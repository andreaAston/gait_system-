"use client";

import { useMemo } from "react";
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
import type { Sensor } from "@/types/database";
import type { ChartPoint } from "@/lib/services/readings";

const SUBSYSTEM_LABELS: Record<string, string> = {
  foot_left: "Left Foot Pressure",
  foot_right: "Right Foot Pressure",
  crutch_left: "Left Crutch",
  crutch_right: "Right Crutch",
};

const LINE_COLORS = ["#0f172a", "#dc2626", "#0891b2", "#7c3aed", "#ea580c"];

function sensorKey(s: Sensor) {
  return `${s.subsystem}__${s.sensor_type}__${s.label}`;
}

export function HistoryChart({
  points,
  sensors,
}: {
  points: ChartPoint[];
  sensors: Sensor[];
}) {
  const bySubsystem = useMemo(() => {
    const groups = new Map<string, Sensor[]>();
    for (const s of sensors) {
      const list = groups.get(s.subsystem) ?? [];
      list.push(s);
      groups.set(s.subsystem, list);
    }
    return groups;
  }, [sensors]);

  const formattedPoints = useMemo(
    () =>
      points.map((p) => ({
        ...p,
        timeLabel: new Date(p.recorded_at).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      })),
    [points]
  );

  if (points.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <p className="text-slate-500 text-sm">
          No readings found in this time range.
        </p>
      </div>
    );
  }

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
                tick={{ fontSize: 10 }}
                minTickGap={40}
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
