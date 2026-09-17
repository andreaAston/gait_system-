import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { getDevicesWithAssignments } from "@/lib/services/devices";
import { endDeviceAssignment } from "./actions";

export default async function DevicesPage() {
  const devices = await getDevicesWithAssignments();

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Devices</h1>
        <Link
          href="/devices/new"
          className="text-sm font-medium bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          + Register Device
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {devices.map((d) => (
          <div
            key={d.id}
            className="bg-white border border-slate-200 rounded-xl p-5"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h2 className="font-medium text-slate-900">
                  {d.label ?? d.device_code}
                </h2>
                <p className="text-xs text-slate-400 font-mono">
                  {d.device_code}
                </p>
              </div>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                  d.active_assignment
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-50 text-slate-500 border-slate-200"
                }`}
              >
                {d.active_assignment ? "Assigned" : "Available"}
              </span>
            </div>

            {d.active_assignment ? (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  Tracking{" "}
                  <Link
                    href={`/patients/${d.active_assignment.patient.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {d.active_assignment.patient.full_name}
                  </Link>
                </p>
                <form
                  action={async () => {
                    "use server";
                    await endDeviceAssignment(
                      d.active_assignment!.id,
                      "manually_ended"
                    );
                  }}
                >
                  <button
                    type="submit"
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    End assignment
                  </button>
                </form>
              </div>
            ) : (
              <Link
                href={`/devices/${d.id}/assign`}
                className="inline-block mt-3 text-sm font-medium text-slate-900 underline underline-offset-4"
              >
                Assign to a patient
              </Link>
            )}
          </div>
        ))}

        {devices.length === 0 && (
          <div className="col-span-full bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400 text-sm">
            No devices registered yet.
          </div>
        )}
      </div>
    </AppShell>
  );
}
