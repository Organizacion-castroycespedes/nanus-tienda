#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SCRIPT="$SCRIPT_DIR/manus-pos-prod-web-deploy.sh"
HELPER_SCRIPT="$SCRIPT_DIR/manus-pos-prod-web-fs-helper.sh"
TEST_ROOT="$(mktemp -d)"
trap 'find "$TEST_ROOT" -depth -mindepth 1 -delete; rmdir "$TEST_ROOT"' EXIT

# shellcheck source=manus-pos-prod-web-deploy.sh
source "$DEPLOY_SCRIPT"

assert_contains() {
  grep -Fq "$2" "$1" || { echo "Expected $1 to contain $2" >&2; exit 1; }
}

make_release() {
  local stage="$1" sha="$2" brand_sha="$3" build_id="$4"
  local root="$stage/test-run-$sha/release-root"
  mkdir -p "$root/web-runtime/.next" "$root/web-runtime/public" "$root/web-runtime/node_modules/next"
  printf '%s\n' "$build_id" > "$root/web-runtime/.next/BUILD_ID"
  printf 'approved-manus-image\n' > "$root/web-runtime/public/login-bg.png"
  printf '{}\n' > "$root/web-runtime/node_modules/next/package.json"
  printf '{"commit": "%s", "build_id": "%s", "brand_asset_sha256": "%s", "next_public_gin_bg_image": "/login-bg.png", "component": "web"}\n' \
    "$sha" "$build_id" "$brand_sha" > "$root/release-manifest.json"
  (
    cd "$root"
    find web-runtime -type f -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS
    sha256sum release-manifest.json >> SHA256SUMS
  )
}

prepare_helper_fixture() {
  FIXTURE="$TEST_ROOT/helper-$1"
  STAGE="$FIXTURE/staging"
  BACKUPS="$FIXTURE/backups"
  RELEASES="$FIXTURE/releases"
  WEB_LINK="$FIXTURE/web/manuspos-web"
  CONFIG="$FIXTURE/helper.conf"
  SHA="$(printf 'a%.0s' $(seq 1 40))"
  RUN="test-run"
  BUILD_ID="build-123"
  mkdir -p "$STAGE" "$BACKUPS" "$RELEASES/old-release" "$(dirname "$WEB_LINK")"
  mkdir -p "$RELEASES/old-release/.next"
  printf 'old-build\n' > "$RELEASES/old-release/.next/BUILD_ID"
  printf 'SECRET=preserved\n' > "$RELEASES/old-release/.env.production"
  ln -s "$RELEASES/old-release" "$WEB_LINK"
  printf 'approved-manus-image\n' > "$FIXTURE/brand.bin"
  BRAND_SHA="$(sha256sum "$FIXTURE/brand.bin" | cut -d' ' -f1)"
  make_release "$STAGE" "$SHA" "$BRAND_SHA" "$BUILD_ID"
  printf '%s\n' \
    'DEPLOY_USER=ubuntu' \
    "STAGING_ROOT=$STAGE" \
    "BACKUP_ROOT=$BACKUPS" \
    "RELEASES_ROOT=$RELEASES" \
    "WEB_PATH=$WEB_LINK" > "$CONFIG"
  export MANUS_POS_HELPER_TEST_MODE=1
  export MANUS_POS_HELPER_TEST_CONFIG="$CONFIG"
}

helper() {
  bash "$HELPER_SCRIPT" "$@"
}

test_helper_atomic_activation_and_rollback() {
  prepare_helper_fixture atomic
  helper prepare "$RUN" "$SHA" "$BRAND_SHA"
  helper activate "$RUN"
  [[ "$(readlink -f "$WEB_LINK")" == "$RELEASES/$SHA-$RUN" ]]
  assert_contains "$WEB_LINK/.env.production" 'SECRET=preserved'
  helper rollback "$RUN"
  [[ "$(readlink -f "$WEB_LINK")" == "$RELEASES/old-release" ]]
}

test_helper_recovers_interrupted_activation() {
  prepare_helper_fixture interruption
  helper prepare "$RUN" "$SHA" "$BRAND_SHA"
  helper activate "$RUN"
  [[ -f "$BACKUPS/.active-transaction" ]]
  helper recover
  [[ "$(readlink -f "$WEB_LINK")" == "$RELEASES/old-release" ]]
  assert_contains "$BACKUPS/$RUN/transaction.state" 'PHASE=rolled_back'
}

