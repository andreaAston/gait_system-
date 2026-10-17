ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS gender text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'patients_gender_check'
      AND conrelid = 'public.patients'::regclass
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_gender_check
      CHECK (
        gender IS NULL
        OR gender IN ('female', 'male', 'other', 'prefer_not_to_say')
      );
  END IF;
END;
$$;
