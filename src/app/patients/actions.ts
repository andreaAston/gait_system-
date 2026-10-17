"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { PatientGender } from "@/types/database";
import { calculateAge } from "@/lib/utils/patient";

const patientGenders = [
  "female",
  "male",
  "other",
  "prefer_not_to_say",
] as const satisfies readonly PatientGender[];

function isPatientGender(value: FormDataEntryValue | null): value is PatientGender {
  return (
    typeof value === "string" &&
    patientGenders.some((patientGender) => patientGender === value)
  );
}

export async function createPatient(formData: FormData) {
  const supabase = await createClient();

  const fullName = formData.get("full_name");
  const dateOfBirth = formData.get("date_of_birth");
  const gender = formData.get("gender");
  const notes = formData.get("notes");

  if (
    typeof fullName !== "string" ||
    !fullName.trim() ||
    typeof dateOfBirth !== "string" ||
    calculateAge(dateOfBirth) === null ||
    !isPatientGender(gender) ||
    (notes !== null && typeof notes !== "string")
  ) {
    throw new Error("Enter a valid name, date of birth, and gender.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("patients")
    .insert({
      full_name: fullName.trim(),
      date_of_birth: dateOfBirth,
      gender,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
      status: "inactive",
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
