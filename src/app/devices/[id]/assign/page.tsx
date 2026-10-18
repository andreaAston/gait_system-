import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import {
  getDeviceById,
  getAssignablePatients,
} from "@/lib/services/devices";
import { assignDeviceToPatient } from "../../actions";

export default async function AssignDevicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const device = await getDeviceById(id);
  if (!device) notFound();

  const availablePatients = await getAssignablePatients();

  async function handleAssign(formData: FormData) {
    "use server";
    await assignDeviceToPatient(id, formData);
  }

  return (
    <AppShell>
      <div className="max-w-lg">
        <h1 className="text-xl font-semibold text-slate-900 mb-1">
          Assign {device.label ?? device.device_code}
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Choose which patient this device will track. Readings sent by this
          device will be attributed to them from this moment on. Select the
          crutch side so the matching foot and crutch sensors can be graphed.
        </p>

        {availablePatients.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <p className="text-sm text-slate-500">
              No inactive or discharged patients available to assign.
            </p>
            <Link
              href="/patients/new"
              className="inline-block mt-3 text-sm font-medium text-slate-900 underline underline-offset-4"
            >
              Register a new patient
            </Link>
          </div>
        ) : (
          <form
            action={handleAssign}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <div>
              <label
                htmlFor="patient_id"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Patient
              </label>
              <select
                id="patient_id"
                name="patient_id"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">Select a patient...</option>
                {availablePatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="crutch_side"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Crutch side
              </label>
              <select
                id="crutch_side"
                name="crutch_side"
                required
                defaultValue=""
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="" disabled>
                  Select the side being used
                </option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Assign Device
            </button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
