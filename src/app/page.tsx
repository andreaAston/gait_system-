import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import {
  getPatientsWithAssignments,
  getLastReadingTime,
} from "@/lib/services/patients";

export default async function HomePage() {
  const patients = await getPatientsWithAssignments();
  const activePatients = patients.filter((p) => p.status === "active");

  // Fetch last-reading time for each actively-tracked patient's device.
  const withStatus = await Promise.all(
    activePatients.map(async (p) => ({
      patient: p,
      lastReadingAt: p.active_assignment
        ? await getLastReadingTime(p.active_assignment.device_id)
        : null,
    }))
  );

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Active Monitoring
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Patients currently wearing a tracked device
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/patients/new"
            className="text-sm font-medium bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            + New Patient
          </Link>
        </div>
      </div>

      {withStatus.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-slate-500 text-sm">
            No patients are currently being tracked.
          </p>
          <Link
            href="/patients/new"
            className="inline-block mt-3 text-sm font-medium text-slate-900 underline underline-offset-4"
          >
            Register a patient to get started
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {withStatus.map(({ patient, lastReadingAt }) => (
            <Link
              key={patient.id}
              href={`/patients/${patient.id}`}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <h2 className="font-medium text-slate-900">
                  {patient.full_name}
                </h2>
                <StatusBadge lastReadingAt={lastReadingAt} />
              </div>
              <p className="text-sm text-slate-500">
                {patient.active_assignment?.device.label ??
                  patient.active_assignment?.device.device_code ??
                  "No device assigned"}
              </p>
              {lastReadingAt && (
                <p className="text-xs text-slate-400 mt-2">
                  Last reading {new Date(lastReadingAt).toLocaleTimeString()}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
