#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

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

RUN_OPTIONAL_QA_FIXTURES="${RUN_OPTIONAL_QA_FIXTURES:-${APPLY_OPTIONAL_FIXTURES:-NO}}"
RUN_REPORTING_QA_FIXTURES="${RUN_REPORTING_QA_FIXTURES:-NO}"

required_vars=(DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD)
for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "[prd] Missing required variable: ${var_name}" >&2
    exit 1
  fi
done

if [[ "$RUN_OPTIONAL_QA_FIXTURES" != "NO" && "$RUN_OPTIONAL_QA_FIXTURES" != "YES" ]]; then
  echo "[prd] RUN_OPTIONAL_QA_FIXTURES/APPLY_OPTIONAL_FIXTURES must be YES or NO." >&2
  exit 1
fi

if [[ "$RUN_REPORTING_QA_FIXTURES" != "NO" && "$RUN_REPORTING_QA_FIXTURES" != "YES" ]]; then
  echo "[prd] RUN_REPORTING_QA_FIXTURES must be YES or NO." >&2
  exit 1
fi

export PGPASSWORD="$DB_PASSWORD"
export PGCLIENTENCODING="${PGCLIENTENCODING:-UTF8}"
PSQL_APP=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -X -q)
DB_ADMIN_USER="${DB_ADMIN_USER:-$DB_USER}"
DB_ADMIN_PASSWORD="${DB_ADMIN_PASSWORD:-$DB_PASSWORD}"
PSQL_ADMIN=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_ADMIN_USER" -d postgres -v ON_ERROR_STOP=1 -X -q)

ensure_database_exists() {
  echo "[prd] Ensuring database role and database exist..."

  if ! PGPASSWORD="$DB_ADMIN_PASSWORD" "${PSQL_ADMIN[@]}" -tAc "SELECT 1;" >/dev/null 2>&1; then
    echo "[prd] Could not connect with admin user '$DB_ADMIN_USER' to database 'postgres'." >&2
    echo "[prd] Check DB_ADMIN_USER/DB_ADMIN_PASSWORD and PostgreSQL availability." >&2
    exit 1
  fi

  local role_exists
  role_exists="$(
    PGPASSWORD="$DB_ADMIN_PASSWORD" "${PSQL_ADMIN[@]}" -tAc \
      "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER';" | tr -d '[:space:]'
  )"

  if [[ "$role_exists" != "1" ]]; then
    echo "[prd] Creating application role: $DB_USER"
    PGPASSWORD="$DB_ADMIN_PASSWORD" "${PSQL_ADMIN[@]}" -c \
      "CREATE ROLE \"$DB_USER\" LOGIN PASSWORD '$DB_PASSWORD';"
  fi

  local db_exists
  db_exists="$(
    PGPASSWORD="$DB_ADMIN_PASSWORD" "${PSQL_ADMIN[@]}" -tAc \
      "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME';" | tr -d '[:space:]'
  )"

  if [[ "$db_exists" != "1" ]]; then
    echo "[prd] Creating database: $DB_NAME"
    PGPASSWORD="$DB_ADMIN_PASSWORD" "${PSQL_ADMIN[@]}" -c \
      "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";"
  fi

  PGPASSWORD="$DB_ADMIN_PASSWORD" "${PSQL_ADMIN[@]}" -c \
    "GRANT ALL PRIVILEGES ON DATABASE \"$DB_NAME\" TO \"$DB_USER\";" >/dev/null
}

ensure_database_exists

if ! "${PSQL_APP[@]}" -tAc "SELECT 1;" >/dev/null 2>&1; then
  echo "[prd] Could not connect to database ${DB_NAME} with application user ${DB_USER}." >&2
  exit 1
fi

ensure_migrations_history_schema() {
  "${PSQL_APP[@]}" -c "
  CREATE SCHEMA IF NOT EXISTS public;
  CREATE TABLE IF NOT EXISTS public.migrations_history (
    id bigserial PRIMARY KEY,
    version text NOT NULL UNIQUE,
    applied_at timestamptz NOT NULL DEFAULT now(),
    applied_by text NOT NULL DEFAULT current_user,
    checksum text,
    success boolean NOT NULL DEFAULT true,
    details text,
    execution_time_ms integer NULL
  );
  ALTER TABLE public.migrations_history
    ADD COLUMN IF NOT EXISTS execution_time_ms integer NULL;"
}

ensure_migrations_history_schema

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "[prd] Missing migrations directory: ${MIGRATIONS_DIR}" >&2
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

current_time_ms() {
  if date +%s%3N >/dev/null 2>&1; then
    date +%s%3N
  else
    echo "$(( $(date +%s) * 1000 ))"
  fi
}

escape_sql_literal() {
  local value="${1:-}"
  value="${value//\'/\'\'}"
  printf "%s" "$value"
}

