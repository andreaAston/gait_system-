import { AppShell } from "@/components/AppShell";

const workflow = [
  {
    number: "01",
    title: "Register a patient",
    description:
      "Add the patient's name, date of birth, gender, and optional clinical notes. Age is calculated from the date of birth.",
  },
  {
    number: "02",
    title: "Assign a device",
    description:
      "Choose an available device and select the crutch side for an eligible patient. Each device can have only one active patient assignment at a time.",
  },
  {
    number: "03",
    title: "Receive gait readings",
    description:
      "The assigned device sends timestamped gait readings. Sensor values are associated with the patient through the device's active assignment.",
  },
  {
    number: "04",
    title: "Review progress",
    description:
      "Open a patient's data to see the heel, midfoot, forefoot, crutch vibration, and handle-load lines together over time. Select a live, preset, or custom date range; older assignments can be reviewed and exported as CSV.",
  },
];

const statuses = [
  {
    title: "Active",
    description: "The patient currently has an active device assignment.",
    style: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    title: "Discharged",
    description:
      "The patient had a device assignment, and that assignment has ended. A new active assignment makes them Active again.",
    style: "bg-slate-50 text-slate-600 border-slate-200",
  },
  {
    title: "Inactive",
    description:
      "The patient has been registered but has never had a device assignment.",
    style: "bg-amber-50 text-amber-700 border-amber-200",
  },
];

export default function SystemInfoPage() {
  return (
    <AppShell>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Help and reference
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          How the GAIT system works
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          GAIT connects patient records with wearable gait-monitoring devices,
          making it easier to review incoming readings and follow each
          patient&apos;s device history.
        </p>
      </div>

      <section aria-labelledby="workflow-heading" className="mb-8">
        <h2
          id="workflow-heading"
          className="mb-4 text-lg font-semibold text-slate-900"
        >
          The workflow
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2">
          {workflow.map((step) => (
            <li
              key={step.number}
              className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-sm font-semibold text-cyan-700">
                {step.number}
              </span>
              <div>
                <h3 className="font-medium text-slate-900">{step.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="status-heading" className="mb-8">
        <h2
          id="status-heading"
          className="mb-4 text-lg font-semibold text-slate-900"
        >
          Patient statuses
        </h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {statuses.map((status, index) => (
            <div
              key={status.title}
              className={`flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:gap-5 ${
                index > 0 ? "border-t border-slate-100" : ""
              }`}
            >
              <span
                className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${status.style}`}
              >
                {status.title}
              </span>
              <p className="text-sm leading-6 text-slate-600">
                {status.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="data-heading">
        <h2
          id="data-heading"
          className="mb-4 text-lg font-semibold text-slate-900"
        >
          Data and access
        </h2>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <ul className="list-inside list-disc space-y-2 text-sm leading-6 text-slate-600">
            <li>
              Patient records, device assignments, and sensor readings are
              stored in the connected Supabase database.
            </li>
            <li>
              Patient age is calculated from the stored date of birth and is
              not stored as a separate value.
            </li>
            <li>
              Live readings are shown for the current assignment; historical
              readings can be reviewed by assignment and date range.
            </li>
            <li>
              Sign-in is managed through Supabase authentication. Database
              access is subject to the project&apos;s row-level security
              policies.
            </li>
          </ul>
        </div>
      </section>
    </AppShell>
  );
}
