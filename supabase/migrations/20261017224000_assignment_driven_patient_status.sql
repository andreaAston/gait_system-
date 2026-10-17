DO $$
DECLARE
  status_constraint record;
BEGIN
  FOR status_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.patients'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.patients DROP CONSTRAINT %I',
      status_constraint.conname
    );
  END LOOP;
END;
$$;

ALTER TABLE public.patients
  ALTER COLUMN status SET DEFAULT 'inactive';

UPDATE public.patients AS patient
SET status = CASE
  WHEN EXISTS (
    SELECT 1
    FROM public.device_assignments AS assignment
    WHERE assignment.patient_id = patient.id
      AND assignment.ended_at IS NULL
  ) THEN 'active'
  WHEN EXISTS (
    SELECT 1
    FROM public.device_assignments AS assignment
    WHERE assignment.patient_id = patient.id
  ) THEN 'discharged'
  ELSE 'inactive'
END;

ALTER TABLE public.patients
  ADD CONSTRAINT patients_status_check
  CHECK (status IN ('active', 'inactive', 'discharged'));

CREATE OR REPLACE FUNCTION public.recalculate_patient_status(
  patient_id_to_sync uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.patients AS patient
  SET status = CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.device_assignments AS assignment
      WHERE assignment.patient_id = patient.id
        AND assignment.ended_at IS NULL
    ) THEN 'active'
    WHEN EXISTS (
      SELECT 1
      FROM public.device_assignments AS assignment
      WHERE assignment.patient_id = patient.id
    ) THEN 'discharged'
    ELSE 'inactive'
  END
  WHERE patient.id = patient_id_to_sync;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_patient_status_after_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalculate_patient_status(NEW.patient_id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_patient_status(OLD.patient_id);
    RETURN OLD;
  END IF;

  PERFORM public.recalculate_patient_status(OLD.patient_id);
  IF NEW.patient_id IS DISTINCT FROM OLD.patient_id THEN
    PERFORM public.recalculate_patient_status(NEW.patient_id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_patient_status(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_patient_status_after_assignment()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS device_assignments_sync_patient_status
  ON public.device_assignments;

CREATE TRIGGER device_assignments_sync_patient_status
AFTER INSERT OR UPDATE OR DELETE ON public.device_assignments
FOR EACH ROW
EXECUTE FUNCTION public.sync_patient_status_after_assignment();
