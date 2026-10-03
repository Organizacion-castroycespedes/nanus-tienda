"""Controlled orchestration boundary for a verified promotion plan.

The orchestrator is intentionally environment-agnostic.  It never invokes a
runner itself; callers inject the single-migration execution and verification
boundaries.  This keeps Phase C deterministic and keeps SQL, credentials and
transport concerns outside this module.
"""

from __future__ import annotations

import re
import hashlib
from collections.abc import Callable, Mapping, Sequence
from typing import Any

from migration_runner_policy import OFFICIAL_RUNNER

VERSION_RE = re.compile(r"^V[0-9]{3}$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
SAFE_EVIDENCE_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
FORBIDDEN_KEYS = {
    "command", "cmd", "shell", "script", "sql", "query", "dsn", "password",
    "token", "private_key", "private_key_content", "ssh_args", "argv",
}

ExecutionCallback = Callable[[Mapping[str, Any]], Mapping[str, Any]]
VerificationCallback = Callable[[Mapping[str, Any], Mapping[str, Any]], Mapping[str, Any]]
PrecheckCallback = Callable[[Mapping[str, Any]], Mapping[str, Any]]
GateCallback = Callable[[Mapping[str, Any]], Mapping[str, Any]]


def _safe_value(value: Any, *, max_length: int = 128) -> str | None:
    if not isinstance(value, str) or not value or len(value) > max_length:
        return None
    if not SAFE_EVIDENCE_ID_RE.fullmatch(value):
        return None
    return value


def _sanitize_boundary_result(value: Any, *, expected_version: str, expected_checksum: str,
                              phase: str) -> dict[str, Any] | None:
    if not isinstance(value, Mapping):
        return None
    status = str(value.get("status", "")).upper()
    allowed = {
        "PASS", "OK", "EXECUTION_PASS", "VERIFIED", "VERIFICATION_PASS",
        "FAIL", "FAILED", "EXECUTION_FAILED", "VERIFICATION_FAILED",
    }
    if status not in allowed:
        return None
    result: dict[str, Any] = {"status": status, "phase": phase}
    version = value.get("version")
    if version is not None and str(version).upper() != expected_version:
        return None
    checksum = value.get("checksum")
    if checksum is not None and str(checksum).lower() != expected_checksum:
        return None
    if version is not None:
        result["version"] = expected_version
    if checksum is not None:
        result["checksum"] = expected_checksum
    evidence_id = _safe_value(value.get("evidence_id"))
    if value.get("evidence_id") is not None and evidence_id is None:
        return None
    if evidence_id is not None:
        result["evidence_id"] = evidence_id
    return result


def _contains_forbidden_key(value: Any) -> bool:
    if isinstance(value, Mapping):
        if any(str(key).lower() in FORBIDDEN_KEYS for key in value):
            return True
        return any(_contains_forbidden_key(child) for child in value.values())
    if isinstance(value, (list, tuple)):
        return any(_contains_forbidden_key(child) for child in value)
    return False


def _execution_binding(*, version: str, filename: str, checksum: str,
                       predecessor_kind: str, predecessor_version: str,
                       predecessor_checksum: str) -> str:
    """Bind runner identity and expected state into one deterministic token."""

    # The shell runner uses the same fields and ordering with newline framing.
    shell_payload = "\n".join((
        version,
        f"scripts/database/migrations/{filename}",
        checksum,
        predecessor_kind,
        predecessor_version,
        predecessor_checksum,
        OFFICIAL_RUNNER,
    ))
    return hashlib.sha256(shell_payload.encode("utf-8")).hexdigest()


def _validate_plan(plan: Mapping[str, Any]) -> tuple[dict[str, Any] | None, list[str]]:
    if not isinstance(plan, Mapping):
        return None, ["PLAN_NOT_OBJECT"]
    if _contains_forbidden_key(plan):
        return None, ["PLAN_CONTAINS_FORBIDDEN_EXECUTION_FIELD"]
    status = str(plan.get("status", "")).upper()
    decision = str(plan.get("decision", "")).upper()
    if decision == "ALREADY_AT_TARGET" and status == "ALREADY_AT_TARGET":
        if plan.get("pending_migrations") not in ([], None):
            return None, ["ALREADY_AT_TARGET_MUST_HAVE_EMPTY_PLAN"]
        return {"kind": "ALREADY_AT_TARGET", "items": []}, []
    if status != "VERIFIED" or decision != "VERIFIED_ORDERED_PLAN":
        return None, ["VERIFIED_ORDERED_PLAN_REQUIRED"]
    raw_items = plan.get("pending_migrations")
    if not isinstance(raw_items, (list, tuple)) or not raw_items:
        return None, ["VERIFIED_ORDERED_PLAN_MUST_HAVE_STEPS"]
    items: list[dict[str, Any]] = []
    previous_number = 0
    seen: set[str] = set()
    for raw_item in raw_items:
        if not isinstance(raw_item, Mapping):
            return None, ["PLAN_ITEM_INVALID"]
        version = str(raw_item.get("version", "")).upper()
        match = VERSION_RE.fullmatch(version)
        checksum = str(raw_item.get("checksum", "")).lower()
        if not match or not SHA256_RE.fullmatch(checksum):
            return None, [f"PLAN_ITEM_IDENTITY_INVALID:{version or 'UNKNOWN'}"]
        number = int(version[1:])
        if version in seen:
            return None, [f"PLAN_DUPLICATE_VERSION:{version}"]
        if number <= previous_number:
            return None, [f"PLAN_ORDER_INVALID:{version}"]
        seen.add(version)
        previous_number = number
        item = {
            "version": version,
            "filename": str(raw_item.get("filename", "")) or None,
            "path": str(raw_item.get("path", "")) or None,
            "checksum": checksum,
            "eligible": raw_item.get("eligible") is True,
            "dependencies": [str(dep).upper() for dep in raw_item.get("dependencies", ()) or ()],
            "runner": OFFICIAL_RUNNER,
        }
        predecessor_kind = raw_item.get("expected_predecessor_kind")
        predecessor_version = str(raw_item.get("expected_predecessor_version", "")).strip()
        predecessor_checksum = str(raw_item.get("expected_predecessor_checksum", "")).lower()
        if predecessor_kind is None:
            return None, [f"PLAN_PREDECESSOR_CONTRACT_MISSING:{version}"]
        if predecessor_kind not in {"PRE_GOVERNANCE_BOUNDARY", "GOVERNED_POST_CUTOVER"}:
            return None, [f"PLAN_PREDECESSOR_KIND_INVALID:{version}"]
        if predecessor_kind == "PRE_GOVERNANCE_BOUNDARY":
            if predecessor_version.upper() != "V095" or predecessor_checksum:
                return None, [f"PLAN_BOUNDARY_CONTRACT_INVALID:{version}"]
        else:
            if not re.fullmatch(r"V[0-9]{3}__[A-Za-z0-9][A-Za-z0-9._-]*\.sql", predecessor_version):
                return None, [f"PLAN_PREDECESSOR_VERSION_INVALID:{version}"]
            if not SHA256_RE.fullmatch(predecessor_checksum):
                return None, [f"PLAN_PREDECESSOR_CHECKSUM_INVALID:{version}"]
        filename = item["filename"] or str(item["path"] or "").replace("\\", "/").rsplit("/", 1)[-1]
        if not re.fullmatch(r"V[0-9]{3}__[A-Za-z0-9][A-Za-z0-9._-]*\.sql", filename):
            return None, [f"PLAN_FILENAME_INVALID:{version}"]
        item.update(
            expected_predecessor_kind=predecessor_kind,
            expected_predecessor_version=predecessor_version,
            expected_predecessor_checksum=predecessor_checksum,
            execution_binding=_execution_binding(
                version=version,
                filename=filename,
                checksum=checksum,
                predecessor_kind=predecessor_kind,
                predecessor_version=predecessor_version,
                predecessor_checksum=predecessor_checksum,
            ),
        )
        if item["eligible"] is not True:
            return None, [f"PLAN_ITEM_INELIGIBLE:{version}"]
        items.append(item)
    return {"kind": "VERIFIED_ORDERED_PLAN", "items": items}, []


def _not_attempted(items: Sequence[Mapping[str, Any]], start: int) -> list[dict[str, Any]]:
    return [
        {
            "version": str(item["version"]),
            "checksum": str(item["checksum"]),
            "status": "NOT_ATTEMPTED_AFTER_FAILURE",
        }
        for item in items[start:]
    ]


def orchestrate_promotion_plan(
    plan: Mapping[str, Any],
    *,
    execute_migration: ExecutionCallback,
    verify_migration: VerificationCallback,
    precheck_migration: PrecheckCallback | None = None,
    preflight_gate: GateCallback | None = None,
) -> dict[str, Any]:
    """Execute one injected migration boundary at a time, then verify it."""

    normalized, reasons = _validate_plan(plan)
    base = {
        "execution_boundary": OFFICIAL_RUNNER,
        "execution_attempts": 0,
        "verification_attempts": 0,
        "steps": [],
        "migration_execution_authorized": False,
        "automatic_retry": False,
        "automatic_rollback": False,
    }
    if normalized is None:
        base.update(status="BLOCKED", decision="PROMOTION_ORCHESTRATION_BLOCKED", reasons=reasons)
        return base
    if normalized["kind"] == "ALREADY_AT_TARGET":
        base.update(status="ALREADY_AT_TARGET", decision="NO_OP_ALREADY_SATISFIED", reasons=["NO_MIGRATION_EXECUTION"])
        return base

    if preflight_gate is not None:
        try:
            gate = preflight_gate(plan)
            if not isinstance(gate, Mapping) or gate.get("execution_allowed") is not True:
                reasons = ["PRE_EXECUTION_GATE_BLOCKED"]
                if isinstance(gate, Mapping):
                    reasons.extend(str(reason) for reason in gate.get("reasons", []) or [])
                base.update(status="BLOCKED", decision="PRE_EXECUTION_GATE_BLOCKED",
                            reasons=list(dict.fromkeys(reasons)))
                return base
        except Exception:
            base.update(status="BLOCKED", decision="PRE_EXECUTION_GATE_EXCEPTION",
                        reasons=["PRE_EXECUTION_GATE_EXCEPTION"])
            return base

    items = normalized["items"]
    for index, item in enumerate(items):
        step: dict[str, Any] = {
            "version": item["version"],
            "checksum": item["checksum"],
            "status": "PENDING",
        }
        try:
            preflight = precheck_migration(item) if precheck_migration else {"status": "PASS"}
            safe_preflight = _sanitize_boundary_result(
                preflight, expected_version=item["version"], expected_checksum=item["checksum"], phase="PRECHECK"
            )
            if safe_preflight is None or safe_preflight["status"] not in {"PASS", "OK", "EXECUTION_PASS"}:
                step.update(status="EXECUTION_FAILED", reason="PRECHECK_FAILED")
                base["steps"].append(step)
                base["steps"].extend(_not_attempted(items, index + 1))
                base.update(status="FAILED", decision="PRECHECK_FAILED", reasons=[f"PRECHECK_FAILED:{item['version']}"])
                return base
            step["precheck"] = {"status": "PASS", "phase": "PRECHECK"}
        except Exception:
            step.update(status="EXECUTION_FAILED", reason="PRECHECK_EXCEPTION")
            base["steps"].append(step)
            base["steps"].extend(_not_attempted(items, index + 1))
            base.update(status="FAILED", decision="PRECHECK_EXCEPTION", reasons=[f"PRECHECK_EXCEPTION:{item['version']}"])
            return base

        try:
            base["execution_attempts"] += 1
            execution = execute_migration(dict(item))
            safe_execution = _sanitize_boundary_result(
                execution, expected_version=item["version"], expected_checksum=item["checksum"], phase="EXECUTION"
            )
            if safe_execution is None or safe_execution["status"] not in {"PASS", "OK", "EXECUTION_PASS"}:
                step.update(status="EXECUTION_FAILED", reason="EXECUTION_FAILED")
                base["steps"].append(step)
                base["steps"].extend(_not_attempted(items, index + 1))
                base.update(status="FAILED", decision="EXECUTION_FAILED", reasons=[f"EXECUTION_FAILED:{item['version']}"])
                return base
            step["execution"] = safe_execution
            step["execution_status"] = "EXECUTION_PASS"
        except Exception:
            step.update(status="EXECUTION_FAILED", reason="EXECUTOR_EXCEPTION")
            base["steps"].append(step)
            base["steps"].extend(_not_attempted(items, index + 1))
            base.update(status="FAILED", decision="EXECUTOR_EXCEPTION", reasons=[f"EXECUTOR_EXCEPTION:{item['version']}"])
            return base

        try:
            base["verification_attempts"] += 1
            verification = verify_migration(dict(item), dict(step["execution"]))
            safe_verification = _sanitize_boundary_result(
                verification, expected_version=item["version"], expected_checksum=item["checksum"], phase="VERIFICATION"
            )
            if safe_verification is None or safe_verification["status"] not in {"PASS", "OK", "VERIFIED", "VERIFICATION_PASS"}:
                step.update(status="VERIFICATION_FAILED", reason="VERIFICATION_FAILED")
                base["steps"].append(step)
                base["steps"].extend(_not_attempted(items, index + 1))
                base.update(status="FAILED", decision="VERIFICATION_FAILED", reasons=[f"VERIFICATION_FAILED:{item['version']}"])
                return base
            step["verification"] = safe_verification
            step["verification_status"] = "VERIFICATION_PASS"
            step["status"] = "VERIFIED"
            base["steps"].append(step)
        except Exception:
            step.update(status="VERIFICATION_FAILED", reason="VERIFIER_EXCEPTION")
            base["steps"].append(step)
            base["steps"].extend(_not_attempted(items, index + 1))
            base.update(status="FAILED", decision="VERIFIER_EXCEPTION", reasons=[f"VERIFIER_EXCEPTION:{item['version']}"])
            return base

    base.update(status="COMPLETE", decision="PROMOTION_PLAN_VERIFIED", reasons=["ALL_STEPS_EXECUTION_AND_VERIFICATION_PASS"])
    return base
