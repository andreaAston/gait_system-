ALTER TABLE public.device_assignments
  ADD COLUMN IF NOT EXISTS crutch_side text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'device_assignments_crutch_side_check'
      AND conrelid = 'public.device_assignments'::regclass
  ) THEN
    ALTER TABLE public.device_assignments
      ADD CONSTRAINT device_assignments_crutch_side_check
      CHECK (crutch_side IS NULL OR crutch_side IN ('left', 'right'));
  END IF;
END;
$$;
