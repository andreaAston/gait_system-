import type { PatientGender } from "@/types/database";

export function calculateAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const birthDate = new Date(0);
  birthDate.setUTCFullYear(year, month - 1, day);
  birthDate.setUTCHours(0, 0, 0, 0);

  if (
    birthDate.getUTCFullYear() !== year ||
    birthDate.getUTCMonth() !== month - 1 ||
    birthDate.getUTCDate() !== day
  ) {
    return null;
  }

  const today = new Date();
  let age = today.getUTCFullYear() - year;

  if (
    today.getUTCMonth() < month - 1 ||
    (today.getUTCMonth() === month - 1 && today.getUTCDate() < day)
  ) {
    age -= 1;
  }

  return age < 0 ? null : age;
}

export function formatPatientGender(
  gender: PatientGender | null
): string {
  if (!gender) return "Not provided";
  if (gender === "prefer_not_to_say") return "Prefer not to say";
  return gender.charAt(0).toUpperCase() + gender.slice(1);
}
