import { SensorLineChart } from "@/components/SensorLineChart";
import type { ChartPoint } from "@/lib/services/readings";
import type { Sensor } from "@/types/database";

export function HistoryChart({
  points,
  sensors,
  rangeKey,
}: {
  points: ChartPoint[];
  sensors: Sensor[];
  rangeKey: string;
}) {
  return (
    <SensorLineChart
      key={rangeKey}
      initialPoints={points}
      sensors={sensors}
    />
  );
}
