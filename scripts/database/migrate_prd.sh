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

required_vars=(DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD)
for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "[prd] Missing required variable: ${var_name}" >&2
    exit 1
  fi
done

export PGPASSWORD="$DB_PASSWORD"
export PGCLIENTENCODING="${PGCLIENTENCODING:-UTF8}"
PSQL_APP=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -X -q)

if ! "${PSQL_APP[@]}" -tAc "SELECT 1;" >/dev/null 2>&1; then
  echo "[prd] Could not connect to database ${DB_NAME}." >&2
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

record_migration() {
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

apply_sql_file() {
  local relative_path="$1"
  local file_path="${SCRIPT_DIR}/${relative_path}"
  local version="$relative_path"
  local checksum

  if [[ ! -f "$file_path" ]]; then
    echo "[prd] Missing SQL file: ${relative_path}" >&2
    exit 1
  fi

  if [[ "$(is_applied "$version")" == "1" ]]; then
    echo "[prd] Skipping already applied: ${version}"
    return
  fi

  checksum="$(checksum_for_file "$file_path")"
  echo "[prd] Applying ${version}..."

  if "${PSQL_APP[@]}" --single-transaction -f "$file_path"; then
    record_migration "$version" "$checksum" "true" "applied by migrate_prd.sh"
  else
    record_migration "$version" "$checksum" "false" "failed in migrate_prd.sh"
    echo "[prd] Failed while running ${version}" >&2
    exit 1
  fi
}

schema_files=(
  "001_initial_schema.sql"
  "002_extensions.sql"
  "003_seed_roles.sql"
  "005_seed_general_data.sql"
  "006_seed_menu_items.sql"
  "007_seed_role_menu_permissions.sql"
  "008_pos_terminals_and_sessions.sql"
  "009_seed_demo_operational_users.sql"
  "010_seed_demo_user_roles.sql"
  "products/2026_04_25_inventory_products.sql"
  "products/2026_04_26_inventory_units_taxes_is_active.sql"
  "products/2026_04_26_inventory_suppliers.sql"
  "products/2026_04_26_inventory_customers.sql"
  "products/2026_04_26_inventory_customers_location.sql"
  "products/2026_04_26_inventory_orders.sql"
  "products/2026_04_26_inventory_order_items.sql"
  "products/2026_04_30_inventory_order_billing.sql"
  "products/2026_04_25_inventory_purchases.sql"
  "products/2026_04_26_inventory_purchases_type_balance.sql"
  "products/2026_04_25_inventory_purchase_items.sql"
  "products/2026_04_26_inventory_purchase_items_partial_reception.sql"
  "products/2026_04_25_inventory_stock_movements.sql"
  "products/2026_04_28_inventory_stock_movements_pos_context.sql"
  "sale/001_sales.sql"
  "sale/002_sale_items.sql"
  "sale/003_sale_item_taxes.sql"
  "sale/004_sale_payment_methods.sql"
  "sale/010_sales_pos_context.sql"
  "sale/005_relations_indexes.sql"
  "sale/007_update_sales_balance_constraint.sql"
  "sale/008_update_orders_status_constraint.sql"
  "finance/migrations/20260430_1753_finance_base_infrastructure.sql"
  "finance/migrations/20260430_1947_finance_payments_engine.sql"
  "finance/migrations/20260502_1015_finance_cash_closing_controls.sql"
  "finance/patches/20260430_1956_finance_payment_integration.sql"
  "finance/patches/20260502_1135_finance_menu_access.sql"
  "finance/patches/20260502_1840_finance_cash_movements_reference_text.sql"
)

function_files=(
  "sale/006_create_sale_function.sql"
  "sale/009_cancel_sale_function.sql"
  "products/2026_05_01_inventory_dashboard.sql"
)

minimal_seed_files=(
  "011_prd_default_customer.sql"
)

echo "Running schema..."
for sql_file in "${schema_files[@]}"; do
  apply_sql_file "$sql_file"
done

echo "Running functions..."
for sql_file in "${function_files[@]}"; do
  apply_sql_file "$sql_file"
done

echo "Running minimal seed (consumer)..."
for sql_file in "${minimal_seed_files[@]}"; do
  apply_sql_file "$sql_file"
done

echo "[prd] Production migration completed successfully."
