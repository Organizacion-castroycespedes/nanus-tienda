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
    echo "[seed] Missing required variable: ${var_name}" >&2
    exit 1
  fi
done

SEED_SUPER_ADMIN_EMAIL="${SEED_SUPER_ADMIN_EMAIL:-admin@manustienda.local}"
SEED_SUPER_ADMIN_PASSWORD="${SEED_SUPER_ADMIN_PASSWORD:-ChangeMe123!}"
SEED_SUPER_ADMIN_FIRST_NAME="${SEED_SUPER_ADMIN_FIRST_NAME:-Super}"
SEED_SUPER_ADMIN_LAST_NAME="${SEED_SUPER_ADMIN_LAST_NAME:-Admin}"

export PGPASSWORD="$DB_PASSWORD"
export PGCLIENTENCODING="${PGCLIENTENCODING:-UTF8}"
PSQL_APP=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -X -q)

if ! "${PSQL_APP[@]}" -tAc "SELECT 1;" >/dev/null; then
  echo "[seed] Could not connect to database." >&2
  exit 1
fi

core_schema_ready="$("${PSQL_APP[@]}" -tAc "
SELECT CASE
  WHEN to_regclass('public.paises') IS NOT NULL
   AND to_regclass('public.tenants') IS NOT NULL
   AND to_regclass('public.roles') IS NOT NULL
   AND to_regclass('public.users') IS NOT NULL
  THEN '1' ELSE '0'
END; " | tr -d '[:space:]')"

if [[ "$core_schema_ready" != "1" ]]; then
  echo "[seed] Core schema is missing. Run migrate first and ensure it completed successfully." >&2
  exit 1
fi

echo "[seed] Running general data seed..."
"${PSQL_APP[@]}" -f "${SCRIPT_DIR}/005_seed_general_data.sql"

echo "[seed] Running menu seed..."
"${PSQL_APP[@]}" -f "${SCRIPT_DIR}/006_seed_menu_items.sql"

echo "[seed] Running roles and permissions seed..."
"${PSQL_APP[@]}" -f "${SCRIPT_DIR}/003_seed_roles.sql"

echo "[seed] Running super admin and demo users seed..."
"${PSQL_APP[@]}" \
  -v super_admin_email="$SEED_SUPER_ADMIN_EMAIL" \
  -v super_admin_password="$SEED_SUPER_ADMIN_PASSWORD" \
  -v super_admin_first_name="$SEED_SUPER_ADMIN_FIRST_NAME" \
  -v super_admin_last_name="$SEED_SUPER_ADMIN_LAST_NAME" \
  -f "${SCRIPT_DIR}/004_seed_super_admin.sql"

echo "[seed] Running demo operational users and menus seed..."
"${PSQL_APP[@]}" -f "${SCRIPT_DIR}/009_seed_demo_operational_users.sql"

echo "[seed] Running demo user-role assignments seed..."
"${PSQL_APP[@]}" -f "${SCRIPT_DIR}/010_seed_demo_user_roles.sql"

echo "[seed] Running finance menu access seed..."
"${PSQL_APP[@]}" -f "${SCRIPT_DIR}/finance/patches/20260502_1135_finance_menu_access.sql"

echo "[seed] Running role-menu permissions seed..."
"${PSQL_APP[@]}" -f "${SCRIPT_DIR}/007_seed_role_menu_permissions.sql"

echo "[seed] Running Gestión Operativa menu seed..."
"${PSQL_APP[@]}" -f "${SCRIPT_DIR}/014_operational_management_menu.sql"

if [[ -f "${SCRIPT_DIR}/products/2026_04_25_seed_inventory_taxes.sql" ]]; then
  echo "[seed] Running base inventory taxes seed..."
  "${PSQL_APP[@]}" -f "${SCRIPT_DIR}/products/2026_04_25_seed_inventory_taxes.sql"
fi

if [[ -f "${SCRIPT_DIR}/products/2026_09_12_seed_inventory_taxes_and_tax_model.sql" ]]; then
  echo "[seed] Running tax model catalog/rates seed (VPS-safe idempotent)..."
  "${PSQL_APP[@]}" -f "${SCRIPT_DIR}/products/2026_09_12_seed_inventory_taxes_and_tax_model.sql"
fi

if [[ -f "${SCRIPT_DIR}/products/2026_09_12_migrate_existing_alcohol_products.sql" ]]; then
  echo "[seed] Running existing alcohol products tax-profile migration..."
  "${PSQL_APP[@]}" -f "${SCRIPT_DIR}/products/2026_09_12_migrate_existing_alcohol_products.sql"
fi

if [[ -f "${SCRIPT_DIR}/products/2026_09_12_migrate_alcohol_from_excel.sql" ]]; then
  echo "[seed] Running Excel alcohol catalog tax-profile migration..."
  "${PSQL_APP[@]}" -f "${SCRIPT_DIR}/products/2026_09_12_migrate_alcohol_from_excel.sql"
fi

echo "[seed] Completed successfully."
