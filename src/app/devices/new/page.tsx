import { AppShell } from "@/components/AppShell";
import { createDevice } from "../actions";

export default function NewDevicePage() {
  return (
    <AppShell>
      <div className="max-w-lg">
        <h1 className="text-xl font-semibold text-slate-900 mb-1">
          Register New Device
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Use the device code the master ESP32 identifies itself with when it
          sends data (e.g. its MAC address).
        </p>

        <form
          action={createDevice}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div>
            <label
              htmlFor="device_code"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Device code
            </label>
            <input
              id="device_code"
              name="device_code"
              type="text"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="e.g. ESP32-MASTER-01 or AA:BB:CC:DD:EE:FF"
            />
          </div>

          <div>
            <label
              htmlFor="label"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Label <span className="text-slate-400">(optional)</span>
            </label>
            <input
              id="label"
              name="label"
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="e.g. Kit A"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-slate-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Register Device
          </button>
        </form>
      </div>
    </AppShell>
  );
}
