#!/usr/bin/env bash
set -euo pipefail

STAGING_DIR="${1:-}"
DEPLOY_BASE_PATH="${DEPLOY_BASE_PATH:-/opt/emaus/tienda}"
WEB_PATH="${WEB_PATH:-/var/www/emaus-web}"
API_PATH="${API_PATH:-/opt/emaus/tienda/emaus_api}"
FACTURACION_PATH="${FACTURACION_PATH:-/opt/emaus/tienda/emaus_facturacion}"
REPORTERIA_PATH="${REPORTERIA_PATH:-/opt/emaus/tienda/emaus_reporteria}"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_DIR="${DEPLOY_BASE_PATH}/backups/full/${TIMESTAMP}"

if [[ -z "${STAGING_DIR}" || ! -d "${STAGING_DIR}" ]]; then
  echo "Usage: $0 <staging-dir>" >&2
  exit 64
fi
if [[ -z "${DEPLOY_BASE_PATH}" || "${DEPLOY_BASE_PATH}" == "/" ]]; then
  echo "DEPLOY_BASE_PATH is unsafe" >&2
  exit 65
fi

wait_for_http() {
  local url="$1"
  for attempt in $(seq 1 30); do
    if curl -fsS "$url" >/dev/null; then return 0; fi
    if [[ "$attempt" == "30" ]]; then return 1; fi
    sleep 2
  done
}

mkdir -p "$BACKUP_DIR" "$DEPLOY_BASE_PATH/logs"
for service_path in "$WEB_PATH" "$API_PATH" "$FACTURACION_PATH" "$REPORTERIA_PATH"; do
  if [[ ! -d "$service_path" ]]; then
    echo "Missing service directory: $service_path" >&2
    exit 66
  fi
done

cp -a "$WEB_PATH" "$BACKUP_DIR/web"
cp -a "$API_PATH" "$BACKUP_DIR/api"
cp -a "$FACTURACION_PATH" "$BACKUP_DIR/facturacion"
cp -a "$REPORTERIA_PATH" "$BACKUP_DIR/reporteria"

cp -a "$STAGING_DIR/web/." "$WEB_PATH/"
(
  cd "$WEB_PATH"
  npm ci --omit=dev
)
install -m 0755 "$STAGING_DIR/linux/emaus_api" "$API_PATH/emaus_api"
install -m 0755 "$STAGING_DIR/linux/emaus_reporteria" "$REPORTERIA_PATH/emaus_reporteria"
install -m 0755 "$STAGING_DIR/linux/emaus_facturacion" "$FACTURACION_PATH/emaus_facturacion"

NODE_ENV=production API_PROXY_TARGET=http://127.0.0.1:4020 pm2 restart emaus-web --update-env
pm2 restart emaus_api emaus_facturacion emaus_reporteria

if ! wait_for_http http://127.0.0.1:3000/login \
  || ! wait_for_http http://127.0.0.1:4020/api/system/version \
  || ! wait_for_http http://127.0.0.1:4021/api/reports/health \
  || ! wait_for_http http://127.0.0.1:4022/health; then
  echo "Healthcheck failed. Restoring previous files." >&2
  NODE_ENV=production API_PROXY_TARGET=http://127.0.0.1:4020 pm2 restart emaus-web --update-env || true
  pm2 restart emaus_api emaus_facturacion emaus_reporteria || true
  rm -rf "$WEB_PATH" "$API_PATH" "$FACTURACION_PATH" "$REPORTERIA_PATH"
  cp -a "$BACKUP_DIR/web" "$WEB_PATH"
  cp -a "$BACKUP_DIR/api" "$API_PATH"
  cp -a "$BACKUP_DIR/facturacion" "$FACTURACION_PATH"
  cp -a "$BACKUP_DIR/reporteria" "$REPORTERIA_PATH"
  NODE_ENV=production API_PROXY_TARGET=http://127.0.0.1:4020 pm2 restart emaus-web --update-env
  pm2 restart emaus_api emaus_facturacion emaus_reporteria
  exit 70
fi

echo "Full deploy completed. Backup: $BACKUP_DIR"
