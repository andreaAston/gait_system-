-- Destructive demo reset:
-- Clears patient, device, assignment, and gait-reading data.
-- Keeps sensor definitions and Supabase auth users.
-- Requires both the demographics and assignment-driven status migrations.
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
    ('Demo Patient 02', '1975-09-03', 'male', 'Fictional prototype record.'),
    ('Demo Patient 03', '1992-01-27', 'female', 'Fictional prototype record.'),
    ('Demo Patient 04', '1969-06-18', 'male', 'Fictional prototype record.'),
    ('Demo Patient 05', '1983-11-09', 'other', 'Fictional prototype record.'),
    ('Demo Patient 06', '1997-02-21', 'female', 'Fictional prototype record.'),
    ('Demo Patient 07', '1979-08-14', 'male', 'Fictional prototype record.'),
    ('Demo Patient 08', '1990-12-05', 'prefer_not_to_say', 'Fictional prototype record.'),
    ('Demo Patient 09', '1964-03-30', 'female', 'Fictional prototype record.'),
    ('Demo Patient 10', '2000-07-22', 'male', 'Fictional prototype record.')
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
  ended_at,
  ended_reason
)
SELECT
  seeded_device.id,
  seeded_patients.id,
  CASE
    WHEN seeded_patients.full_name = 'Demo Patient 10' THEN now()
    ELSE NULL
  END,
  CASE
    WHEN seeded_patients.full_name = 'Demo Patient 10' THEN 'demo_discharged'
    ELSE NULL
  END
FROM seeded_device
CROSS JOIN seeded_patients
WHERE seeded_patients.full_name IN ('Demo Patient 01', 'Demo Patient 10');

COMMIT;
