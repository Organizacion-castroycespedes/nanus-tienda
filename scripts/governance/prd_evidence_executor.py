"""Allowlisted PRD evidence-executor boundary.

This module owns only request/response validation. Credential-bearing execution
is supplied by an authorized process boundary and is never performed here.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from typing import Any

CONTRACT_VERSION = "prd-evidence-v1"
ALLOWED_OPERATION = "collect_prd_migration_evidence"
LIVE_PROVENANCE = "EXECUTOR_LIVE_READ_ONLY_EVIDENCE"
FORBIDDEN_REQUEST_FIELDS = frozenset({
    "args", "command", "connection_string", "credential", "dsn", "env",
    "environment_dump", "password", "private_key", "query", "remote_command",
    "script", "shell", "sql", "stderr", "stdout", "token",
})
ALLOWED_REQUEST_FIELDS = frozenset({
    "contract_version", "operation", "correlation_id", "expected_host",
    "expected_database", "expected_schema",
})
BEGIN_MARKER = "MANUS_PRD_EVIDENCE_BEGIN"
END_MARKER = "MANUS_PRD_EVIDENCE_END"
LIVE_ENABLE_ENV = "PRD_EVIDENCE_EXECUTOR_ENABLE_LIVE"
RUNTIME_CONFIG_FIELDS = (
    "PRD_SSH_EXECUTABLE", "PRD_SSH_TARGET_HOST", "PRD_SSH_PORT", "PRD_SSH_USER",
    "PRD_SSH_KEY_PATH", "PRD_REMOTE_ENV_PATH", "PRD_EXPECTED_HOSTNAME",
    "PRD_EXPECTED_DATABASE", "PRD_EXPECTED_SCHEMA",
)
WRITE_SQL_TOKENS = re.compile(
    r"\b(?:INSERT|UPDATE|DELETE|MERGE|COPY\s+FROM|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|CALL)\b",
    re.IGNORECASE,
)
READ_ONLY_SQL = """BEGIN;
SET TRANSACTION READ ONLY;
SELECT json_build_object(
  'identity', json_build_object(
    'environment', 'prd',
    'current_database', current_database(),
    'current_schema', current_schema(),
    'user', current_user
  ),
  'schema', json_build_object(
    'table', 'public.migrations_history',
    'exists', to_regclass('public.migrations_history') IS NOT NULL,
    'columns', COALESCE((
      SELECT json_agg(json_build_object(
        'name', column_name,
        'data_type', data_type,
        'nullable', is_nullable
      ) ORDER BY ordinal_position)
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'migrations_history'
    ), '[]'::json)
  ),
  'read_only_verified', current_setting('transaction_read_only') = 'on',
  'history_rows', COALESCE((
    SELECT json_agg(json_build_object(
      'version', version,
      'checksum', checksum,
      'success', success
    ) ORDER BY id)
    FROM public.migrations_history
  ), '[]'::json),
  'query_count', 1,
  'write_count', 0
);
COMMIT;"""


def _failure(reason: str, *, correlation_id: str | None = None) -> dict[str, object]:
    return {
        "contract_version": CONTRACT_VERSION,
        "operation": ALLOWED_OPERATION,
        "correlation_id": correlation_id,
        "status": "UNVERIFIED",
        "evidence": None,
        "error": {"code": reason},
        "sanitized": True,
    }


def validate_prd_evidence_request(request: Mapping[str, object] | None) -> dict[str, object]:
    """Validate a non-secret, semantic request before crossing the boundary."""
    if not isinstance(request, Mapping):
        return _failure("REQUEST_MUST_BE_OBJECT")
    keys = {str(key) for key in request}
    forbidden = sorted(keys & FORBIDDEN_REQUEST_FIELDS)
    if forbidden:
        return _failure("FORBIDDEN_REQUEST_FIELD")
    unknown = sorted(keys - ALLOWED_REQUEST_FIELDS)
    if unknown:
        return _failure("UNKNOWN_REQUEST_FIELD")
    if request.get("contract_version") != CONTRACT_VERSION:
        return _failure("CONTRACT_VERSION_MISMATCH")
    if request.get("operation") != ALLOWED_OPERATION:
        return _failure("OPERATION_NOT_ALLOWLISTED")
    correlation_id = request.get("correlation_id")
    if not isinstance(correlation_id, str) or not 1 <= len(correlation_id) <= 128:
        return _failure("CORRELATION_ID_INVALID")
    if any(ord(char) < 32 or ord(char) == 127 for char in correlation_id):
        return _failure("CORRELATION_ID_INVALID")
    for field in ("expected_host", "expected_database", "expected_schema"):
        value = request.get(field)
        if not isinstance(value, str) or not value.strip() or len(value) > 255:
            return _failure(f"{field.upper()}_INVALID", correlation_id=correlation_id)
    return {
        "contract_version": CONTRACT_VERSION,
        "operation": ALLOWED_OPERATION,
        "correlation_id": correlation_id,
        "status": "ACCEPTED",
        "sanitized": True,
    }


def build_prd_evidence_request(
    correlation_id: str,
    *,
    expected_host: str = "vmi3503021",
    expected_database: str = "emaus_tienda",
    expected_schema: str = "public",
) -> dict[str, object]:
    request = {
        "contract_version": CONTRACT_VERSION,
        "operation": ALLOWED_OPERATION,
        "correlation_id": correlation_id,
        "expected_host": expected_host,
        "expected_database": expected_database,
        "expected_schema": expected_schema,
    }
    validation = validate_prd_evidence_request(request)
    if validation["status"] != "ACCEPTED":
        raise ValueError(str(validation["error"]))
    return request


def _sanitize_evidence(evidence: object) -> dict[str, object] | None:
    if not isinstance(evidence, Mapping):
        return None
    identity = evidence.get("identity")
    schema = evidence.get("schema")
    history_rows = evidence.get("history_rows", [])
    if "history_rows" not in evidence:
        return None
    if not isinstance(identity, Mapping) or not isinstance(schema, Mapping):
        return None
    safe_history_rows: list[dict[str, object]] = []
    if not isinstance(history_rows, list):
        return None
    for row in history_rows:
        if not isinstance(row, Mapping) or not isinstance(row.get("version"), str):
            return None
        if not isinstance(row.get("success"), bool):
            return None
        safe_row: dict[str, object] = {
            "version": row["version"], "success": row["success"],
        }
        if "checksum" in row and row["checksum"] is not None:
            if not isinstance(row["checksum"], str):
                return None
            safe_row["checksum"] = row["checksum"]
        for field in ("filename", "path"):
            if field in row and row[field] is not None:
                if not isinstance(row[field], str):
                    return None
                safe_row[field] = row[field]
        safe_history_rows.append(safe_row)
    safe_identity = {
        key: identity[key]
        for key in ("environment", "hostname", "user", "current_database", "current_schema")
        if key in identity and isinstance(identity[key], (str, int, bool))
    }
    safe_schema = {
        key: schema[key]
        for key in ("table", "exists", "columns")
        if key in schema and isinstance(schema[key], (str, bool, list))
    }
    safe: dict[str, object] = {
        "evidence_type": evidence.get("evidence_type"),
        "provenance": evidence.get("provenance"),
        "same_operation": evidence.get("same_operation"),
        "identity": safe_identity,
        "schema": safe_schema,
        "read_only_verified": evidence.get("read_only_verified"),
        "history_rows": safe_history_rows,
        "occupied_numeric_identities": evidence.get("occupied_numeric_identities", []),
        "query_count": evidence.get("query_count", 0),
        "write_count": evidence.get("write_count", 0),
    }
    if not isinstance(safe["occupied_numeric_identities"], list):
        return None
    if not all(isinstance(value, str) for value in safe["occupied_numeric_identities"]):
        return None
    if not isinstance(safe["query_count"], int) or not isinstance(safe["write_count"], int):
        return None
    return safe


def validate_prd_evidence_response(
    response: Mapping[str, object] | None,
    request: Mapping[str, object],
) -> dict[str, object]:
    """Accept only a sanitized live response matching the request identity."""
    request_result = validate_prd_evidence_request(request)
    if request_result["status"] != "ACCEPTED":
        return _failure("REQUEST_INVALID")
    if not isinstance(response, Mapping):
        return _failure("EXECUTOR_RESPONSE_MALFORMED", correlation_id=str(request["correlation_id"]))
    correlation_id = response.get("correlation_id")
    if correlation_id != request["correlation_id"]:
        return _failure("CORRELATION_ID_MISMATCH", correlation_id=str(request["correlation_id"]))
    if response.get("contract_version") != CONTRACT_VERSION:
        return _failure("CONTRACT_VERSION_MISMATCH", correlation_id=str(correlation_id))
    if response.get("operation") != ALLOWED_OPERATION:
        return _failure("OPERATION_MISMATCH", correlation_id=str(correlation_id))
    if response.get("status") != "VERIFIED":
        return _failure("EXECUTOR_UNVERIFIED", correlation_id=str(correlation_id))
    evidence = _sanitize_evidence(response.get("evidence"))
    if evidence is None:
        return _failure("EVIDENCE_MALFORMED", correlation_id=str(correlation_id))
    if evidence.get("provenance") != LIVE_PROVENANCE:
        return _failure("EVIDENCE_PROVENANCE_UNVERIFIED", correlation_id=str(correlation_id))
    identity = evidence.get("identity", {})
    if identity.get("current_database") != request.get("expected_database"):
        return _failure("SOURCE_IDENTITY_MISMATCH", correlation_id=str(correlation_id))
    if identity.get("current_schema") != request.get("expected_schema"):
        return _failure("SOURCE_SCHEMA_MISMATCH", correlation_id=str(correlation_id))
    if identity.get("hostname") != request.get("expected_host"):
        return _failure("SOURCE_HOST_MISMATCH", correlation_id=str(correlation_id))
    if evidence.get("evidence_type") != "LIVE" or evidence.get("same_operation") is not True:
        return _failure("SAME_OPERATION_EVIDENCE_REQUIRED", correlation_id=str(correlation_id))
    if evidence.get("read_only_verified") is not True or evidence.get("write_count") != 0:
        return _failure("READ_ONLY_EVIDENCE_INVALID", correlation_id=str(correlation_id))
    return {
        "contract_version": CONTRACT_VERSION,
        "operation": ALLOWED_OPERATION,
        "correlation_id": correlation_id,
        "status": "VERIFIED",
        "evidence": evidence,
        "error": None,
        "sanitized": True,
    }


def execute_prd_evidence_request(
    request: Mapping[str, object],
    executor: Callable[[dict[str, object]], Mapping[str, object]] | None,
) -> dict[str, object]:
    """Cross the executor boundary supplied by an authorized OS process."""
    validation = validate_prd_evidence_request(request)
    correlation_id = request.get("correlation_id") if isinstance(request, Mapping) else None
    if validation["status"] != "ACCEPTED":
        return validation
    if executor is None:
        return _failure("EXECUTOR_UNAVAILABLE", correlation_id=str(correlation_id))
    try:
        response = executor(dict(request))
    except Exception:
        return _failure("EXECUTOR_FAILURE", correlation_id=str(correlation_id))
    return validate_prd_evidence_response(response, request)


def validate_runtime_config(config: Mapping[str, object] | None) -> dict[str, object]:
    """Validate trusted executor configuration without opening any path."""
    if not isinstance(config, Mapping):
        return {"status": "UNVERIFIED", "reason": "RUNTIME_CONFIG_MISSING"}
    missing = [name for name in RUNTIME_CONFIG_FIELDS if not str(config.get(name, "")).strip()]
    if missing:
        return {"status": "UNVERIFIED", "reason": "RUNTIME_CONFIG_INCOMPLETE", "missing": missing}
    for name in RUNTIME_CONFIG_FIELDS:
        value = str(config[name])
        if any(ord(char) < 32 or ord(char) == 127 for char in value):
            return {"status": "UNVERIFIED", "reason": "RUNTIME_CONFIG_CONTROL_CHARACTER"}
        if len(value) > 1024:
            return {"status": "UNVERIFIED", "reason": "RUNTIME_CONFIG_VALUE_TOO_LONG"}
    try:
        port = int(str(config["PRD_SSH_PORT"]))
    except ValueError:
        return {"status": "UNVERIFIED", "reason": "PRD_SSH_PORT_INVALID"}
    if not 1 <= port <= 65535:
        return {"status": "UNVERIFIED", "reason": "PRD_SSH_PORT_INVALID"}
    for name in ("PRD_EXPECTED_HOSTNAME", "PRD_EXPECTED_DATABASE", "PRD_EXPECTED_SCHEMA"):
        if not re.fullmatch(r"[A-Za-z0-9_.:-]+", str(config[name])):
            return {"status": "UNVERIFIED", "reason": f"{name}_INVALID"}
    for name in ("PRD_SSH_TARGET_HOST", "PRD_SSH_USER"):
        if not re.fullmatch(r"[A-Za-z0-9_.:@-]+", str(config[name])):
            return {"status": "UNVERIFIED", "reason": f"{name}_INVALID"}
    for name in ("PRD_SSH_EXECUTABLE", "PRD_SSH_KEY_PATH", "PRD_REMOTE_ENV_PATH"):
        value = str(config[name])
        if not (os.path.isabs(value) or value.startswith("/") or re.match(r"^[A-Za-z]:[\\/]", value)):
            return {"status": "UNVERIFIED", "reason": f"{name}_MUST_BE_ABSOLUTE"}
    return {"status": "READY", "sanitized": {"port": port}}


def load_runtime_config(environ: Mapping[str, str] | None = None) -> dict[str, object]:
    """Load only trusted process configuration names; never inspect key content."""
    source = environ if environ is not None else os.environ
    config = {name: source.get(name, "") for name in RUNTIME_CONFIG_FIELDS}
    result = validate_runtime_config(config)
    if result["status"] != "READY":
        return result
    return {"status": "READY", "config": config, "sanitized": result["sanitized"]}


def build_read_only_sql_plan(request: Mapping[str, object], config: Mapping[str, object]) -> dict[str, object]:
    """Build fixed SSH argv and remote script. Request cannot alter either."""
    request_result = validate_prd_evidence_request(request)
    config_result = validate_runtime_config(config)
    if request_result["status"] != "ACCEPTED" or config_result["status"] != "READY":
        return {"status": "UNVERIFIED", "reason": "TRANSPORT_PLAN_INPUT_INVALID"}
    for request_field, config_field in (
        ("expected_host", "PRD_EXPECTED_HOSTNAME"),
        ("expected_database", "PRD_EXPECTED_DATABASE"),
        ("expected_schema", "PRD_EXPECTED_SCHEMA"),
    ):
        if request[request_field] != config[config_field]:
            return {"status": "UNVERIFIED", "reason": "REQUEST_IDENTITY_CONFIG_MISMATCH"}
    def shell_quote(value: object) -> str:
        return "'" + str(value).replace("'", "'\\''") + "'"
    expected_host = shell_quote(config["PRD_EXPECTED_HOSTNAME"])
    remote_env = shell_quote(config["PRD_REMOTE_ENV_PATH"])
    remote_script = f"""set -eu
