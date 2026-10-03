#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT

RUNNER_ROOT="${TEST_ROOT}/scripts/database"
MIGRATIONS_DIR="${RUNNER_ROOT}/migrations"
GOVERNANCE_ROOT="${TEST_ROOT}/scripts/governance"
MOCK_BIN="${TEST_ROOT}/bin"
ENV_FILE="${TEST_ROOT}/qa.env"
PSQL_LOG="${TEST_ROOT}/psql.log"

mkdir -p "$MIGRATIONS_DIR" "$GOVERNANCE_ROOT" "$MOCK_BIN"
cp "${REPO_ROOT}/scripts/database/apply_single_migration.sh" "${RUNNER_ROOT}/apply_single_migration.sh"
cp "${REPO_ROOT}/scripts/governance/migration_runner_policy.py" \
  "${GOVERNANCE_ROOT}/migration_runner_policy.py"
cp "${REPO_ROOT}/scripts/governance/migration-baseline.json" \
  "${GOVERNANCE_ROOT}/migration-baseline.json"
sed -i 's/"status": "ACTIVE"/"status": "APPROVED_NOT_ACTIVE"/; s/"activated": true/"activated": false/; s/"activation": "EXPLICIT_OWNER_ACTIVATION"/"activation": "NOT_GRANTED"/' \
  "${GOVERNANCE_ROOT}/migration-baseline.json"
cp "${REPO_ROOT}/scripts/database/migrations/V096__electronic_billing_failure_detail.sql" \
  "${MIGRATIONS_DIR}/V096__electronic_billing_failure_detail.sql"
printf '%s\n' 'BEGIN;' 'SELECT 1;' 'COMMIT;' > "${MIGRATIONS_DIR}/V097__transaction_control.sql"

printf '%s\n' \
  'DB_HOST=mock-host' \
  'DB_PORT=5432' \
  'DB_NAME=manus_tienda_qa' \
  'DB_USER=qa_runtime_user' \
  'DB_PASSWORD=fixture-password' \
  'ENVIRONMENT=QA' \
  'DB_SCHEMA=public' \
  'MIGRATION_EXPECTED_PREDECESSOR_KIND=PRE_GOVERNANCE_BOUNDARY' \
  'MIGRATION_EXPECTED_PREDECESSOR_VERSION=V095' \
  > "$ENV_FILE"

cat > "${MOCK_BIN}/psql" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$*" >> "${MOCK_PSQL_LOG}"
arguments="$*"

if [[ "$arguments" == *"pg_try_advisory_xact_lock"* && "${MOCK_LOCK_FAIL:-NO}" == "YES" ]]; then
  printf '%s\n' 'ERROR: PROMOTION_LOCK_UNAVAILABLE' >&2
  exit 1
fi

if [[ "$arguments" == *"pg_try_advisory_xact_lock"* && "${MOCK_EXPECTED_STATE_FAIL:-NO}" == "YES" ]]; then
  printf '%s\n' 'ERROR: EXPECTED_PREDECESSOR_MISMATCH' >&2
  exit 1
fi

if [[ "$arguments" == *"-tAc SELECT current_database()"* ]]; then
  printf '%s\n' 't'
  exit 0
fi

if [[ "$arguments" == *"-tAc SELECT to_regclass"* ]]; then
  printf '%s\n' 't'
  exit 0
fi

if [[ "$arguments" == *"SELECT COALESCE(checksum"* ]]; then
  exit 0
fi

if [[ "$arguments" == *" -f "* && "${MOCK_FAIL_APPLY:-NO}" == "YES" ]]; then
  exit 1
fi

if [[ "$arguments" == *"INSERT INTO"* && "${MOCK_FAIL_HISTORY:-NO}" == "YES" ]]; then
  exit 1
fi

exit 0
EOF
chmod +x "${MOCK_BIN}/psql"

V096_CHECKSUM="$(sha256sum "${MIGRATIONS_DIR}/V096__electronic_billing_failure_detail.sql" | awk '{print $1}')"

execution_binding() {
  local version="$1" checksum="$2" predecessor_kind="$3" predecessor_version="$4" predecessor_checksum="$5"
  local payload="${version}
scripts/database/migrations/${version}
${checksum}
${predecessor_kind}
${predecessor_version}
${predecessor_checksum}
scripts/database/apply_single_migration.sh"
  printf '%s' "$payload" | sha256sum | awk '{print $1}'
}

