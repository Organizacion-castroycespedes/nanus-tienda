#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT

RUNNER_ROOT="${TEST_ROOT}/scripts/database"
MIGRATIONS_DIR="${RUNNER_ROOT}/migrations"
MOCK_BIN="${TEST_ROOT}/bin"
ENV_FILE="${TEST_ROOT}/qa.env"
PSQL_LOG="${TEST_ROOT}/psql.log"

mkdir -p "$MIGRATIONS_DIR" "$MOCK_BIN"
cp "${REPO_ROOT}/scripts/database/migrate_prd.sh" "${RUNNER_ROOT}/migrate_prd.sh"
cp "${REPO_ROOT}/scripts/database/migrations/V071__link_pos_terminals_to_operational_terminals.sql" \
  "${MIGRATIONS_DIR}/V071__link_pos_terminals_to_operational_terminals.sql"
printf '%s\n' '-- must never run' > "${MIGRATIONS_DIR}/V070__other_pending.sql"
chmod +x "${RUNNER_ROOT}/migrate_prd.sh"

printf '%s\n' \
  'DB_HOST=mock-host' \
  'DB_PORT=5432' \
  'DB_NAME=manus_tienda_qa' \
  'DB_USER=manus_user' \
  'DB_PASSWORD=not-a-secret' \
  'ENVIRONMENT=qa' \
  'DB_SCHEMA=public' \
  > "$ENV_FILE"

cat > "${MOCK_BIN}/psql" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$*" >> "${MOCK_PSQL_LOG}"
arguments="$*"

if [[ "$arguments" == *"SELECT current_database()"* ]]; then
  printf '%s\t%s\t%s\t%s\n' \
    "${MOCK_DATABASE:-manus_tienda_qa}" \
    "${MOCK_USER:-manus_user}" \
    "${MOCK_SCHEMA:-public}" \
    '"$user", public'
  exit 0
fi

if [[ "$arguments" == *"SELECT to_regclass('public.migrations_history')"* ]]; then
  printf '%s\n' "migrations_history"
  exit 0
fi

if [[ "$arguments" == *"SELECT COALESCE(checksum"* ]]; then
  case "${MOCK_HISTORY:-pending}" in
    pending) ;;
    already) printf '%s\ttrue\n' "${MOCK_CURRENT_CHECKSUM}" ;;
    mismatch) printf '%s\ttrue\n' 'different-checksum' ;;
    failed) printf '%s\tfalse\n' "${MOCK_CURRENT_CHECKSUM}" ;;
  esac
  exit 0
fi

if [[ "$arguments" == *" -f "* ]]; then
  if [[ "${MOCK_FAIL_APPLY:-NO}" == "YES" ]]; then
    exit 1
  fi
  exit 0
fi

exit 0
EOF
chmod +x "${MOCK_BIN}/psql"

CURRENT_CHECKSUM="$(sha256sum "${MIGRATIONS_DIR}/V071__link_pos_terminals_to_operational_terminals.sql" | awk '{print $1}')"

failures=0

expect_success() {
  local name="$1"
  shift
  if "$@" > "${TEST_ROOT}/${name}.out" 2>&1; then
    printf 'PASS %s\n' "$name"
  else
    printf 'FAIL %s\n' "$name" >&2
    cat "${TEST_ROOT}/${name}.out" >&2
    failures=$((failures + 1))
  fi
}

expect_failure() {
  local name="$1"
  shift
  if "$@" > "${TEST_ROOT}/${name}.out" 2>&1; then
    printf 'FAIL %s (expected failure)\n' "$name" >&2
    failures=$((failures + 1))
  else
    printf 'PASS %s\n' "$name"
  fi
}

run_runner() {
  env \
    PATH="${MOCK_BIN}:$PATH" \
    MOCK_PSQL_LOG="$PSQL_LOG" \
    MOCK_CURRENT_CHECKSUM="$CURRENT_CHECKSUM" \
    "$@" \
    bash "${RUNNER_ROOT}/migrate_prd.sh" "$ENV_FILE"
}