expected_hostname={expected_host}
remote_env={remote_env}
if [ \"$(hostname)\" != \"$expected_hostname\" ]; then
  printf '%s\\n' 'PRD_HOSTNAME_MISMATCH' >&2
  exit 21
fi
if [ ! -r \"$remote_env\" ]; then
  printf '%s\\n' 'PRD_RUNTIME_ENV_UNAVAILABLE' >&2
  exit 22
fi
set -a
. \"$remote_env\"
set +a
: \"${{DB_HOST:?}}\"
: \"${{DB_PORT:?}}\"
: \"${{DB_NAME:?}}\"
: \"${{DB_USER:?}}\"
: \"${{DB_PASSWORD:?}}\"
export PGPASSWORD=\"$DB_PASSWORD\"
printf '%s\\n' '{BEGIN_MARKER}'
psql -h \"$DB_HOST\" -p \"$DB_PORT\" -U \"$DB_USER\" -d \"$DB_NAME\" -X -q -A -t -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -v SHOW_CONTEXT=always <<'SQL'
{READ_ONLY_SQL}
SQL
printf '%s\\n' '{END_MARKER}'
unset PGPASSWORD
"""
    return {
        "status": "READY", "argv": [
            str(config["PRD_SSH_EXECUTABLE"]), "-p", str(config["PRD_SSH_PORT"]),
            "-i", str(config["PRD_SSH_KEY_PATH"]), "-o", "IdentitiesOnly=yes",
            "-o", "BatchMode=yes", f"{config['PRD_SSH_USER']}@{config['PRD_SSH_TARGET_HOST']}",
            "bash", "-s",
        ], "remote_script": remote_script, "sql": READ_ONLY_SQL,
        "correlation_id": request["correlation_id"],
        "expected_hostname": config["PRD_EXPECTED_HOSTNAME"],
    }


def parse_read_only_transport_output(
    stdout: bytes, request: Mapping[str, object], expected_hostname: str,
) -> dict[str, object]:
    """Parse one marked JSON evidence object and assign live provenance internally."""
    correlation_id = str(request.get("correlation_id"))
    try:
        text = stdout.decode("utf-8")
        if text.count(BEGIN_MARKER) != 1 or text.count(END_MARKER) != 1:
            return _failure("PRD_EVIDENCE_MARKERS_INVALID", correlation_id=correlation_id)
        before, payload = text.split(BEGIN_MARKER, 1)
        payload, after = payload.split(END_MARKER, 1)
        if before.strip() or after.strip() or not payload.strip():
            return _failure("PRD_EVIDENCE_PAYLOAD_INVALID", correlation_id=correlation_id)
        raw = json.loads(payload.strip())
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
        return _failure("PRD_EVIDENCE_PAYLOAD_INVALID", correlation_id=correlation_id)
    if not isinstance(raw, Mapping):
        return _failure("PRD_EVIDENCE_PAYLOAD_INVALID", correlation_id=correlation_id)
    identity = raw.get("identity")
    schema = raw.get("schema")
    if not isinstance(identity, Mapping) or not isinstance(schema, Mapping):
        return _failure("PRD_EVIDENCE_INCOMPLETE", correlation_id=correlation_id)
    if identity.get("current_database") != request["expected_database"]:
        return _failure("SOURCE_IDENTITY_MISMATCH", correlation_id=correlation_id)
    if identity.get("current_schema") != request["expected_schema"]:
        return _failure("SOURCE_SCHEMA_MISMATCH", correlation_id=correlation_id)
    if identity.get("hostname", expected_hostname) != expected_hostname:
        return _failure("SOURCE_HOST_MISMATCH", correlation_id=correlation_id)
    if schema.get("exists") is not True or not isinstance(raw.get("history_rows"), list):
        return _failure("PRD_EVIDENCE_INCOMPLETE", correlation_id=correlation_id)
    if raw.get("read_only_verified") is not True or raw.get("write_count") != 0:
        return _failure("READ_ONLY_EVIDENCE_INVALID", correlation_id=correlation_id)
    evidence = dict(raw)
    evidence["identity"] = dict(identity)
    evidence["identity"]["hostname"] = expected_hostname
    evidence["evidence_type"] = "LIVE"
    evidence["provenance"] = LIVE_PROVENANCE
    evidence["same_operation"] = True
    response = {
        "contract_version": CONTRACT_VERSION, "operation": ALLOWED_OPERATION,
        "correlation_id": correlation_id, "status": "VERIFIED",
        "evidence": evidence, "error": None, "sanitized": True,
    }
    return validate_prd_evidence_response(response, request)


def execute_read_only_transport(
    plan: Mapping[str, object], request: Mapping[str, object], *, timeout_seconds: float = 60.0,
) -> dict[str, object]:
    """Execute only the fixed plan. This function is never used by tests with network."""
    argv = plan.get("argv")
    script = plan.get("remote_script")
    if not isinstance(argv, list) or not all(isinstance(item, str) for item in argv):
        return _failure("TRANSPORT_PLAN_MALFORMED", correlation_id=str(request["correlation_id"]))
    if not isinstance(script, str):
        return _failure("TRANSPORT_PLAN_MALFORMED", correlation_id=str(request["correlation_id"]))
    try:
        completed = subprocess.run(
            argv, input=script.encode("utf-8"), stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, shell=False, timeout=timeout_seconds, check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return _failure("PRD_TRANSPORT_UNAVAILABLE", correlation_id=str(request["correlation_id"]))
    if completed.returncode != 0:
        return _failure("PRD_TRANSPORT_FAILED", correlation_id=str(request["correlation_id"]))
    if completed.stderr.strip():
        return _failure("PRD_TRANSPORT_DIAGNOSTIC", correlation_id=str(request["correlation_id"]))
    return parse_read_only_transport_output(
        completed.stdout, request, str(plan.get("expected_hostname", request["expected_host"])),
    )


def collect_prd_migration_evidence(request: Mapping[str, object]) -> dict[str, object]:
    """Run the specialized backend owned by the executor process.

    The real credential-bearing backend is deliberately not enabled by this
    contract slice. A test-only fixture can exercise process framing, but its
    provenance is never accepted as live evidence.
    """
    validation = validate_prd_evidence_request(request)
    if validation["status"] != "ACCEPTED":
        return validation
    correlation_id = str(request["correlation_id"])
    if os.environ.get("PRD_EVIDENCE_EXECUTOR_TEST_BACKEND") == "fixture":
        return {
        "contract_version": CONTRACT_VERSION,
        "operation": ALLOWED_OPERATION,
        "correlation_id": correlation_id,
        "status": "VERIFIED",
        "evidence": {
            "evidence_type": "TEST_FIXTURE",
            "provenance": "EXECUTOR_TEST_FIXTURE",
            "same_operation": True,
            "identity": {
                "environment": "prd-test-fixture",
                "hostname": request["expected_host"],
                "user": "fixture",
                "current_database": request["expected_database"],
                "current_schema": request["expected_schema"],
            },
            "schema": {"table": "public.migrations_history", "exists": True,
                       "columns": []},
            "read_only_verified": True,
            "history": {},
            "history_rows": [{"version": "V095", "checksum": "fixture", "success": True}],
            "occupied_numeric_identities": ["V095"],
            "query_count": 1,
            "write_count": 0,
        },
        "error": None,
        "sanitized": True,
        }
    if os.environ.get(LIVE_ENABLE_ENV) != "YES":
        return _failure("EXECUTOR_BACKEND_UNAVAILABLE", correlation_id=correlation_id)
    runtime = load_runtime_config()
    if runtime["status"] != "READY":
        return _failure("RUNTIME_CONFIG_UNVERIFIED", correlation_id=correlation_id)
    plan = build_read_only_sql_plan(request, runtime["config"])
    if plan["status"] != "READY":
        return _failure("TRANSPORT_PLAN_UNVERIFIED", correlation_id=correlation_id)
    plan["expected_hostname"] = runtime["config"]["PRD_EXPECTED_HOSTNAME"]
    return execute_read_only_transport(plan, request)


def _parse_process_response(stdout: bytes, request: Mapping[str, object]) -> dict[str, object]:
    """Parse exactly one UTF-8 JSON response and validate its contract."""
    try:
        text = stdout.decode("utf-8")
        decoder = json.JSONDecoder()
        start = len(text) - len(text.lstrip())
        response, end = decoder.raw_decode(text, start)
        if text[end:].strip():
            return _failure("EXECUTOR_RESPONSE_MULTIPLE_PAYLOADS",
                            correlation_id=str(request["correlation_id"]))
    except (UnicodeDecodeError, json.JSONDecodeError, TypeError):
        return _failure("EXECUTOR_RESPONSE_MALFORMED",
                        correlation_id=str(request["correlation_id"]))
    if not isinstance(response, Mapping):
        return _failure("EXECUTOR_RESPONSE_MALFORMED",
                        correlation_id=str(request["correlation_id"]))
    return validate_prd_evidence_response(response, request)


def execute_prd_evidence_process(
    request: Mapping[str, object],
    *,
    executable: str | None = None,
    timeout_seconds: float = 30.0,
    process_environment: Mapping[str, str] | None = None,
) -> dict[str, object]:
    """Launch only this specialized executor entrypoint with fixed argv."""
    validation = validate_prd_evidence_request(request)
    correlation_id = request.get("correlation_id") if isinstance(request, Mapping) else None
    if validation["status"] != "ACCEPTED":
        return validation
    command = [executable or sys.executable, str(Path(__file__).resolve()), "--process"]
    payload = json.dumps(dict(request), ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    try:
        completed = subprocess.run(
            command, input=payload, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            shell=False, timeout=timeout_seconds, check=False,
            env=dict(process_environment) if process_environment is not None else None,
        )
    except (OSError, subprocess.TimeoutExpired):
        return _failure("EXECUTOR_PROCESS_UNAVAILABLE", correlation_id=str(correlation_id))
    if completed.returncode != 0:
        return _failure("EXECUTOR_PROCESS_FAILED", correlation_id=str(correlation_id))
    if completed.stderr.strip():
        return _failure("EXECUTOR_DIAGNOSTIC_ON_STDERR", correlation_id=str(correlation_id))
    return _parse_process_response(completed.stdout, request)


def _process_main() -> int:
    """Protocol entrypoint. It never accepts commands or arbitrary SQL."""
    def write_response(response: Mapping[str, object]) -> None:
        payload = json.dumps(response, ensure_ascii=False, separators=(",", ":"))
        sys.stdout.buffer.write(payload.encode("utf-8") + b"\n")

    try:
        raw = sys.stdin.buffer.read()
        request = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError, TypeError):
        response = _failure("REQUEST_MALFORMED")
        write_response(response)
        return 2
    if not isinstance(request, Mapping):
        response = _failure("REQUEST_MUST_BE_OBJECT")
        write_response(response)
        return 2
    response = collect_prd_migration_evidence(request)
    write_response(response)
    return 0 if response.get("status") == "VERIFIED" else 3


if __name__ == "__main__":
    raise SystemExit(_process_main() if "--process" in sys.argv[1:] else 2)
