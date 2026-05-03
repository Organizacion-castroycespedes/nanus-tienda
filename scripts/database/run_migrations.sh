#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEFAULT_ENV_FILE="${ROOT_DIR}/scripts/config/db.env"
ENV_FILE="${1:-${DB_ENV_FILE:-$DEFAULT_ENV_FILE}}"
MIGRATIONS_DIR="${SCRIPT_DIR}/migrations"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

required_vars=(DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD)
for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "[run_migrations] Missing required variable: ${var_name}" >&2
    exit 1
  fi
done

export PGPASSWORD="$DB_PASSWORD"
export PGCLIENTENCODING="${PGCLIENTENCODING:-UTF8}"
PSQL_APP=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -X -q)

if ! "${PSQL_APP[@]}" -tAc "SELECT 1;" >/dev/null 2>&1; then
  echo "[run_migrations] Could not connect to database ${DB_NAME}." >&2
  exit 1
fi

"${PSQL_APP[@]}" -c "
CREATE SCHEMA IF NOT EXISTS public;
CREATE TABLE IF NOT EXISTS public.migrations_history (
  id bigserial PRIMARY KEY,
  version text NOT NULL UNIQUE,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text NOT NULL DEFAULT current_user,
  checksum text,
  success boolean NOT NULL DEFAULT true,
  details text
);"

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "[run_migrations] Missing migrations directory: ${MIGRATIONS_DIR}" >&2
  exit 1
fi

checksum_for_file() {
  local file_path="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file_path" | awk '{print $1}'
  else
    shasum -a 256 "$file_path" | awk '{print $1}'
  fi
}

is_applied() {
  local version="$1"
  "${PSQL_APP[@]}" -tAc \
    "SELECT 1 FROM public.migrations_history WHERE version = '$version' AND success = true;" \
    | tr -d '[:space:]'
}

record_result() {
  local version="$1"
  local checksum="$2"
  local success="$3"
  local details="$4"

  "${PSQL_APP[@]}" -c "
    INSERT INTO public.migrations_history (version, checksum, success, details)
    VALUES ('$version', '$checksum', $success, '$details')
    ON CONFLICT (version)
    DO UPDATE SET
      applied_at = now(),
      checksum = EXCLUDED.checksum,
      success = EXCLUDED.success,
      details = EXCLUDED.details;"
}

shopt -s nullglob
migration_files=("${MIGRATIONS_DIR}"/[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_*.sql)

if [[ ${#migration_files[@]} -eq 0 ]]; then
  echo "[run_migrations] No migration files found in ${MIGRATIONS_DIR}."
  exit 0
fi

for migration_file in "${migration_files[@]}"; do
  version="$(basename "$migration_file")"
  checksum="$(checksum_for_file "$migration_file")"

  if [[ "$(is_applied "$version")" == "1" ]]; then
    echo "[run_migrations] Skipping already applied migration: ${version}"
    continue
  fi

  echo "[run_migrations] Applying ${version}..."
  if "${PSQL_APP[@]}" --single-transaction -f "$migration_file"; then
    record_result "$version" "$checksum" "true" "applied by run_migrations.sh"
  else
    record_result "$version" "$checksum" "false" "failed in run_migrations.sh"
    echo "[run_migrations] Migration failed: ${version}" >&2
    exit 1
  fi
done

echo "[run_migrations] Completed successfully."
