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
  "#000000",
  "#2563eb",
  "#ea580c",
  "#7c3aed",
  "#db2777",
  "#475569",
  "#ca8a04",
  "#0891b2",
  "#000000",
  "#9333ea",
];

const SIDES = [
  { key: "left", label: "Left foot + crutch" },
  { key: "right", label: "Right foot + crutch" },
] as const;

const LEFT_FSR_KEY = "foot_left__fsr__forefoot";
const RIGHT_FSR_KEY = "foot_right__fsr__forefoot";
const LIVE_POLL_INTERVAL_MS = 3_000;
const MIN_STRIDE_INTERVAL_MS = 600;
const MAX_STRIDE_INTERVAL_MS = 3_000;

function sensorKey(sensor: Sensor) {
  return `${sensor.subsystem}__${sensor.sensor_type}__${sensor.label}`;
}

function mergePoints(
  previous: ChartPoint[],
  incoming: ChartPoint[],
  maxPoints: number
) {
  const pointsById = new Map(
    previous.map((point) => [point.reading_id, point])
  );
  for (const point of incoming) {
    pointsById.set(point.reading_id, {
      ...pointsById.get(point.reading_id),
      ...point,
    });
  }

  const next = [...pointsById.values()].sort((left, right) =>
    left.recorded_at.localeCompare(right.recorded_at)
  );
  return next.length > maxPoints ? next.slice(-maxPoints) : next;
}

function withSimulatedAlternatingFoot(points: ChartPoint[]) {
  const orderedPoints = [...points].sort((left, right) =>
    left.recorded_at.localeCompare(right.recorded_at)
  );
  const simulatedKey = `${RIGHT_FSR_KEY}__is_simulated`;
  const hasMeasuredRightFoot = orderedPoints.some(
    (point) =>
      typeof point[RIGHT_FSR_KEY] === "number" &&
      point[simulatedKey] !== true
  );
  if (hasMeasuredRightFoot) return orderedPoints;

  const measuredSamples = orderedPoints.flatMap((point) => {
    const force = point[LEFT_FSR_KEY];
    if (typeof force !== "number") return [];
    return [{
      reading_id: point.reading_id,
      recorded_at: point.recorded_at,
      time: new Date(point.recorded_at).getTime(),
      force,
    }];
  });
  const pointsWithoutOldSimulation = orderedPoints.map((point) => {
    const copy = { ...point };
    delete copy[RIGHT_FSR_KEY];
    delete copy[simulatedKey];
    return copy;
  });
  if (measuredSamples.length < 2) return pointsWithoutOldSimulation;

  const strideIntervals: number[] = [];
  let wasInContact = false;
  let lastContactAt: number | null = null;
  for (const sample of measuredSamples) {
    const isInContact = sample.force > 0;
    if (isInContact && !wasInContact) {
      if (lastContactAt !== null) {
        const interval = sample.time - lastContactAt;
        if (
          interval >= MIN_STRIDE_INTERVAL_MS &&
          interval <= MAX_STRIDE_INTERVAL_MS
        ) {
          strideIntervals.push(interval);
        }
      }
      lastContactAt = sample.time;
    }
    wasInContact = isInContact;
  }
  if (strideIntervals.length === 0) return pointsWithoutOldSimulation;

  const strideMs =
    strideIntervals.reduce((sum, interval) => sum + interval, 0) /
    strideIntervals.length;
  const halfStrideMs = strideMs / 2;
  const latestSampleTime = measuredSamples[measuredSamples.length - 1].time;
  const simulatedPoints = measuredSamples.flatMap((sample) => {
    const simulatedTime = sample.time + halfStrideMs;
    if (simulatedTime > latestSampleTime) return [];
    return [{
      reading_id: -sample.reading_id,
      recorded_at: new Date(simulatedTime).toISOString(),
      [RIGHT_FSR_KEY]: sample.force,
      [simulatedKey]: true,
    } satisfies ChartPoint];
  });

  return [...pointsWithoutOldSimulation, ...simulatedPoints].sort(
    (left, right) => left.recorded_at.localeCompare(right.recorded_at)
  );
}

function sensorHasSimulatedValues(sensor: Sensor, points: ChartPoint[]) {
  const simulatedKey = `${sensorKey(sensor)}__is_simulated`;
  return points.some((point) => point[simulatedKey] === true);
}

function sensorName(sensor: Sensor, isSimulated = false) {
  const name =
    sensor.sensor_type === "fsr"
      ? sensor.label.charAt(0).toUpperCase() + sensor.label.slice(1)
      : sensor.sensor_type === "load_cell"
        ? "Crutch handle load"
        : sensor.sensor_type === "vibration"
          ? "Crutch vibration"
          : sensor.label.charAt(0).toUpperCase() + sensor.label.slice(1);

  return `${name} (${sensor.unit})${isSimulated ? " · SIMULATED" : ""}`;
}

