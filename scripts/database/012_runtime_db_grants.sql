\set ON_ERROR_STOP on

CREATE TEMP TABLE tmp_runtime_db_grants_config (
  runtime_user text
) ON COMMIT DROP;

INSERT INTO tmp_runtime_db_grants_config (runtime_user)
VALUES (NULLIF(btrim(:'runtime_user'), ''));

DO $$
DECLARE
  v_runtime_user text;
  v_database_name text := current_database();
BEGIN
  SELECT runtime_user
  INTO v_runtime_user
  FROM tmp_runtime_db_grants_config
  LIMIT 1;

  IF v_runtime_user IS NULL THEN
    RAISE EXCEPTION 'runtime_user psql variable is required for runtime DB grants';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = v_runtime_user
  ) THEN
    RAISE EXCEPTION 'Runtime DB role "%" does not exist', v_runtime_user;
  END IF;

  EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', v_database_name, v_runtime_user);
  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', v_runtime_user);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', v_runtime_user);
  EXECUTE format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO %I', v_runtime_user);
  EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO %I', v_runtime_user);

  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', v_runtime_user);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I', v_runtime_user);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO %I', v_runtime_user);
END
$$;
