#!/usr/bin/env bash
set -Eeuo pipefail

readonly EXPECTED_WEB_PATH="/var/www/manuspos-web"
readonly EXPECTED_PM2_PROCESS="manuspos-web"
readonly EXPECTED_PM2_OWNER="ubuntu"
readonly EXPECTED_PM2_HOME="/home/ubuntu/.pm2"
readonly EXPECTED_WEB_PORT="19500"
readonly EXPECTED_API_PROXY_TARGET="http://127.0.0.1:4020"
readonly EXPECTED_SERVER_REPO_PATH="/opt/manuspos/repos/nanus-tienda"
readonly EXPECTED_FS_HELPER="/usr/local/sbin/manuspos-web-fs-helper"
readonly EXPECTED_BRAND_ASSET_PATH="/login-bg.png"

STATUS="failed_before_change"
INTEGRITY_VERIFIED="false"
BACKUP_VERIFIED="false"
LOCAL_LOGIN_HEALTH="false"
LOCAL_API_HEALTH="false"
LOCAL_BRANDING_HEALTH="false"
LOCAL_BUILD_ID_HEALTH="false"
PUBLIC_LOGIN_HEALTH="false"
PUBLIC_BRANDING_HEALTH="false"
ROLLBACK_HEALTH="false"
ACTIVE_CHANGED="false"
LOCK_HELD="false"

