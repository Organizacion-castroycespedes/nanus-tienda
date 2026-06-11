#!/usr/bin/env bash
set -euo pipefail

STAGING_BIN_DIR="${1:-}"
DEPLOY_BASE_PATH="${DEPLOY_BASE_PATH:-/home/ubuntu/manustienda}"
RUN_LOCAL_SMOKE="${RUN_LOCAL_SMOKE:-YES}"
RUN_PM2_SAVE="${RUN_PM2_SAVE:-NO}"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"

if [[ -z "${STAGING_BIN_DIR}" || ! -d "${STAGING_BIN_DIR}" ]]; then
  echo "Usage: $0 <staging-bin-dir>" >&2
  exit 64
fi

if [[ -z "${DEPLOY_BASE_PATH}" || "${DEPLOY_BASE_PATH}" == "/" ]]; then
  echo "DEPLOY_BASE_PATH is unsafe" >&2
  exit 65
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ECOSYSTEM_SOURCE="${SCRIPT_DIR}/../pm2/ecosystem.qa.config.js"
ECOSYSTEM_TARGET="${DEPLOY_BASE_PATH}/scripts/pm2/ecosystem.qa.config.js"
BACKUP_ROOT="${DEPLOY_BASE_PATH}/backups/backends/${TIMESTAMP}"

if [[ ! -f "${ECOSYSTEM_SOURCE}" ]]; then
  echo "Missing PM2 ecosystem source: ${ECOSYSTEM_SOURCE}" >&2
  exit 66
fi

wait_for_http() {
  local url="$1"
  local max_attempts="${2:-30}"
  local sleep_seconds="${3:-2}"
  local attempt=1

  while (( attempt <= max_attempts )); do
    echo "Smoke attempt ${attempt}/${max_attempts}: ${url}"
    if curl -fsS "${url}" >/dev/null; then
      echo "Smoke OK ${url}"
      return 0
    fi

    if (( attempt == max_attempts )); then
      echo "Smoke FAILED ${url} after ${max_attempts} attempts" >&2
      return 1
    fi

    sleep "${sleep_seconds}"
    attempt=$((attempt + 1))
  done
}

SERVICES=(
  "api-linux|build|api-linux|4020|/api/system/version"
  "backend-reporteria-linux|build-reporteria|backend-reporteria-linux|4021|/api/reports/health"
  "backend-facturacion-electronica-linux|build-facturacion-electronica|backend-facturacion-electronica-linux|4022|/health"
  "backend-perifericos-linux|build-perifericos|backend-perifericos-linux|4023|/health"
)

mkdir -p "${BACKUP_ROOT}"
mkdir -p "$(dirname "${ECOSYSTEM_TARGET}")"
install -m 0644 "${ECOSYSTEM_SOURCE}" "${ECOSYSTEM_TARGET}"

for service_entry in "${SERVICES[@]}"; do
  IFS="|" read -r service_name runtime_dir binary_name port health_path <<< "${service_entry}"
  runtime_path="${DEPLOY_BASE_PATH}/${runtime_dir}"
  source_binary="${STAGING_BIN_DIR}/${binary_name}"
  target_binary="${runtime_path}/${binary_name}"
  backup_dir="${BACKUP_ROOT}/${service_name}"

  if [[ ! -f "${source_binary}" ]]; then
    echo "Missing binary: ${source_binary}" >&2
    exit 67
  fi

  mkdir -p "${runtime_path}" "${backup_dir}"

  if [[ -f "${target_binary}" ]]; then
    cp -p "${target_binary}" "${backup_dir}/${binary_name}"
    echo "Backed up ${target_binary} to ${backup_dir}/${binary_name}"
  else
    echo "No current binary found for ${service_name}; first deploy path"
  fi

  install -m 0755 "${source_binary}" "${target_binary}.new"
  mv -f "${target_binary}.new" "${target_binary}"
  chmod +x "${target_binary}"
  echo "Installed ${service_name} on port ${port}"
done

pm2 startOrReload "${ECOSYSTEM_TARGET}" \
  --only "api-linux,backend-reporteria-linux,backend-facturacion-electronica-linux,backend-perifericos-linux" \
  --update-env

if [[ "${RUN_LOCAL_SMOKE}" == "YES" ]]; then
  echo "Running local smoke checks"
  for service_entry in "${SERVICES[@]}"; do
    IFS="|" read -r service_name runtime_dir binary_name port health_path <<< "${service_entry}"
    smoke_url="http://127.0.0.1:${port}${health_path}"
    wait_for_http "${smoke_url}" 30 2
    echo "Smoke OK ${service_name} ${smoke_url}"
  done
else
  echo "Skipping local smoke checks"
fi

if [[ "${RUN_PM2_SAVE}" == "YES" ]]; then
  pm2 save
else
  echo "Skipping pm2 save. Set RUN_PM2_SAVE=YES after manual approval."
fi

echo "QA backend deploy script completed. Backups: ${BACKUP_ROOT}"
