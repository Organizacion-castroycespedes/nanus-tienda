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
    echo "[products] Missing required variable: ${var_name}" >&2
    exit 1
  fi
done

export PGPASSWORD="$DB_PASSWORD"
export PGCLIENTENCODING="${PGCLIENTENCODING:-UTF8}"
PSQL_APP=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -X -q)

if ! "${PSQL_APP[@]}" -tAc "SELECT 1;" >/dev/null 2>&1; then
  echo "[products] Could not connect to database." >&2
  exit 1
fi

core_schema_ready="$("${PSQL_APP[@]}" -tAc "
SELECT CASE
  WHEN to_regclass('public.tenants') IS NOT NULL
   AND to_regclass('public.roles') IS NOT NULL
   AND to_regclass('public.menu_items') IS NOT NULL
   AND to_regclass('public.role_menu_permissions') IS NOT NULL
  THEN '1' ELSE '0'
END;
" | tr -d '[:space:]')"

if [[ "$core_schema_ready" != "1" ]]; then
  echo "[products] Core schema is missing. Run the main migrations first." >&2
  exit 1
fi

sql_files=(
  "2026_04_25_inventory_products.sql"
  "2026_04_26_inventory_units_taxes_is_active.sql"
  "2026_04_26_inventory_suppliers.sql"
  "2026_04_26_inventory_customers.sql"
  "2026_04_26_inventory_customers_location.sql"
  "2026_04_26_inventory_orders.sql"
  "2026_04_26_inventory_order_items.sql"
  "2026_04_25_inventory_purchases.sql"
  "2026_04_26_inventory_purchases_type_balance.sql"
  "2026_04_25_inventory_purchase_items.sql"
  "2026_04_26_inventory_purchase_items_partial_reception.sql"
  "2026_04_25_inventory_stock_movements.sql"
  "2026_04_25_seed_menu_modules.sql"
  "2026_04_25_seed_menu_inventory_children.sql"
  "2026_04_26_seed_menu_role_actions.sql"
  "2026_04_25_seed_inventory_units.sql"
  "2026_04_25_seed_inventory_taxes.sql"
  "2026_04_25_seed_inventory_products.sql"
  "2026_04_26_seed_inventory_suppliers.sql"
)

for sql_file in "${sql_files[@]}"; do
  file_path="${SCRIPT_DIR}/${sql_file}"
  if [[ ! -f "$file_path" ]]; then
    echo "[products] Missing SQL file: ${sql_file}" >&2
    exit 1
  fi

  echo "[products] Running ${sql_file}..."
  if ! "${PSQL_APP[@]}" --single-transaction -f "$file_path"; then
    echo "[products] Failed while running ${sql_file}" >&2
    exit 1
  fi
done

echo "[products] Completed successfully."