fail() { echo "ERROR: $*" >&2; return 1; }
require_value() { [[ -n "${!1:-}" ]] || fail "Missing required variable: $1"; }
require_safe_token() { [[ "${!1}" =~ ^[A-Za-z0-9._-]+$ ]] || fail "Unsafe $1"; }
require_safe_path() { [[ "${!1}" =~ ^/[A-Za-z0-9._/-]+$ && "${!1}" != "/" ]] || fail "Unsafe $1"; }
canonical_path() { realpath -m -- "$1"; }
is_descendant() { local c p; c="$(canonical_path "$1")"; p="$(canonical_path "$2")"; [[ "$c" == "$p"/* ]]; }
paths_overlap() { local a b; a="$(canonical_path "$1")"; b="$(canonical_path "$2")"; [[ "$a" == "$b" || "$a" == "$b"/* || "$b" == "$a"/* ]]; }
require_https_url() { [[ "$PUBLIC_BASE_URL" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._~:/?#%+&=-]*)?$ ]] || fail "Invalid PUBLIC_BASE_URL"; }

wait_for_http() {
  local url="$1" attempts="${HEALTH_ATTEMPTS:-30}" delay="${HEALTH_DELAY_SECONDS:-2}" attempt
  for attempt in $(seq 1 "$attempts"); do
    curl --fail --silent --show-error --max-time 10 "$url" >/dev/null && return 0
    [[ "$attempt" == "$attempts" ]] || sleep "$delay"
  done
  return 1
}

write_evidence() {
  local path="${STAGING_DIR:-}/deployment-evidence.json"
  [[ -n "${STAGING_DIR:-}" && -d "${STAGING_DIR:-}" ]] || return 0
  umask 077
  printf '%s\n' '{' \
    '  "hu": "HU-CONTABO-DEP-001",' \
    "  \"run_id\": \"${RUN_ID:-unknown}\"," \
    "  \"release_sha\": \"${RELEASE_SHA:-unknown}\"," \
    "  \"build_id\": \"${EXPECTED_BUILD_ID:-unknown}\"," \
    "  \"artifact_sha256\": \"${ARTIFACT_SHA256:-unknown}\"," \
    "  \"brand_asset_sha256\": \"${BRAND_ASSET_SHA256:-unknown}\"," \
    "  \"brand_asset_path\": \"${BRAND_ASSET_PATH:-unknown}\"," \
    '  "target": "MANUS_POS_PRD_CONTABO_109.123.251.8",' \
    '  "component_scope": ["web"],' \
    '  "restart_scope": ["manuspos-web"],' \
    '  "pm2_owner": "ubuntu",' \
    "  \"integrity_verified\": ${INTEGRITY_VERIFIED}," \
    "  \"backup_verified\": ${BACKUP_VERIFIED}," \
    "  \"local_login_health\": ${LOCAL_LOGIN_HEALTH}," \
    "  \"local_api_health\": ${LOCAL_API_HEALTH}," \
    "  \"local_branding_health\": ${LOCAL_BRANDING_HEALTH}," \
    "  \"local_build_id_health\": ${LOCAL_BUILD_ID_HEALTH}," \
    "  \"public_login_health\": ${PUBLIC_LOGIN_HEALTH}," \
    "  \"public_branding_health\": ${PUBLIC_BRANDING_HEALTH}," \
    "  \"rollback_health\": ${ROLLBACK_HEALTH}," \
    "  \"status\": \"${STATUS}\"" '}' > "$path"
}

release_lock() {
  if [[ "$LOCK_HELD" == "true" && -d "${LOCK_DIR:-}" ]]; then
    rmdir -- "$LOCK_DIR" || true
    LOCK_HELD="false"
  fi
}

call_fs_helper() { sudo -n "$FS_HELPER_PATH" "$@"; }

restart_web() {
  NODE_ENV=production API_PROXY_TARGET="$EXPECTED_API_PROXY_TARGET" PM2_HOME="$EXPECTED_PM2_HOME" \
    pm2 restart "$EXPECTED_PM2_PROCESS" --update-env >/dev/null || return 1
  local pid
  pid="$(PM2_HOME="$EXPECTED_PM2_HOME" pm2 pid "$EXPECTED_PM2_PROCESS" | tr -d '[:space:]')" || return 1
  [[ "$pid" =~ ^[1-9][0-9]*$ ]] || fail "PM2 process did not return an active pid"
}

rollback_after_change() {
  set +e
  call_fs_helper rollback "$RUN_ID"
  local helper_exit=$?
  restart_web
  local restart_exit=$?
  if [[ "$helper_exit" -eq 0 && "$restart_exit" -eq 0 ]] \
    && wait_for_http "http://127.0.0.1:${EXPECTED_WEB_PORT}/login" \
    && wait_for_http "http://127.0.0.1:${EXPECTED_WEB_PORT}/api/system/version"; then
    ROLLBACK_HEALTH="true"; STATUS="rolled_back"
  else
    STATUS="rollback_failed"
  fi
  ACTIVE_CHANGED="false"
  set -e
  [[ "$STATUS" == "rolled_back" ]]
}

on_signal() {
  local signal="$1"
  [[ "$ACTIVE_CHANGED" == "false" ]] || rollback_after_change || true
  write_evidence || true
  release_lock
  trap - INT TERM HUP
  kill -s "$signal" "$$"
}

on_exit() { local code="$1"; write_evidence || true; release_lock; return "$code"; }

validate_contract() {
  local required
  for required in RELEASE_SHA RUN_ID STAGING_DIR STAGING_ROOT BACKUP_ROOT WEB_PATH PM2_PROCESS \
    PM2_OWNER PM2_HOME WEB_PORT API_PROXY_TARGET SERVER_REPO_PATH RELEASE_ROOT PUBLIC_BASE_URL \
    ARTIFACT_SHA256 BRAND_ASSET_PATH BRAND_ASSET_SHA256 EXPECTED_BUILD_ID FS_HELPER_PATH FS_HELPER_SHA256; do
    require_value "$required"
  done
  require_safe_token RUN_ID; require_safe_token EXPECTED_BUILD_ID
  require_safe_path STAGING_DIR; require_safe_path STAGING_ROOT; require_safe_path BACKUP_ROOT
  require_safe_path WEB_PATH; require_safe_path SERVER_REPO_PATH; require_safe_path RELEASE_ROOT
  require_safe_path FS_HELPER_PATH; require_https_url
  [[ "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "Invalid RELEASE_SHA"
  [[ "$ARTIFACT_SHA256" =~ ^[0-9a-f]{64}$ ]] || fail "Invalid ARTIFACT_SHA256"
  [[ "$BRAND_ASSET_SHA256" =~ ^[0-9a-f]{64}$ ]] || fail "Invalid BRAND_ASSET_SHA256"
  [[ "$BRAND_ASSET_PATH" == "$EXPECTED_BRAND_ASSET_PATH" ]] || fail "Unexpected BRAND_ASSET_PATH"
  [[ "$FS_HELPER_SHA256" =~ ^[0-9a-f]{64}$ ]] || fail "Invalid FS_HELPER_SHA256"
  [[ "$WEB_PATH" == "$EXPECTED_WEB_PATH" ]] || fail "Unexpected WEB_PATH"
  [[ "$PM2_PROCESS" == "$EXPECTED_PM2_PROCESS" ]] || fail "Unexpected PM2_PROCESS"
  [[ "$PM2_OWNER" == "$EXPECTED_PM2_OWNER" ]] || fail "Unexpected PM2_OWNER"
  [[ "$PM2_HOME" == "$EXPECTED_PM2_HOME" ]] || fail "Unexpected PM2_HOME"
  [[ "$WEB_PORT" == "$EXPECTED_WEB_PORT" ]] || fail "Unexpected WEB_PORT"
  [[ "$API_PROXY_TARGET" == "$EXPECTED_API_PROXY_TARGET" ]] || fail "Unexpected API_PROXY_TARGET"
  [[ "$SERVER_REPO_PATH" == "$EXPECTED_SERVER_REPO_PATH" ]] || fail "Unexpected SERVER_REPO_PATH"
  [[ "$FS_HELPER_PATH" == "$EXPECTED_FS_HELPER" ]] || fail "Unexpected FS_HELPER_PATH"
  is_descendant "$STAGING_DIR" "$STAGING_ROOT" || fail "STAGING_DIR escapes STAGING_ROOT"
  is_descendant "$RELEASE_ROOT" "$STAGING_DIR" || fail "RELEASE_ROOT escapes STAGING_DIR"
  ! paths_overlap "$BACKUP_ROOT" "$WEB_PATH" || fail "BACKUP_ROOT overlaps WEB_PATH"
  ! paths_overlap "$STAGING_ROOT" "$WEB_PATH" || fail "STAGING_ROOT overlaps WEB_PATH"
}

validate_release() {
  local manifest="$RELEASE_ROOT/release-manifest.json" checksums="$RELEASE_ROOT/SHA256SUMS"
  [[ -f "$manifest" && -f "$checksums" ]] || { fail "Missing release integrity metadata"; return 1; }
  grep -Fq "\"commit\": \"${RELEASE_SHA}\"" "$manifest" || { fail "Manifest commit mismatch"; return 1; }
  grep -Fq "\"build_id\": \"${EXPECTED_BUILD_ID}\"" "$manifest" || { fail "Manifest build mismatch"; return 1; }
  grep -Fq "\"brand_asset_sha256\": \"${BRAND_ASSET_SHA256}\"" "$manifest" || { fail "Manifest brand mismatch"; return 1; }
  grep -Fq "\"next_public_gin_bg_image\": \"${BRAND_ASSET_PATH}\"" "$manifest" || { fail "Manifest brand path mismatch"; return 1; }
  (cd "$RELEASE_ROOT" && sha256sum --check SHA256SUMS) >/dev/null || { fail "Payload checksum failure"; return 1; }
  [[ "$(sha256sum "$RELEASE_ROOT/web-runtime/public/login-bg.png" | cut -d' ' -f1)" == "$BRAND_ASSET_SHA256" ]] \
    || { fail "Unapproved branding asset"; return 1; }
  [[ "$(tr -d '\r\n' < "$RELEASE_ROOT/web-runtime/.next/BUILD_ID")" == "$EXPECTED_BUILD_ID" ]] \
    || { fail "Runtime BUILD_ID mismatch"; return 1; }
  INTEGRITY_VERIFIED="true"
}

validate_server() {
  [[ "$(id -un)" == "$EXPECTED_PM2_OWNER" ]] || fail "Deployment must run as ubuntu"
  [[ -d "$STAGING_DIR" && -d "$STAGING_ROOT" && -d "$BACKUP_ROOT" ]] || fail "Missing deployment roots"
  [[ -L "$WEB_PATH" ]] || fail "Active web path must use symlink layout"
  [[ -d "$SERVER_REPO_PATH/.git" ]] || fail "Missing MANUS POS repository sentinel"
  [[ -x "$FS_HELPER_PATH" ]] || fail "Missing fixed filesystem helper"
  [[ -d "$EXPECTED_PM2_HOME" ]] || fail "Missing ubuntu PM2 home"
  command -v sudo >/dev/null 2>&1 || fail "sudo unavailable"
  command -v pm2 >/dev/null 2>&1 || fail "pm2 unavailable"
  command -v curl >/dev/null 2>&1 || fail "curl unavailable"
  command -v node >/dev/null 2>&1 || fail "node unavailable"
  call_fs_helper attest "$FS_HELPER_SHA256" >/dev/null || fail "Filesystem helper attestation failed"
  call_fs_helper recover >/dev/null || fail "Incomplete transaction recovery failed"
  PM2_HOME="$EXPECTED_PM2_HOME" pm2 describe "$PM2_PROCESS" >/dev/null || fail "PM2 process unavailable to ubuntu"
  PM2_HOME="$EXPECTED_PM2_HOME" PM2_PROCESS="$PM2_PROCESS" WEB_PATH="$WEB_PATH" \
    node -e '
      const processes = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
      const target = processes.find((entry) => entry.name === process.env.PM2_PROCESS);
      if (!target || target.pm2_env?.pm_cwd !== process.env.WEB_PATH || target.pm2_env?.status !== "online") {
        process.exit(1);
      }
    ' < <(PM2_HOME="$EXPECTED_PM2_HOME" pm2 jlist) || fail "PM2 owner, cwd, or online contract mismatch"
}

check_brand_asset() {
  local base="$1" file="$STAGING_DIR/.brand-smoke-${RUN_ID}" actual
  curl --fail --silent --show-error --max-time 20 "${base%/}${BRAND_ASSET_PATH}" -o "$file" || return 1
  actual="$(sha256sum "$file" | cut -d' ' -f1)"
  find "$file" -maxdepth 0 -type f -delete
  [[ "$actual" == "$BRAND_ASSET_SHA256" ]]
}

check_login_brand() { curl --fail --silent --show-error --max-time 20 "${1%/}/login" | grep -Fq "MANUS POS"; }

check_all_health() {
  local local_base="http://127.0.0.1:${EXPECTED_WEB_PORT}"
  wait_for_http "$local_base/login" || return 1; LOCAL_LOGIN_HEALTH="true"
  wait_for_http "$local_base/api/system/version" || return 1; LOCAL_API_HEALTH="true"
  check_login_brand "$local_base" && check_brand_asset "$local_base" || return 1; LOCAL_BRANDING_HEALTH="true"
  [[ "$(tr -d '\r\n' < "$WEB_PATH/.next/BUILD_ID")" == "$EXPECTED_BUILD_ID" ]] || return 1; LOCAL_BUILD_ID_HEALTH="true"
  wait_for_http "${PUBLIC_BASE_URL%/}/login" || return 1; PUBLIC_LOGIN_HEALTH="true"
  check_login_brand "$PUBLIC_BASE_URL" && check_brand_asset "$PUBLIC_BASE_URL" || return 1; PUBLIC_BRANDING_HEALTH="true"
}

perform_deploy() {
  call_fs_helper prepare "$RUN_ID" "$RELEASE_SHA" "$BRAND_ASSET_SHA256"
  BACKUP_VERIFIED="true"
  call_fs_helper activate "$RUN_ID"
  ACTIVE_CHANGED="true"
  if ! restart_web || ! check_all_health; then
    echo "Deployment validation failed; restoring previous frontend" >&2
    rollback_after_change || true
    return 70
  fi
  call_fs_helper finalize "$RUN_ID"
  ACTIVE_CHANGED="false"; STATUS="deployed"
}

perform_rollback() {
  call_fs_helper rollback "$RUN_ID"
  restart_web || { STATUS="rollback_failed"; return 1; }
  if wait_for_http "http://127.0.0.1:${EXPECTED_WEB_PORT}/login" \
    && wait_for_http "http://127.0.0.1:${EXPECTED_WEB_PORT}/api/system/version"; then
    ROLLBACK_HEALTH="true"; STATUS="rolled_back"
  else
    STATUS="rollback_failed"; return 1
  fi
}

main() {
  local action="${1:-}"
  trap 'on_exit $?' EXIT
  trap 'on_signal INT' INT; trap 'on_signal TERM' TERM; trap 'on_signal HUP' HUP
  validate_contract; validate_release; validate_server
  LOCK_DIR="$STAGING_ROOT/.manuspos-web-deploy.lock"
  mkdir -- "$LOCK_DIR" || fail "Another deployment holds the server lock"
  LOCK_HELD="true"
  case "$action" in deploy) perform_deploy ;; rollback) perform_rollback ;; *) fail "Usage: $0 <deploy|rollback>" ;; esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then main "$@"; fi
