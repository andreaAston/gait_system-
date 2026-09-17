"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import type { Sensor } from "@/types/database";
import type { ChartPoint } from "@/lib/services/readings";

const SUBSYSTEM_LABELS: Record<string, string> = {
  foot_left: "Left Foot Pressure",
  foot_right: "Right Foot Pressure",
  crutch_left: "Left Crutch",
  crutch_right: "Right Crutch",
};

const LINE_COLORS = [
  "#0f172a",
  "#dc2626",
  "#0891b2",
  "#7c3aed",
  "#ea580c",
];

function sensorKey(s: Sensor) {
  return `${s.subsystem}__${s.sensor_type}__${s.label}`;
}

export function LiveReadingsChart({
  deviceId,
  initialPoints,
  sensors,
  maxPoints = 60,
}: {
  deviceId: string;
  initialPoints: ChartPoint[];
  sensors: Sensor[];
  maxPoints?: number;
}) {
  const [points, setPoints] = useState<ChartPoint[]>(initialPoints);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`device-${deviceId}-readings`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "gait_readings",
          filter: `device_id=eq.${deviceId}`,
        },
        async (payload) => {
          const readingId = payload.new.id as number;
          const recordedAt = payload.new.recorded_at as string;

          // Fetch the associated sensor values for this new reading.
          const { data: values } = await supabase
            .from("reading_values")
            .select("sensor_id, value")
            .eq("reading_id", readingId);

          const sensorById = new Map(sensors.map((s) => [s.id, s]));
          const point: ChartPoint = { recorded_at: recordedAt };
          for (const v of values ?? []) {
            const sensor = sensorById.get(v.sensor_id);
            if (sensor) point[sensorKey(sensor)] = v.value;
          }

          setPoints((prev) => {
            const next = [...prev, point];
            return next.length > maxPoints
              ? next.slice(next.length - maxPoints)
              : next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deviceId, sensors, maxPoints]);

  const bySubsystem = useMemo(() => {
    const groups = new Map<string, Sensor[]>();
    for (const s of sensors) {
      const list = groups.get(s.subsystem) ?? [];
      list.push(s);
      groups.set(s.subsystem, list);
    }
    return groups;
  }, [sensors]);

  const formattedPoints = points.map((p) => ({
    ...p,
    timeLabel: new Date(p.recorded_at).toLocaleTimeString(),
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {Array.from(bySubsystem.entries()).map(([subsystem, subsystemSensors]) => (
        <div
          key={subsystem}
          className="bg-white border border-slate-200 rounded-xl p-4"
        >
          <h3 className="text-sm font-medium text-slate-700 mb-3">
            {SUBSYSTEM_LABELS[subsystem] ?? subsystem}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={formattedPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="timeLabel"
                tick={{ fontSize: 11 }}
                minTickGap={30}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {subsystemSensors.map((s, i) => (
                <Line
                  key={s.id}
                  type="monotone"
                  dataKey={sensorKey(s)}
                  name={`${s.label} (${s.unit})`}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  dot={false}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}