test_helper_rejects_corrupt_backup_before_restore() {
  prepare_helper_fixture corrupt-backup
  helper prepare "$RUN" "$SHA" "$BRAND_SHA"
  helper activate "$RUN"
  find "$RELEASES/old-release" -depth -mindepth 1 -delete
  rmdir "$RELEASES/old-release"
  printf 'corrupt\n' >> "$BACKUPS/$RUN/manuspos-web.tar.gz"
  if helper rollback "$RUN" >/dev/null 2>&1; then
    echo "Corrupt backup was accepted" >&2
    exit 1
  fi
  [[ "$(readlink -f "$WEB_LINK")" == "$RELEASES/$SHA-$RUN" ]]
}

test_helper_rejects_unapproved_branding() {
  prepare_helper_fixture brand
  if helper prepare "$RUN" "$SHA" "$(printf 'f%.0s' $(seq 1 64))" >/dev/null 2>&1; then
    echo "Unapproved branding was accepted" >&2
    exit 1
  fi
  [[ "$(readlink -f "$WEB_LINK")" == "$RELEASES/old-release" ]]
}

test_release_integrity_rejects_corruption() {
  prepare_helper_fixture release-integrity
  RELEASE_SHA="$SHA"
  RUN_ID="$RUN"
  RELEASE_ROOT="$STAGE/$RUN-$SHA/release-root"
  BRAND_ASSET_SHA256="$BRAND_SHA"
  BRAND_ASSET_PATH="/login-bg.png"
  EXPECTED_BUILD_ID="$BUILD_ID"
  INTEGRITY_VERIFIED="false"
  validate_release
  printf 'tampered\n' >> "$RELEASE_ROOT/web-runtime/.next/BUILD_ID"
  INTEGRITY_VERIFIED="false"
  if validate_release >/dev/null 2>&1; then
    echo "Corrupt release was accepted" >&2
    exit 1
  fi
  [[ "$INTEGRITY_VERIFIED" == "false" ]]
}

test_release_integrity_rejects_wrong_brand_path() {
  prepare_helper_fixture wrong-brand-path
  RELEASE_SHA="$SHA"
  RUN_ID="$RUN"
  RELEASE_ROOT="$STAGE/$RUN-$SHA/release-root"
  BRAND_ASSET_SHA256="$BRAND_SHA"
  BRAND_ASSET_PATH="/logo-login-tablet.png"
  EXPECTED_BUILD_ID="$BUILD_ID"
  INTEGRITY_VERIFIED="false"
  if validate_release >/dev/null 2>&1; then
    echo "Wrong MANUS branding path was accepted" >&2
    exit 1
  fi
  [[ "$INTEGRITY_VERIFIED" == "false" ]]
}

test_restart_failure_propagates_and_rolls_back() {
  local calls="$TEST_ROOT/orchestrator-calls.log"
  call_fs_helper() { printf '%s\n' "$*" >> "$calls"; }
  restart_web() { return 1; }
  check_all_health() { return 0; }
  RUN_ID="restart-failure"
  RELEASE_SHA="$(printf 'b%.0s' $(seq 1 40))"
  BRAND_ASSET_SHA256="$(printf 'c%.0s' $(seq 1 64))"
  BRAND_ASSET_PATH="/login-bg.png"
  STATUS="failed_before_change"
  ACTIVE_CHANGED="false"
  if perform_deploy >/dev/null 2>&1; then
    echo "Restart failure did not fail deployment" >&2
    exit 1
  fi
  assert_contains "$calls" 'prepare restart-failure'
  assert_contains "$calls" 'activate restart-failure'
  assert_contains "$calls" 'rollback restart-failure'
  [[ "$STATUS" == "rollback_failed" ]]
}

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    echo "PARTIAL: Linux symlink integration tests require the pinned Ubuntu Actions runner"
    ;;
  *)
    test_helper_atomic_activation_and_rollback
    test_helper_recovers_interrupted_activation
    test_helper_rejects_corrupt_backup_before_restore
    test_helper_rejects_unapproved_branding
    ;;
esac
test_release_integrity_rejects_corruption
test_release_integrity_rejects_wrong_brand_path
test_restart_failure_propagates_and_rolls_back
echo "PASS: MANUS POS production web deployment safety tests"
