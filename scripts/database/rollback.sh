#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEFAULT_ENV_FILE="${ROOT_DIR}/scripts/config/db.env"
ENV_FILE="${DB_ENV_FILE:-$DEFAULT_ENV_FILE}"
BACKUP_FILE="${1:-}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

required_vars=(DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD)
for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "[rollback] Missing required variable: ${var_name}" >&2
    exit 1
  fi
done

if [[ -z "$BACKUP_FILE" ]]; then
  echo "[rollback] Usage: ./rollback.sh <backup_file.dump>" >&2
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "[rollback] Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

export PGPASSWORD="$DB_PASSWORD"
echo "[rollback] Restoring backup: $BACKUP_FILE"
pg_restore \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  "$BACKUP_FILE"

echo "[rollback] Restore completed."

