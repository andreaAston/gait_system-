import { createClient } from "@/lib/supabase/server";
import type { Device, DeviceAssignment, Patient } from "@/types/database";

export interface DeviceWithAssignment extends Device {
  active_assignment: (DeviceAssignment & { patient: Patient }) | null;
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
  }));
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
