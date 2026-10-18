"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import type { ChartPoint } from "@/lib/services/readings";
import type { Sensor } from "@/types/database";

const LINE_COLORS = [
  "#0f766e",
  "#2563eb",
  "#ea580c",
  "#7c3aed",
  "#db2777",
  "#475569",
  "#ca8a04",
  "#0891b2",
  "#16a34a",
  "#9333ea",
];

const SIDES = [
  { key: "left", label: "Left foot + crutch" },
  { key: "right", label: "Right foot + crutch" },
] as const;

function sensorKey(sensor: Sensor) {
  return `${sensor.subsystem}__${sensor.sensor_type}__${sensor.label}`;
}

function sensorName(sensor: Sensor) {
  const name =
    sensor.sensor_type === "fsr"
      ? sensor.label.charAt(0).toUpperCase() + sensor.label.slice(1)
      : sensor.sensor_type === "load_cell"
        ? "Crutch handle load"
        : sensor.sensor_type === "vibration"
          ? "Crutch vibration"
          : sensor.label.charAt(0).toUpperCase() + sensor.label.slice(1);

  return `${name} (${sensor.unit})`;
}

export function SensorLineChart({
  deviceId,
  initialPoints,
  sensors,
  live = false,
  maxPoints = 2000,
}: {
  deviceId?: string;
  initialPoints: ChartPoint[];
  sensors: Sensor[];
  live?: boolean;
  maxPoints?: number;
}) {
  const [points, setPoints] = useState(initialPoints);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);

  useEffect(() => {
    if (!live || !deviceId) return;

    const supabase = createClient();
    let channel = supabase.channel(`device-${deviceId}-readings`);
    for (const sensor of sensors) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reading_values",
          filter: `sensor_id=eq.${sensor.id}`,
        },
        async (payload) => {
          const readingId = payload.new.reading_id as number;
          const { data: reading, error } = await supabase
            .from("gait_readings")
            .select("recorded_at")
            .eq("id", readingId)
            .eq("device_id", deviceId)
            .maybeSingle();

          if (error) {
            setRealtimeError(`Could not load a new reading: ${error.message}`);
            return;
          }
          if (!reading) return;

          const point: ChartPoint = {
            reading_id: readingId,
            recorded_at: reading.recorded_at,
            [sensorKey(sensor)]: payload.new.value as number,
          };

          setRealtimeError(null);
          setPoints((previous) => {
            const existingIndex = previous.findIndex(
              (entry) => entry.reading_id === readingId
            );
            const next =
              existingIndex === -1
                ? [...previous, point]
                : previous.map((entry, index) =>
                    index === existingIndex ? { ...entry, ...point } : entry
                  );
            return next.length > maxPoints
              ? next.slice(next.length - maxPoints)
              : next;
          });
        }
      );
    }
    channel = channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setRealtimeError("Live updates are unavailable. Refresh to retry.");
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [deviceId, live, maxPoints, sensors]);

  const formattedPoints = useMemo(
    () =>
      points.map((point) => ({
        ...point,
        timeValue: new Date(point.recorded_at).getTime(),
      })),
    [points]
  );

  if (sensors.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-600">
          No left- or right-side sensors are configured for this device.
        </p>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-600">
          No sensor readings were found in this time range.
        </p>
        {realtimeError && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {realtimeError}
          </p>
        )}
      </div>
    );
  }

  return (
    <section
      aria-label="Gait force and vibration readings over time"
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 className="font-semibold text-slate-900">
            Sensor readings over time
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Force values are shown in newtons (N); vibration uses the sensor&apos;s
            configured unit.
          </p>
        </div>
        {live && (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live
          </span>
        )}
      </div>
      {realtimeError && (
        <p role="alert" className="px-5 pt-3 text-sm text-red-700">
          {realtimeError}
        </p>
      )}
      <div className="overflow-x-auto px-3 pb-4 pt-2">
        <div className="min-w-[900px] sm:min-w-0">
          {SIDES.map((side, sideIndex) => {
            const sideSensors = sensors.filter((sensor) =>
              sensor.subsystem.endsWith(`_${side.key}`)
            );

            return (
              <section
                key={side.key}
                aria-label={`${side.label} readings`}
                className="border-b border-slate-200 last:border-b-0"
              >
                <h3 className="px-3 pt-3 text-sm font-medium text-slate-700">
                  {side.label}
                </h3>
                {sideSensors.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-slate-500">
                    No {side.key}-side sensors are configured.
                  </p>
                ) : (
                  <div className="flex h-[270px] items-center gap-2">
                    <div className="h-full min-w-0 flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={formattedPoints}
                          syncId="gait-sensor-time"
                          margin={{
                            top: 12,
                            right: 12,
                            bottom: sideIndex === SIDES.length - 1 ? 14 : 0,
                            left: 4,
                          }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#e2e8f0"
                          />
                          <XAxis
                            type="number"
                            dataKey="timeValue"
                            domain={["dataMin", "dataMax"]}
                            scale="time"
                            tick={
                              sideIndex === SIDES.length - 1
                                ? { fontSize: 11 }
                                : false
                            }
                            tickLine={sideIndex === SIDES.length - 1}
                            axisLine={sideIndex === SIDES.length - 1}
                            height={sideIndex === SIDES.length - 1 ? 30 : 0}
                            tickFormatter={(value: number) =>
                              new Date(value).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            }
                            minTickGap={36}
                          />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            tickCount={5}
                            yAxisId="force"
                            label={{
                              value: "Force (N)",
                              angle: -90,
                              position: "insideLeft",
                              style: { fontSize: 11, fill: "#64748b" },
                            }}
                          />
                          {sideSensors.some(
                            (sensor) => sensor.unit !== "N"
                          ) && (
                            <YAxis
                              yAxisId="other"
                              orientation="right"
                              tick={{ fontSize: 11 }}
                              tickCount={5}
                              label={{
                                value: "Vibration (g)",
                                angle: 90,
                                position: "insideRight",
                                style: { fontSize: 11, fill: "#64748b" },
                              }}
                            />
                          )}
                          <Tooltip
                            labelFormatter={(value) =>
                              new Date(Number(value)).toLocaleString()
                            }
                            formatter={(value, name) => [
                              typeof value === "number"
                                ? value.toFixed(2)
                                : value,
                              name,
                            ]}
                          />
                          {sideSensors.map((sensor, index) => (
                            <Line
                              key={sensor.id}
                              yAxisId={
                                sensor.unit === "N" ? "force" : "other"
                              }
                              type="monotone"
                              dataKey={sensorKey(sensor)}
                              name={sensorName(sensor)}
                              stroke={LINE_COLORS[index % LINE_COLORS.length]}
                              dot={false}
                              strokeWidth={2}
                              connectNulls={false}
                              isAnimationActive={false}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <ul
                      aria-label={`${side.label} sensor legend`}
                      className="w-44 shrink-0 space-y-2 pr-1 text-xs"
                    >
                      {sideSensors.map((sensor, index) => (
                        <li
                          key={sensor.id}
                          className="flex items-center gap-2 text-slate-700"
                          title={sensorName(sensor)}
                        >
                          <span
                            aria-hidden="true"
                            className="h-3 w-3 shrink-0 rounded-sm"
                            style={{
                              backgroundColor:
                                LINE_COLORS[index % LINE_COLORS.length],
                            }}
                          />
                          <span>{sensorName(sensor)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
