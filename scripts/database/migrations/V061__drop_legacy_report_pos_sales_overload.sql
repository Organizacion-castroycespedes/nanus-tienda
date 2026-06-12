BEGIN;

-- The backend-reporteria adapter calls report_pos_sales with exactly 8
-- parameters. Keep one callable signature so PostgreSQL cannot resolve to the
-- legacy reporting overload with customer filters.
DROP FUNCTION IF EXISTS public.report_pos_sales(
  UUID,
  TEXT,
  UUID,
  UUID,
  UUID,
  UUID,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  TEXT,
  TEXT
);

DO $$
DECLARE
  v_expected_oid OID;
  v_legacy_oid OID;
  v_overload_count INTEGER;
  v_arguments TEXT;
BEGIN
  v_expected_oid := to_regprocedure(
    'public.report_pos_sales(uuid,text,uuid,uuid,uuid,uuid,timestamptz,timestamptz)'
  );
  v_legacy_oid := to_regprocedure(
    'public.report_pos_sales(uuid,text,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text)'
  );

  IF v_expected_oid IS NULL THEN
    RAISE EXCEPTION 'report_pos_sales expected 8-argument signature does not exist';
  END IF;

  IF v_legacy_oid IS NOT NULL THEN
    RAISE EXCEPTION 'legacy report_pos_sales extended overload still exists';
  END IF;

  SELECT COUNT(*)
  INTO v_overload_count
  FROM pg_proc p
  INNER JOIN pg_namespace n
    ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'report_pos_sales';

  IF v_overload_count <> 1 THEN
    RAISE EXCEPTION 'report_pos_sales overload count expected 1, found %', v_overload_count;
  END IF;

  SELECT pg_get_function_arguments(v_expected_oid)
  INTO v_arguments;

  IF v_arguments IS NULL THEN
    RAISE EXCEPTION 'report_pos_sales expected arguments could not be read';
  END IF;
END $$;

COMMIT;
