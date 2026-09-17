import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { getPatientsWithAssignments } from "@/lib/services/patients";

const statusStyles: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  healed: "bg-blue-50 text-blue-700 border-blue-200",
  discharged: "bg-slate-50 text-slate-600 border-slate-200",
};

export default async function PatientsPage() {
  const patients = await getPatientsWithAssignments();

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-900">All Patients</h1>
        <Link
          href="/patients/new"
          className="text-sm font-medium bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          + New Patient
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Device</th>
              <th className="px-5 py-3 font-medium">Registered</th>
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
              </tr>
            ))}
            {patients.length === 0 && (
              <tr>
                <td
                  colSpan={4}
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
