#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
MANIFEST_FILE="${SCRIPT_DIR}/bootstrap-manus-tienda-qa.manifest.md"

ENV_FILE="${1:-${DB_ENV_FILE:-}}"

if [[ -z "$ENV_FILE" ]]; then
  echo "[bootstrap-qa] Missing env file path." >&2
  echo "[bootstrap-qa] Usage: CONFIRM_CREATE_QA_DB=YES bash scripts/database/bootstrap-manus-tienda-qa.sh /secure/path/qa.env" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[bootstrap-qa] Env file not found: $ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$MANIFEST_FILE" ]]; then
  echo "[bootstrap-qa] SQL manifest not found: $MANIFEST_FILE" >&2
  echo "[bootstrap-qa] Review scripts/database/bootstrap-manus-tienda-qa.manifest.md before running bootstrap." >&2
  exit 1
fi

case "$ENV_FILE" in
  *db.env.example)
    echo "[bootstrap-qa] Refusing to use example env file: $ENV_FILE" >&2
    exit 1
    ;;
esac

# shellcheck disable=SC1090
source "$ENV_FILE"

DB_USER="${DB_USER:-${DB_OWNER:-}}"
DB_PASSWORD="${DB_PASSWORD:-${DB_APP_PASSWORD:-}}"
if [[ -n "${APP_DB_USER:-}" ]]; then
  DB_RUNTIME_USER="$APP_DB_USER"
  DB_RUNTIME_USER_SOURCE="APP_DB_USER"
elif [[ -n "${DB_RUNTIME_USER:-}" ]]; then
  DB_RUNTIME_USER_SOURCE="DB_RUNTIME_USER"
elif [[ -n "${MANUS_RUNTIME_DB_USER:-}" ]]; then
  DB_RUNTIME_USER="$MANUS_RUNTIME_DB_USER"
  DB_RUNTIME_USER_SOURCE="MANUS_RUNTIME_DB_USER"
else
  DB_RUNTIME_USER="manus_user"
  DB_RUNTIME_USER_SOURCE="default:manus_user"
fi
RUN_OPTIONAL_QA_FIXTURES="${RUN_OPTIONAL_QA_FIXTURES:-${APPLY_OPTIONAL_FIXTURES:-NO}}"
RUN_REPORTING_QA_FIXTURES="${RUN_REPORTING_QA_FIXTURES:-NO}"
RUN_SMOKE_SQL="${RUN_SMOKE_SQL:-YES}"
LOG_DIR="${LOG_DIR:-${SCRIPT_DIR}/logs}"

