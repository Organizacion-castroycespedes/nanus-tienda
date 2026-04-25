#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEFAULT_ENV_FILE="${ROOT_DIR}/scripts/config/db.env"
ENV_FILE="${1:-${DB_ENV_FILE:-$DEFAULT_ENV_FILE}}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

required_vars=(DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD ENVIRONMENT)
for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "[migrate] Missing required variable: ${var_name}" >&2
    exit 1
  fi
done

export PGPASSWORD="$DB_PASSWORD"
export PGCLIENTENCODING="${PGCLIENTENCODING:-UTF8}"
DB_ADMIN_USER="${DB_ADMIN_USER:-$DB_USER}"
DB_ADMIN_PASSWORD="${DB_ADMIN_PASSWORD:-$DB_PASSWORD}"
PGPASSWORD_ADMIN="$DB_ADMIN_PASSWORD"

PSQL_ADMIN=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_ADMIN_USER" -d postgres -v ON_ERROR_STOP=1 -X -q)
PSQL_APP=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -X -q)

echo "[migrate] Environment: $ENVIRONMENT"
echo "[migrate] Ensuring database exists: $DB_NAME"
if ! PGPASSWORD="$PGPASSWORD_ADMIN" "${PSQL_ADMIN[@]}" -tAc "SELECT 1;" >/dev/null 2>&1; then
  echo "[migrate] Could not connect with admin user '$DB_ADMIN_USER' to database 'postgres'." >&2
  echo "[migrate] Check DB_ADMIN_USER/DB_ADMIN_PASSWORD in your env file." >&2
  exit 1
fi

DB_EXISTS="$(PGPASSWORD="$PGPASSWORD_ADMIN" "${PSQL_ADMIN[@]}" -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME';" | tr -d '[:space:]')"
if [[ "$DB_EXISTS" != "1" ]]; then
  PGPASSWORD="$PGPASSWORD_ADMIN" "${PSQL_ADMIN[@]}" -c "CREATE DATABASE \"$DB_NAME\";"
  echo "[migrate] Database created."
fi

"${PSQL_APP[@]}" -c "CREATE SCHEMA IF NOT EXISTS public;"
"${PSQL_APP[@]}" -c "
CREATE TABLE IF NOT EXISTS public.migrations_history (
  id bigserial PRIMARY KEY,
  version text NOT NULL UNIQUE,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text NOT NULL DEFAULT current_user,
  checksum text,
  success boolean NOT NULL DEFAULT true,
  details text
);"

echo "[migrate] Running SQL migrations..."
shopt -s nullglob
migration_files=("${SCRIPT_DIR}"/[0-9][0-9][0-9]_*.sql)
if [[ ${#migration_files[@]} -eq 0 ]]; then
  echo "[migrate] No migration files found in ${SCRIPT_DIR}."
  exit 0
fi

for migration_file in "${migration_files[@]}"; do
  version="$(basename "$migration_file")"
  if [[ "$version" == *"_seed_"* ]]; then
    echo "[migrate] Skipping seed file during migration: $version"
    continue
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    checksum="$(sha256sum "$migration_file" | awk '{print $1}')"
  else
    checksum="$(shasum -a 256 "$migration_file" | awk '{print $1}')"
  fi

  already_applied="$("${PSQL_APP[@]}" -tAc "SELECT 1 FROM public.migrations_history WHERE version = '$version' AND success = true;" | tr -d '[:space:]')"
  if [[ "$already_applied" == "1" ]]; then
    echo "[migrate] Skipping already applied migration: $version"
    continue
  fi

  echo "[migrate] Applying: $version"
  if "${PSQL_APP[@]}" -f "$migration_file"; then
    "${PSQL_APP[@]}" -c "
      INSERT INTO public.migrations_history (version, checksum, success, details)
      VALUES ('$version', '$checksum', true, 'applied')
      ON CONFLICT (version)
      DO UPDATE SET
        applied_at = now(),
        checksum = EXCLUDED.checksum,
        success = true,
        details = 're-applied';
    "
  else
    "${PSQL_APP[@]}" -c "
      INSERT INTO public.migrations_history (version, checksum, success, details)
      VALUES ('$version', '$checksum', false, 'failed')
      ON CONFLICT (version)
      DO UPDATE SET
        applied_at = now(),
        checksum = EXCLUDED.checksum,
        success = false,
        details = 'failed';
    "
    echo "[migrate] Migration failed: $version" >&2
    exit 1
  fi
done

echo "[migrate] Validating core schema..."
"${PSQL_APP[@]}" -c "
DO \$\$
DECLARE
  missing_count int;
BEGIN
  SELECT count(*) INTO missing_count
  FROM (
    SELECT 'tenants' AS t
    UNION ALL SELECT 'tenant_branches'
    UNION ALL SELECT 'roles'
    UNION ALL SELECT 'permissions'
    UNION ALL SELECT 'role_menu_permissions'
    UNION ALL SELECT 'security_audit_logs'
    UNION ALL SELECT 'users'
  ) expected
  WHERE to_regclass('public.' || expected.t) IS NULL;

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Schema validation failed: missing % core tables', missing_count;
  END IF;
END \$\$;
"

echo "[migrate] Completed successfully."
