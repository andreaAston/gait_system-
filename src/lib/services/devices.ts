import { createClient } from "@/lib/supabase/server";
import type { Device, DeviceAssignment, Patient } from "@/types/database";
import { isGatewayOnline } from "@/lib/utils/device-status";

export interface DeviceWithAssignment extends Device {
  active_assignment: (DeviceAssignment & { patient: Patient }) | null;
  is_online: boolean;
}

export async function getDevicesWithAssignments(): Promise<
  DeviceWithAssignment[]
> {
  const supabase = await createClient();

  const { data: devices, error } = await supabase
    .from("devices")
    .select("*")
    .order("registered_at", { ascending: false });

  if (error) throw error;
  if (!devices) return [];

  const { data: assignments, error: assignmentsError } = await supabase
    .from("device_assignments")
    .select("*, patient:patients(*)")
    .is("ended_at", null);

  if (assignmentsError) throw assignmentsError;

  const assignmentByDevice = new Map(
    (assignments ?? []).map((a) => [a.device_id, a])
  );

  return (devices as Device[]).map((d) => ({
    ...d,
    active_assignment: assignmentByDevice.get(d.id) ?? null,
    is_online: isGatewayOnline(d.last_seen_at),
  }));
}

export async function getOnlineDeviceCount(): Promise<number> {
  const supabase = await createClient();
  const { data: devices, error } = await supabase
    .from("devices")
    .select("last_seen_at");

  if (error) throw error;
  return (devices ?? []).filter((device) =>
    isGatewayOnline(device.last_seen_at)
  ).length;
}

export async function getDeviceById(
  id: string
): Promise<DeviceWithAssignment | null> {
  const supabase = await createClient();

  const { data: device, error } = await supabase
    .from("devices")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;

  const { data: assignment } = await supabase
    .from("device_assignments")
    .select("*, patient:patients(*)")
    .eq("device_id", id)
    .is("ended_at", null)
    .maybeSingle();

  return {
    ...(device as Device),
    active_assignment: assignment ?? null,
    is_online: isGatewayOnline((device as Device).last_seen_at),
  };
}

export async function getAssignablePatients(): Promise<Patient[]> {
  const supabase = await createClient();

  const { data: patients, error } = await supabase
    .from("patients")
    .select("*")
    .in("status", ["inactive", "discharged"]);

  if (error) throw error;
  if (!patients) return [];

  const { data: assignments, error: assignmentsError } = await supabase
    .from("device_assignments")
    .select("patient_id")
    .is("ended_at", null);

  if (assignmentsError) throw assignmentsError;

  const assignedPatientIds = new Set(
    (assignments ?? []).map((a) => a.patient_id)
  );

  return (patients as Patient[]).filter((p) => !assignedPatientIds.has(p.id));
}
