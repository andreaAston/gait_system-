import {
  getDeviceStatus,
  deviceStatusConfig,
} from "@/lib/utils/device-status";

export function StatusBadge({
  lastReadingAt,
}: {
  lastReadingAt: string | null;
}) {
  const status = getDeviceStatus(lastReadingAt);
  const config = deviceStatusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.textClass}`}
    >
      <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
      {config.label}
    </span>
  );
}
