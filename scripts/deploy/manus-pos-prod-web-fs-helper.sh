#!/usr/bin/env bash
set -Eeuo pipefail

readonly EXPECTED_WEB_PATH="/var/www/manuspos-web"
readonly EXPECTED_DEPLOY_USER="ubuntu"
readonly PRODUCTION_CONFIG="/etc/manuspos/manuspos-web-release.conf"

fail() {
  echo "ERROR: $*" >&2
  return 1
}

canonical_path() {
  realpath -m -- "$1"
}

is_descendant() {
  local child
  local parent
  child="$(canonical_path "$1")"
  parent="$(canonical_path "$2")"
  [[ "$child" == "$parent"/* ]]
}

require_safe_token() {
  [[ "$1" =~ ^[A-Za-z0-9._-]+$ ]] || fail "Unsafe token"
}

require_safe_path() {
  [[ "$1" =~ ^/[A-Za-z0-9._/-]+$ && "$1" != "/" ]] || fail "Unsafe path"
}

load_config() {
  local config_path="$PRODUCTION_CONFIG"
  if [[ "${MANUS_POS_HELPER_TEST_MODE:-0}" == "1" && "$EUID" -ne 0 ]]; then
    config_path="${MANUS_POS_HELPER_TEST_CONFIG:?Missing test config}"
  fi
  [[ -f "$config_path" ]] || fail "Missing helper configuration"
  if [[ "$EUID" -eq 0 ]]; then
    [[ "$(stat -c '%u' "$config_path")" == "0" ]] || fail "Helper configuration is not root-owned"
    (( (8#$(stat -c '%a' "$config_path") & 8#022) == 0 )) || fail "Helper configuration is writable by group or other"
  fi
  # shellcheck disable=SC1090
  source "$config_path"
  : "${DEPLOY_USER:?Missing DEPLOY_USER}"
  : "${STAGING_ROOT:?Missing STAGING_ROOT}"
  : "${BACKUP_ROOT:?Missing BACKUP_ROOT}"
  : "${RELEASES_ROOT:?Missing RELEASES_ROOT}"
  : "${WEB_PATH:?Missing WEB_PATH}"
  [[ "$DEPLOY_USER" == "$EXPECTED_DEPLOY_USER" ]] || fail "Unexpected deploy user"
  [[ "$WEB_PATH" == "$EXPECTED_WEB_PATH" || "${MANUS_POS_HELPER_TEST_MODE:-0}" == "1" ]] || fail "Unexpected web path"
  require_safe_path "$STAGING_ROOT"
  require_safe_path "$BACKUP_ROOT"
  require_safe_path "$RELEASES_ROOT"
  require_safe_path "$WEB_PATH"
  [[ ! "$STAGING_ROOT" == "$BACKUP_ROOT" ]] || fail "Staging and backup roots overlap"
  [[ ! "$STAGING_ROOT" == "$RELEASES_ROOT" ]] || fail "Staging and release roots overlap"
}

attest_helper() {
  local expected_sha="$1"
  local helper_path
  [[ "$expected_sha" =~ ^[0-9a-f]{64}$ ]] || fail "Invalid helper checksum"
  helper_path="$(realpath -- "${BASH_SOURCE[0]}")"
  [[ "$(sha256sum "$helper_path" | cut -d' ' -f1)" == "$expected_sha" ]] || fail "Helper checksum mismatch"
  if [[ "$EUID" -eq 0 ]]; then
    [[ "$(stat -c '%u' "$helper_path")" == "0" ]] || fail "Helper is not root-owned"
    (( (8#$(stat -c '%a' "$helper_path") & 8#022) == 0 )) || fail "Helper is writable by group or other"
  fi
}

read_state() {
  local key="$1"
  local value
  value="$(sed -n "s/^${key}=//p" "$STATE_FILE")"
  [[ -n "$value" && "$value" != *$'\n'* ]] || fail "Missing transaction state: ${key}"
  printf '%s\n' "$value"
}

write_state() {
  local phase="$1"
  umask 077
  printf '%s\n' \
    "RUN_ID=${RUN_ID}" \
    "RELEASE_SHA=${RELEASE_SHA}" \
    "PREVIOUS_TARGET=${PREVIOUS_TARGET}" \
    "NEW_TARGET=${NEW_TARGET}" \
    "BACKUP_ARCHIVE=${BACKUP_ARCHIVE}" \
    "PHASE=${phase}" > "$STATE_FILE"
}

validate_state_paths() {
  is_descendant "$PREVIOUS_TARGET" "$RELEASES_ROOT" || fail "Previous target escapes releases root"
  is_descendant "$NEW_TARGET" "$RELEASES_ROOT" || fail "New target escapes releases root"
  is_descendant "$BACKUP_ARCHIVE" "$BACKUP_ROOT" || fail "Backup escapes backup root"
}

load_transaction() {
  RUN_ID="$1"
  require_safe_token "$RUN_ID"
  TRANSACTION_DIR="$BACKUP_ROOT/$RUN_ID"
  STATE_FILE="$TRANSACTION_DIR/transaction.state"
  [[ -f "$STATE_FILE" ]] || fail "Missing transaction state"
  RELEASE_SHA="$(read_state RELEASE_SHA)"
  PREVIOUS_TARGET="$(read_state PREVIOUS_TARGET)"
  NEW_TARGET="$(read_state NEW_TARGET)"
  BACKUP_ARCHIVE="$(read_state BACKUP_ARCHIVE)"
  PHASE="$(read_state PHASE)"
  require_safe_token "$RELEASE_SHA"
  validate_state_paths
}

validate_release_integrity() {
  local release_root="$1"
  local brand_sha="$2"
  [[ "$brand_sha" =~ ^[0-9a-f]{64}$ ]] || fail "Invalid brand checksum"
  [[ -f "$release_root/SHA256SUMS" ]] || fail "Missing release checksums"
  (
    cd "$release_root"
    sha256sum --check SHA256SUMS
  ) >/dev/null || fail "Release checksum verification failed"
  [[ "$(sha256sum "$release_root/web-runtime/public/login-bg.png" | cut -d' ' -f1)" == "$brand_sha" ]] \
    || fail "Approved branding checksum mismatch"
  if find "$release_root/web-runtime" -name '.env*' -print -quit | grep -q .; then
    fail "Release contains environment files"
  fi
  while IFS= read -r -d '' link; do
    is_descendant "$(realpath -m -- "$link")" "$release_root/web-runtime" \
      || fail "Release symlink escapes runtime"
  done < <(find "$release_root/web-runtime" -type l -print0)
}

atomic_point_to() {
  local target="$1"
  local parent
  local temporary_link
  is_descendant "$target" "$RELEASES_ROOT" || fail "Activation target escapes releases root"
  [[ -d "$target" ]] || fail "Activation target is missing"
  parent="$(dirname "$WEB_PATH")"
  temporary_link="$parent/.manuspos-web.link-${RUN_ID}"
  [[ ! -e "$temporary_link" && ! -L "$temporary_link" ]] || fail "Temporary activation link exists"
  ln -s -- "$target" "$temporary_link"
  mv -Tf -- "$temporary_link" "$WEB_PATH"
  [[ "$(readlink -f -- "$WEB_PATH")" == "$(canonical_path "$target")" ]] || fail "Atomic activation verification failed"
}

prepare_release() {
  local run_id="$1"
  local release_sha="$2"
  local brand_sha="$3"
  local release_root
  local current_target
  require_safe_token "$run_id"
  [[ "$release_sha" =~ ^[0-9a-f]{40}$ ]] || fail "Invalid release SHA"
  [[ ! -e "$BACKUP_ROOT/.active-transaction" ]] || fail "An incomplete transaction requires recovery"
  [[ -L "$WEB_PATH" ]] || fail "Active web path must be a symlink"
  current_target="$(readlink -f -- "$WEB_PATH")"
  is_descendant "$current_target" "$RELEASES_ROOT" || fail "Active release escapes releases root"

  RUN_ID="$run_id"
  RELEASE_SHA="$release_sha"
  release_root="$STAGING_ROOT/$RUN_ID-$RELEASE_SHA/release-root"
  [[ -d "$release_root" && ! -L "$release_root" ]] || fail "Invalid staged release root"
  is_descendant "$release_root" "$STAGING_ROOT" || fail "Staged release escapes staging root"
  if [[ "$EUID" -eq 0 ]]; then
    chown -hR root:root "$release_root"
  fi
  validate_release_integrity "$release_root" "$brand_sha"

  TRANSACTION_DIR="$BACKUP_ROOT/$RUN_ID"
  STATE_FILE="$TRANSACTION_DIR/transaction.state"
  PREVIOUS_TARGET="$current_target"
  NEW_TARGET="$RELEASES_ROOT/$RELEASE_SHA-$RUN_ID"
  BACKUP_ARCHIVE="$TRANSACTION_DIR/manuspos-web.tar.gz"
  [[ ! -e "$TRANSACTION_DIR" ]] || fail "Transaction already exists"
  [[ ! -e "$NEW_TARGET" ]] || fail "Release target already exists"
  umask 077
  mkdir -p -- "$TRANSACTION_DIR"
  cp -a -- "$release_root/web-runtime" "$NEW_TARGET"
  while IFS= read -r -d '' env_file; do
    cp -a -- "$env_file" "$NEW_TARGET/"
  done < <(find "$PREVIOUS_TARGET" -maxdepth 1 -type f -name '.env*' -print0)
  tar -C "$(dirname "$PREVIOUS_TARGET")" -czf "$BACKUP_ARCHIVE" "$(basename "$PREVIOUS_TARGET")"
  gzip -t "$BACKUP_ARCHIVE"
  tar -tzf "$BACKUP_ARCHIVE" >/dev/null
  (
    cd "$TRANSACTION_DIR"
    sha256sum manuspos-web.tar.gz > manuspos-web.tar.gz.sha256
    sha256sum --check manuspos-web.tar.gz.sha256
  ) >/dev/null
  write_state prepared
  printf '%s\n' "$RUN_ID" > "$BACKUP_ROOT/.active-transaction"
}

activate_release() {
  load_transaction "$1"
  [[ "$PHASE" == "prepared" ]] || fail "Transaction is not prepared"
  atomic_point_to "$NEW_TARGET"
  write_state activated
}

restore_from_verified_backup() {
  local restore_target="$RELEASES_ROOT/recovered-$RUN_ID"
  [[ ! -e "$restore_target" ]] || fail "Recovery target already exists"
  (
    cd "$TRANSACTION_DIR"
    sha256sum --check manuspos-web.tar.gz.sha256
  ) >/dev/null || fail "Backup checksum verification failed before restore"
  mkdir -p -- "$restore_target"
  tar -xzf "$BACKUP_ARCHIVE" -C "$restore_target" --strip-components=1
  PREVIOUS_TARGET="$restore_target"
}

rollback_release() {
  load_transaction "$1"
  if [[ ! -d "$PREVIOUS_TARGET" ]]; then
    restore_from_verified_backup
  fi
  atomic_point_to "$PREVIOUS_TARGET"
  write_state rolled_back
  rm -f -- "$BACKUP_ROOT/.active-transaction"
}

recover_incomplete() {
  local active_file="$BACKUP_ROOT/.active-transaction"
  local active_run
  [[ -f "$active_file" ]] || return 0
  active_run="$(sed -n '1p' "$active_file")"
  require_safe_token "$active_run"
  load_transaction "$active_run"
  case "$PHASE" in
    prepared)
      write_state recovered_before_activation
      rm -f -- "$active_file"
      ;;
    activated)
      rollback_release "$active_run"
      ;;
    *)
      fail "Incomplete transaction has unexpected phase"
      ;;
  esac
}

finalize_release() {
  load_transaction "$1"
  [[ "$PHASE" == "activated" ]] || fail "Transaction is not activated"
  write_state completed
  rm -f -- "$BACKUP_ROOT/.active-transaction"
}

main() {
  local action="${1:-}"
  load_config
  case "$action" in
    attest)
      [[ "$#" -eq 2 ]] || fail "Usage: $0 attest <sha256>"
      attest_helper "$2"
      [[ -L "$WEB_PATH" ]] || fail "Active web path must be a symlink"
      ;;
    recover)
      [[ "$#" -eq 1 ]] || fail "Usage: $0 recover"
      recover_incomplete
      ;;
    prepare)
      [[ "$#" -eq 4 ]] || fail "Usage: $0 prepare <run-id> <release-sha> <brand-sha256>"
      prepare_release "$2" "$3" "$4"
      ;;
    activate)
      [[ "$#" -eq 2 ]] || fail "Usage: $0 activate <run-id>"
      activate_release "$2"
      ;;
    rollback)
      [[ "$#" -eq 2 ]] || fail "Usage: $0 rollback <run-id>"
      rollback_release "$2"
      ;;
    finalize)
      [[ "$#" -eq 2 ]] || fail "Usage: $0 finalize <run-id>"
      finalize_release "$2"
      ;;
    *)
      fail "Usage: $0 <attest|recover|prepare|activate|rollback|finalize>"
      ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