case "$LOG_DIR" in
  /*)
    ;;
  *)
    LOG_DIR="${SCRIPT_DIR}/${LOG_DIR#./}"
    ;;
esac

required_vars=(
  CONFIRM_CREATE_QA_DB
  DB_HOST
  DB_PORT
  DB_NAME
  DB_USER
  DB_PASSWORD
  DB_RUNTIME_USER
  DB_ADMIN_USER
  DB_ADMIN_PASSWORD
  ENVIRONMENT
  SEED_SUPER_ADMIN_EMAIL
  SEED_SUPER_ADMIN_PASSWORD
  SEED_SUPER_ADMIN_FIRST_NAME
  SEED_SUPER_ADMIN_LAST_NAME
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "[bootstrap-qa] Missing required variable: ${var_name}" >&2
    exit 1
  fi
done

if [[ "$CONFIRM_CREATE_QA_DB" != "YES" ]]; then
  echo "[bootstrap-qa] Refusing to run. Set CONFIRM_CREATE_QA_DB=YES in the external env file or shell." >&2
  exit 1
fi

if [[ "$DB_NAME" != *_qa ]]; then
  echo "[bootstrap-qa] Refusing to run. DB_NAME must end with _qa. Current DB_NAME=$DB_NAME" >&2
  exit 1
fi

if [[ "$DB_NAME" != "manus_tienda_qa" ]]; then
  echo "[bootstrap-qa] Refusing to run. This bootstrap is scoped to DB_NAME=manus_tienda_qa only." >&2
  exit 1
fi

if [[ "$DB_NAME" == "manus_tienda" || "$DB_NAME" == "manus_tienda_prd" ]]; then
  echo "[bootstrap-qa] Refusing to run against protected database: $DB_NAME" >&2
  exit 1
fi

case "$ENVIRONMENT" in
  qa|QA|staging|STAGING)
    ;;
  *)
    echo "[bootstrap-qa] Refusing to run. ENVIRONMENT must be qa or staging. Current ENVIRONMENT=$ENVIRONMENT" >&2
    exit 1
    ;;
esac

if [[ "${RUN_OPTIONAL_QA_FIXTURES:-NO}" != "NO" && "${RUN_OPTIONAL_QA_FIXTURES:-NO}" != "YES" ]]; then
  echo "[bootstrap-qa] RUN_OPTIONAL_QA_FIXTURES must be YES or NO." >&2
  exit 1
fi

if [[ "$RUN_REPORTING_QA_FIXTURES" != "NO" && "$RUN_REPORTING_QA_FIXTURES" != "YES" ]]; then
  echo "[bootstrap-qa] RUN_REPORTING_QA_FIXTURES must be YES or NO." >&2
  exit 1
fi

if [[ "$RUN_SMOKE_SQL" != "NO" && "$RUN_SMOKE_SQL" != "YES" ]]; then
  echo "[bootstrap-qa] RUN_SMOKE_SQL must be YES or NO." >&2
  exit 1
fi

mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/bootstrap-manus-tienda-qa-$(date +%Y%m%d%H%M%S).log"

log() {
  echo "$@" | tee -a "$LOG_FILE"
}

log "[bootstrap-qa] Starting QA bootstrap plan."
log "[bootstrap-qa] DB_NAME=$DB_NAME"
log "[bootstrap-qa] DB_USER=$DB_USER"
log "[bootstrap-qa] DB_RUNTIME_USER=$DB_RUNTIME_USER"
log "[bootstrap-qa] DB_RUNTIME_USER_SOURCE=$DB_RUNTIME_USER_SOURCE"
log "[bootstrap-qa] ENVIRONMENT=$ENVIRONMENT"
log "[bootstrap-qa] RUN_OPTIONAL_QA_FIXTURES=${RUN_OPTIONAL_QA_FIXTURES:-NO}"
log "[bootstrap-qa] RUN_REPORTING_QA_FIXTURES=$RUN_REPORTING_QA_FIXTURES"
log "[bootstrap-qa] RUN_SMOKE_SQL=$RUN_SMOKE_SQL"
log "[bootstrap-qa] Log file: $LOG_FILE"
log "[bootstrap-qa] SQL manifest: $MANIFEST_FILE"
log "[bootstrap-qa] Manifest is documentation for review. Execution order remains controlled by migrate_prd.sh."
log "[bootstrap-qa] Functional QA SQL fixtures run only when RUN_OPTIONAL_QA_FIXTURES=YES."
log "[bootstrap-qa] Legacy reporting QA SQL fixtures run only when RUN_REPORTING_QA_FIXTURES=YES."
log "[bootstrap-qa] Runtime DB grants run at the end of migrate_prd.sh."
log "[bootstrap-qa] Rollback SQL files are excluded from forward bootstrap by migrate_prd.sh."

log "[bootstrap-qa] Running full schema/migration bootstrap via migrate_prd.sh."
export RUN_OPTIONAL_QA_FIXTURES
export RUN_REPORTING_QA_FIXTURES
export DB_RUNTIME_USER
bash "${SCRIPT_DIR}/migrate_prd.sh" "$ENV_FILE" 2>&1 | tee -a "$LOG_FILE"

if [[ "${RUN_OPTIONAL_QA_FIXTURES:-NO}" == "YES" ]]; then
  log "[bootstrap-qa] Running optional QA product fixtures."
  bash "${SCRIPT_DIR}/products/run_all.sh" "$ENV_FILE" 2>&1 | tee -a "$LOG_FILE"
else
  log "[bootstrap-qa] Optional QA fixtures skipped."
fi

if [[ "$RUN_SMOKE_SQL" == "YES" ]]; then
  log "[bootstrap-qa] Running smoke SQL checks."
  export PGPASSWORD="$DB_PASSWORD"
  PSQL_APP=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -X -q)

  "${PSQL_APP[@]}" -c "
  SELECT
    current_database() AS database,
    current_user AS user_name,
    now() AS checked_at;
  " 2>&1 | tee -a "$LOG_FILE"

  "${PSQL_APP[@]}" -c "
  SELECT version, success, details
  FROM public.migrations_history
  ORDER BY applied_at DESC
  LIMIT 20;
  " 2>&1 | tee -a "$LOG_FILE"

  "${PSQL_APP[@]}" -c "
  SELECT
    to_regclass('public.tenants') AS tenants,
    to_regclass('public.tenant_branches') AS tenant_branches,
    to_regclass('public.roles') AS roles,
    to_regclass('public.menu_items') AS menu_items,
    to_regclass('public.role_menu_permissions') AS role_menu_permissions,
    to_regclass('public.users') AS users,
    to_regclass('public.pos_terminals') AS pos_terminals,
    to_regclass('public.pos_terminal_peripheral_settings') AS pos_terminal_peripheral_settings;
  " 2>&1 | tee -a "$LOG_FILE"
else
  log "[bootstrap-qa] Smoke SQL checks skipped."
fi

log "[bootstrap-qa] Completed successfully."
