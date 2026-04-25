#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEFAULT_ENV_FILE="${ROOT_DIR}/scripts/config/db.env"
ENV_FILE="${1:-${DB_ENV_FILE:-$DEFAULT_ENV_FILE}}"
LOG_DIR="${SCRIPT_DIR}/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/deploy-db-$(date +%Y%m%d%H%M%S).log"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

required_vars=(
  SSH_HOST SSH_PORT SSH_USER SSH_REMOTE_DIR
  DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD ENVIRONMENT
)
for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "[deploy-db] Missing required variable: ${var_name}" >&2
    exit 1
  fi
done

run_remote() {
  ssh -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" "$@"
}

escape_squotes() {
  printf "%s" "$1" | sed "s/'/'\"'\"'/g"
}

echo "[deploy-db] Starting deployment to ${SSH_USER}@${SSH_HOST} (${ENVIRONMENT})" | tee -a "$LOG_FILE"

remote_env=$(cat <<EOF
export DB_HOST='$(escape_squotes "${DB_HOST}")'
export DB_PORT='$(escape_squotes "${DB_PORT}")'
export DB_NAME='$(escape_squotes "${DB_NAME}")'
export DB_USER='$(escape_squotes "${DB_USER}")'
export DB_PASSWORD='$(escape_squotes "${DB_PASSWORD}")'
export DB_ADMIN_USER='$(escape_squotes "${DB_ADMIN_USER:-$DB_USER}")'
export DB_ADMIN_PASSWORD='$(escape_squotes "${DB_ADMIN_PASSWORD:-$DB_PASSWORD}")'
export ENVIRONMENT='$(escape_squotes "${ENVIRONMENT}")'
export SEED_SUPER_ADMIN_EMAIL='$(escape_squotes "${SEED_SUPER_ADMIN_EMAIL:-admin@tenantcore.local}")'
export SEED_SUPER_ADMIN_PASSWORD='$(escape_squotes "${SEED_SUPER_ADMIN_PASSWORD:-ChangeMe123!}")'
export SEED_SUPER_ADMIN_FIRST_NAME='$(escape_squotes "${SEED_SUPER_ADMIN_FIRST_NAME:-Super}")'
export SEED_SUPER_ADMIN_LAST_NAME='$(escape_squotes "${SEED_SUPER_ADMIN_LAST_NAME:-Admin}")'
EOF
)

db_exists="$(
  run_remote "cd '$(escape_squotes "${SSH_REMOTE_DIR}")' && ${remote_env} && export PGPASSWORD=\"\$DB_ADMIN_PASSWORD\" && psql -h \"\$DB_HOST\" -p \"\$DB_PORT\" -U \"\$DB_ADMIN_USER\" -d postgres -v ON_ERROR_STOP=1 -X -tAc \"SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_database WHERE datname = '\$DB_NAME') THEN '1' ELSE '0' END;\"" \
    | tr -d '[:space:]'
)"

if [[ "$db_exists" == "1" ]]; then
  run_remote "cd '$(escape_squotes "${SSH_REMOTE_DIR}")' && ${remote_env} && bash scripts/database/backup.sh" | tee -a "$LOG_FILE"
else
  echo "[deploy-db] Database does not exist yet. Backup skipped." | tee -a "$LOG_FILE"
fi

run_remote "cd '$(escape_squotes "${SSH_REMOTE_DIR}")' && ${remote_env} && bash scripts/database/migrate.sh" | tee -a "$LOG_FILE"

is_new_env="$(
  run_remote "cd '$(escape_squotes "${SSH_REMOTE_DIR}")' && ${remote_env} && export PGPASSWORD=\"\$DB_PASSWORD\" && psql -h \"\$DB_HOST\" -p \"\$DB_PORT\" -U \"\$DB_USER\" -d \"\$DB_NAME\" -v ON_ERROR_STOP=1 -X -tAc \"SELECT CASE WHEN to_regclass('public.users') IS NULL THEN '1' WHEN COALESCE((SELECT COUNT(*) FROM public.users), 0) = 0 THEN '1' ELSE '0' END;\"" \
    | tr -d '[:space:]'
)"

if [[ "$is_new_env" == "1" ]]; then
  echo "[deploy-db] New environment detected. Running seed..." | tee -a "$LOG_FILE"
  run_remote "cd '$(escape_squotes "${SSH_REMOTE_DIR}")' && ${remote_env} && bash scripts/database/seed.sh" | tee -a "$LOG_FILE"
else
  echo "[deploy-db] Existing environment detected. Seed skipped." | tee -a "$LOG_FILE"
fi

echo "[deploy-db] Deployment completed successfully." | tee -a "$LOG_FILE"
echo "[deploy-db] Log file: $LOG_FILE"
