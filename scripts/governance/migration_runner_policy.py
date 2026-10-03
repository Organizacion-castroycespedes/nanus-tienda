"""Repository-only policy for Manus migration execution paths.

This module does not connect to PostgreSQL. It describes which existing
scripts may handle a VERSIONED_MIGRATION and exposes the failure contract used
by the official runner tests.
"""

from __future__ import annotations

import argparse
import re
import hashlib
import json
import sys
from pathlib import Path
from pathlib import PurePosixPath
from typing import Mapping

MIGRATION_ROOT = "scripts/database/migrations/"
OFFICIAL_RUNNER = "scripts/database/apply_single_migration.sh"
BASELINE_MANIFEST = "scripts/governance/migration-baseline.json"
VERSIONED_RE = re.compile(r"^V[0-9]{3}__[A-Za-z0-9][A-Za-z0-9._-]*\.sql$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
CUTOVER_BOUNDARY_VERSION_RE = re.compile(r"^V[0-9]{3}$")
NUMERIC_VERSION_RE = re.compile(r"^V([0-9]{3})$", re.IGNORECASE)
NEXT_VERSION_ALGORITHM = "FIRST_FREE_VERSION_ABOVE_CUTOVER_FROM_AUTHORITATIVE_UNION"
CUTOVER_STATES = ("NOT_APPROVED", "APPROVED_NOT_ACTIVE", "ACTIVE")
ENFORCEMENT_MODES = ("WARNING", "STRICT")
ENFORCEMENT_STATE_STATUSES = ("DEFAULT_ACTIVE", "ACTIVE", "ROLLED_BACK")

RUNNER_CLASSES = {
    OFFICIAL_RUNNER: "OFFICIAL_VERSIONED_ATOMIC",
    "scripts/database/migrate.sh": "LEGACY_BOOTSTRAP",
    "scripts/database/run_migrations.sh": "LEGACY_COMPATIBILITY",
    "scripts/database/migrate_prd.sh": "LEGACY_BOOTSTRAP",
    "scripts/database/finance/run_finance_migrations.sh": "FINANCE_LEGACY_NON_VERSIONED",
    "scripts/database/products/run_all.sh": "PRODUCTS_LEGACY_NON_VERSIONED",
    "scripts/database/sale/run_sales_migrations.sh": "SALE_LEGACY_NON_VERSIONED",
    "scripts/database/seed.sh": "SEED",
    "scripts/database/fiscal_data_backfill.sh": "BACKFILL",
}


def normalize_path(path: str) -> str:
    return path.replace("\\", "/").strip().lstrip("./")


def classify_runner(path: str) -> str:
    normalized = normalize_path(path)
    return RUNNER_CLASSES.get(normalized, "UNCLASSIFIED")


def validate_versioned_request(migration_path: str, runner_path: str = OFFICIAL_RUNNER) -> dict[str, object]:
    """Validate a request without touching the filesystem or a database."""

    migration = normalize_path(migration_path)
    runner = normalize_path(runner_path)
    reasons: list[str] = []
    if runner != OFFICIAL_RUNNER:
        reasons.append("NON_OFFICIAL_RUNNER")
    if ".." in PurePosixPath(migration).parts:
        reasons.append("PATH_TRAVERSAL")
    if not migration.startswith(MIGRATION_ROOT):
        reasons.append("NON_AUTHORITATIVE_LOCATION")
    filename = migration.rsplit("/", 1)[-1]
    if not VERSIONED_RE.fullmatch(filename):
        reasons.append("INVALID_VERSIONED_FILENAME")
    return {
        "accepted": not reasons,
        "runner_class": classify_runner(runner),
        "migration_class": "VERSIONED_MIGRATION",
        "migration_path": migration,
        "reasons": reasons,
    }


def sha256_bytes(content: bytes) -> str:
    """Return lowercase SHA-256 over the exact supplied bytes."""

    return hashlib.sha256(content).hexdigest()


def sha256_file(path: Path) -> str:
    """Hash exact file bytes. No newline, encoding or whitespace normalization."""

    return sha256_bytes(path.read_bytes())


def validate_checksum_value(value: str) -> bool:
    return bool(SHA256_RE.fullmatch(value.strip().lower()))


def classify_history_checksum(
    repository_checksum: str,
    history_checksum: str | None,
    *,
    history_success: bool | None = True,
) -> dict[str, object]:
    """Classify supplied history evidence without certifying any database."""

    current = repository_checksum.strip().lower()
    stored = (history_checksum or "").strip().lower()
    if not validate_checksum_value(current):
        return {"status": "CURRENT_CHECKSUM_INVALID", "certified": False}
    if history_success is not True or not stored:
        return {"status": "HISTORICAL_UNVERIFIED", "certified": False}
    if not validate_checksum_value(stored):
        return {"status": "HISTORICAL_UNVERIFIED", "certified": False}
    if current != stored:
        return {
            "status": "CHECKSUM_MISMATCH",
            "certified": False,
            "immutability_violation": True,
        }
    return {"status": "VERIFIED_MATCH", "certified": True}


def failure_contract() -> dict[str, str]:
    return {
        "validation_failure": "NO_EXECUTOR_CALL_NO_HISTORY",
        "sql_failure": "ROLLBACK_NO_SUCCESS_HISTORY",
        "history_failure": "ROLLBACK_NO_APPLIED_SQL",
        "success": "SQL_AND_SUCCESS_HISTORY_COMMIT_TOGETHER",
        "already_applied": "REFUSE_WITHOUT_EXECUTION",
        "success_false": "REFUSE_AND_REQUIRE_RECONCILIATION",
        "checksum_mismatch": "REFUSE_WITHOUT_EXECUTION",
        "unavailable_tooling": "EXPLICIT_FAILURE_NO_EXECUTION",
        "non_versioned": "CONTROLLED_NON_VERSIONED_PATH",
    }


def simulated_execution(
    validation_ok: bool,
    *,
    dry_run: bool = False,
    already_applied: bool = False,
    sql_ok: bool = True,
    history_ok: bool = True,
) -> dict[str, object]:
    """Model runner outcomes for tests; never invokes a database executor."""

    if not validation_ok:
        return {"status": "REJECTED", "executor_calls": 0, "history_success": False}
    if dry_run:
        return {"status": "DRY_RUN", "executor_calls": 0, "history_success": False}
    if already_applied:
        return {"status": "ALREADY_APPLIED", "executor_calls": 0, "history_success": True}
    if not sql_ok or not history_ok:
        return {"status": "ROLLED_BACK", "executor_calls": 1, "history_success": False}
    return {"status": "COMMITTED", "executor_calls": 1, "history_success": True}


def runner_inventory() -> list[dict[str, str]]:
    return [
        {"path": path, "class": runner_class}
        for path, runner_class in sorted(RUNNER_CLASSES.items())
    ]


def evaluate_cutover_state(boundary: object) -> tuple[dict[str, object] | None, list[str]]:
    """Evaluate the repository-owned V095 approval/activation state."""

    errors: list[str] = []
    if not isinstance(boundary, dict):
        return None, ["CUTOVER_BOUNDARY_MUST_BE_OBJECT"]

    if boundary.get("version") != "V095":
        errors.append("CUTOVER_BOUNDARY_VERSION_UNEXPECTED")
    if boundary.get("semantics") != "NUMERIC_HISTORICAL_BOUNDARY_NOT_CANONICAL_FILE":
        errors.append("CUTOVER_BOUNDARY_SEMANTICS_INVALID")

    approved = boundary.get("approved")
    activated = boundary.get("activated")
    if type(approved) is not bool:
        errors.append("CUTOVER_APPROVED_MUST_BE_BOOLEAN")
    if type(activated) is not bool:
        errors.append("CUTOVER_ACTIVATED_MUST_BE_BOOLEAN")
    if errors:
        return None, errors

    if activated and not approved:
        errors.append("CUTOVER_ACTIVATED_WITHOUT_APPROVAL")
    state = "ACTIVE" if activated else ("APPROVED_NOT_ACTIVE" if approved else "NOT_APPROVED")
    expected_status = {
        "NOT_APPROVED": "DEFINED_NOT_APPROVED",
        "APPROVED_NOT_ACTIVE": "APPROVED_NOT_ACTIVE",
        "ACTIVE": "ACTIVE",
    }[state]
    if boundary.get("status") != expected_status:
        errors.append("CUTOVER_BOUNDARY_STATUS_MISMATCH")

    if approved:
        owner_approval = boundary.get("owner_approval")
        if not isinstance(owner_approval, dict):
            errors.append("OWNER_APPROVAL_MISSING")
        else:
            if owner_approval.get("status") != "EXPLICIT_OWNER_APPROVAL":
                errors.append("OWNER_APPROVAL_STATUS_INVALID")
            if owner_approval.get("statement") != "APRUEBO EL CUTOVER V095":
                errors.append("OWNER_APPROVAL_STATEMENT_INVALID")
            if owner_approval.get("scope") != "CUTOVER_BOUNDARY_ONLY":
                errors.append("OWNER_APPROVAL_SCOPE_INVALID")
            expected_activation = "EXPLICIT_OWNER_ACTIVATION" if activated else "NOT_GRANTED"
            if owner_approval.get("activation") != expected_activation:
                errors.append("OWNER_APPROVAL_ACTIVATION_INVALID")

    if errors:
        return None, errors
    return {
        "state": state,
        "version": "V095",
        "approved": approved,
        "activated": activated,
        "owner_activation": (
            boundary.get("owner_approval", {}).get("activation")
            if isinstance(boundary.get("owner_approval"), dict)
            else None
        ),
    }, []


def evaluate_enforcement_state(
    state: object,
    requested: str | None = None,
    *,
    rollback_authorized: bool = False,
) -> tuple[dict[str, object] | None, list[str]]:
    """Resolve repository-owned enforcement state and explicit requests."""

    errors: list[str] = []
    if not isinstance(state, dict):
        return None, ["ENFORCEMENT_STATE_MUST_BE_OBJECT"]
    mode = state.get("mode")
    status = state.get("status")
    owner_activation = state.get("owner_activation")
    rollback = state.get("rollback")
    if mode not in ENFORCEMENT_MODES:
        errors.append("ENFORCEMENT_MODE_INVALID")
    if status not in ENFORCEMENT_STATE_STATUSES:
        errors.append("ENFORCEMENT_STATUS_INVALID")
    if type(owner_activation) is not str or type(rollback) is not str:
        errors.append("ENFORCEMENT_METADATA_INVALID")
    if not errors:
        if mode == "WARNING":
            if status == "DEFAULT_ACTIVE" and owner_activation != "NOT_GRANTED":
                errors.append("WARNING_ACTIVATION_METADATA_INVALID")
            if status == "ROLLED_BACK" and owner_activation != "EXPLICIT_OWNER_ROLLBACK":
                errors.append("ROLLBACK_ACTIVATION_METADATA_INVALID")
            if status == "ACTIVE":
                errors.append("WARNING_STATUS_CANNOT_BE_ACTIVE")
        if mode == "STRICT":
            if status != "ACTIVE" or owner_activation != "EXPLICIT_OWNER_ACTIVATION":
                errors.append("STRICT_ACTIVATION_METADATA_INVALID")
        if rollback not in {"NOT_REQUESTED", "EXPLICIT_OWNER_ROLLBACK"}:
            errors.append("ENFORCEMENT_ROLLBACK_METADATA_INVALID")
        if mode == "WARNING" and rollback == "EXPLICIT_OWNER_ROLLBACK" and status != "ROLLED_BACK":
            errors.append("ROLLBACK_STATUS_INVALID")
        if mode == "STRICT" and rollback not in {"NOT_REQUESTED", "EXPLICIT_OWNER_ROLLBACK"}:
            errors.append("STRICT_ROLLBACK_METADATA_INVALID")

    requested_mode = None if requested is None else str(requested).upper()
    if requested_mode not in {None, "WARNING", "DIAGNOSTIC_ONLY", "STRICT"}:
        errors.append("ENFORCEMENT_REQUEST_INVALID")
    if errors:
        return None, errors

    effective = requested_mode or mode
    if mode == "STRICT" and requested_mode in {"WARNING", "DIAGNOSTIC_ONLY"}:
        if not (rollback_authorized and rollback == "EXPLICIT_OWNER_ROLLBACK"):
            errors.append("STRICT_DOWNGRADE_NOT_AUTHORIZED")
        else:
            effective = "WARNING"
    if errors:
        return None, errors
    return {
        "durable_mode": mode,
        "durable_status": status,
        "mode": effective,
        "strict_active": effective == "STRICT",
        "warning_mode_active": effective == "WARNING",
        "rollback_authorized": bool(rollback_authorized and rollback == "EXPLICIT_OWNER_ROLLBACK"),
    }, []


def load_baseline_manifest(root: Path) -> tuple[dict[str, object] | None, list[str]]:
    """Load the non-certifying owner baseline declaration defensively."""

    path = root / BASELINE_MANIFEST
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None, ["BASELINE_MANIFEST_MISSING"]
    except (OSError, json.JSONDecodeError) as error:
        return None, [f"BASELINE_MANIFEST_INVALID_JSON:{error}"]
    if not isinstance(data, dict):
        return None, ["BASELINE_MANIFEST_MUST_BE_OBJECT"]
    required = {
        "version", "baseline_type", "execution_status",
        "history_certification_status", "owner_statement", "prohibitions",
    }
    errors = [f"BASELINE_MANIFEST_MISSING_FIELD:{key}" for key in sorted(required - data.keys())]
    if data.get("version") != 1:
        errors.append("BASELINE_MANIFEST_VERSION_MUST_BE_1")
    if data.get("baseline_type") != "PRE-GOVERNANCE EXECUTION BASELINE":
        errors.append("BASELINE_MANIFEST_TYPE_INVALID")
    if data.get("execution_status") != "EXECUTED_LEGACY_REPORTED":
        errors.append("BASELINE_EXECUTION_STATUS_INVALID")
    if data.get("history_certification_status") not in {"PARTIAL", "UNVERIFIED"}:
        errors.append("BASELINE_CERTIFICATION_STATUS_INVALID")
    owner_statement = data.get("owner_statement")
    if not isinstance(owner_statement, dict) or owner_statement.get("per_file_certification") is not False:
        errors.append("BASELINE_MUST_NOT_CERTIFY_FILES")
    forbidden = {"applied_at", "applied_by", "checksum", "success", "history_rows"}
    if forbidden.intersection(data.keys()):
        errors.append("BASELINE_CONTAINS_CERTIFICATION_FIELDS")
    boundary = data.get("cutover_boundary")
    if boundary is not None:
        if not isinstance(boundary, dict):
            errors.append("CUTOVER_BOUNDARY_MUST_BE_OBJECT")
        else:
            if not CUTOVER_BOUNDARY_VERSION_RE.fullmatch(str(boundary.get("version", ""))):
                errors.append("CUTOVER_BOUNDARY_VERSION_INVALID")
            if boundary.get("version") != "V095":
                errors.append("CUTOVER_BOUNDARY_VERSION_UNEXPECTED")
            if boundary.get("semantics") != "NUMERIC_HISTORICAL_BOUNDARY_NOT_CANONICAL_FILE":
                errors.append("CUTOVER_BOUNDARY_SEMANTICS_INVALID")
            _, cutover_errors = evaluate_cutover_state(boundary)
            errors.extend(cutover_errors)
            if boundary.get("approved") is True:
                owner_approval = boundary.get("owner_approval")
                if not isinstance(owner_approval, dict):
                    errors.append("OWNER_APPROVAL_MISSING")
                else:
                    if owner_approval.get("status") != "EXPLICIT_OWNER_APPROVAL":
                        errors.append("OWNER_APPROVAL_STATUS_INVALID")
                    if owner_approval.get("statement") != "APRUEBO EL CUTOVER V095":
                        errors.append("OWNER_APPROVAL_STATEMENT_INVALID")
                    if owner_approval.get("scope") != "CUTOVER_BOUNDARY_ONLY":
                        errors.append("OWNER_APPROVAL_SCOPE_INVALID")
                    expected_activation = (
                        "EXPLICIT_OWNER_ACTIVATION"
                        if boundary.get("activated") is True
                        else "NOT_GRANTED"
                    )
                    if owner_approval.get("activation") != expected_activation:
                        errors.append("OWNER_APPROVAL_ACTIVATION_INVALID")
            if boundary.get("drift_disposition") != "PREEXISTING_BASELINE_RETAINED":
                errors.append("CUTOVER_BOUNDARY_DRIFT_DISPOSITION_INVALID")
            required_environments = boundary.get("required_environments")
            if required_environments != ["QA", "PRD_SNAPSHOT"]:
                errors.append("CUTOVER_REQUIRED_ENVIRONMENTS_INVALID")
            local = boundary.get("local")
            if not isinstance(local, dict) or local.get("cutover_requirement") != "NOT_REQUIRED":
                errors.append("LOCAL_CUTOVER_REQUIREMENT_INVALID")
            historical_disposition = boundary.get("historical_disposition")
            if not isinstance(historical_disposition, dict):
                errors.append("HISTORICAL_DISPOSITION_MISSING")
            else:
                for source in ("repository", "qa", "prd_snapshot"):
                    if historical_disposition.get(source) != "PREEXISTING_HISTORICAL_BASELINE":
                        errors.append(f"HISTORICAL_DISPOSITION_INVALID:{source}")
                if historical_disposition.get("history_certification_status") != "PARTIAL":
                    errors.append("HISTORICAL_DISPOSITION_CERTIFICATION_INVALID")
                if historical_disposition.get("remediation") != "SEPARATE_OPENSPEC_HISTORICAL_DRIFT":
                    errors.append("HISTORICAL_DISPOSITION_REMEDIATION_INVALID")
    _, enforcement_errors = evaluate_enforcement_state(data.get("enforcement_state"))
    errors.extend(enforcement_errors)
    return (data if not errors else None), errors


def cutover_evaluation(
    *, repository_verified: bool = False, target_verified: bool = False,
    local_verified: bool = False, qa_verified: bool = False,
    prd_verified: bool = False, runner_policy_verified: bool = False,
    gate_policy_verified: bool = False, drift_disposition_approved: bool = False,
    explicit_approval: bool = False, boundary_defined: bool = False,
    activated: bool = False,
    required_environments: tuple[str, ...] = ("LOCAL", "QA", "PRD"),
) -> dict[str, object]:
    """Evaluate cutover prerequisites without environment access or approval."""

    prerequisites = {
        "repository": repository_verified, "target_branch": target_verified,
        "runner_policy": runner_policy_verified, "gate_policy": gate_policy_verified,
        "drift_disposition": drift_disposition_approved,
        "explicit_approval": explicit_approval,
    }
    environment_values = {
        "LOCAL": ("local", local_verified),
        "QA": ("qa", qa_verified),
        "PRD": ("prd", prd_verified),
        "PRD_SNAPSHOT": ("prd_snapshot", prd_verified),
    }
    for environment in required_environments:
        key, verified = environment_values.get(environment, (environment.lower(), False))
        prerequisites[key] = verified
    missing = [name for name, verified in prerequisites.items() if not verified]
    approved = not missing and boundary_defined
    return {
        "cutover_boundary_status": "DEFINED_CRITERIA_UNVERIFIED" if boundary_defined else "UNVERIFIED",
        "governance_cutover_status": "GOVERNANCE_CUTOVER_APPROVED" if approved else "NOT_APPROVED",
        "activated_cutover": bool(activated and approved),
        "migration_governance_era": "POST_CUTOVER_STRICT" if activated and approved else "PRE_GOVERNANCE",
        "missing_prerequisites": missing,
        "boundary_defined": bool(boundary_defined),
        "required_environments": list(required_environments),
        "next_safe_version": "UNVERIFIED",
    }


PROMOTION_ORDER = ("LOCAL", "QA", "PRD")


def promotion_evaluation(
    *,
    target_stage: str,
    local_status: str = "UNVERIFIED",
    qa_status: str = "UNVERIFIED",
    prd_status: str = "UNVERIFIED",
    completed_stages: tuple[str, ...] = (),
    local_required: bool = True,
    qa_approved: bool = False,
    explicit_prd_authorization: bool = False,
    operation: str = "PRD_MIGRATION_PROMOTION",
    enforcement_active: bool = False,
    prd_read_only_authorized: bool = False,
) -> dict[str, object]:
    """Evaluate ordered promotion without DB access or execution side effects."""
    stage = str(target_stage).upper()
    operation_name = str(operation).upper()
    base = {
        "promotion_order": list(PROMOTION_ORDER),
        "target_stage": stage,
        "completed_stages": [str(item).upper() for item in completed_stages],
        "operation": operation_name,
        "qa_approval_required_for_prd": True,
        "explicit_prd_authorization_required": True,
        "prd_read_only_reconciliation_separate": True,
        "runtime_enforcement_active": bool(enforcement_active),
        "migration_execution_allowed": False,
        "next_safe_version": "UNVERIFIED",
        "reasons": [],
    }
    if stage not in PROMOTION_ORDER:
        base.update(status="BLOCKED", decision="PROMOTION_REJECTED")
        base["reasons"].append("UNKNOWN_PROMOTION_STAGE")
        return base

    if operation_name == "PRD_READ_ONLY_RECONCILIATION":
        if stage != "PRD":
            base.update(status="BLOCKED", decision="RECONCILIATION_REJECTED")
            base["reasons"].append("READ_ONLY_RECONCILIATION_REQUIRES_PRD_STAGE")
            return base
        if prd_status != "VERIFIED":
            base.update(status="UNVERIFIED", decision="RECONCILIATION_UNVERIFIED")
            base["reasons"].append("PRD_SOURCE_UNVERIFIED")
            return base
        if not prd_read_only_authorized:
            base.update(status="BLOCKED", decision="RECONCILIATION_REJECTED")
            base["reasons"].append("PRD_READ_ONLY_AUTHORIZATION_MISSING")
            return base
        base.update(
            status="ALLOWED_DIAGNOSTIC_ONLY",
            decision="PRD_READ_ONLY_RECONCILIATION_ALLOWED",
            migration_execution_allowed=False,
        )
        base["reasons"].append("READ_ONLY_RECONCILIATION_NOT_MIGRATION_PROMOTION")
        return base

    if operation_name != "PRD_MIGRATION_PROMOTION":
        base.update(status="BLOCKED", decision="PROMOTION_REJECTED")
        base["reasons"].append("UNKNOWN_PROMOTION_OPERATION")
        return base

    required_prior = [item for item in PROMOTION_ORDER[:PROMOTION_ORDER.index(stage)]
                      if item != "LOCAL" or local_required]
    completed = [str(item).upper() for item in completed_stages]
    if completed != required_prior:
        base.update(status="BLOCKED", decision="PROMOTION_REJECTED")
        base["reasons"].append("PROMOTION_ORDER_VIOLATION")
        return base

    source_statuses = {"LOCAL": local_status, "QA": qa_status, "PRD": prd_status}
    for source in required_prior + [stage]:
        if source == "LOCAL" and not local_required:
            continue
        if source_statuses[source] != "VERIFIED":
            base.update(status="UNVERIFIED", decision="PROMOTION_UNVERIFIED")
            base["reasons"].append(f"{source}_SOURCE_UNVERIFIED")
    if base["reasons"]:
        return base

    if stage == "PRD" and not qa_approved:
        base.update(status="BLOCKED", decision="PROMOTION_REJECTED")
        base["reasons"].append("QA_APPROVAL_REQUIRED_BEFORE_PRD")
    if stage == "PRD" and not explicit_prd_authorization:
        base.update(status="BLOCKED", decision="PROMOTION_REJECTED")
        base["reasons"].append("PRD_EXPLICIT_AUTHORIZATION_REQUIRED")
    if base["reasons"]:
        return base

    base.update(status="ALLOWED_DIAGNOSTIC_ONLY", decision="PROMOTION_ALLOWED")
    base["reasons"].append("POLICY_VALIDATION_ONLY_RUNTIME_ENFORCEMENT_INACTIVE")
    return base


def next_safe_version_evaluation(
    *,
    cutover_boundary_version: str,
    cutover_approved: bool,
    required_sources: Mapping[str, Mapping[str, object]],
    repository_status: str = "VERIFIED",
    openspec_status: str = "VERIFIED",
    governance_status: str = "VERIFIED",
    target_verified: bool = True,
    target_revalidated: bool = True,
    same_operation_live_evidence_required: bool = True,
) -> dict[str, object]:
    """Select a synthetic next-version proposal without any I/O.

    Each source must provide ``status`` and ``occupied_numeric_identities``.
    Environment sources that participate in a real calculation must also mark
    ``evidence_type=LIVE`` and ``same_operation=True``. This function never
    reserves a number, creates a file, or authorizes promotion/execution.
    """
    reasons: list[str] = []
    normalized_sources = {str(name).upper(): value for name, value in required_sources.items()}
    source_names = sorted(normalized_sources)
    result: dict[str, object] = {
        "status": "UNVERIFIED",
        "decision": "NEXT_SAFE_VERSION_UNVERIFIED",
        "next_safe_version": "UNVERIFIED",
        "candidate": None,
        "algorithm": NEXT_VERSION_ALGORITHM,
        "cutover_boundary_version": str(cutover_boundary_version),
        "required_sources": source_names,
        "verified_sources": [],
        "occupied_union": [],
        "occupied_by_source": {},
        "reasons": reasons,
        "target_verified": bool(target_verified),
        "target_revalidated": bool(target_revalidated),
        "same_operation_live_evidence_required": bool(same_operation_live_evidence_required),
        "candidate_is_proposal": False,
        "candidate_is_reservation": False,
        "version_reservation_created": False,
        "promotion_authorized": False,
        "migration_execution_authorized": False,
    }

    boundary_match = NUMERIC_VERSION_RE.fullmatch(str(cutover_boundary_version).strip())
    if not boundary_match:
        result.update(status="BLOCKED", decision="NEXT_SAFE_VERSION_BLOCKED")
        reasons.append("INVALID_CUTOVER_BOUNDARY_VERSION")
        return result
    if not normalized_sources or not {"REPOSITORY", "TARGET"}.issubset(normalized_sources):
        result.update(status="BLOCKED", decision="NEXT_SAFE_VERSION_BLOCKED")
        reasons.append("AUTHORITATIVE_SOURCE_SET_INVALID")
        return result
    boundary = int(boundary_match.group(1))
    if not cutover_approved:
        result.update(status="BLOCKED", decision="NEXT_SAFE_VERSION_BLOCKED")
        reasons.append("GOVERNANCE_CUTOVER_NOT_APPROVED")
        return result
    if str(repository_status).upper() in {"BLOCKED", "STRICT_REJECTED"}:
        result.update(status="BLOCKED", decision="NEXT_SAFE_VERSION_BLOCKED")
        reasons.append("REPOSITORY_GATE_REJECTED")
        return result
    if str(openspec_status).upper() in {"BLOCKED", "STRICT_REJECTED", "INVALID"}:
        result.update(status="BLOCKED", decision="NEXT_SAFE_VERSION_BLOCKED")
        reasons.append("OPENSPEC_GOVERNANCE_PREREQUISITE_BLOCKED")
        return result
    if str(governance_status).upper() in {"BLOCKED", "STRICT_REJECTED", "INVALID"}:
        result.update(status="BLOCKED", decision="NEXT_SAFE_VERSION_BLOCKED")
        reasons.append("GOVERNANCE_PREREQUISITE_BLOCKED")
        return result
    if str(repository_status).upper() != "VERIFIED":
        reasons.append("REPOSITORY_SOURCE_UNVERIFIED")
    if str(openspec_status).upper() != "VERIFIED":
        reasons.append("OPENSPEC_GOVERNANCE_PREREQUISITE_UNVERIFIED")
    if str(governance_status).upper() != "VERIFIED":
        reasons.append("GOVERNANCE_PREREQUISITE_UNVERIFIED")
    if not target_verified:
        reasons.append("TARGET_SOURCE_UNVERIFIED")
    if not target_revalidated:
        reasons.append("TARGET_REVALIDATION_REQUIRED")

    occupied_by_source: dict[str, list[str]] = {}
    occupied_numbers: set[int] = set()
    for source_name in source_names:
        source = normalized_sources[source_name]
        status = str(source.get("status", "UNVERIFIED")).upper()
        if status == "BLOCKED":
            reasons.append(f"{source_name}_SOURCE_BLOCKED")
        elif status != "VERIFIED":
            reasons.append(f"{source_name}_SOURCE_UNVERIFIED")
        is_environment = source_name in {"LOCAL", "QA", "PRD"}
        if is_environment and same_operation_live_evidence_required:
            evidence_type = str(source.get("evidence_type", "")).upper()
            if evidence_type != "LIVE":
                reasons.append(f"{source_name}_LIVE_EVIDENCE_REQUIRED")
            if source.get("same_operation") is not True:
                reasons.append(f"{source_name}_SAME_OPERATION_EVIDENCE_REQUIRED")
            freshness = str(source.get("freshness_status", "UNSPECIFIED_BY_OPENSPEC")).upper()
            if freshness in {"STALE", "UNKNOWN", "UNVERIFIED"}:
                reasons.append(f"{source_name}_EVIDENCE_FRESHNESS_UNVERIFIED")
        raw_identities = source.get("occupied_numeric_identities", ())
        normalized: set[str] = set()
        if not isinstance(raw_identities, (list, tuple, set, frozenset)):
            reasons.append(f"{source_name}_OCCUPIED_IDENTITIES_INVALID")
            raw_identities = ()
        for raw_identity in raw_identities:
            match = NUMERIC_VERSION_RE.fullmatch(str(raw_identity).strip())
            if not match:
                reasons.append(f"{source_name}_OCCUPIED_IDENTITY_INVALID")
                continue
            number = int(match.group(1))
            normalized.add(f"V{number:03d}")
            occupied_numbers.add(number)
        occupied_by_source[source_name] = sorted(normalized, key=lambda value: int(value[1:]))
        if status == "VERIFIED":
            result["verified_sources"].append(source_name)

    result["occupied_by_source"] = occupied_by_source
    result["occupied_union"] = [f"V{number:03d}" for number in sorted(occupied_numbers)]
    if reasons:
        result["status"] = "BLOCKED" if any("BLOCKED" in reason or "INVALID" in reason for reason in reasons) else "UNVERIFIED"
        result["decision"] = "NEXT_SAFE_VERSION_BLOCKED" if result["status"] == "BLOCKED" else "NEXT_SAFE_VERSION_UNVERIFIED"
        return result

    candidate_number = next((number for number in range(boundary + 1, 1000) if number not in occupied_numbers), None)
    if candidate_number is None:
        result.update(status="UNVERIFIED", decision="NEXT_SAFE_VERSION_UNVERIFIED")
        reasons.append("VERSION_NAMESPACE_EXHAUSTED_OR_UNREPRESENTABLE")
        return result
    candidate = f"V{candidate_number:03d}"
    result.update(status="VERIFIED", decision="NEXT_SAFE_VERSION_PROPOSAL",
                  next_safe_version=candidate, candidate=candidate,
                  candidate_is_proposal=True)
    reasons.append("FIRST_FREE_VERSION_ABOVE_CUTOVER_SELECTED")
    return result


def environment_gate_evaluation(
    *, environment: str, evidence: dict[str, object] | None = None,
    required: bool = True, expected_database: str | None = None,
    authorization_required: bool = False, authorization_granted: bool = False,
    read_only_required: bool = False, freshness_status: str | None = None,
) -> dict[str, object]:
    """Evaluate sanitized environment evidence without I/O or execution effects."""
    name = str(environment).upper()
    reasons: list[str] = []
    evidence = evidence if isinstance(evidence, dict) else None
    result: dict[str, object] = {
        "environment": name, "status": "UNVERIFIED", "decision": "ENVIRONMENT_UNVERIFIED",
        "reasons": reasons, "required": bool(required),
        "evidence_type": evidence.get("evidence_type") if evidence else None,
        "authorization_required": bool(authorization_required),
        "authorization_verified": bool(authorization_granted),
        "read_only_verified": bool(evidence and evidence.get("read_only_verified") is True),
        "freshness_status": freshness_status or "UNSPECIFIED_BY_OPENSPEC",
        "migration_execution_authorized": False,
    }
    if not required:
        result.update(status="VERIFIED", decision="ENVIRONMENT_NOT_REQUIRED")
        reasons.append("ENVIRONMENT_NOT_REQUIRED")
        return result
    if evidence is None:
        reasons.append("SOURCE_UNAVAILABLE")
        return result

    evidence_status = str(evidence.get("status", "UNVERIFIED")).upper()
    if evidence_status in {"BLOCKED", "UNAVAILABLE"}:
        result.update(status="BLOCKED", decision="ENVIRONMENT_BLOCKED")
        reasons.append("SOURCE_" + evidence_status)
        return result
    if evidence_status != "VERIFIED":
        reasons.append("SOURCE_UNVERIFIED")

    evidence_type = str(evidence.get("evidence_type", "")).upper()
    if name == "PRD" and evidence_type in {"DOCUMENTARY", "PRD_SNAPSHOT", "OPERATOR_ACCEPTED_SNAPSHOT_NOT_LIVE"}:
        reasons.append("DOCUMENTARY_EVIDENCE_NOT_LIVE")
        return result
    elif evidence_type and evidence_type != "LIVE":
        reasons.append("EVIDENCE_NOT_LIVE")

    identity = evidence.get("identity") if isinstance(evidence.get("identity"), dict) else evidence
    actual_database = identity.get("current_database") if isinstance(identity, dict) else None
    if expected_database and actual_database != expected_database:
        result.update(status="BLOCKED", decision="ENVIRONMENT_BLOCKED")
        reasons.append("IDENTITY_MISMATCH")
        return result

    schema_status = str(evidence.get("schema_status", evidence.get("history_schema_status", "VERIFIED"))).upper()
    if schema_status in {"MISSING", "INVALID", "BLOCKED"}:
        result.update(status="BLOCKED", decision="ENVIRONMENT_BLOCKED")
        reasons.append("HISTORY_SCHEMA_" + schema_status)
        return result
    if schema_status != "VERIFIED":
        reasons.append("HISTORY_SCHEMA_UNVERIFIED")

    if read_only_required and evidence.get("read_only_verified") is not True:
        reasons.append("READ_ONLY_UNVERIFIED")

    if authorization_required and not authorization_granted:
        result.update(status="BLOCKED", decision="ENVIRONMENT_BLOCKED")
        reasons.append("ENVIRONMENT_AUTHORIZATION_REQUIRED")
        return result

    freshness = str(freshness_status or evidence.get("freshness_status", "UNSPECIFIED_BY_OPENSPEC")).upper()
    result["freshness_status"] = freshness
    if freshness in {"STALE", "UNKNOWN", "UNVERIFIED"}:
        reasons.append("EVIDENCE_FRESHNESS_UNVERIFIED")

    if evidence_status != "VERIFIED" or "DOCUMENTARY_EVIDENCE_NOT_LIVE" in reasons or "EVIDENCE_NOT_LIVE" in reasons:
        return result
    if "READ_ONLY_UNVERIFIED" in reasons or "HISTORY_SCHEMA_UNVERIFIED" in reasons or "EVIDENCE_FRESHNESS_UNVERIFIED" in reasons:
        return result
    result.update(status="VERIFIED", decision="ENVIRONMENT_VERIFIED")
    return result


def combined_environment_gate_evaluation(
    *, repository_result: dict[str, object], environment_results: dict[str, dict[str, object]],
    promotion_result: dict[str, object] | None = None,
    required_environments: tuple[str, ...] = ("QA", "PRD"),
) -> dict[str, object]:
    """Compose repository, environment and promotion results without authorizing execution."""
    reasons: list[str] = []
    repository_status = str(repository_result.get("status", "UNVERIFIED")).upper()
    if repository_status in {"STRICT_REJECTED", "BLOCKED"}:
        return {"status": "BLOCKED", "decision": "REPOSITORY_GATE_REJECTED",
                "reasons": ["REPOSITORY_GATE_REJECTED"], "environment_results": environment_results,
                "promotion_result": promotion_result, "migration_execution_authorized": False}
    if repository_status != "PASS":
        reasons.append("REPOSITORY_GATE_UNVERIFIED")

    statuses = []
    for name in required_environments:
        result = environment_results.get(name)
        if not isinstance(result, dict):
            statuses.append("UNVERIFIED")
            reasons.append(f"{name}_SOURCE_UNVERIFIED")
            continue
        status = str(result.get("status", "UNVERIFIED")).upper()
        statuses.append(status)
        if status != "VERIFIED":
            reasons.extend(str(reason) for reason in result.get("reasons", []) or [])

    if promotion_result:
        decision = str(promotion_result.get("decision", "")).upper()
        if decision not in {"PROMOTION_ALLOWED", "PRD_READ_ONLY_RECONCILIATION_ALLOWED"}:
            reasons.extend(str(reason) for reason in promotion_result.get("reasons", []) or [])
            return {"status": "BLOCKED", "decision": "PROMOTION_REJECTED",
                    "reasons": reasons or ["PROMOTION_REJECTED"],
                    "environment_results": environment_results,
                    "promotion_result": promotion_result, "migration_execution_authorized": False}

    if "BLOCKED" in statuses:
        status, decision = "BLOCKED", "ENVIRONMENT_BLOCKED"
    elif reasons or "UNVERIFIED" in statuses or repository_status != "PASS":
        status, decision = "UNVERIFIED", "ENVIRONMENT_UNVERIFIED"
    else:
        status, decision = "VERIFIED", "ENVIRONMENT_GATE_VERIFIED"
    return {"status": status, "decision": decision, "reasons": reasons,
            "environment_results": environment_results, "promotion_result": promotion_result,
            "migration_execution_authorized": False}


def evaluate_migration_era(
    *, is_pre_governance_baseline: bool, requested_era: str = "PRE_GOVERNANCE",
    cutover: dict[str, object] | None = None,
    checksum_status: str = "HISTORICAL_UNVERIFIED",
) -> dict[str, object]:
    """Return a safe classification before any executor call."""

    current_cutover = cutover or cutover_evaluation()
    if is_pre_governance_baseline:
        return {"era": "PRE_GOVERNANCE_EXECUTED_LEGACY", "replay_protection": "HISTORICAL_REPLAY_PROHIBITED", "executor_allowed": False, "status": "REVIEW_REQUIRED"}
    if requested_era == "POST_CUTOVER" and current_cutover.get("activated_cutover") is not True:
        return {"era": "POST_CUTOVER_STRICT", "replay_protection": "CUTOVER_NOT_APPROVED", "executor_allowed": False, "status": "REVIEW_REQUIRED"}
    if requested_era == "POST_CUTOVER" and checksum_status != "VERIFIED_MATCH":
        return {"era": "POST_CUTOVER_STRICT", "replay_protection": "CHECKSUM_PREREQUISITE_MISSING", "executor_allowed": False, "status": "REVIEW_REQUIRED"}
    return {"era": "PRE_GOVERNANCE", "replay_protection": "CUTOVER_NOT_APPROVED", "executor_allowed": False, "status": "UNVERIFIED"}


def cutover_state_cli(argv: list[str] | None = None) -> int:
    """Expose only the fixed repository cutover-state check to shell callers."""

    parser = argparse.ArgumentParser(description="Validate repository V095 cutover state")
    parser.add_argument("--root", required=True)
    parser.add_argument("--require-active", action="store_true")
    args = parser.parse_args(argv)
    manifest, manifest_errors = load_baseline_manifest(Path(args.root))
    boundary = manifest.get("cutover_boundary") if manifest else None
    state, state_errors = evaluate_cutover_state(boundary)
    errors = [*manifest_errors, *state_errors]
    if errors or state is None:
        print("CUTOVER_STATE_INVALID", file=sys.stderr)
        return 1
    print(f"CUTOVER_STATE={state['state']}")
    if args.require_active and state["state"] != "ACTIVE":
        print("CUTOVER_NOT_ACTIVE", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(cutover_state_cli())
