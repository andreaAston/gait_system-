-- Demo-only sensor setup and chart data for Demo Patient 01 (active)
-- and Demo Patients 02 and 03 (discharged) on DEMO-GAIT-001.
-- Run after all patient/assignment/realtime migrations and seed_demo_data.sql.
-- Re-running this script replaces readings for DEMO-GAIT-001 only.
BEGIN;

INSERT INTO public.sensors (subsystem, sensor_type, label, unit)
SELECT source.subsystem, source.sensor_type, source.label, source.unit
FROM (
  VALUES
    ('foot_left', 'fsr', 'heel', 'N'),
    ('foot_left', 'fsr', 'midfoot', 'N'),
    ('foot_left', 'fsr', 'forefoot', 'N'),
    ('crutch_left', 'vibration', 'shaft', 'g'),
    ('crutch_left', 'load_cell', 'handgrip', 'N'),
    ('foot_right', 'fsr', 'heel', 'N'),
    ('foot_right', 'fsr', 'midfoot', 'N'),
    ('foot_right', 'fsr', 'forefoot', 'N'),
    ('crutch_right', 'vibration', 'shaft', 'g'),
    ('crutch_right', 'load_cell', 'handgrip', 'N')
) AS source(subsystem, sensor_type, label, unit)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.sensors AS existing
  WHERE existing.subsystem = source.subsystem
    AND existing.sensor_type = source.sensor_type
    AND existing.label = source.label
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.device_assignments AS assignment
    JOIN public.patients AS patient ON patient.id = assignment.patient_id
    JOIN public.devices AS device ON device.id = assignment.device_id
    WHERE patient.full_name = 'Demo Patient 01'
      AND device.device_code = 'DEMO-GAIT-001'
      AND assignment.ended_at IS NULL
      AND assignment.crutch_side = 'left'
  ) THEN
    RAISE EXCEPTION
      'Missing the active left-side assignment for Demo Patient 01 on DEMO-GAIT-001. Run supabase/seed_demo_data.sql first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.device_assignments AS assignment
    JOIN public.patients AS patient ON patient.id = assignment.patient_id
    JOIN public.devices AS device ON device.id = assignment.device_id
    WHERE patient.full_name = 'Demo Patient 02'
      AND device.device_code = 'DEMO-GAIT-001'
      AND assignment.ended_at IS NOT NULL
      AND assignment.crutch_side = 'left'
  ) THEN
    RAISE EXCEPTION
      'Missing the discharged left-side assignment for Demo Patient 02 on DEMO-GAIT-001. Run supabase/seed_demo_data.sql first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.device_assignments AS assignment
    JOIN public.patients AS patient ON patient.id = assignment.patient_id
    JOIN public.devices AS device ON device.id = assignment.device_id
    WHERE patient.full_name = 'Demo Patient 03'
      AND device.device_code = 'DEMO-GAIT-001'
      AND assignment.ended_at IS NOT NULL
      AND assignment.crutch_side = 'left'
  ) THEN
    RAISE EXCEPTION
      'Missing the discharged left-side assignment for Demo Patient 03 on DEMO-GAIT-001. Run supabase/seed_demo_data.sql first.';
  END IF;
END;
$$;

DELETE FROM public.reading_values
WHERE reading_id IN (
  SELECT reading.id
  FROM public.gait_readings AS reading
  JOIN public.devices AS device ON device.id = reading.device_id
  WHERE device.device_code = 'DEMO-GAIT-001'
);

DELETE FROM public.gait_readings AS reading
USING public.devices AS device
WHERE device.id = reading.device_id
  AND device.device_code = 'DEMO-GAIT-001';

DO $$
DECLARE
  assignment_record record;
  heel_sensor_id uuid;
  midfoot_sensor_id uuid;
  forefoot_sensor_id uuid;
  vibration_sensor_id uuid;
  handle_sensor_id uuid;
  right_heel_sensor_id uuid;
  right_midfoot_sensor_id uuid;
  right_forefoot_sensor_id uuid;
  right_vibration_sensor_id uuid;
  right_handle_sensor_id uuid;
  sample_index integer;
  sample_time timestamptz;
  reading_id bigint;
  assignment_start timestamptz;
  window_start timestamptz;
  sample_end timestamptz;