run_runner() {
  local override=()
  while [[ "${1:-}" == *=* ]]; do
    override+=("$1")
    shift
  done
  local migration_name="${1:-}"
  local migration_checksum="${2:-}"
  local binding="$(execution_binding "$migration_name" "$migration_checksum" \
    "${MIGRATION_EXPECTED_PREDECESSOR_KIND:-PRE_GOVERNANCE_BOUNDARY}" \
    "${MIGRATION_EXPECTED_PREDECESSOR_VERSION:-V095}" \
    "${MIGRATION_EXPECTED_PREDECESSOR_CHECKSUM:-}")"
  env \
    PATH="${MOCK_BIN}:$PATH" \
    MOCK_PSQL_LOG="$PSQL_LOG" \
    MOCK_LOCK_FAIL="${MOCK_LOCK_FAIL:-NO}" \
    MOCK_EXPECTED_STATE_FAIL="${MOCK_EXPECTED_STATE_FAIL:-NO}" \
    MIGRATION_GOVERNANCE_ERA=POST_CUTOVER \
    GOVERNANCE_CUTOVER_APPROVED=YES \
    "${override[@]}" \
    bash "${RUNNER_ROOT}/apply_single_migration.sh" "$ENV_FILE" "$migration_name" "$migration_checksum" "$binding"
}

: > "$PSQL_LOG"
if run_runner V096__electronic_billing_failure_detail.sql "$V096_CHECKSUM" > "${TEST_ROOT}/inactive-cutover.out" 2>&1; then
  echo 'FAIL inactive repository cutover was accepted' >&2
  exit 1
fi
grep -Fq -- 'CUTOVER_NOT_ACTIVE_OR_INVALID' "${TEST_ROOT}/inactive-cutover.out"
if [[ -s "$PSQL_LOG" ]]; then
  echo 'FAIL inactive cutover reached DB client' >&2
  exit 1
fi

# Activate only the disposable fixture. Production baseline remains inactive.
sed -i 's/"status": "APPROVED_NOT_ACTIVE"/"status": "ACTIVE"/; s/"activated": false/"activated": true/; s/"activation": "NOT_GRANTED"/"activation": "EXPLICIT_OWNER_ACTIVATION"/' \
  "${GOVERNANCE_ROOT}/migration-baseline.json"

: > "$PSQL_LOG"
run_runner V096__electronic_billing_failure_detail.sql "$V096_CHECKSUM" > "${TEST_ROOT}/success.out"
grep -Fq -- '--single-transaction' "$PSQL_LOG"
grep -Fq -- '-U qa_runtime_user' "$PSQL_LOG"
grep -Fq -- ' -f ' "$PSQL_LOG"
grep -Fq -- 'INSERT INTO' "$PSQL_LOG"
grep -Fq -- 'pg_try_advisory_xact_lock' "$PSQL_LOG"
grep -Fq -- 'PRE_GOVERNANCE_BOUNDARY' "$PSQL_LOG"
grep -Fq -- 'V095' "$PSQL_LOG"
if grep -Fq 'fixture-password' "${TEST_ROOT}/success.out"; then
  echo 'FAIL secret appeared in runner output' >&2
  exit 1
fi

: > "$PSQL_LOG"
if run_runner MOCK_LOCK_FAIL=YES V096__electronic_billing_failure_detail.sql "$V096_CHECKSUM" > "${TEST_ROOT}/lock-failure.out" 2>&1; then
  echo 'FAIL advisory lock failure was accepted' >&2
  exit 1
fi
if ! grep -Fq 'PROMOTION_LOCK_UNAVAILABLE: V096__electronic_billing_failure_detail.sql' "${TEST_ROOT}/lock-failure.out"; then
  echo 'FAIL lock failure was not sanitized as expected' >&2
  cat "${TEST_ROOT}/lock-failure.out" >&2
  exit 1
fi
if grep -Eq 'fixture-password|DB_PASSWORD|postgres://' "${TEST_ROOT}/lock-failure.out"; then
  echo 'FAIL lock failure leaked secret/DSN' >&2
  exit 1
fi

: > "$PSQL_LOG"
if run_runner MOCK_EXPECTED_STATE_FAIL=YES V096__electronic_billing_failure_detail.sql "$V096_CHECKSUM" > "${TEST_ROOT}/state-failure.out" 2>&1; then
  echo 'FAIL expected-state failure was accepted' >&2
  exit 1
