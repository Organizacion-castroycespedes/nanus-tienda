#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
DEFAULT_ENV_FILE="${ROOT_DIR}/scripts/config/db.env"
ENV_FILE="${1:-${DB_ENV_FILE:-$DEFAULT_ENV_FILE}}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

required_vars=(DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD)
for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "[finance] Missing required variable: ${var_name}" >&2
    exit 1
  fi
done

export PGPASSWORD="$DB_PASSWORD"
export PGCLIENTENCODING="${PGCLIENTENCODING:-UTF8}"
PSQL_APP=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -X -q)

sql_files=(
  "migrations/20260430_1753_finance_base_infrastructure.sql"
  "migrations/20260430_1947_finance_payments_engine.sql"
  "migrations/20260502_1015_finance_cash_closing_controls.sql"
  "patches/20260430_1956_finance_payment_integration.sql"
  "patches/20260502_1135_finance_menu_access.sql"
  "patches/20260502_1840_finance_cash_movements_reference_text.sql"
)

for sql_file in "${sql_files[@]}"; do
  file_path="${SCRIPT_DIR}/${sql_file}"
  if [[ ! -f "$file_path" ]]; then
    echo "[finance] Missing SQL file: ${sql_file}" >&2
    exit 1
  fi

  echo "[finance] Running ${sql_file}..."
  "${PSQL_APP[@]}" --single-transaction -f "$file_path"
done

echo "[finance] Completed successfully."