validate_incremental_migration_name() {
  local version="$1"

  if [[ "$version" =~ ^V[0-9]{3}__.+\.sql$ ]]; then
    return 0
  fi

  if [[ "$version" =~ ^[0-9]{8}_.+\.sql$ ]]; then
    return 0
  fi

  echo "[prd] Invalid migration name '${version}'." >&2
  echo "[prd] Use V###__description.sql for new migrations. Legacy YYYYMMDD_description.sql remains supported." >&2
  exit 1
}

get_migration_row() {
  local version="$1"
  local escaped_version
  escaped_version="$(escape_sql_literal "$version")"

  "${PSQL_APP[@]}" -F $'\t' -Atc \
    "SELECT COALESCE(checksum, ''), success::text
     FROM public.migrations_history
     WHERE version = '${escaped_version}'
     LIMIT 1;"
}

verify_applied_migration_integrity() {
  local version="$1"
  local checksum="$2"
  local migration_row
  local stored_checksum
  local stored_success

  migration_row="$(get_migration_row "$version")"
  if [[ -z "$migration_row" ]]; then
    return 1
  fi

  IFS=$'\t' read -r stored_checksum stored_success <<< "$migration_row"

  if [[ "$stored_success" != "true" ]]; then
    echo "[prd] Migration ${version} is registered with success=false. Resolve it manually before continuing." >&2
    exit 1
  fi

  if [[ -n "$stored_checksum" && "$stored_checksum" != "$checksum" ]]; then
    echo "[prd] Checksum mismatch for ${version}." >&2
    echo "[prd] Stored:  ${stored_checksum}" >&2
    echo "[prd] Current: ${checksum}" >&2
    echo "[prd] Execution aborted to avoid running an altered migration." >&2
    exit 1
  fi

  if [[ -z "$stored_checksum" ]]; then
    echo "[prd] Skipping already applied legacy migration without checksum: ${version}"
  else
    echo "[prd] Skipping already applied migration: ${version}"
  fi

  return 0
}

record_migration() {
  local version="$1"
  local checksum="$2"
  local success="$3"
  local details="$4"
  local execution_time_ms="$5"
  local escaped_version
  local escaped_checksum
  local escaped_details

  escaped_version="$(escape_sql_literal "$version")"
  escaped_checksum="$(escape_sql_literal "$checksum")"
  escaped_details="$(escape_sql_literal "$details")"

  "${PSQL_APP[@]}" -c "
    INSERT INTO public.migrations_history (version, checksum, success, details, execution_time_ms)
    VALUES ('${escaped_version}', '${escaped_checksum}', ${success}, '${escaped_details}', ${execution_time_ms});"
}

apply_sql_file_with_args() {
  local relative_path="$1"
  shift
  local file_path="${SCRIPT_DIR}/${relative_path}"
  local version="$relative_path"
  local checksum
  local psql_args=("$@")
  local start_time_ms
  local end_time_ms
  local execution_time_ms

  if [[ ! -f "$file_path" ]]; then
    echo "[prd] Missing SQL file: ${relative_path}" >&2
    exit 1
  fi

  checksum="$(checksum_for_file "$file_path")"

  if verify_applied_migration_integrity "$version" "$checksum"; then
    return
  fi

  start_time_ms="$(current_time_ms)"
  echo "[prd] Applying ${version}..."

  if "${PSQL_APP[@]}" "${psql_args[@]}" --single-transaction -f "$file_path"; then
    end_time_ms="$(current_time_ms)"
    execution_time_ms="$((end_time_ms - start_time_ms))"
    record_migration "$version" "$checksum" "true" "applied by migrate_prd.sh" "$execution_time_ms"
    echo "[prd] ${version} | ${execution_time_ms} ms | OK"
  else
    end_time_ms="$(current_time_ms)"
    execution_time_ms="$((end_time_ms - start_time_ms))"
    echo "[prd] ${version} | ${execution_time_ms} ms | ERROR" >&2
    echo "[prd] Failed while running ${version}" >&2
    exit 1
  fi
}

apply_sql_file() {
  apply_sql_file_with_args "$1"
}

schema_files=(
  "001_initial_schema.sql"
  "002_extensions.sql"
  "003_seed_roles.sql"
  "008_pos_terminals_and_sessions.sql"
  "005_seed_general_data.sql"
  "004_seed_super_admin.sql"
  "006_seed_menu_items.sql"
  "products/2026_04_25_seed_menu_modules.sql"
  "007_seed_role_menu_permissions.sql"
  "products/2026_04_26_seed_menu_role_actions.sql"
  "009_seed_demo_operational_users.sql"
  "010_seed_demo_user_roles.sql"
  "products/2026_04_25_inventory_products.sql"
  "products/2026_04_26_inventory_units_taxes_is_active.sql"
  "products/2026_04_25_seed_inventory_units.sql"
  "products/2026_04_25_seed_inventory_taxes.sql"
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
  "sale/011_sales_refunded_branch_stock.sql"
  "finance/migrations/20260430_1753_finance_base_infrastructure.sql"
  "finance/migrations/20260430_1947_finance_payments_engine.sql"
  "finance/migrations/20260502_1015_finance_cash_closing_controls.sql"
  "finance/patches/20260430_1956_finance_payment_integration.sql"
  "finance/patches/20260502_1135_finance_menu_access.sql"
  "finance/patches/20260502_1840_finance_cash_movements_reference_text.sql"
  "finance/migrations/20260503_2030_finance_cash_payment_traceability.sql"
)

