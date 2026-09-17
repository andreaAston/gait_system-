import { AppShell } from "@/components/AppShell";
import { createPatient } from "../actions";

export default function NewPatientPage() {
  return (
    <AppShell>
      <div className="max-w-lg">
        <h1 className="text-xl font-semibold text-slate-900 mb-1">
          Register New Patient
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          A device can be assigned to them afterward from the Devices page.
        </p>

        <form
          action={createPatient}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div>
            <label
              htmlFor="full_name"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Full name
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="e.g. Andrea Banda"
            />
          </div>

          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Notes <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="Injury details, rehab plan, etc."
            />
          </div>

          <button
            type="submit"
            className="w-full bg-slate-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Register Patient
          </button>
        </form>
      </div>
    </AppShell>
  );
}
