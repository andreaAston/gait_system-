import { SensorLineChart } from "@/components/SensorLineChart";
import type { ChartPoint } from "@/lib/services/readings";
import type { Sensor } from "@/types/database";

export function LiveReadingsChart({
  deviceId,
  initialPoints,
  sensors,
  rangeKey,
  live,
}: {
  deviceId: string;
  initialPoints: ChartPoint[];
  sensors: Sensor[];
  rangeKey: string;
  live: boolean;
}) {
  const lastPointAt = initialPoints.at(-1)?.recorded_at ?? "empty";

  return (
    <SensorLineChart
      key={`${rangeKey}:${lastPointAt}`}
      deviceId={deviceId}
      initialPoints={initialPoints}
      sensors={sensors}
      live={live}
    />
  );
}