function_files=(
  "sale/006_create_sale_function.sql"
  "sale/009_cancel_sale_function.sql"
  "sale/012_sale_financial_sync_and_pos_function.sql"
  "products/2026_05_01_inventory_dashboard.sql"
)

readarray -t incremental_migration_files < <(
  find "${MIGRATIONS_DIR}" -maxdepth 1 -type f -name '*.sql' -print \
    | LC_ALL=C sort \
    | while read -r file_path; do
        basename "$file_path"
      done
)

functional_qa_fixture_migration_files=(
  "20260611_mvp_01_2b_functional_qa_fixtures.sql"
)

reporting_qa_fixture_migration_files=(
  "20260505_reporting_pos_fixtures.sql"
)

is_fixture_migration() {
  local version="$1"

  for optional_fixture in "${functional_qa_fixture_migration_files[@]}" "${reporting_qa_fixture_migration_files[@]}"; do
    if [[ "$version" == "$optional_fixture" ]]; then
      return 0
    fi
  done

  return 1
}

is_rollback_migration() {
  local version="$1"

  if [[ "$version" == *_rollback.sql || "$version" == *rollback*.sql ]]; then
    return 0
  fi

  return 1
}

minimal_seed_files=(
  "011_prd_default_customer.sql"
)

echo "Running schema..."
for sql_file in "${schema_files[@]}"; do
  if [[ "$sql_file" == "004_seed_super_admin.sql" ]]; then
    super_admin_vars=(
      "SEED_SUPER_ADMIN_EMAIL"
      "SEED_SUPER_ADMIN_PASSWORD"
      "SEED_SUPER_ADMIN_FIRST_NAME"
      "SEED_SUPER_ADMIN_LAST_NAME"
    )

    for var_name in "${super_admin_vars[@]}"; do
      if [[ -z "${!var_name:-}" ]]; then
        echo "[prd] Missing required SUPER_ADMIN seed variable: ${var_name}" >&2
        exit 1
      fi
    done

    apply_sql_file_with_args \
      "$sql_file" \
      -v "super_admin_email=${SEED_SUPER_ADMIN_EMAIL}" \
      -v "super_admin_password=${SEED_SUPER_ADMIN_PASSWORD}" \
      -v "super_admin_first_name=${SEED_SUPER_ADMIN_FIRST_NAME}" \
      -v "super_admin_last_name=${SEED_SUPER_ADMIN_LAST_NAME}"
  else
    apply_sql_file "$sql_file"
  fi
done

echo "Running functions..."
for sql_file in "${function_files[@]}"; do
  apply_sql_file "$sql_file"
done

echo "Running incremental migrations..."
found_pending_incremental="false"
for sql_file in "${incremental_migration_files[@]}"; do
  if is_rollback_migration "$sql_file"; then
    echo "[prd] Skipping rollback SQL in forward migration runner: migrations/${sql_file}"
    continue
  fi

  validate_incremental_migration_name "$sql_file"

  if is_fixture_migration "$sql_file"; then
    echo "[prd] Skipping QA fixture in forward migration runner: migrations/${sql_file}"
    continue
  fi

  file_path="${MIGRATIONS_DIR}/${sql_file}"
  checksum="$(checksum_for_file "$file_path")"

  if verify_applied_migration_integrity "$sql_file" "$checksum"; then
    if [[ "$found_pending_incremental" == "true" ]]; then
      echo "[prd] Out-of-order incremental migration detected: ${sql_file} is already applied after a pending earlier migration." >&2
      echo "[prd] Add new migrations at the end of the alphabetical sequence only." >&2
      exit 1
    fi
    continue
  fi

  found_pending_incremental="true"
  apply_sql_file "migrations/${sql_file}"
done

if [[ "$RUN_OPTIONAL_QA_FIXTURES" == "YES" ]]; then
  echo "Running functional QA fixtures..."
  for sql_file in "${functional_qa_fixture_migration_files[@]}"; do
    apply_sql_file "migrations/${sql_file}"
  done
else
  echo "[prd] Functional QA fixtures skipped."
fi

if [[ "$RUN_REPORTING_QA_FIXTURES" == "YES" ]]; then
  echo "Running reporting QA fixtures..."
  for sql_file in "${reporting_qa_fixture_migration_files[@]}"; do
    apply_sql_file "migrations/${sql_file}"
  done
else
  echo "[prd] Reporting QA fixtures skipped."
fi

echo "Running minimal seed (consumer)..."
for sql_file in "${minimal_seed_files[@]}"; do
  apply_sql_file "$sql_file"
done

echo "[prd] Production migration completed successfully."
