"""Fail-closed QA write-path certification.

This module is not a migration runner.  It has one fixed, allowlisted
certification operation.  The operation proves the governed PostgreSQL
boundary with synthetic DDL/DML, then always rolls the transaction back.
It never allocates a V### version and never writes migrations_history.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Mapping


CERTIFICATION_OPERATION = "QA_WRITE_PATH_CERTIFICATION"
CERTIFICATION_FIXTURE_ID = "manus-governance-certification-fixture-v1"
CERTIFICATION_EXECUTOR_ID = "scripts/governance/qa_certification.py"
CERTIFICATION_SCHEMA = "public"
CERTIFICATION_OBJECT = "governance_certification_probe_v1"
LOCK_NAMESPACE = "manus-governed-migration-v1:"
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
FINGERPRINT_RE = re.compile(r"^[0-9a-f]{32}$")
IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
CORRELATION_RE = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


class CertificationError(ValueError):
    """Sanitized, deterministic certification rejection."""


def _sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _identifier(value: Any, *, field: str) -> str:
    if not isinstance(value, str) or not IDENTIFIER_RE.fullmatch(value):
        raise CertificationError(f"INVALID_{field.upper()}")
    return value


def _correlation(value: Any) -> str:
    if not isinstance(value, str) or not CORRELATION_RE.fullmatch(value):
        raise CertificationError("INVALID_CORRELATION_ID")
    return value


def _digest(value: Any, *, field: str) -> str:
    if not isinstance(value, str) or not SHA256_RE.fullmatch(value.lower()):
        raise CertificationError(f"INVALID_{field.upper()}")
    return value.lower()


def _fingerprint(value: Any) -> str:
    if not isinstance(value, str) or not FINGERPRINT_RE.fullmatch(value.lower()):
        raise CertificationError("INVALID_HISTORY_FINGERPRINT")
    return value.lower()


def certification_sql(*, database: str, schema: str, history_fingerprint: str) -> bytes:
    """Return the only SQL this operation can execute.

    All dynamic values are validated identifiers or SHA-256 values.  The SQL
    contains no caller-supplied statement and no canonical history mutation.
    The explicit ROLLBACK is unconditional on the successful path.
    """
    database = _identifier(database, field="database")
    schema = _identifier(schema, field="schema")
    history_fingerprint = _fingerprint(history_fingerprint)
    if schema != CERTIFICATION_SCHEMA:
        raise CertificationError("CERTIFICATION_SCHEMA_MUST_BE_PUBLIC")
    return f"""\\set ON_ERROR_STOP on
BEGIN;
DO $certification$
DECLARE
  lock_acquired boolean;
  current_fingerprint text;
  object_exists boolean;
BEGIN
  IF current_database() <> '{database}' OR current_schema() <> '{schema}' THEN
    RAISE EXCEPTION USING MESSAGE = 'CERTIFICATION_DATABASE_SCHEMA_MISMATCH';
  END IF;
  SELECT pg_try_advisory_xact_lock(
    hashtextextended('{LOCK_NAMESPACE}' || current_database() || ':' || current_schema(), 0)
  ) INTO lock_acquired;
  IF NOT lock_acquired THEN
    RAISE EXCEPTION USING ERRCODE = '55P03', MESSAGE = 'PROMOTION_LOCK_UNAVAILABLE';
  END IF;
  SELECT md5(COALESCE(json_agg(row_data ORDER BY version, checksum, success)::text, '[]'))
    INTO current_fingerprint
    FROM (
      SELECT version, checksum, success
      FROM {schema}.migrations_history
    ) AS row_data;
  IF current_fingerprint <> '{history_fingerprint}' THEN
    RAISE EXCEPTION USING MESSAGE = 'CERTIFICATION_HISTORY_FINGERPRINT_CHANGED';
  END IF;
  SELECT to_regclass('{schema}.{CERTIFICATION_OBJECT}') IS NOT NULL INTO object_exists;
  IF object_exists THEN
    RAISE EXCEPTION USING MESSAGE = 'CERTIFICATION_OBJECT_ALREADY_EXISTS';
  END IF;
END
$certification$;
CREATE TABLE {schema}.{CERTIFICATION_OBJECT} (
  marker text PRIMARY KEY,
  created_by text NOT NULL
);
INSERT INTO {schema}.{CERTIFICATION_OBJECT} (marker, created_by)
VALUES ('CERTIFICATION_ONLY', '{CERTIFICATION_EXECUTOR_ID}');
SELECT json_build_object(
  'backend_pid', pg_backend_pid(),
  'transaction_id', txid_current(),
  'synthetic_write_visible', EXISTS(
    SELECT 1 FROM {schema}.{CERTIFICATION_OBJECT}
    WHERE marker = 'CERTIFICATION_ONLY'
  )
);
DO $certification_verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM {schema}.{CERTIFICATION_OBJECT}
    WHERE marker = 'CERTIFICATION_ONLY'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'CERTIFICATION_SYNTHETIC_WRITE_NOT_VISIBLE';
  END IF;
