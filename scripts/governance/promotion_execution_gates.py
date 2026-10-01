"""Pure pre-execution gates for the governed promotion path.

No gate in this module fetches evidence or invokes a runner.  Callers supply
the current sanitized target/environment evidence and the explicit policy
inputs.  The result is suitable for the Phase C orchestration boundary.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from migration_runner_policy import OFFICIAL_RUNNER, classify_runner, validate_versioned_request


def _identity(evidence: Mapping[str, Any]) -> str | None:
    for key in ("target_sha", "identity", "fingerprint"):
        value = evidence.get(key)
        if value:
            return str(value)
    return None


def _evidence_issues(evidence: Mapping[str, Any], label: str) -> list[str]:
    issues: list[str] = []
    if str(evidence.get("status", "UNVERIFIED")).upper() != "VERIFIED":
        issues.append(f"{label}_EVIDENCE_UNVERIFIED")
    freshness = str(evidence.get("freshness_status", "UNVERIFIED")).upper()
    if freshness in {"STALE", "EXPIRED"}:
        issues.append(f"{label}_EVIDENCE_STALE")
    elif freshness not in {"VERIFIED", "FRESH"}:
        issues.append(f"{label}_EVIDENCE_UNVERIFIED")
    if evidence.get("identity_verified") is False:
        issues.append(f"{label}_IDENTITY_MISMATCH")
    if _identity(evidence) is None:
        issues.append(f"{label}_IDENTITY_MISSING")
    return issues


def _target_issues(plan: Mapping[str, Any], current_target: Mapping[str, Any]) -> list[str]:
    issues = _evidence_issues(current_target, "TARGET")
    captured = plan.get("target_identity")
    if not isinstance(captured, Mapping):
        return issues + ["PLAN_TARGET_IDENTITY_MISSING"]
    captured_identity = _identity(captured)
    current_identity = _identity(current_target)
    if captured_identity is None:
        issues.append("PLAN_TARGET_IDENTITY_MISSING")
    elif current_identity is not None and captured_identity != current_identity:
        issues.extend(["PLAN_STALE", "TARGET_CHANGED"])
    return issues


def _environment_issues(plan: Mapping[str, Any], current_environment: Mapping[str, Any],
                        *, same_operation_required: bool) -> list[str]:
    issues = _evidence_issues(current_environment, "ENVIRONMENT")
    if same_operation_required and current_environment.get("same_operation") is not True:
        issues.append("ENVIRONMENT_SAME_OPERATION_REQUIRED")
    captured = plan.get("destination_identity")
    if not isinstance(captured, Mapping):
        return issues + ["PLAN_ENVIRONMENT_IDENTITY_MISSING"]
    captured_identity = _identity(captured)
    current_identity = _identity(current_environment)
    if captured_identity is None:
        issues.append("PLAN_ENVIRONMENT_IDENTITY_MISSING")
    elif current_identity is not None and captured_identity != current_identity:
        issues.extend(["PLAN_STALE", "ENVIRONMENT_STATE_CHANGED"])
    captured_correlation = captured.get("correlation_id")
    current_correlation = current_environment.get("correlation_id")
    if captured_correlation and current_correlation and captured_correlation != current_correlation:
        issues.append("EVIDENCE_CORRELATION_MISMATCH")
    return issues


def _runner_issues(plan: Mapping[str, Any], runner_path: str) -> list[str]:
    normalized_runner = str(runner_path).replace("\\", "/").lstrip("./")
    if normalized_runner != OFFICIAL_RUNNER:
        return ["UNSAFE_RUNNER", f"RUNNER_CLASS:{classify_runner(normalized_runner)}"]
    issues: list[str] = []
    items = plan.get("pending_migrations", ())
    if not isinstance(items, (list, tuple)) or not items:
        return ["PROMOTION_PLAN_ITEMS_MISSING"]
    for item in items:
        if not isinstance(item, Mapping):
            issues.append("PROMOTION_PLAN_ITEM_INVALID")
            continue
        path = item.get("path") or item.get("filename")
        if not isinstance(path, str):
            issues.append("UNSAFE_MIGRATION_PATH")
            continue
        request = validate_versioned_request(path, normalized_runner)
        if request.get("accepted") is not True:
            issues.extend(str(reason) for reason in request.get("reasons", []) or [])
            issues.append("UNSAFE_MIGRATION_PATH")
    return issues


def promotion_execution_gate(
    plan: Mapping[str, Any],
    *,
    current_target_evidence: Mapping[str, Any],
    current_environment_evidence: Mapping[str, Any],
    destination_stage: str,
    authorization: Mapping[str, Any] | None = None,
    runner_path: str = OFFICIAL_RUNNER,
    same_operation_required: bool = False,
    strict_active: bool = False,
) -> dict[str, Any]:
    """Evaluate all pre-execution policy gates without performing I/O."""

    authorization = authorization or {}
    stage = str(destination_stage).upper()
    issues: list[str] = []
    if str(plan.get("status", "")).upper() != "VERIFIED" or str(plan.get("decision", "")).upper() != "VERIFIED_ORDERED_PLAN":
        issues.append("VERIFIED_ORDERED_PLAN_REQUIRED")
    issues.extend(_target_issues(plan, current_target_evidence))
    issues.extend(_environment_issues(plan, current_environment_evidence, same_operation_required=same_operation_required))
    issues.extend(_runner_issues(plan, runner_path))
    if stage not in {"LOCAL", "QA", "PRD"}:
        issues.append("UNKNOWN_PROMOTION_STAGE")
    if stage == "PRD":
        if authorization.get("qa_verified") is not True or authorization.get("qa_approved") is not True:
            issues.append("QA_VERIFICATION_AND_APPROVAL_REQUIRED_BEFORE_PRD")
        if authorization.get("explicit_prd_authorization") is not True:
            issues.append("PRD_EXPLICIT_AUTHORIZATION_REQUIRED")
    elif stage == "QA" and authorization.get("explicit_prd_authorization") is True:
        issues.append("PRD_AUTHORIZATION_NOT_USED_FOR_QA")

    unique_issues = list(dict.fromkeys(issues))
    if unique_issues:
        if strict_active:
            status, decision, blocking = "BLOCKED", "STRICT_PROMOTION_REJECTED", True
        else:
            status, decision, blocking = "DIAGNOSTIC", "PROMOTION_WARNING", False
        return {
            "status": status,
            "decision": decision,
            "blocking": blocking,
            "execution_allowed": False,
            "strict_active": bool(strict_active),
            "destination_stage": stage,
            "runner_path": OFFICIAL_RUNNER if str(runner_path).replace("\\", "/").lstrip("./") == OFFICIAL_RUNNER else str(runner_path),
            "reasons": unique_issues,
        }
    return {
        "status": "PASS",
        "decision": "PROMOTION_PRE_EXECUTION_GATE_PASS",
        "blocking": False,
        "execution_allowed": True,
        "strict_active": bool(strict_active),
        "destination_stage": stage,
        "runner_path": OFFICIAL_RUNNER,
        "reasons": ["ALL_PRE_EXECUTION_GATES_PASS"],
    }


def governance_mode_evaluation(mode: str | None) -> dict[str, Any]:
    """Return default-off enforcement state and configuration-only rollback."""

    normalized = str(mode or "WARNING").upper()
    if normalized not in {"WARNING", "DIAGNOSTIC_ONLY", "STRICT"}:
        return {"status": "BLOCKED", "mode": normalized, "strict_active": False, "reasons": ["UNKNOWN_GOVERNANCE_MODE"]}
    active = normalized == "STRICT"
    return {
        "status": "STRICT_ACTIVE" if active else "DIAGNOSTIC",
        "mode": normalized,
        "strict_active": active,
        "rollback_mode": "WARNING",
        "rollback_mutates_database": False,
        "rollback_mutates_history": False,
        "reasons": ["CONFIGURATION_ONLY_ENFORCEMENT_STATE"],
    }
