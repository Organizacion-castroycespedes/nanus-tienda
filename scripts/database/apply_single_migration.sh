#!/usr/bin/env bash
set -euo pipefail

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${1:-${DB_ENV_FILE:-${ROOT_DIR}/scripts/config/db.env}}"
MIGRATION_FILE="${2:-}"

if [[ "$(basename "$MIGRATION_FILE")" != "V080__electronic_billing_staged_processing_stages.sql" ]]; then
  echo "[apply_single_migration] Refusing migration: exact V080 filename required." >&2
  exit 1
fi
if [[ ! -f "$MIGRATION_FILE" ]]; then
  echo "[apply_single_migration] Migration file not found." >&2
  exit 1
fi

source "$ENV_FILE"
if [[ "${DB_NAME:-}" != "manus_tienda_qa" || "${DB_SCHEMA:-public}" != "public" ]]; then
  echo "[apply_single_migration] Refusing non-QA/non-public target." >&2
  exit 1
fi
for var_name in DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD DB_ADMIN_USER DB_ADMIN_PASSWORD; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "[apply_single_migration] Missing ${var_name}." >&2
    exit 1
  fi
done

export PGPASSWORD="$DB_ADMIN_PASSWORD"
PSQL=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_ADMIN_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -X -q)
"${PSQL[@]}" -tAc "SELECT current_database() = 'manus_tienda_qa' AND current_schema() = 'public';" | grep -qx t

version="$(basename "$MIGRATION_FILE")"
if [[ "$("${PSQL[@]}" -tAc "SELECT EXISTS (SELECT 1 FROM public.migrations_history WHERE version = '$version' AND success = true);" | tr -d '[:space:]')" == "t" ]]; then
  echo "[apply_single_migration] Refusing already-applied migration: $version" >&2
  exit 1
fi

checksum="$(sha256sum "$MIGRATION_FILE" | awk '{print $1}')"
"${PSQL[@]}" --single-transaction -f "$MIGRATION_FILE" -c \
  "INSERT INTO public.migrations_history (version, checksum, success, details) VALUES ('$version', '$checksum', true, 'applied by apply_single_migration.sh');"

echo "[apply_single_migration] Applied $version to manus_tienda_qa/public."
