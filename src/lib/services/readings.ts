import { createClient } from "@/lib/supabase/server";
import type { Sensor } from "@/types/database";

export interface ChartPoint {
  recorded_at: string;
  [sensorLabel: string]: string | number;
}

/**
 * Fetch readings for a device, pivoted into one row per timestamp
 * with each sensor as a column — ready for Recharts.
 *
 * `sinceMinutes` limits how far back to look from now (used by the
 * live view). `fromDate`/`toDate` (ISO strings) select an arbitrary
 * historical window instead (used by the history view) — if both
 * are provided, the explicit range wins over sinceMinutes.
 */
export async function getDeviceReadings(
  deviceId: string,
  {
    sinceMinutes,
    fromDate,
    toDate,
    limit,
  }: {
    sinceMinutes?: number;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  } = {}
): Promise<{ points: ChartPoint[]; sensors: Sensor[] }> {
  const supabase = await createClient();

  const { data: sensors, error: sensorsError } = await supabase
    .from("sensors")
    .select("*")
    .order("subsystem")
    .order("sensor_type");

  if (sensorsError) throw sensorsError;

  let query = supabase
    .from("gait_readings")
    .select("id, recorded_at, reading_values(sensor_id, value)")
    .eq("device_id", deviceId)
    .order("recorded_at", { ascending: true });

  if (fromDate || toDate) {
    if (fromDate) query = query.gte("recorded_at", fromDate);
    if (toDate) query = query.lte("recorded_at", toDate);
  } else if (sinceMinutes) {
    const since = new Date(Date.now() - sinceMinutes * 60_000).toISOString();
    query = query.gte("recorded_at", since);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data: readings, error: readingsError } = await query;
  if (readingsError) throw readingsError;

  const sensorById = new Map((sensors as Sensor[]).map((s) => [s.id, s]));

  const points: ChartPoint[] = (readings ?? []).map((r) => {
    const point: ChartPoint = { recorded_at: r.recorded_at };
    for (const rv of r.reading_values as {
      sensor_id: string;
      value: number;
    }[]) {
      const sensor = sensorById.get(rv.sensor_id);
      if (sensor) {
        const key = `${sensor.subsystem}__${sensor.sensor_type}__${sensor.label}`;
        point[key] = rv.value;
      }
    }
    return point;
  });

  return { points, sensors: sensors as Sensor[] };
}