fi
if ! grep -Fq 'EXPECTED_PREDECESSOR_MISMATCH: V096__electronic_billing_failure_detail.sql' "${TEST_ROOT}/state-failure.out"; then
  echo 'FAIL expected-state failure was not sanitized as expected' >&2
  cat "${TEST_ROOT}/state-failure.out" >&2
  exit 1
fi

: > "$PSQL_LOG"
if run_runner MOCK_FAIL_APPLY=YES V096__electronic_billing_failure_detail.sql "$V096_CHECKSUM" > "${TEST_ROOT}/sql-failure.out" 2>&1; then
  echo 'FAIL SQL failure was accepted' >&2
  exit 1
fi

: > "$PSQL_LOG"
if run_runner MOCK_FAIL_HISTORY=YES V096__electronic_billing_failure_detail.sql "$V096_CHECKSUM" > "${TEST_ROOT}/history-failure.out" 2>&1; then
  echo 'FAIL history failure was accepted' >&2
  exit 1
fi
grep -Fq -- '--single-transaction' "$PSQL_LOG"

: > "$PSQL_LOG"
if run_runner V097__transaction_control.sql "$(sha256sum "${MIGRATIONS_DIR}/V097__transaction_control.sql" | awk '{print $1}')" > "${TEST_ROOT}/guard.out" 2>&1; then
  echo 'FAIL transaction-control migration was accepted' >&2
  exit 1
fi
if [[ -s "$PSQL_LOG" ]]; then
  echo 'FAIL transaction-control guard reached DB client' >&2
  exit 1
fi

# Path substitution and stale-plan checksum regressions fail before psql.
old_checksum="$(printf '%s\n' 'SELECT 1;' | sha256sum | awk '{print $1}')"
printf '%s\n' 'SELECT 1;' > "${TEST_ROOT}/outside.sql"
python -c 'import os, sys; os.symlink(sys.argv[1], sys.argv[2])' \
  "${TEST_ROOT}/outside.sql" "${MIGRATIONS_DIR}/V098__symlinked.sql"
[[ -L "${MIGRATIONS_DIR}/V098__symlinked.sql" ]] || {
  echo 'FAIL symlink fixture was not created' >&2
  exit 1
}
if run_runner V098__symlinked.sql "$(sha256sum "${TEST_ROOT}/outside.sql" | awk '{print $1}')" > "${TEST_ROOT}/symlink.out" 2>&1; then
  echo 'FAIL escaping symlink was accepted' >&2
  exit 1
fi
grep -Fq 'Refusing symlinked migration path' "${TEST_ROOT}/symlink.out"
if [[ -s "$PSQL_LOG" ]]; then
  echo 'FAIL symlink validation reached DB client' >&2
  exit 1
fi

if run_runner ../outside.sql "$old_checksum" > "${TEST_ROOT}/traversal.out" 2>&1; then
  echo 'FAIL traversal path was accepted' >&2
  exit 1
fi
grep -Fq 'Refusing migration outside scripts/database/migrations' "${TEST_ROOT}/traversal.out"

python -c 'import os, sys; os.symlink(sys.argv[1], sys.argv[2])' \
  "${TEST_ROOT}/missing.sql" "${MIGRATIONS_DIR}/V098__broken.sql"
if run_runner V098__broken.sql "$old_checksum" > "${TEST_ROOT}/broken.out" 2>&1; then
  echo 'FAIL broken symlink was accepted' >&2
  exit 1
fi
grep -Fq 'Refusing symlinked migration path' "${TEST_ROOT}/broken.out"

mkdir "${MIGRATIONS_DIR}/V098__directory.sql"
if run_runner V098__directory.sql "$old_checksum" > "${TEST_ROOT}/directory.out" 2>&1; then
  echo 'FAIL non-regular migration target was accepted' >&2
  exit 1
fi
grep -Eq 'Migration file not found|Refusing non-regular migration file' "${TEST_ROOT}/directory.out"

printf '%s\n' 'SELECT 2;' > "${MIGRATIONS_DIR}/V099__mutated.sql"
if run_runner V099__mutated.sql "$old_checksum" > "${TEST_ROOT}/mutation.out" 2>&1; then
  echo 'FAIL stale expected checksum was accepted' >&2
  exit 1
fi
grep -Fq 'Checksum mismatch' "${TEST_ROOT}/mutation.out"

echo 'PASS apply_single_migration governance contract suite'
