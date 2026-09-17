"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createPatient(formData: FormData) {
  const supabase = await createClient();

  const fullName = formData.get("full_name") as string;
  const notes = formData.get("notes") as string;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("patients")
    .insert({
      full_name: fullName,
      notes: notes || null,
      status: "active",
      registered_by: user?.id ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/patients");
  revalidatePath("/");
  redirect(`/patients/${data.id}`);
}

export async function updatePatientStatus(
  patientId: string,
  status: "active" | "healed" | "discharged"
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("patients")
    .update({ status })
    .eq("id", patientId);

  if (error) throw new Error(error.message);

  revalidatePath(`/patients/${patientId}`);
  revalidatePath("/patients");
  revalidatePath("/");
}
