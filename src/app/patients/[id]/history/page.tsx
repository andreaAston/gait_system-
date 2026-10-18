import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { HistoryChart } from "@/components/HistoryChart";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import {
  getPatientById,
  getPatientAssignmentHistory,
} from "@/lib/services/patients";
import { getDeviceReadings } from "@/lib/services/readings";

function toDateInputValue(iso: string) {
  return new Date(iso).toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm
}

export default async function PatientHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    assignment?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const { id } = await params;
  const { assignment: assignmentIdParam, from, to } = await searchParams;

  const patient = await getPatientById(id);
  if (!patient) notFound();

  const assignments = await getPatientAssignmentHistory(id);

  if (assignments.length === 0) {
    return (
      <AppShell>
        <BackLink patientId={id} />
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center mt-4">
          <p className="text-slate-500 text-sm">
            This patient has never been assigned a device, so there is no
            history to show yet.
          </p>
        </div>
      </AppShell>
    );
  }

  // Default to the most recent assignment (could be the active one).
  const selectedAssignment =
    assignments.find((a) => a.id === assignmentIdParam) ?? assignments[0];

  // Default date range: the full span of the selected assignment.
  const defaultFrom = selectedAssignment.started_at;
  const defaultTo = selectedAssignment.ended_at ?? new Date().toISOString();

  const fromDate = from ? new Date(from).toISOString() : defaultFrom;
  const toDate = to ? new Date(to).toISOString() : defaultTo;

  const { points, sensors } = await getDeviceReadings(
    selectedAssignment.device_id,
    { fromDate, toDate }
  );
  const selectedSensors = sensors.filter((sensor) =>
    ["foot_left", "crutch_left", "foot_right", "crutch_right"].includes(
      sensor.subsystem
    )
  );

  return (
    <AppShell>
      <BackLink patientId={id} />

      <div className="flex items-center justify-between mt-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {patient.full_name} — History
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {points.length} reading{points.length === 1 ? "" : "s"} in this
            range
          </p>
        </div>
        <ExportCsvButton
          points={points}
          sensors={selectedSensors}
          filename={`${patient.full_name.replace(/\s+/g, "_")}_${fromDate.slice(0, 10)}_to_${toDate.slice(0, 10)}.csv`}
        />
      </div>

      <form
        method="get"
        className="bg-white border border-slate-200 rounded-xl p-4 mb-6 flex flex-wrap items-end gap-4"
      >
        {assignments.length > 1 && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Device period
            </label>
            <select
              name="assignment"
              defaultValue={selectedAssignment.id}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.device.label ?? a.device.device_code} —{" "}
                  {new Date(a.started_at).toLocaleDateString()}
                  {a.ended_at
                    ? ` to ${new Date(a.ended_at).toLocaleDateString()}`
                    : " (current)"}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            From
          </label>
          <input
            type="datetime-local"
            name="from"
            defaultValue={toDateInputValue(fromDate)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            To
          </label>
          <input
            type="datetime-local"
            name="to"
            defaultValue={toDateInputValue(toDate)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <button
          type="submit"
          className="text-sm font-medium bg-slate-900 text-white px-4 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          Apply
        </button>
      </form>

      <HistoryChart
        points={points}
        sensors={selectedSensors}
        rangeKey={`${selectedAssignment.id}:${fromDate}:${toDate}`}
      />
    </AppShell>
  );
}

function BackLink({ patientId }: { patientId: string }) {
  return (
    <Link
      href={`/patients/${patientId}`}
      className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
    >
      ← Back to patient
    </Link>
  );
}
