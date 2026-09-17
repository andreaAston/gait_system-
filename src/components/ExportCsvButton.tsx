"use client";

import type { Sensor } from "@/types/database";
import type { ChartPoint } from "@/lib/services/readings";

function sensorKey(s: Sensor) {
  return `${s.subsystem}__${s.sensor_type}__${s.label}`;
}

function sensorColumnName(s: Sensor) {
  return `${s.subsystem}_${s.sensor_type}_${s.label} (${s.unit})`;
}

export function ExportCsvButton({
  points,
  sensors,
  filename,
}: {
  points: ChartPoint[];
  sensors: Sensor[];
  filename: string;
}) {
  function handleExport() {
    const headers = ["recorded_at", ...sensors.map(sensorColumnName)];
    const rows = points.map((p) => {
      const row = [p.recorded_at as string];
      for (const s of sensors) {
        const v = p[sensorKey(s)];
        row.push(v === undefined ? "" : String(v));
      }
      return row;
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      disabled={points.length === 0}
      className="text-sm font-medium border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      Export CSV
    </button>
  );
}
