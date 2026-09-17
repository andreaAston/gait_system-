// Types mirroring the Supabase schema (schema_v2.sql)

export type PatientStatus = "active" | "healed" | "discharged";

export interface Patient {
  id: string;
  full_name: string;
  status: PatientStatus;
  notes: string | null;
  registered_at: string;
  registered_by: string | null;
}

export interface Device {
  id: string;
  device_code: string;
  label: string | null;
  registered_at: string;
}

export interface DeviceAssignment {
  id: string;
  device_id: string;
  patient_id: string;
  started_at: string;
  ended_at: string | null;
  ended_reason: string | null;
}

export type Subsystem = "foot_left" | "foot_right" | "crutch_left" | "crutch_right";

export interface Sensor {
  id: string;
  subsystem: Subsystem;
  sensor_type: string; // 'fsr' | 'pressure' | 'accel_x' | 'accel_y' | 'accel_z'
  label: string; // 'heel' | 'midfoot' | 'forefoot' | 'handgrip' | 'base'
  unit: string; // 'N' | 'g'
}

export interface GaitReading {
  id: number;
  device_id: string;
  recorded_at: string;
}

export interface ReadingValue {
  id: number;
  reading_id: number;
  sensor_id: string;
  value: number;
}

// Row shape returned by the `patient_readings` view —
// this is what the dashboard queries most often.
export interface PatientReadingRow {
  reading_id: number;
  device_id: string;
  recorded_at: string;
  patient_id: string;
  sensor_id: string;
  value: number;
}

// Convenience: a patient with their current (active) assignment
// and device, joined — used on patient list/detail pages.
export interface PatientWithAssignment extends Patient {
  active_assignment: (DeviceAssignment & { device: Device }) | null;
}
