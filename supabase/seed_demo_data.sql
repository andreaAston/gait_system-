-- Destructive demo reset and seed for the complete current GAIT sensor model.
-- Run only after supabase/setup_new_project.sql.
-- Clears operational readings, assignments, patients, devices, and sensors,
-- then recreates the six-channel demo sensor catalog and sample data.

BEGIN;

TRUNCATE TABLE
  public.reading_values,
  public.gait_readings,
  public.device_assignments,
  public.patients,
  public.devices,
  public.sensors
RESTART IDENTITY;

INSERT INTO public.sensors (subsystem, sensor_type, label, unit)
VALUES
  ('foot_left', 'fsr', 'forefoot', 'N'),
  ('foot_right', 'fsr', 'forefoot', 'N'),
  ('crutch_left', 'vibration', 'shaft', 'g'),
  ('crutch_left', 'load_cell', 'handgrip', 'N'),
  ('crutch_right', 'vibration', 'shaft', 'g'),
  ('crutch_right', 'load_cell', 'handgrip', 'N');

DO $$
DECLARE
  active_patient_id uuid;
  discharged_patient_1_id uuid;
  discharged_patient_2_id uuid;
  demo_device_id uuid;
  left_forefoot_sensor_id uuid;
  right_forefoot_sensor_id uuid;
  left_vibration_sensor_id uuid;
  left_load_sensor_id uuid;
  right_vibration_sensor_id uuid;
  right_load_sensor_id uuid;
  assignment_record record;
  sample_index integer;
  sample_time timestamptz;
  window_start timestamptz;
  sample_end timestamptz;
  reading_id bigint;
  setup_time timestamptz := now();
BEGIN
  INSERT INTO public.patients (full_name, date_of_birth, gender, notes)
  VALUES ('Demo Patient 01', '1988-04-12', 'female', 'Fictional prototype record.')
  RETURNING id INTO active_patient_id;

  INSERT INTO public.patients (full_name, date_of_birth, gender, notes)
  VALUES ('Demo Patient 02', '1964-03-30', 'female', 'Fictional prototype record.')
  RETURNING id INTO discharged_patient_1_id;

  INSERT INTO public.patients (full_name, date_of_birth, gender, notes)
  VALUES ('Demo Patient 03', '2000-07-22', 'male', 'Fictional prototype record.')
  RETURNING id INTO discharged_patient_2_id;

  INSERT INTO public.patients (full_name, date_of_birth, gender, notes)
  VALUES ('Demo Patient 04', '1975-09-03', 'male', 'Fictional prototype record.');

  INSERT INTO public.devices (device_code, label)
  VALUES ('DEMO-GAIT-001', 'Prototype demo device')
  RETURNING id INTO demo_device_id;

  INSERT INTO public.device_assignments (
    device_id, patient_id, started_at, ended_at, ended_reason
  )
  VALUES
    (
      demo_device_id, discharged_patient_1_id,
      setup_time - interval '4 hours',
      setup_time - interval '2 hours 20 minutes',
      'demo_discharged'
    ),
    (
      demo_device_id, discharged_patient_2_id,
      setup_time - interval '2 hours',
      setup_time - interval '20 minutes',
      'demo_discharged'
    ),
    (
      demo_device_id, active_patient_id,
      setup_time - interval '15 minutes', NULL, NULL
    );

  SELECT id INTO STRICT left_forefoot_sensor_id
  FROM public.sensors
  WHERE subsystem = 'foot_left' AND sensor_type = 'fsr' AND label = 'forefoot';

  SELECT id INTO STRICT right_forefoot_sensor_id
  FROM public.sensors
  WHERE subsystem = 'foot_right' AND sensor_type = 'fsr' AND label = 'forefoot';

  SELECT id INTO STRICT left_vibration_sensor_id
  FROM public.sensors
  WHERE subsystem = 'crutch_left' AND sensor_type = 'vibration';

  SELECT id INTO STRICT left_load_sensor_id
  FROM public.sensors
  WHERE subsystem = 'crutch_left' AND sensor_type = 'load_cell';

  SELECT id INTO STRICT right_vibration_sensor_id
  FROM public.sensors
  WHERE subsystem = 'crutch_right' AND sensor_type = 'vibration';

  SELECT id INTO STRICT right_load_sensor_id
  FROM public.sensors
  WHERE subsystem = 'crutch_right' AND sensor_type = 'load_cell';

  FOR assignment_record IN
    SELECT started_at, ended_at
    FROM public.device_assignments
    WHERE device_id = demo_device_id
    ORDER BY started_at
  LOOP
    sample_end := coalesce(assignment_record.ended_at, setup_time);
    window_start := greatest(
      assignment_record.started_at,
      sample_end - interval '15 minutes'
    );

    FOR sample_index IN 0..60 LOOP
      sample_time := window_start
        + (sample_end - window_start) * sample_index / 60.0;

      INSERT INTO public.gait_readings (device_id, recorded_at)
      VALUES (demo_device_id, sample_time)
      RETURNING id INTO reading_id;

      INSERT INTO public.reading_values (
        reading_id, sensor_id, value, is_simulated
      )
      VALUES
        (reading_id, left_forefoot_sensor_id,
          (500 + 230 * sin(sample_index * 0.32 - 1.8))::double precision, true),
        (reading_id, right_forefoot_sensor_id,
          (465 + 210 * sin(sample_index * 0.32 - 1.5))::double precision, true),
        (reading_id, left_vibration_sensor_id,
          (0.12 + 0.08 * abs(sin(sample_index * 0.75)))::double precision, true),
        (reading_id, left_load_sensor_id,
          (75 + 28 * sin(sample_index * 0.32 - 0.5))::double precision, true),
        (reading_id, right_vibration_sensor_id,
          (0.10 + 0.07 * abs(sin(sample_index * 0.75 + 0.4)))::double precision, true),
        (reading_id, right_load_sensor_id,
          (70 + 25 * sin(sample_index * 0.32 - 0.2))::double precision, true);
    END LOOP;
  END LOOP;
END;
$$;

COMMIT;
