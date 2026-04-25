#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEFAULT_ENV_FILE="${ROOT_DIR}/scripts/config/db.env"
ENV_FILE="${1:-${DB_ENV_FILE:-$DEFAULT_ENV_FILE}}"
BACKUP_DIR="${BACKUP_DIR:-${SCRIPT_DIR}/backups}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

required_vars=(DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD)
for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "[backup] Missing required variable: ${var_name}" >&2
    exit 1
  fi
done

mkdir -p "$BACKUP_DIR"
timestamp="$(date +%Y%m%d%H%M%S)"
backup_file="${BACKUP_DIR}/${DB_NAME}_${timestamp}.dump"

export PGPASSWORD="$DB_PASSWORD"
echo "[backup] Creating backup file: ${backup_file}"
pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$backup_file"

echo "[backup] Backup completed."
echo "$backup_file"

