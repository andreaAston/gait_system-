-- Destructive demo reset:
-- Clears patient, device, assignment, and gait-reading data.
-- Keeps sensor definitions and Supabase auth users.
-- Requires demographics, assignment-driven status, and crutch-side migrations.
-- Seeds one active, two discharged, and one inactive patient using one device.
BEGIN;

TRUNCATE TABLE
  public.reading_values,
  public.gait_readings,
  public.device_assignments,
  public.patients,
  public.devices
RESTART IDENTITY;

WITH seeded_patients AS (
  INSERT INTO public.patients (
    full_name,
    date_of_birth,
    gender,
    notes
  )
  VALUES
    ('Demo Patient 01', '1988-04-12', 'female', 'Fictional prototype record.'),
    ('Demo Patient 02', '1964-03-30', 'female', 'Fictional prototype record.'),
    ('Demo Patient 03', '2000-07-22', 'male', 'Fictional prototype record.'),
    ('Demo Patient 04', '1975-09-03', 'male', 'Fictional prototype record.')
  RETURNING id, full_name
),
seeded_device AS (
  INSERT INTO public.devices (device_code, label)
  VALUES ('DEMO-GAIT-001', 'Prototype demo device')
  RETURNING id
)
INSERT INTO public.device_assignments (
  device_id,
  patient_id,
  crutch_side,
  started_at,
  ended_at,
  ended_reason
)
SELECT
  seeded_device.id,
  seeded_patients.id,
  'left',
  CASE
    WHEN seeded_patients.full_name = 'Demo Patient 02'
      THEN now() - interval '4 hours'
    WHEN seeded_patients.full_name = 'Demo Patient 03'
      THEN now() - interval '2 hours'
    ELSE now() - interval '15 minutes'
  END,
  CASE
    WHEN seeded_patients.full_name = 'Demo Patient 02'
      THEN now() - interval '2 hours 20 minutes'
    WHEN seeded_patients.full_name = 'Demo Patient 03'
      THEN now() - interval '20 minutes'
    ELSE NULL
  END,
  CASE
    WHEN seeded_patients.full_name IN ('Demo Patient 02', 'Demo Patient 03')
      THEN 'demo_discharged'
    ELSE NULL
  END
FROM seeded_device
CROSS JOIN seeded_patients
WHERE seeded_patients.full_name IN (
  'Demo Patient 01',
  'Demo Patient 02',
  'Demo Patient 03'
);

COMMIT;