END
$certification_verify$;
ROLLBACK;
""".encode("utf-8")


def fixture_checksum(*, database: str, schema: str, history_fingerprint: str) -> str:
    return _sha256(certification_sql(
        database=database, schema=schema, history_fingerprint=history_fingerprint,
    ))


def build_certification_descriptor(
    *, database: str, schema: str, correlation_id: str, history_fingerprint: str,
) -> dict[str, str]:
    database = _identifier(database, field="database")
    schema = _identifier(schema, field="schema")
    if schema != CERTIFICATION_SCHEMA:
        raise CertificationError("CERTIFICATION_SCHEMA_MUST_BE_PUBLIC")
    correlation_id = _correlation(correlation_id)
    history_fingerprint = _fingerprint(history_fingerprint)
    checksum = fixture_checksum(
        database=database, schema=schema, history_fingerprint=history_fingerprint,
    )
    binding_payload = "\n".join((
        CERTIFICATION_OPERATION,
        CERTIFICATION_FIXTURE_ID,
        database,
        schema,
        history_fingerprint,
        checksum,
        CERTIFICATION_EXECUTOR_ID,
        correlation_id,
    ))
    return {
        "operation": CERTIFICATION_OPERATION,
        "fixture_id": CERTIFICATION_FIXTURE_ID,
        "database": database,
        "schema": schema,
        "history_fingerprint": history_fingerprint,
        "fixture_checksum": checksum,
        "executor": CERTIFICATION_EXECUTOR_ID,
        "correlation_id": correlation_id,
        "binding": _sha256(binding_payload.encode("utf-8")),
    }


def validate_certification_descriptor(
    descriptor: Mapping[str, Any], *, expected_environment: str = "QA",
    local_disposable: bool = False,
) -> dict[str, str]:
    if not isinstance(descriptor, Mapping):
        raise CertificationError("CERTIFICATION_DESCRIPTOR_INVALID")
    if str(descriptor.get("operation", "")) != CERTIFICATION_OPERATION:
        raise CertificationError("CERTIFICATION_OPERATION_REQUIRED")
    if str(expected_environment).upper() != "QA":
        raise CertificationError("CERTIFICATION_QA_ONLY")
    database = _identifier(descriptor.get("database"), field="database")
    if not (database == "manus_tienda_qa" or (local_disposable and database.startswith("manus_governance_qa_"))):
        raise CertificationError("CERTIFICATION_DATABASE_NOT_QA")
    expected = build_certification_descriptor(
        database=database,
        schema=descriptor.get("schema"),
        correlation_id=descriptor.get("correlation_id"),
        history_fingerprint=descriptor.get("history_fingerprint"),
    )
    for key, value in expected.items():
        if descriptor.get(key) != value:
            raise CertificationError(f"CERTIFICATION_DESCRIPTOR_{key.upper()}_MISMATCH")
    return expected


def validate_qa_execution_request(
    config: Mapping[str, Any], *, operator_authorized: bool,
) -> dict[str, str]:
    """Validate the future real-QA interface without opening a connection."""
    if operator_authorized is not True:
        raise CertificationError("QA_CERTIFICATION_AUTHORIZATION_REQUIRED")
    if str(config.get("environment", "")).upper() != "QA":
        raise CertificationError("CERTIFICATION_QA_ONLY")
    if config.get("database") != "manus_tienda_qa":
        raise CertificationError("CERTIFICATION_DATABASE_NOT_QA")
    if config.get("schema", CERTIFICATION_SCHEMA) != CERTIFICATION_SCHEMA:
        raise CertificationError("CERTIFICATION_SCHEMA_MUST_BE_PUBLIC")
    for key in ("host", "port", "user", "password", "database"):
        if not isinstance(config.get(key), str) or not config[key]:
            raise CertificationError("QA_CERTIFICATION_CONFIG_INVALID")
    return {
        "environment": "QA",
        "database": "manus_tienda_qa",
        "schema": CERTIFICATION_SCHEMA,
        "authorization": "EXPLICIT_OPERATOR_AUTHORIZATION",
    }


def _psql_command(config: Mapping[str, str], *, psql: str) -> list[str]:
    return [
        psql, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-h", config["host"],
        "-p", config["port"], "-U", config["user"], "-d", config["database"], "-At",
    ]


def history_fingerprint(config: Mapping[str, str], *, psql: str = "psql") -> str:
    command = _psql_command(config, psql=psql)
    result = subprocess.run(
        command + ["-c", "SELECT md5(COALESCE(json_agg(row_data ORDER BY row_data.version, row_data.checksum, row_data.success)::text, '[]')) FROM (SELECT version, checksum, success FROM public.migrations_history) AS row_data;"],
        env={**os.environ, "PGPASSWORD": config["password"]},
        capture_output=True, text=True, check=False, timeout=15,
    )
    # The database fingerprint is MD5 by design for a compact equality
    # witness. It is not used as a security checksum.
    value = result.stdout.strip().lower()
    if result.returncode != 0 or not FINGERPRINT_RE.fullmatch(value):
        raise CertificationError("CERTIFICATION_HISTORY_FINGERPRINT_UNAVAILABLE")
    return value


def _run_certification(
    *, config: Mapping[str, str], correlation_id: str, psql: str,
    local_disposable: bool,
) -> dict[str, Any]:
    required = ("host", "port", "user", "password", "database")
    if any(not isinstance(config.get(key), str) or not config[key] for key in required):
        raise CertificationError("CERTIFICATION_DATABASE_CONFIG_INVALID")
    if local_disposable:
        if config["host"] not in {"127.0.0.1", "localhost"}:
            raise CertificationError("LOCAL_CERTIFICATION_REQUIRES_LOOPBACK")
        if not config["database"].startswith("manus_governance_qa_"):
            raise CertificationError("LOCAL_CERTIFICATION_DATABASE_NOT_DISPOSABLE")
    before = history_fingerprint(config, psql=psql)
    descriptor = build_certification_descriptor(
        database=config["database"], schema=CERTIFICATION_SCHEMA,
        correlation_id=correlation_id, history_fingerprint=before,
    )
    validate_certification_descriptor(descriptor, local_disposable=local_disposable)
    snapshot: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            prefix="manus-certification-snapshot-", suffix=".sql", delete=False,
        ) as handle:
            snapshot = Path(handle.name)
            handle.write(certification_sql(
                database=config["database"], schema=CERTIFICATION_SCHEMA,
                history_fingerprint=before,
            ))
        actual = _sha256(snapshot.read_bytes())
        if actual != descriptor["fixture_checksum"]:
            raise CertificationError("CERTIFICATION_SNAPSHOT_CHECKSUM_MISMATCH")
        result = subprocess.run(
            _psql_command(config, psql=psql) + ["-f", str(snapshot)],
            env={**os.environ, "PGPASSWORD": config["password"]},
            capture_output=True, text=True, check=False, timeout=20,
        )
        if result.returncode != 0:
            raise CertificationError("CERTIFICATION_TRANSACTION_FAILED")
        observation: dict[str, Any] = {}
        for line in result.stdout.splitlines():
            try:
                candidate = json.loads(line.strip())
            except json.JSONDecodeError:
                continue
            if isinstance(candidate, dict) and "synthetic_write_visible" in candidate:
                observation = {
                    "backend_pid": candidate.get("backend_pid"),
                    "transaction_id": candidate.get("transaction_id"),
                    "synthetic_write_visible": candidate.get("synthetic_write_visible") is True,
                }
                break
        if observation.get("synthetic_write_visible") is not True:
            raise CertificationError("CERTIFICATION_TRANSACTION_OBSERVATION_MISSING")
        after = history_fingerprint(config, psql=psql)
        verify = subprocess.run(
            _psql_command(config, psql=psql) + [
                "-c", "SELECT to_regclass('public.governance_certification_probe_v1') IS NULL;"
            ],
            env={**os.environ, "PGPASSWORD": config["password"]},
            capture_output=True, text=True, check=False, timeout=15,
        )
        absent = verify.returncode == 0 and verify.stdout.strip() == "t"
        lock = subprocess.run(
            _psql_command(config, psql=psql) + [
                "-c", "BEGIN; SELECT pg_try_advisory_xact_lock(hashtextextended('manus-governed-migration-v1:' || current_database() || ':' || current_schema(), 0)); ROLLBACK;"
            ],
            env={**os.environ, "PGPASSWORD": config["password"]},
            capture_output=True, text=True, check=False, timeout=15,
        )
        lock_released = lock.returncode == 0 and "t" in lock.stdout.split()
        return {
            "status": "PASS" if after == before and absent and lock_released else "FAIL",
            "operation": CERTIFICATION_OPERATION,
            "descriptor": {key: value for key, value in descriptor.items() if key != "binding"},
            "binding": descriptor["binding"],
            "fixture_checksum": actual,
            "transaction_observation": observation,
            "synthetic_write_visible_inside_transaction": observation["synthetic_write_visible"],
            "intentional_rollback": True,
            "post_rollback_object_absent": absent,
            "history_fingerprint_unchanged": after == before,
            "lock_released": lock_released,
        }
    finally:
        if snapshot is not None:
            snapshot.unlink(missing_ok=True)


def run_local_certification(
    *, config: Mapping[str, str], correlation_id: str, psql: str = "psql",
) -> dict[str, Any]:
    """Run only against a named disposable local QA-like database."""
    return _run_certification(
        config=config, correlation_id=correlation_id, psql=psql,
        local_disposable=True,
    )


def run_qa_certification(
    *, config: Mapping[str, str], correlation_id: str,
    operator_authorized: bool, psql: str = "psql",
) -> dict[str, Any]:
    """Future explicit QA interface; never accepts a PRD identity."""
    validate_qa_execution_request(config, operator_authorized=operator_authorized)
    return _run_certification(
        config=config, correlation_id=correlation_id, psql=psql,
        local_disposable=False,
    )


def descriptor_json(descriptor: Mapping[str, Any]) -> str:
    """Return sanitized deterministic evidence for callers."""
    return json.dumps(dict(descriptor), sort_keys=True, separators=(",", ":"))