: > "$PSQL_LOG"
expect_success selected_v071_dry_run \
  run_runner ONLY_INCREMENTAL_MIGRATION=V071__link_pos_terminals_to_operational_terminals.sql ONLY_INCREMENTAL_DRY_RUN=YES
grep -Fq 'Selected migrations: 1' "${TEST_ROOT}/selected_v071_dry_run.out"
grep -Fq 'Other pending migrations: NOT EXECUTED' "${TEST_ROOT}/selected_v071_dry_run.out"
if grep -Fq 'V070__other_pending.sql' "$PSQL_LOG"; then
  printf 'FAIL selected_v071_dry_run (other migration reached psql)\n' >&2
  failures=$((failures + 1))
fi

: > "$PSQL_LOG"
expect_success uses_selected_migration_owner \
  run_runner MIGRATION_DB_USER=manus_qa_user MOCK_USER=manus_qa_user ONLY_INCREMENTAL_MIGRATION=V071__link_pos_terminals_to_operational_terminals.sql ONLY_INCREMENTAL_DRY_RUN=YES
if ! grep -Fq -- '-U manus_qa_user' "$PSQL_LOG"; then
  printf 'FAIL uses_selected_migration_owner (owner connection was not used)\n' >&2
  failures=$((failures + 1))
fi

expect_failure rejects_two_files \
  run_runner ONLY_INCREMENTAL_MIGRATION=V071__link_pos_terminals_to_operational_terminals.sql,V070__other_pending.sql ONLY_INCREMENTAL_DRY_RUN=YES
expect_failure rejects_nonexistent \
  run_runner ONLY_INCREMENTAL_MIGRATION=V072__missing.sql ONLY_INCREMENTAL_DRY_RUN=YES
expect_failure rejects_non_v_name \
  run_runner ONLY_INCREMENTAL_MIGRATION=20260821_not_allowed.sql ONLY_INCREMENTAL_DRY_RUN=YES
expect_failure rejects_path_traversal \
  run_runner ONLY_INCREMENTAL_MIGRATION=../V071__link_pos_terminals_to_operational_terminals.sql ONLY_INCREMENTAL_DRY_RUN=YES

expect_success already_applied \
  run_runner MOCK_HISTORY=already ONLY_INCREMENTAL_MIGRATION=V071__link_pos_terminals_to_operational_terminals.sql ONLY_INCREMENTAL_DRY_RUN=YES
grep -Fq 'Status: ALREADY_APPLIED' "${TEST_ROOT}/already_applied.out"

expect_failure checksum_mismatch \
  run_runner MOCK_HISTORY=mismatch ONLY_INCREMENTAL_MIGRATION=V071__link_pos_terminals_to_operational_terminals.sql ONLY_INCREMENTAL_DRY_RUN=YES

: > "$PSQL_LOG"
expect_failure failure_does_not_record_success \
  run_runner MOCK_FAIL_APPLY=YES ONLY_INCREMENTAL_MIGRATION=V071__link_pos_terminals_to_operational_terminals.sql ONLY_INCREMENTAL_DRY_RUN=NO
if grep -Fq 'INSERT INTO public.migrations_history' "$PSQL_LOG"; then
  printf 'FAIL failure_does_not_record_success (success was recorded)\n' >&2
  failures=$((failures + 1))
fi

expect_failure qa_rejects_production_database \
  run_runner MOCK_DATABASE=manus_tienda_prd ONLY_INCREMENTAL_MIGRATION=V071__link_pos_terminals_to_operational_terminals.sql ONLY_INCREMENTAL_DRY_RUN=YES

if [[ "$failures" -ne 0 ]]; then
  exit 1
fi

printf 'PASS migrate_prd single-incremental suite\n'
