import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { getPatientsWithAssignments } from "@/lib/services/patients";
import { calculateAge, formatPatientGender } from "@/lib/utils/patient";
import type { PatientStatus } from "@/types/database";

const statusStyles: Record<PatientStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-amber-50 text-amber-700 border-amber-200",
  discharged: "bg-slate-50 text-slate-600 border-slate-200",
};

const statusOrder: Record<PatientStatus, number> = {
  active: 0,
  discharged: 1,
  inactive: 2,
};

export default async function PatientsPage() {
  const patients = (await getPatientsWithAssignments()).sort(
    (first, second) =>
      statusOrder[first.status] - statusOrder[second.status] ||
      second.registered_at.localeCompare(first.registered_at)
  );

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Patients</h1>
        <Link
          href="/patients/new"
          className="text-sm font-medium bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          + New Patient
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Age</th>
              <th className="px-5 py-3 font-medium">Gender</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Device</th>
              <th className="px-5 py-3 font-medium">Registered</th>
              <th className="px-5 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr
                key={p.id}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
              >
                <td className="px-5 py-3">
                  <Link
                    href={`/patients/${p.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {p.full_name}
                  </Link>
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {calculateAge(p.date_of_birth) ?? "—"}
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {formatPatientGender(p.gender)}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${
                      statusStyles[p.status]
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {p.active_assignment?.device.label ??
                    p.active_assignment?.device.device_code ??
                    "—"}
                </td>
                <td className="px-5 py-3 text-slate-500">
                  {new Date(p.registered_at).toLocaleDateString()}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/patients/${p.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      className="h-4 w-4"
                    >
                      <path d="M1.8 10s3-5.5 8.2-5.5 8.2 5.5 8.2 5.5-3 5.5-8.2 5.5S1.8 10 1.8 10Z" />
                      <circle cx="10" cy="10" r="2.2" />
                    </svg>
                    View data
                  </Link>
                </td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-10 text-center text-slate-400"
                >
                  No patients registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
