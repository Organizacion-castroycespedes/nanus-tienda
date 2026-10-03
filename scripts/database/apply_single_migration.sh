#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${BASH_VERSION:-}" ]]; then
  exec bash "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
MIGRATIONS_DIR="${SCRIPT_DIR}/migrations"
ENV_FILE="${1:-${DB_ENV_FILE:-${ROOT_DIR}/scripts/config/db.env}}"
MIGRATION_INPUT="${2:-}"
EXPECTED_CHECKSUM="${3:-${MIGRATION_EXPECTED_CHECKSUM:-}}"
EXPECTED_BINDING="${4:-${MIGRATION_EXECUTION_BINDING:-}}"
DB_SCHEMA="${DB_SCHEMA:-public}"
SHA256_RE='^[0-9a-fA-F]{64}$'
MIGRATION_FILENAME_RE='^V[0-9]{3}__[A-Za-z0-9][A-Za-z0-9._-]*\.sql$'
MIGRATION_GOVERNANCE_ERA="${MIGRATION_GOVERNANCE_ERA:-PRE_GOVERNANCE}"
GOVERNANCE_CUTOVER_APPROVED="${GOVERNANCE_CUTOVER_APPROVED:-NO}"
MIGRATION_EXPECTED_PREDECESSOR_KIND="${MIGRATION_EXPECTED_PREDECESSOR_KIND:-}"
MIGRATION_EXPECTED_PREDECESSOR_VERSION="${MIGRATION_EXPECTED_PREDECESSOR_VERSION:-}"
MIGRATION_EXPECTED_PREDECESSOR_CHECKSUM="${MIGRATION_EXPECTED_PREDECESSOR_CHECKSUM:-}"

usage() {
  echo "Usage: $0 <env-file> <migration-file> [sha256-checksum] [execution-binding]" >&2
  exit 2
}

[[ -n "$MIGRATION_INPUT" ]] || usage
[[ -f "$ENV_FILE" ]] || { echo "[apply_single_migration] Environment file not found." >&2; exit 1; }