BEGIN
  SELECT sensor.id INTO STRICT heel_sensor_id
  FROM public.sensors AS sensor
  WHERE sensor.subsystem = 'foot_left'
    AND sensor.sensor_type = 'fsr'
    AND sensor.label = 'heel'
  LIMIT 1;

  SELECT sensor.id INTO STRICT midfoot_sensor_id
  FROM public.sensors AS sensor
  WHERE sensor.subsystem = 'foot_left'
    AND sensor.sensor_type = 'fsr'
    AND sensor.label = 'midfoot'
  LIMIT 1;

  SELECT sensor.id INTO STRICT forefoot_sensor_id
  FROM public.sensors AS sensor
  WHERE sensor.subsystem = 'foot_left'
    AND sensor.sensor_type = 'fsr'
    AND sensor.label = 'forefoot'
  LIMIT 1;

  SELECT sensor.id INTO STRICT vibration_sensor_id
  FROM public.sensors AS sensor
  WHERE sensor.subsystem = 'crutch_left'
    AND sensor.sensor_type = 'vibration'
    AND sensor.label = 'shaft'
  LIMIT 1;

  SELECT sensor.id INTO STRICT handle_sensor_id
  FROM public.sensors AS sensor
  WHERE sensor.subsystem = 'crutch_left'
    AND sensor.sensor_type = 'load_cell'
    AND sensor.label = 'handgrip'
  LIMIT 1;

  SELECT sensor.id INTO STRICT right_heel_sensor_id
  FROM public.sensors AS sensor
  WHERE sensor.subsystem = 'foot_right'
    AND sensor.sensor_type = 'fsr'
    AND sensor.label = 'heel'
  LIMIT 1;

  SELECT sensor.id INTO STRICT right_midfoot_sensor_id
  FROM public.sensors AS sensor
  WHERE sensor.subsystem = 'foot_right'
    AND sensor.sensor_type = 'fsr'
    AND sensor.label = 'midfoot'
  LIMIT 1;

  SELECT sensor.id INTO STRICT right_forefoot_sensor_id
  FROM public.sensors AS sensor
  WHERE sensor.subsystem = 'foot_right'
    AND sensor.sensor_type = 'fsr'
    AND sensor.label = 'forefoot'
  LIMIT 1;

  SELECT sensor.id INTO STRICT right_vibration_sensor_id
  FROM public.sensors AS sensor
  WHERE sensor.subsystem = 'crutch_right'
    AND sensor.sensor_type = 'vibration'
    AND sensor.label = 'shaft'
  LIMIT 1;

  SELECT sensor.id INTO STRICT right_handle_sensor_id
  FROM public.sensors AS sensor
  WHERE sensor.subsystem = 'crutch_right'
    AND sensor.sensor_type = 'load_cell'
    AND sensor.label = 'handgrip'
  LIMIT 1;

  FOR assignment_record IN
    SELECT assignment.started_at, assignment.ended_at
    FROM public.device_assignments AS assignment
    JOIN public.patients AS patient ON patient.id = assignment.patient_id
    JOIN public.devices AS device ON device.id = assignment.device_id
    WHERE patient.full_name IN (
      'Demo Patient 01',
      'Demo Patient 02',
      'Demo Patient 03'
    )
      AND device.device_code = 'DEMO-GAIT-001'
    ORDER BY assignment.started_at
  LOOP
    assignment_start := assignment_record.started_at;
    sample_end := coalesce(assignment_record.ended_at, now());

    window_start := greatest(
      assignment_start,
      sample_end - interval '15 minutes'
    );

    FOR sample_index IN 0..60 LOOP
      sample_time := window_start
        + (sample_end - window_start) * sample_index / 60.0;

      INSERT INTO public.gait_readings (device_id, recorded_at)
      SELECT device.id, sample_time
      FROM public.devices AS device
      WHERE device.device_code = 'DEMO-GAIT-001'
      RETURNING id INTO reading_id;

      INSERT INTO public.reading_values (reading_id, sensor_id, value)
      VALUES
        (reading_id, heel_sensor_id,
          (420 + 190 * sin(sample_index * 0.32))::real),
        (reading_id, midfoot_sensor_id,
          (180 + 90 * sin(sample_index * 0.32 - 0.9))::real),
        (reading_id, forefoot_sensor_id,
          (500 + 230 * sin(sample_index * 0.32 - 1.8))::real),
        (reading_id, vibration_sensor_id,
          (0.12 + 0.08 * abs(sin(sample_index * 0.75)))::real),
        (reading_id, handle_sensor_id,
          (75 + 28 * sin(sample_index * 0.32 - 0.5))::real),
        (reading_id, right_heel_sensor_id,
          (390 + 175 * sin(sample_index * 0.32 + 0.3))::real),
        (reading_id, right_midfoot_sensor_id,
          (165 + 82 * sin(sample_index * 0.32 - 0.6))::real),
        (reading_id, right_forefoot_sensor_id,
          (465 + 210 * sin(sample_index * 0.32 - 1.5))::real),
        (reading_id, right_vibration_sensor_id,
          (0.10 + 0.07 * abs(sin(sample_index * 0.75 + 0.4)))::real),
        (reading_id, right_handle_sensor_id,
          (70 + 25 * sin(sample_index * 0.32 - 0.2))::real);
    END LOOP;
  END LOOP;
END;
$$;

COMMIT;
