"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createDevice(formData: FormData) {
  const supabase = await createClient();

  const deviceCode = formData.get("device_code") as string;
  const label = formData.get("label") as string;

  const { error } = await supabase.from("devices").insert({
    device_code: deviceCode,
    label: label || null,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/devices");
  redirect(`/devices`);
}

export async function assignDeviceToPatient(
  deviceId: string,
  formData: FormData
) {
  const patientId = formData.get("patient_id");
  const crutchSide = formData.get("crutch_side");
  if (typeof patientId !== "string" || !patientId) {
    throw new Error("Select a patient before assigning the device.");
  }
  if (crutchSide !== "left" && crutchSide !== "right") {
    throw new Error("Select the left or right crutch side.");
  }

  const supabase = await createClient();

  // The unique index on device_assignments (device_id where ended_at
  // is null) protects against double-assignment at the DB level, but
  // we check here too for a clean error message instead of a raw
  // constraint violation.
  const { data: existing, error: lookupError } = await supabase
    .from("device_assignments")
    .select("id")
    .eq("device_id", deviceId)
    .is("ended_at", null)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);

  if (existing) {
    throw new Error(
      "This device is already assigned to a patient. End that assignment first."
    );
  }

  const { error } = await supabase.from("device_assignments").insert({
    device_id: deviceId,
    patient_id: patientId,
    crutch_side: crutchSide,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/devices");
  revalidatePath("/patients");
  revalidatePath("/");
  redirect(`/devices`);
}

export async function endDeviceAssignment(assignmentId: string, reason: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("device_assignments")
    .update({ ended_at: new Date().toISOString(), ended_reason: reason })
    .eq("id", assignmentId)
    .is("ended_at", null);

  if (error) throw new Error(error.message);

  revalidatePath("/devices");
  revalidatePath("/patients");
  revalidatePath("/");
}
