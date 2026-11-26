import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const expectedChannels = [
  "left_foot_fsr_n",
  "right_foot_fsr_n",
  "left_crutch_vibration_rms_g",
  "left_crutch_force_n",
  "right_crutch_vibration_rms_g",
  "right_crutch_force_n",
] as const;

type ChannelName = (typeof expectedChannels)[number];

function isChannelName(value: unknown): value is ChannelName {
  return (
    typeof value === "string" &&
    expectedChannels.some((channel) => channel === value)
  );
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function isAuthorized(request: Request) {
  const expectedToken = process.env.GAIT_INGEST_TOKEN;
  const authorization = request.headers.get("authorization");
  const suppliedToken = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!expectedToken || !suppliedToken) return false;

  const expected = Buffer.from(expectedToken);
  const supplied = Buffer.from(suppliedToken);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function readDeviceCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const deviceCode = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(deviceCode)
    ? deviceCode
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getDeviceState(deviceCode: string) {
  const supabase = createAdminClient();
  if (!supabase) return { error: "SERVER_NOT_CONFIGURED" as const };

  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .select("id")
    .eq("device_code", deviceCode)
    .maybeSingle();

  if (deviceError) return { error: "DATABASE_ERROR" as const };
  if (!device) return { error: "DEVICE_NOT_REGISTERED" as const };

  const { error: heartbeatError } = await supabase
    .from("devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", device.id);

  if (heartbeatError) return { error: "DATABASE_ERROR" as const };

  const { data: assignment, error: assignmentError } = await supabase
    .from("device_assignments")
    .select("id")
    .eq("device_id", device.id)
    .is("ended_at", null)
    .maybeSingle();

  if (assignmentError) return { error: "DATABASE_ERROR" as const };
  if (!assignment) return { error: "DEVICE_NOT_ASSIGNED" as const };

  return { deviceId: device.id };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return jsonError("UNAUTHORIZED", 401);

  const url = new URL(request.url);
  const deviceCode = readDeviceCode(url.searchParams.get("device_code"));
  if (!deviceCode) return jsonError("INVALID_DEVICE_CODE", 400);

  const state = await getDeviceState(deviceCode);
  if ("error" in state) {
    const status = state.error === "DEVICE_NOT_REGISTERED" ? 404
      : state.error === "DEVICE_NOT_ASSIGNED" ? 409
      : 503;
    return Response.json({ ready: false, status: state.error }, { status });
  }

  return Response.json({ ready: true });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return jsonError("UNAUTHORIZED", 401);

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4096) return jsonError("PAYLOAD_TOO_LARGE", 413);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", 400);
  }

  if (!isRecord(body)) return jsonError("INVALID_PAYLOAD", 400);

  const deviceCode = readDeviceCode(body.device_code);
  if (
    !deviceCode ||
    !body.values ||
    typeof body.values !== "object" ||
    Array.isArray(body.values)
  ) {
    return jsonError("INVALID_PAYLOAD", 400);
  }

  const channels = new Map<ChannelName, number>();
  for (const [channel, value] of Object.entries(body.values)) {
    if (!isChannelName(channel)) {
      return jsonError(`INVALID_CHANNEL:${channel}`, 400);
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return jsonError(`INVALID_CHANNEL:${channel}`, 400);
    }
    channels.set(channel, value);
  }
  if (channels.size === 0) {
    return jsonError("INVALID_PAYLOAD", 400);
  }

  const simulatedChannelNames: ChannelName[] = [];
  if (body.simulated_channels !== undefined) {
    if (!Array.isArray(body.simulated_channels)) {
      return jsonError("INVALID_SIMULATED_CHANNELS", 400);
    }
    for (const channel of body.simulated_channels) {
      if (!isChannelName(channel) || !channels.has(channel)) {
        return jsonError("INVALID_SIMULATED_CHANNELS", 400);
      }
      simulatedChannelNames.push(channel);
    }
  }
  const simulatedChannels = new Set(simulatedChannelNames);

  const state = await getDeviceState(deviceCode);
  if ("error" in state) {
    const status = state.error === "DEVICE_NOT_REGISTERED" ? 404
      : state.error === "DEVICE_NOT_ASSIGNED" ? 409
      : 503;
    return Response.json({ accepted: false, status: state.error }, { status });
  }

  const supabase = createAdminClient();
  if (!supabase) return jsonError("SERVER_NOT_CONFIGURED", 503);

  const { data: sensors, error: sensorError } = await supabase
    .from("sensors")
    .select("id, subsystem, sensor_type, label")
    .in("subsystem", ["foot_left", "foot_right", "crutch_left", "crutch_right"]);

  if (sensorError) return jsonError("SENSOR_LOOKUP_FAILED", 503);

  const sensorKeys: Record<ChannelName, string> = {
    left_foot_fsr_n: "foot_left|fsr|forefoot",
    right_foot_fsr_n: "foot_right|fsr|forefoot",
    left_crutch_vibration_rms_g: "crutch_left|vibration|shaft",
    left_crutch_force_n: "crutch_left|load_cell|handgrip",
    right_crutch_vibration_rms_g: "crutch_right|vibration|shaft",
    right_crutch_force_n: "crutch_right|load_cell|handgrip",
  };

  const sensorIds = new Map(
    (sensors ?? []).map((sensor) => [
      `${sensor.subsystem}|${sensor.sensor_type}|${sensor.label}`,
      sensor.id,
    ])
  );
  const readingValues = [...channels].map(([channel, value]) => {
    const sensorId = sensorIds.get(sensorKeys[channel]);
    return sensorId
      ? {
          sensor_id: sensorId,
          value,
          is_simulated: simulatedChannels.has(channel),
        }
      : null;
  });

  if (readingValues.some((value) => value === null)) {
    return jsonError("SENSORS_NOT_CONFIGURED", 503);
  }

  const { data: reading, error: readingError } = await supabase
    .from("gait_readings")
    .insert({ device_id: state.deviceId, recorded_at: new Date().toISOString() })
    .select("id")
    .single();

  if (readingError || !reading) return jsonError("READING_INSERT_FAILED", 503);

  const { error: valuesError } = await supabase
    .from("reading_values")
    .insert(readingValues.filter((value) => value !== null).map((value) => ({
      reading_id: reading.id,
      sensor_id: value.sensor_id,
      value: value.value,
      is_simulated: value.is_simulated,
    })));

  if (valuesError) {
    await supabase.from("gait_readings").delete().eq("id", reading.id);
    return jsonError("READING_VALUES_INSERT_FAILED", 503);
  }

  return Response.json({ accepted: true, reading_id: reading.id });
}
