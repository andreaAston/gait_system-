import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { LiveReadingsChart } from "@/components/LiveReadingsChart";
import { StatusBadge } from "@/components/StatusBadge";
import {
  getLastReadingTime,
  getPatientAssignmentHistory,
  getPatientById,
} from "@/lib/services/patients";
import { getDeviceReadings } from "@/lib/services/readings";
import { calculateAge, formatPatientGender } from "@/lib/utils/patient";
import type { DeviceAssignment } from "@/types/database";

const patientStatusStyles = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-amber-50 text-amber-700 border-amber-200",
  discharged: "bg-slate-50 text-slate-600 border-slate-200",
} as const;

type ReadingsRange = "live" | "1h" | "24h" | "custom";

function PatientInfoIcon({ name }: { name: "age" | "birth" | "gender" | "device" }) {
  const paths = {
    age: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    birth: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    gender: (
      <>
        <circle cx="10" cy="14" r="6" />
        <path d="m14.5 9.5 6-6M15 3h6v6" />
      </>
    ),
    device: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h3" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      {paths[name]}
    </svg>
  );
}

function parseDateTime(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function assignmentTitle(assignment: DeviceAssignment & {
  device: { label: string | null; device_code: string };
}) {
  const date = new Date(assignment.started_at).toLocaleDateString();
  return `${assignment.device.label ?? assignment.device.device_code} — ${date}${
    assignment.ended_at
      ? ` to ${new Date(assignment.ended_at).toLocaleDateString()}`
      : " (current)"
  }`;
}

export default async function PatientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    assignment?: string;
    range?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [patient, assignments] = await Promise.all([
    getPatientById(id),
    getPatientAssignmentHistory(id),
  ]);

  if (!patient) notFound();

  const assignment =
    assignments.find((item) => item.id === query.assignment) ??
    assignments.find((item) => item.ended_at === null) ??
    assignments[0] ??
    null;
  const activeAssignment = Boolean(assignment && assignment.ended_at === null);
  let requestedRange: ReadingsRange = activeAssignment ? "live" : "24h";
  if (
    query.range === "1h" ||
    query.range === "24h" ||
    query.range === "custom" ||
    (query.range === "live" && activeAssignment)
  ) {
    requestedRange = query.range;
  }
  const now = new Date();
  const rangeEnd = assignment?.ended_at
    ? new Date(assignment.ended_at)
    : now;
  const rangeDurationMs =
    requestedRange === "live"
      ? 15 * 60_000
      : requestedRange === "1h"
        ? 60 * 60_000
        : 24 * 60 * 60_000;

  let fromDate =
    requestedRange === "custom"
      ? parseDateTime(query.from)
      : new Date(rangeEnd.getTime() - rangeDurationMs);
  let toDate =
    requestedRange === "custom" ? parseDateTime(query.to) : rangeEnd;
  let rangeError: string | null = null;

  if (requestedRange === "custom" && (!fromDate || !toDate)) {
    rangeError = "Choose both a valid start and end time.";
  } else if (
    fromDate &&
    toDate &&
    fromDate.getTime() > toDate.getTime()
  ) {
    rangeError = "The start time must be before the end time.";
  }

  if (assignment && fromDate) {
    fromDate = new Date(
      Math.max(fromDate.getTime(), new Date(assignment.started_at).getTime())
    );
  }
  if (assignment?.ended_at && toDate) {
    toDate = new Date(
      Math.min(toDate.getTime(), new Date(assignment.ended_at).getTime())
    );
  }
  if (
    fromDate &&
    toDate &&
    fromDate.getTime() > toDate.getTime() &&
    !rangeError
  ) {
    rangeError = "The selected time range does not overlap this assignment.";
  }

  const canQueryReadings =
    Boolean(assignment && fromDate && toDate) && !rangeError;
  const { points, sensors } =
    canQueryReadings && assignment && fromDate && toDate
      ? await getDeviceReadings(assignment.device_id, {
          fromDate: fromDate.toISOString(),
          toDate: toDate.toISOString(),
          limit: 2000,
        })
      : { points: [], sensors: [] };

  const selectedSensors = sensors.filter((sensor) =>
    ["foot_left", "crutch_left", "foot_right", "crutch_right"].includes(
      sensor.subsystem
    )
  );
  const lastReadingAt =
    assignment && assignment.ended_at === null
      ? await getLastReadingTime(assignment.device_id)
      : null;
  const age = calculateAge(patient.date_of_birth);
  const liveMode =
    activeAssignment && requestedRange === "live";
  const rangeKey = `${assignment?.id ?? "no-assignment"}:${requestedRange}:${fromDate?.toISOString() ?? ""}:${toDate?.toISOString() ?? ""}`;
  const csvFrom =
    fromDate?.toISOString() ?? assignment?.started_at ?? now.toISOString();
  const csvTo =
    toDate?.toISOString() ?? assignment?.ended_at ?? now.toISOString();

  return (
    <AppShell>
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-4">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-8 w-8"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  {patient.full_name}
                </h1>
                <span
                  className={`rounded-full border px-3 py-1 text-sm font-medium capitalize ${patientStatusStyles[patient.status]}`}
                >
                  {patient.status}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-600 sm:text-base">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <PatientInfoIcon name="device" />
                </span>
                <span>
                  {assignment
                    ? `${assignment.device.label ?? assignment.device.device_code}${
                        assignment.crutch_side
                          ? ` · ${assignment.crutch_side} side`
                          : ""
                      }`
                    : "No device assignment recorded"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {assignment?.ended_at === null && assignment && (
              <StatusBadge lastReadingAt={lastReadingAt} />
            )}
            <ExportCsvButton
              points={points}
              sensors={selectedSensors}
              filename={`${patient.full_name.replace(/\s+/g, "_")}_${csvFrom.slice(0, 10)}_to_${csvTo.slice(0, 10)}.csv`}
            />
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          {[
            {
              label: "Age",
              value: age === null ? "Not provided" : `${age} years`,
              icon: "age" as const,
              tone: "bg-violet-50 text-violet-700",
            },
            {
              label: "Date of birth",
              value: patient.date_of_birth
                ? new Date(
                    `${patient.date_of_birth}T00:00:00`
                  ).toLocaleDateString()
                : "Not provided",
              icon: "birth" as const,
              tone: "bg-sky-50 text-sky-700",
            },
            {
              label: "Gender",
              value: formatPatientGender(patient.gender),
              icon: "gender" as const,
              tone: "bg-rose-50 text-rose-700",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 sm:gap-3 sm:p-3"
            >
              <span
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9 ${item.tone}`}
              >
                <PatientInfoIcon name={item.icon} />
              </span>
              <div className="min-w-0">
                <dt className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">
                  {item.label}
                </dt>
                <dd className="mt-0.5 truncate text-xs font-semibold text-slate-900 sm:text-sm">
                  {item.value}
                </dd>
              </div>
            </div>
          ))}
        </dl>
        {patient.notes && (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-slate-700">
            {patient.notes}
          </p>
        )}
      </section>

      {assignments.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-600">
            This patient has no device assignment yet, so there are no gait
            readings to display.
          </p>
          <Link
            href="/devices"
            className="mt-3 inline-block text-sm font-medium text-slate-900 underline underline-offset-4"
          >
            Go to Devices to assign one
          </Link>
        </div>
      ) : (
        <>
          <form
            method="get"
            className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
          >
            {assignments.length > 1 && (
              <div>
                <label
                  htmlFor="assignment"
                  className="mb-1 block text-xs font-medium text-slate-500"
                >
                  Device assignment
                </label>
                <select
                  id="assignment"
                  name="assignment"
                  defaultValue={assignment?.id}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {assignments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {assignmentTitle(item)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label
                htmlFor="range"
                className="mb-1 block text-xs font-medium text-slate-500"
              >
                Time range
              </label>
              <select
                id="range"
                name="range"
                defaultValue={requestedRange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {activeAssignment && (
                  <option value="live">Live · last 15 minutes</option>
                )}
                <option value="1h">Last 1 hour</option>
                <option value="24h">Last 24 hours</option>
                <option value="custom">Custom range</option>
              </select>
            </div>
            {requestedRange === "custom" && (
              <>
                <div>
                  <label
                    htmlFor="from"
                    className="mb-1 block text-xs font-medium text-slate-500"
                  >
                    From
                  </label>
                  <input
                    id="from"
                    name="from"
                    type="datetime-local"
                    required
                    defaultValue={
                      fromDate ? toDateTimeLocalValue(fromDate) : query.from
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="to"
                    className="mb-1 block text-xs font-medium text-slate-500"
                  >
                    To
                  </label>
                  <input
                    id="to"
                    name="to"
                    type="datetime-local"
                    required
                    defaultValue={
                      toDate ? toDateTimeLocalValue(toDate) : query.to
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </>
            )}
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Apply range
            </button>
          </form>

          {rangeError && (
            <p role="alert" className="mb-4 text-sm text-red-700">
              {rangeError}
            </p>
          )}
          {assignment && canQueryReadings && (
            <LiveReadingsChart
              deviceId={assignment.device_id}
              initialPoints={points}
              sensors={selectedSensors}
              rangeKey={rangeKey}
              live={liveMode}
            />
          )}
        </>
      )}
    </AppShell>
  );
}
