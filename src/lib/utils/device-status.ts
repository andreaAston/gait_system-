export type DeviceStatus = "online" | "stale" | "offline";

const ONLINE_THRESHOLD_MS = 10 * 1000; // last reading within 10s = online
const STALE_THRESHOLD_MS = 2 * 60 * 1000; // within 2 min = stale, else offline

export function getDeviceStatus(lastReadingAt: string | null): DeviceStatus {
  if (!lastReadingAt) return "offline";

  const ageMs = Date.now() - new Date(lastReadingAt).getTime();

  if (ageMs <= ONLINE_THRESHOLD_MS) return "online";
  if (ageMs <= STALE_THRESHOLD_MS) return "stale";
  return "offline";
}

export const deviceStatusConfig: Record<
  DeviceStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  online: {
    label: "Live",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-700",
  },
  stale: {
    label: "Idle",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700",
  },
  offline: {
    label: "Offline",
    dotClass: "bg-slate-300",
    textClass: "text-slate-500",
  },
};