if [[ ! "$DB_SCHEMA" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  echo "[apply_single_migration] Invalid DB_SCHEMA identifier." >&2
  exit 1
fi

case "$MIGRATION_INPUT" in
  /*) MIGRATION_FILE="$MIGRATION_INPUT" ;;
  scripts/database/migrations/*) MIGRATION_FILE="${ROOT_DIR}/${MIGRATION_INPUT}" ;;
  *) MIGRATION_FILE="${MIGRATIONS_DIR}/${MIGRATION_INPUT}" ;;
esac

MIGRATION_ROOT="$(cd "$MIGRATIONS_DIR" && pwd -P)"
MIGRATION_FILE="$(cd "$(dirname "$MIGRATION_FILE")" && pwd -P)/$(basename "$MIGRATION_FILE")"
[[ ! -L "$MIGRATION_FILE" ]] || {
  echo "[apply_single_migration] Refusing symlinked migration path." >&2
  exit 1
}
RESOLVED_MIGRATION_FILE="$(readlink -f -- "$MIGRATION_FILE" 2>/dev/null || true)"
case "$RESOLVED_MIGRATION_FILE" in
  "${MIGRATION_ROOT}"/*.sql) ;;
  *) echo "[apply_single_migration] Refusing migration outside scripts/database/migrations." >&2; exit 1 ;;
esac

[[ -f "$RESOLVED_MIGRATION_FILE" && ! -L "$RESOLVED_MIGRATION_FILE" ]] || {
  echo "[apply_single_migration] Refusing non-regular migration file." >&2
  exit 1
}
MIGRATION_FILE="$RESOLVED_MIGRATION_FILE"

VERSION="$(basename "$MIGRATION_FILE")"
[[ "$VERSION" =~ ^V[0-9]{3}__.+\.sql$ ]] || {
  echo "[apply_single_migration] Refusing invalid migration filename: $VERSION" >&2
  exit 1
}
[[ -f "$MIGRATION_FILE" ]] || { echo "[apply_single_migration] Migration file not found." >&2; exit 1; }

# Freeze the validated file bytes before any database client starts. The
# authoritative transaction reads this private regular snapshot, not the
# mutable repository pathname.
SOURCE_MIGRATION_FILE="$MIGRATION_FILE"
SNAPSHOT_FILE="$(mktemp "${TMPDIR:-/tmp}/manus-migration-snapshot-XXXXXX.sql")"
cleanup_snapshot() { rm -f -- "$SNAPSHOT_FILE"; }
trap cleanup_snapshot EXIT
cp -- "$SOURCE_MIGRATION_FILE" "$SNAPSHOT_FILE"
chmod 600 "$SNAPSHOT_FILE" 2>/dev/null || true
[[ -f "$SNAPSHOT_FILE" && ! -L "$SNAPSHOT_FILE" ]] || {
  echo "[apply_single_migration] Refusing invalid migration snapshot." >&2
  exit 1
}
MIGRATION_FILE="$SNAPSHOT_FILE"

# shellcheck disable=SC1090
source "$ENV_FILE"
TARGET_ENV="${MIGRATION_TARGET_ENV:-QA}"
TARGET_ENV="${TARGET_ENV^^}"
DB_SCHEMA="${DB_SCHEMA:-public}"
DB_ADMIN_USER="${DB_ADMIN_USER:-${DB_USER:-}}"
DB_ADMIN_PASSWORD="${DB_ADMIN_PASSWORD:-${DB_PASSWORD:-}}"
MIGRATION_GOVERNANCE_ERA="${MIGRATION_GOVERNANCE_ERA:-PRE_GOVERNANCE}"
GOVERNANCE_CUTOVER_APPROVED="${GOVERNANCE_CUTOVER_APPROVED:-NO}"
MIGRATION_EXPECTED_PREDECESSOR_KIND="${MIGRATION_EXPECTED_PREDECESSOR_KIND:-}"
MIGRATION_EXPECTED_PREDECESSOR_VERSION="${MIGRATION_EXPECTED_PREDECESSOR_VERSION:-}"
MIGRATION_EXPECTED_PREDECESSOR_CHECKSUM="${MIGRATION_EXPECTED_PREDECESSOR_CHECKSUM:-}"
ENVIRONMENT_NORMALIZED="${ENVIRONMENT:-QA}"
ENVIRONMENT_NORMALIZED="${ENVIRONMENT_NORMALIZED^^}"

if [[ "$MIGRATION_GOVERNANCE_ERA" == "POST_CUTOVER" ]]; then
  python -B "$ROOT_DIR/scripts/governance/migration_runner_policy.py" \
    --root "$ROOT_DIR" --require-active >/dev/null 2>&1 || {
    echo "[apply_single_migration] CUTOVER_NOT_ACTIVE_OR_INVALID; no executor call." >&2
    exit 1
  }
fi

case "$TARGET_ENV" in
  QA)
    [[ "${DB_NAME:-}" == "manus_tienda_qa" && "$DB_SCHEMA" == "public" && "$ENVIRONMENT_NORMALIZED" == "QA" ]] || {
      echo "[apply_single_migration] Refusing target: explicit QA guard failed." >&2
      exit 1
    }
    ;;
  PROD)
    [[ "${ENVIRONMENT:-}" == "PROD" && "${MIGRATION_PROD_APPROVED:-}" == "YES" ]] || {
      echo "[apply_single_migration] Refusing PROD target without ENVIRONMENT=PROD and MIGRATION_PROD_APPROVED=YES." >&2
      exit 1
    }
    ;;
  *)
    echo "[apply_single_migration] Refusing unknown MIGRATION_TARGET_ENV=$TARGET_ENV." >&2
    exit 1
    ;;
esac

for var_name in DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD DB_ADMIN_USER DB_ADMIN_PASSWORD; do
  [[ -n "${!var_name:-}" ]] || { echo "[apply_single_migration] Missing ${var_name}." >&2; exit 1; }
done
if [[ ! "$DB_NAME" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  echo "[apply_single_migration] Invalid DB_NAME identifier." >&2
  exit 1
fi

reject_transaction_control() {
  # Remove SQL comments, quoted strings and dollar-quoted bodies before the
  # conservative keyword check. A false positive fails closed before DB access.
  awk '
    function emit(c) { output = output c }
    function flush() { if (output != "") print output; output = "" }
    BEGIN { block = 0; single = 0; double = 0; dollar = ""; output = "" }
    {
      line = $0
      i = 1
      length_line = length(line)
      while (i <= length_line) {
        rest = substr(line, i)
        c = substr(line, i, 1)
        next_c = substr(line, i + 1, 1)
        if (block) {
          if (c == "*" && next_c == "/") { block = 0; i += 2 } else { i++ }
          continue
        }
        if (dollar != "") {
          close_at = index(rest, dollar)
          if (close_at > 0) { i += close_at + length(dollar) - 1; dollar = "" } else { i = length_line + 1 }
          continue
        }
        if (single) {
          if (c == "\\" && next_c == "\\") { i += 2; continue }
          if (c == "\047" && next_c == "\047") { i += 2; continue }
          if (c == "\047") single = 0
          i++
          continue
        }
        if (double) {
          if (c == "\"" && next_c == "\"") { i += 2; continue }
          if (c == "\"") double = 0
          i++
          continue
        }
        if (c == "-" && next_c == "-") { break }
        if (c == "/" && next_c == "*") { block = 1; i += 2; continue }
        if (c == "\047") { single = 1; i++; continue }
        if (c == "\"") { double = 1; i++; continue }
        if (c == "$") {
          if (substr(rest, 1, 2) == "$$") { dollar = "$$"; i += 2; continue }
          if (match(rest, /^\$[A-Za-z_][A-Za-z0-9_]*\$/)) {
            dollar = substr(rest, RSTART, RLENGTH)
            i += RLENGTH
            continue
          }
        }
        emit(c)
        i++
      }
      flush()
    }
  ' "$1" | grep -Eiq '(^|[^[:alnum:]_])(BEGIN|START|COMMIT|END|ROLLBACK|ABORT|SAVEPOINT|RELEASE)([^[:alnum:]_]|$)'
}

if reject_transaction_control "$MIGRATION_FILE"; then
  echo "[apply_single_migration] Refusing transaction-control statements in post-cutover migration: $VERSION" >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  CHECKSUM="$(sha256sum "$MIGRATION_FILE" | awk '{print $1}')"
else
  CHECKSUM="$(shasum -a 256 "$MIGRATION_FILE" | awk '{print $1}')"
fi
if [[ -n "$EXPECTED_CHECKSUM" && ! "$EXPECTED_CHECKSUM" =~ $SHA256_RE ]]; then
  echo "[apply_single_migration] Expected checksum must be a SHA-256 hex digest." >&2
  exit 1
fi
if [[ -n "$EXPECTED_CHECKSUM" && "${CHECKSUM,,}" != "${EXPECTED_CHECKSUM,,}" ]]; then
  echo "[apply_single_migration] Checksum mismatch for $VERSION." >&2
  exit 1
fi

if [[ "${MIGRATION_DRY_RUN:-NO}" == "YES" ]]; then
  if [[ "$MIGRATION_GOVERNANCE_ERA" == "PRE_GOVERNANCE" ]]; then
    echo "[apply_single_migration] DRY_RUN era=PRE_GOVERNANCE replay_protection=HISTORICAL_REPLAY_PROHIBITED executor=NO version=$VERSION checksum=$CHECKSUM"
  elif [[ "$MIGRATION_GOVERNANCE_ERA" == "POST_CUTOVER" && "$GOVERNANCE_CUTOVER_APPROVED" != "YES" ]]; then
    echo "[apply_single_migration] DRY_RUN era=POST_CUTOVER_STRICT replay_protection=CUTOVER_NOT_APPROVED executor=NO version=$VERSION checksum=$CHECKSUM"
  else
    echo "[apply_single_migration] DRY_RUN era=$MIGRATION_GOVERNANCE_ERA executor=NO version=$VERSION checksum=$CHECKSUM"
  fi
  exit 0
fi

case "$MIGRATION_GOVERNANCE_ERA" in
  PRE_GOVERNANCE)
    echo "[apply_single_migration] HISTORICAL_REPLAY_PROHIBITED before governance cutover; no executor call." >&2
    exit 1
    ;;
  POST_CUTOVER)
    [[ "$GOVERNANCE_CUTOVER_APPROVED" == "YES" ]] || {
      echo "[apply_single_migration] CUTOVER_NOT_APPROVED; no executor call." >&2
      exit 1
    }
    [[ "$MIGRATION_EXPECTED_PREDECESSOR_KIND" == "PRE_GOVERNANCE_BOUNDARY" || \
       "$MIGRATION_EXPECTED_PREDECESSOR_KIND" == "GOVERNED_POST_CUTOVER" ]] || {
      echo "[apply_single_migration] Missing or invalid expected predecessor kind; no executor call." >&2
      exit 1
    }
    if [[ "$MIGRATION_EXPECTED_PREDECESSOR_KIND" == "PRE_GOVERNANCE_BOUNDARY" ]]; then
      [[ "$MIGRATION_EXPECTED_PREDECESSOR_VERSION" == "V095" && -z "$MIGRATION_EXPECTED_PREDECESSOR_CHECKSUM" ]] || {
        echo "[apply_single_migration] Invalid pre-governance boundary contract; no executor call." >&2
        exit 1
      }
    else
      [[ "$MIGRATION_EXPECTED_PREDECESSOR_VERSION" =~ $MIGRATION_FILENAME_RE && \
         "$MIGRATION_EXPECTED_PREDECESSOR_CHECKSUM" =~ $SHA256_RE ]] || {
        echo "[apply_single_migration] Missing or invalid governed predecessor checksum; no executor call." >&2
        exit 1
      }
    fi
    ;;
  *)
    echo "[apply_single_migration] Invalid MIGRATION_GOVERNANCE_ERA; no executor call." >&2
    exit 1
    ;;
esac

if [[ -n "$EXPECTED_BINDING" && ! "$EXPECTED_BINDING" =~ $SHA256_RE ]]; then
  echo "[apply_single_migration] Execution binding must be a SHA-256 hex digest." >&2
  exit 1
fi
MIGRATION_RELATIVE_PATH="scripts/database/migrations/${VERSION}"
BINDING_INPUT="${VERSION}
${MIGRATION_RELATIVE_PATH}
${CHECKSUM,,}
${MIGRATION_EXPECTED_PREDECESSOR_KIND}
${MIGRATION_EXPECTED_PREDECESSOR_VERSION}
${MIGRATION_EXPECTED_PREDECESSOR_CHECKSUM,,}
scripts/database/apply_single_migration.sh"
if command -v sha256sum >/dev/null 2>&1; then
  EXECUTION_BINDING="$(printf '%s' "$BINDING_INPUT" | sha256sum | awk '{print $1}')"
else
  EXECUTION_BINDING="$(printf '%s' "$BINDING_INPUT" | shasum -a 256 | awk '{print $1}')"
fi
if [[ -z "$EXPECTED_BINDING" || "${EXECUTION_BINDING,,}" != "${EXPECTED_BINDING,,}" ]]; then
  echo "[apply_single_migration] Execution binding mismatch; no executor call." >&2
  exit 1
fi

export PGPASSWORD="$DB_ADMIN_PASSWORD"
PSQL=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_ADMIN_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -X -q)

if [[ ! "$DB_SCHEMA" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  echo "[apply_single_migration] Invalid DB_SCHEMA identifier." >&2
  exit 1
fi

"${PSQL[@]}" -tAc "SELECT current_database() = '$DB_NAME' AND current_schema() = '$DB_SCHEMA';" | grep -qx t
"${PSQL[@]}" -tAc "SELECT to_regclass('${DB_SCHEMA}.migrations_history') IS NOT NULL;" | grep -qx t

already_applied_row="$("${PSQL[@]}" -F $'\t' -Atc "SELECT COALESCE(checksum, ''), success::text FROM \"${DB_SCHEMA}\".migrations_history WHERE version = '$VERSION' LIMIT 1;")"
if [[ -n "$already_applied_row" ]]; then
  stored_checksum=""
  stored_success=""
  IFS=$'\t' read -r stored_checksum stored_success <<< "$already_applied_row"
  if [[ "$stored_success" != "true" ]]; then
    echo "[apply_single_migration] Refusing history row with success=false: $VERSION" >&2
    exit 1
  fi
  if [[ -z "$stored_checksum" || ! "$stored_checksum" =~ $SHA256_RE ]]; then
    echo "[apply_single_migration] Existing history checksum is unverified for $VERSION; no rewrite or replay allowed." >&2
    exit 1
  fi
  if [[ "${stored_checksum,,}" != "${CHECKSUM,,}" ]]; then
    echo "[apply_single_migration] CHECKSUM_MISMATCH for $VERSION; refusing execution." >&2
    exit 1
  fi
  if [[ "$MIGRATION_GOVERNANCE_ERA" == "POST_CUTOVER" ]]; then
    echo "[apply_single_migration] TARGET_ALREADY_APPLIED: $VERSION; fresh evidence and plan required." >&2
    exit 1
  fi
  echo "[apply_single_migration] VERIFIED_MATCH; already applied: $VERSION"
  exit 0
fi

# Exactly one requested file is executed. No scan, fallback, or generic loop.
# The lock, authoritative state assertions, migration and history row share
# one connection and one transaction. The lock is transaction-scoped and
# fail-fast.
transaction_output=""
transaction_status=0
# migration_checksum is the validated exact-byte CHECKSUM above.
set +e
transaction_output="$("${PSQL[@]}" --single-transaction \
  -c "DO \$governance\$
DECLARE
  lock_acquired boolean;
  schema_matches boolean;
  target_count integer;
  target_failed_count integer;
  predecessor_count integer;
  predecessor_success_count integer;
  predecessor_checksum text;
  conflicting_count integer;
BEGIN
  SELECT current_database() = '$DB_NAME'
     AND current_schema() = '$DB_SCHEMA'
    INTO schema_matches;
  IF NOT schema_matches THEN
    RAISE EXCEPTION USING MESSAGE = 'DB_SCHEMA_IDENTITY_MISMATCH';
  END IF;

  SELECT pg_try_advisory_xact_lock(
    hashtextextended(
      'manus-governed-migration-v1:' || current_database() || ':' || current_schema(),
      0
    )
  ) INTO lock_acquired;
  IF NOT lock_acquired THEN
    RAISE EXCEPTION USING ERRCODE = '55P03', MESSAGE = 'PROMOTION_LOCK_UNAVAILABLE';
  END IF;

  EXECUTE format(
    'SELECT count(*), count(*) FILTER (WHERE success IS FALSE) FROM %I.migrations_history WHERE version = \$1',
    '$DB_SCHEMA'
  ) INTO target_count, target_failed_count USING '$VERSION';
  IF target_failed_count > 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'FAILED_HISTORY_PRESENT';
  ELSIF target_count > 1 THEN
    RAISE EXCEPTION USING MESSAGE = 'DUPLICATE_HISTORY_VERSION';
  ELSIF target_count = 1 THEN
    RAISE EXCEPTION USING MESSAGE = 'TARGET_ALREADY_APPLIED';
  END IF;

  EXECUTE format(
    'SELECT count(*), count(*) FILTER (WHERE success IS TRUE), max(checksum) FROM %I.migrations_history WHERE version = \$1',
    '$DB_SCHEMA'
  ) INTO predecessor_count, predecessor_success_count, predecessor_checksum
  USING '$MIGRATION_EXPECTED_PREDECESSOR_VERSION';

  IF '$MIGRATION_EXPECTED_PREDECESSOR_KIND' = 'PRE_GOVERNANCE_BOUNDARY' THEN
    IF '$MIGRATION_EXPECTED_PREDECESSOR_VERSION' <> 'V095' OR predecessor_count > 1 THEN
      RAISE EXCEPTION USING MESSAGE = 'EXPECTED_PREDECESSOR_MISMATCH';
    END IF;
  ELSE
    IF predecessor_count <> 1 OR predecessor_success_count <> 1
       OR lower(coalesce(predecessor_checksum, '')) <> lower('$MIGRATION_EXPECTED_PREDECESSOR_CHECKSUM') THEN
      RAISE EXCEPTION USING MESSAGE = 'EXPECTED_PREDECESSOR_MISMATCH';
    END IF;
  END IF;

  EXECUTE format(
    'SELECT count(*) FROM %I.migrations_history WHERE version ~ \$1 AND substring(version from 2 for 3)::integer > substring(\$2 from 2 for 3)::integer AND version <> \$2',
    '$DB_SCHEMA'
  ) INTO conflicting_count USING '^V[0-9]{3}__', '$VERSION';
  IF conflicting_count > 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'CONFLICTING_POST_CUTOVER_STATE';
  END IF;
END
\$governance\$;" \
  -f "$MIGRATION_FILE" \
  -c "INSERT INTO \"${DB_SCHEMA}\".migrations_history (version, checksum, success, details) VALUES ('$VERSION', '$CHECKSUM', true, 'applied by apply_single_migration.sh');" 2>&1)"
transaction_status=$?
set -e

if (( transaction_status != 0 )); then
  case "$transaction_output" in
    *PROMOTION_LOCK_UNAVAILABLE*) reason="PROMOTION_LOCK_UNAVAILABLE" ;;
    *DB_SCHEMA_IDENTITY_MISMATCH*) reason="DB_SCHEMA_IDENTITY_MISMATCH" ;;
    *FAILED_HISTORY_PRESENT*) reason="FAILED_HISTORY_PRESENT" ;;
    *DUPLICATE_HISTORY_VERSION*) reason="DUPLICATE_HISTORY_VERSION" ;;
    *TARGET_ALREADY_APPLIED*) reason="TARGET_ALREADY_APPLIED" ;;
    *EXPECTED_PREDECESSOR_MISMATCH*) reason="EXPECTED_PREDECESSOR_MISMATCH" ;;
    *CONFLICTING_POST_CUTOVER_STATE*) reason="CONFLICTING_POST_CUTOVER_STATE" ;;
    *) reason="MIGRATION_TRANSACTION_FAILED" ;;
  esac
  echo "[apply_single_migration] ${reason}: ${VERSION}" >&2
  exit 1
fi

echo "[apply_single_migration] Applied $VERSION to ${DB_NAME}/${DB_SCHEMA}."
