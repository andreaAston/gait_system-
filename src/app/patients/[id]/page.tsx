import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { LiveReadingsChart } from "@/components/LiveReadingsChart";
import { getPatientById, getLastReadingTime } from "@/lib/services/patients";
import { getDeviceReadings } from "@/lib/services/readings";
import { updatePatientStatus } from "../actions";

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

  async function markHealed() {
    "use server";
    await updatePatientStatus(id, "healed");
  }

  return (
    <AppShell>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900">
              {patient.full_name}
            </h1>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 capitalize">
              {patient.status}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {assignment
              ? `Assigned device: ${assignment.device.label ?? assignment.device.device_code}`
              : "No device currently assigned"}
          </p>
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
          {patient.status === "active" && assignment && (
            <form action={markHealed}>
              <button
                type="submit"
                className="text-sm font-medium border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Mark as Healed
              </button>
            </form>
          )}
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
