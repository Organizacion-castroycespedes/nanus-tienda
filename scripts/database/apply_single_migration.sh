#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${BASH_VERSION:-}" ]]; then
  exec bash "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
MIGRATIONS_DIR="${SCRIPT_DIR}/migrations"
ENV_FILE="${1:-${DB_ENV_FILE:-${ROOT_DIR}/scripts/config/db.env}}"
MIGRATION_INPUT="${2:-}"
EXPECTED_CHECKSUM="${3:-${MIGRATION_EXPECTED_CHECKSUM:-}}"

usage() {
  echo "Usage: $0 <env-file> <migration-file> [sha256-checksum]" >&2
  exit 2
}

[[ -n "$MIGRATION_INPUT" ]] || usage
[[ -f "$ENV_FILE" ]] || { echo "[apply_single_migration] Environment file not found." >&2; exit 1; }

case "$MIGRATION_INPUT" in
  /*) MIGRATION_FILE="$MIGRATION_INPUT" ;;
  scripts/database/migrations/*) MIGRATION_FILE="${ROOT_DIR}/${MIGRATION_INPUT}" ;;
  *) MIGRATION_FILE="${MIGRATIONS_DIR}/${MIGRATION_INPUT}" ;;
esac

MIGRATION_FILE="$(cd "$(dirname "$MIGRATION_FILE")" && pwd)/$(basename "$MIGRATION_FILE")"
case "$MIGRATION_FILE" in
  "${MIGRATIONS_DIR}"/*.sql) ;;
  *) echo "[apply_single_migration] Refusing migration outside scripts/database/migrations." >&2; exit 1 ;;
esac

VERSION="$(basename "$MIGRATION_FILE")"
[[ "$VERSION" =~ ^V[0-9]{3}__.+\.sql$ ]] || {
  echo "[apply_single_migration] Refusing invalid migration filename: $VERSION" >&2
  exit 1
}
[[ -f "$MIGRATION_FILE" ]] || { echo "[apply_single_migration] Migration file not found." >&2; exit 1; }

# shellcheck disable=SC1090
source "$ENV_FILE"
TARGET_ENV="${MIGRATION_TARGET_ENV:-QA}"
TARGET_ENV="${TARGET_ENV^^}"
DB_SCHEMA="${DB_SCHEMA:-public}"
ENVIRONMENT_NORMALIZED="${ENVIRONMENT:-QA}"
ENVIRONMENT_NORMALIZED="${ENVIRONMENT_NORMALIZED^^}"

case "$TARGET_ENV" in
  QA)
    [[ "${DB_NAME:-}" == "manus_tienda_qa" && "$DB_SCHEMA" == "public" && "$ENVIRONMENT_NORMALIZED" == "QA" ]] || {
      echo "[apply_single_migration] Refusing target: explicit QA guard failed." >&2
      exit 1
    }
    ;;
  PROD)
    [[ "${ENVIRONMENT:-}" == "PROD" && "${MIGRATION_PROD_APPROVED:-}" == "YES" ]] || {
      echo "[apply_single_migration] Refusing PROD target without ENVIRONMENT=PROD and MIGRATION_PROD_APPROVED=YES." >&2
      exit 1
    }
    ;;
  *)
    echo "[apply_single_migration] Refusing unknown MIGRATION_TARGET_ENV=$TARGET_ENV." >&2
    exit 1
    ;;
esac

for var_name in DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD DB_ADMIN_USER DB_ADMIN_PASSWORD; do
  [[ -n "${!var_name:-}" ]] || { echo "[apply_single_migration] Missing ${var_name}." >&2; exit 1; }
done

if command -v sha256sum >/dev/null 2>&1; then
  CHECKSUM="$(sha256sum "$MIGRATION_FILE" | awk '{print $1}')"
else
  CHECKSUM="$(shasum -a 256 "$MIGRATION_FILE" | awk '{print $1}')"
fi
if [[ -n "$EXPECTED_CHECKSUM" && "$CHECKSUM" != "$EXPECTED_CHECKSUM" ]]; then
  echo "[apply_single_migration] Checksum mismatch for $VERSION." >&2
  exit 1
fi

if [[ "${MIGRATION_DRY_RUN:-NO}" == "YES" ]]; then
  echo "[apply_single_migration] DRY_RUN target=$TARGET_ENV database=$DB_NAME schema=$DB_SCHEMA version=$VERSION checksum=$CHECKSUM"
  exit 0
fi

export PGPASSWORD="$DB_ADMIN_PASSWORD"
PSQL=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_ADMIN_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -X -q)

"${PSQL[@]}" -tAc "SELECT current_database() = '$DB_NAME' AND current_schema() = '$DB_SCHEMA';" | grep -qx t
"${PSQL[@]}" -tAc "SELECT to_regclass('${DB_SCHEMA}.migrations_history') IS NOT NULL;" | grep -qx t

already_applied="$("${PSQL[@]}" -tAc "SELECT EXISTS (SELECT 1 FROM ${DB_SCHEMA}.migrations_history WHERE version = '$VERSION');" | tr -d '[:space:]')"
[[ "$already_applied" == "f" ]] || {
  echo "[apply_single_migration] Refusing already-recorded migration: $VERSION" >&2
  exit 1
}

# Exactly one requested file is executed. No scan, fallback, or generic loop.
# The migration and its history row share one transaction.
"${PSQL[@]}" --single-transaction -f "$MIGRATION_FILE" -c "INSERT INTO ${DB_SCHEMA}.migrations_history (version, checksum, success, details) VALUES ('$VERSION', '$CHECKSUM', true, 'applied by apply_single_migration.sh');"

echo "[apply_single_migration] Applied $VERSION to ${DB_NAME}/${DB_SCHEMA}."