export function SensorLineChart({
  deviceId,
  initialPoints,
  sensors,
  live = false,
  maxPoints = 4000,
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
    const sensorById = new Map(sensors.map((sensor) => [sensor.id, sensor]));
    let latestReadingId = Math.max(
      0,
      ...initialPoints.map((point) => point.reading_id)
    );
    let pollInProgress = false;

    const pollForReadings = async () => {
      if (pollInProgress) return;
      pollInProgress = true;

      try {
        const { data, error } = await supabase
          .from("gait_readings")
          .select("id, recorded_at, reading_values(sensor_id, value, is_simulated)")
          .eq("device_id", deviceId)
          .gte("recorded_at", new Date(Date.now() - 15 * 60_000).toISOString())
          .gt("id", latestReadingId)
          .order("id", { ascending: true })
          .limit(1000);

        if (error) {
          setRealtimeError(`Could not check for new readings: ${error.message}`);
          return;
        }

        const incomingPoints: ChartPoint[] = [];
        for (const reading of data ?? []) {
          const readingValues = reading.reading_values as {
            sensor_id: string;
            value: number;
            is_simulated: boolean;
          }[];
          if (readingValues.length === 0) break;

          const readingId = Number(reading.id);
          latestReadingId = Math.max(latestReadingId, readingId);
          const point: ChartPoint = {
            reading_id: readingId,
            recorded_at: reading.recorded_at,
          };
          for (const readingValue of readingValues) {
            const sensor = sensorById.get(readingValue.sensor_id);
            if (!sensor) continue;
            const key = sensorKey(sensor);
            point[key] = readingValue.value;
            point[`${key}__is_simulated`] = readingValue.is_simulated;
          }
          incomingPoints.push(point);
        }

        if (incomingPoints.length > 0) {
          setPoints((previous) =>
            mergePoints(previous, incomingPoints, maxPoints)
          );
          setRealtimeError(null);
        }
      } finally {
        pollInProgress = false;
      }
    };

    void pollForReadings();
    const pollInterval = window.setInterval(
      () => void pollForReadings(),
      LIVE_POLL_INTERVAL_MS
    );

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
            [`${sensorKey(sensor)}__is_simulated`]:
              payload.new.is_simulated === true,
          };

          setRealtimeError(null);
          setPoints((previous) => mergePoints(previous, [point], maxPoints));
        }
      );
    }
    channel = channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setRealtimeError("Live updates are unavailable. Refresh to retry.");
      }
    });

    return () => {
      window.clearInterval(pollInterval);
      void supabase.removeChannel(channel);
    };
  }, [deviceId, initialPoints, live, maxPoints, sensors]);

  const displayPoints = useMemo(
    () => withSimulatedAlternatingFoot(points),
    [points]
  );

  const formattedPoints = useMemo(
    () =>
      displayPoints.map((point) => ({
        ...point,
        timeValue: new Date(point.recorded_at).getTime(),
      })),
    [displayPoints]
  );
  const hasSimulatedValues = sensors.some((sensor) =>
    sensorHasSimulatedValues(sensor, displayPoints)
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
          {hasSimulatedValues && (
            <p className="mt-1 text-xs text-amber-700">
              The right-foot FSR is calculated in the dashboard from the
              measured left-foot signal, shifted by half an estimated stride.
              It uses the same force values, is not a separate measurement,
              and appears after repeated contacts establish cadence.
            </p>
          )}
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
                          {sideSensors.map((sensor, index) => {
                            const isSimulated = sensorHasSimulatedValues(
                              sensor,
                              points
                            );
                            return (
                              <Line
                                key={sensor.id}
                                yAxisId={
                                  sensor.unit === "N" ? "force" : "other"
                                }
                                type="monotone"
                                dataKey={sensorKey(sensor)}
                                name={sensorName(sensor, isSimulated)}
                                stroke={LINE_COLORS[index % LINE_COLORS.length]}
                                strokeDasharray={isSimulated ? "6 4" : undefined}
                                dot={false}
                                strokeWidth={2}
                                connectNulls
                                isAnimationActive={false}
                              />
                            );
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <ul
                      aria-label={`${side.label} sensor legend`}
                      className="w-44 shrink-0 space-y-2 pr-1 text-xs"
                    >
                      {sideSensors.map((sensor, index) => {
                        const isSimulated = sensorHasSimulatedValues(
                          sensor,
                          points
                        );
                        const color = LINE_COLORS[index % LINE_COLORS.length];
                        const name = sensorName(sensor, isSimulated);
                        return (
                          <li
                            key={sensor.id}
                            className="flex items-center gap-2 text-slate-700"
                            title={name}
                          >
                            <span
                              aria-hidden="true"
                              className="h-3 w-3 shrink-0 rounded-sm"
                              style={{
                                backgroundColor: color,
                              }}
                            />
                            <span>{name}</span>
                          </li>
                        );
                      })}
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
