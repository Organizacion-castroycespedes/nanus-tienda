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
    echo "[sale] Missing required variable: ${var_name}" >&2
    exit 1
  fi
done

export PGPASSWORD="$DB_PASSWORD"
export PGCLIENTENCODING="${PGCLIENTENCODING:-UTF8}"
PSQL_APP=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -X -q)

sql_files=(
  "001_sales.sql"
  "002_sale_items.sql"
  "003_sale_item_taxes.sql"
  "004_sale_payment_methods.sql"
  "010_sales_pos_context.sql"
  "005_relations_indexes.sql"
  "006_create_sale_function.sql"
  "007_update_sales_balance_constraint.sql"
  "008_update_orders_status_constraint.sql"
  "009_cancel_sale_function.sql"
  "011_sales_refunded_branch_stock.sql"
  "012_sale_financial_sync_and_pos_function.sql"
)

for sql_file in "${sql_files[@]}"; do
  file_path="${SCRIPT_DIR}/${sql_file}"
  if [[ ! -f "$file_path" ]]; then
    echo "[sale] Missing SQL file: ${sql_file}" >&2
    exit 1
  fi

  echo "[sale] Running ${sql_file}..."
  "${PSQL_APP[@]}" --single-transaction -f "$file_path"
done

echo "[sale] Completed successfully."
