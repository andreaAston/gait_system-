import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { LiveReadingsChart } from "@/components/LiveReadingsChart";
import { getPatientById, getLastReadingTime } from "@/lib/services/patients";
import { getDeviceReadings } from "@/lib/services/readings";
import { calculateAge, formatPatientGender } from "@/lib/utils/patient";

const patientStatusStyles = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-amber-50 text-amber-700 border-amber-200",
  discharged: "bg-slate-50 text-slate-600 border-slate-200",
} as const;

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getPatientById(id);

  if (!patient) notFound();

  const assignment = patient.active_assignment;
  const lastReadingAt = assignment
    ? await getLastReadingTime(assignment.device_id)
    : null;

  const { points, sensors } = assignment
    ? await getDeviceReadings(assignment.device_id, { sinceMinutes: 15 })
    : { points: [], sensors: [] };
  const age = calculateAge(patient.date_of_birth);

  return (
    <AppShell>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900">
              {patient.full_name}
            </h1>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${patientStatusStyles[patient.status]}`}
            >
              {patient.status}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {assignment
              ? `Assigned device: ${assignment.device.label ?? assignment.device.device_code}`
              : "No device currently assigned"}
          </p>
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-slate-500">Age</dt>
              <dd className="mt-0.5 text-slate-900">
                {age === null ? "Not provided" : `${age} years`}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">
                Date of birth
              </dt>
              <dd className="mt-0.5 text-slate-900">
                {patient.date_of_birth
                  ? new Date(
                      `${patient.date_of_birth}T00:00:00`
                    ).toLocaleDateString()
                  : "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Gender</dt>
              <dd className="mt-0.5 text-slate-900">
                {formatPatientGender(patient.gender)}
              </dd>
            </div>
          </dl>
          {patient.notes && (
            <p className="text-sm text-slate-600 mt-2 max-w-lg">
              {patient.notes}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {assignment && <StatusBadge lastReadingAt={lastReadingAt} />}
          <a
            href={`/patients/${id}/history`}
            className="text-sm font-medium border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            View History
          </a>
        </div>
      </div>

      {!assignment ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-slate-500 text-sm">
            No device is assigned to this patient yet.
          </p>
          <a
            href="/devices"
            className="inline-block mt-3 text-sm font-medium text-slate-900 underline underline-offset-4"
          >
            Go to Devices to assign one
          </a>
        </div>
      ) : points.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-slate-500 text-sm">
            No readings received yet from this device in the last 15 minutes.
          </p>
        </div>
      ) : (
        <LiveReadingsChart
          deviceId={assignment.device_id}
          initialPoints={points}
          sensors={sensors}
        />
      )}
    </AppShell>
  );
}
