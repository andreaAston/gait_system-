import { createClient } from "@/lib/supabase/server";
import type { Patient, PatientWithAssignment } from "@/types/database";

/**
 * Fetch all patients, each with their currently active device
 * assignment (if any) joined in. Used on the dashboard home and
 * the patients list page.
 */
export async function getPatientsWithAssignments(): Promise<
  PatientWithAssignment[]
> {
  const supabase = await createClient();

  const { data: patients, error } = await supabase
    .from("patients")
    .select("*")
    .order("registered_at", { ascending: false });

  if (error) throw error;
  if (!patients) return [];

  // Fetch active assignments (ended_at IS NULL) with their device, joined.
  const { data: assignments, error: assignmentsError } = await supabase
    .from("device_assignments")
    .select("*, device:devices(*)")
    .is("ended_at", null);

  if (assignmentsError) throw assignmentsError;

  const assignmentByPatient = new Map(
    (assignments ?? []).map((a) => [a.patient_id, a])
  );

  return (patients as Patient[]).map((p) => ({
    ...p,
    active_assignment: assignmentByPatient.get(p.id) ?? null,
  }));
}

export async function getPatientById(
  id: string
): Promise<PatientWithAssignment | null> {
  const supabase = await createClient();

  const { data: patient, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;

  const { data: assignment } = await supabase
    .from("device_assignments")
    .select("*, device:devices(*)")
    .eq("patient_id", id)
    .is("ended_at", null)
    .maybeSingle();

  return {
    ...(patient as Patient),
    active_assignment: assignment ?? null,
  };
}

/**
 * Full history of every device assignment a patient has ever had
 * (past and current), most recent first. Used on the history page
 * since a patient may have worn more than one physical device
 * over time (e.g. a replacement kit).
 */
export async function getPatientAssignmentHistory(patientId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("device_assignments")
    .select("*, device:devices(*)")
    .eq("patient_id", patientId)
    .order("started_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * The timestamp of the most recent reading for a given device.
 * Used to show an "online / stale" indicator on the dashboard.
 */
export async function getLastReadingTime(
  deviceId: string
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("gait_readings")
    .select("recorded_at")
    .eq("device_id", deviceId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.recorded_at;
}
