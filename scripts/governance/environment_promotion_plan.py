"""Pure, fail-closed planning for governed migration promotion.

This module deliberately has no subprocess, filesystem, database, SSH or
network behavior.  It evaluates sanitized evidence and returns a serializable
plan for a later orchestration phase.
"""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from typing import Any

VERSION_RE = re.compile(r"^V([0-9]{3})$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
MIGRATION_FILENAME_RE = re.compile(r"^V[0-9]{3}__[A-Za-z0-9][A-Za-z0-9._-]*\.sql$")

DEFAULT_BOUNDARY = "V095"
BLOCKING_EVIDENCE_STATUSES = {"UNVERIFIED", "BLOCKED", "INVALID"}
STALE_EVIDENCE_STATUSES = {"STALE", "EXPIRED"}


def _version(value: Any) -> tuple[str, int] | None:
    match = VERSION_RE.fullmatch(str(value).strip().upper())
    if not match:
        return None
    return f"V{int(match.group(1)):03d}", int(match.group(1))


def _reason_result(*, reasons: list[str], classification: str = "BLOCKED_DRIFT",
                   target_identity: Mapping[str, Any] | None = None,
                   destination_identity: Mapping[str, Any] | None = None,
                   requested_target: str | None = None) -> dict[str, Any]:
    return {
        "status": "BLOCKED",
        "decision": "PROMOTION_PLAN_BLOCKED",
        "classification": classification,
        "reasons": list(dict.fromkeys(reasons)),
        "requested_target_version": requested_target,
        "target_identity": dict(target_identity or {}),
        "destination_identity": dict(destination_identity or {}),
        "pending_migrations": [],
        "migration_execution_authorized": False,
        "plan_is_executable": False,
    }


def _source_status(evidence: Mapping[str, Any], *, name: str,
                   same_operation_required: bool) -> list[str]:
    reasons: list[str] = []
    status = str(evidence.get("status", "UNVERIFIED")).upper()
    if status in BLOCKING_EVIDENCE_STATUSES:
        reasons.append(f"{name}_EVIDENCE_UNVERIFIED")
    elif status != "VERIFIED":
        reasons.append(f"{name}_EVIDENCE_UNVERIFIED")
    freshness = str(evidence.get("freshness_status", "UNVERIFIED")).upper()
    if freshness in STALE_EVIDENCE_STATUSES:
        reasons.append(f"{name}_EVIDENCE_STALE")
    elif freshness not in {"VERIFIED", "FRESH"}:
        reasons.append(f"{name}_EVIDENCE_UNVERIFIED")
    if same_operation_required and evidence.get("same_operation") is not True:
        reasons.append(f"{name}_SAME_OPERATION_EVIDENCE_REQUIRED")
    if evidence.get("identity_verified") is False:
        reasons.append(f"{name}_IDENTITY_MISMATCH")
    return reasons


def _metadata_index(items: Sequence[Mapping[str, Any]], source: str,
                    boundary: int) -> tuple[dict[str, dict[str, Any]], list[str], dict[str, int]]:
    index: dict[str, dict[str, Any]] = {}
    reasons: list[str] = []
    numbers: dict[str, int] = {}
    for item in items:
        if not isinstance(item, Mapping):
            reasons.append(f"{source}_MIGRATION_METADATA_INVALID")
            continue
        parsed = _version(item.get("version"))
        if parsed is None:
            reasons.append(f"{source}_VERSION_INVALID")
            continue
        version, number = parsed
        numbers[version] = numbers.get(version, 0) + 1
        if number <= boundary:
            continue
        if version in index:
            reasons.append(f"{source}_DUPLICATE_VERSION:{version}")
            continue
        checksum = str(item.get("checksum", "")).strip().lower()
        filename = str(item.get("filename", item.get("path", ""))).replace("\\", "/").rsplit("/", 1)[-1]
        if not SHA256_RE.fullmatch(checksum):
            reasons.append(f"{source}_CHECKSUM_INVALID:{version}")
        if filename and not MIGRATION_FILENAME_RE.fullmatch(filename):
            reasons.append(f"{source}_FILENAME_INVALID:{version}")
        if item.get("eligible", True) is not True:
            reasons.append(f"{source}_MIGRATION_INELIGIBLE:{version}")
        index[version] = {
            "version": version,
            "filename": filename or None,
            "path": str(item.get("path", "")).replace("\\", "/") or None,
            "checksum": checksum,
            "eligible": True,
            "dependencies": [str(dep).upper() for dep in item.get("dependencies", ()) or ()],
        }
    duplicate_numbers = {version: count for version, count in numbers.items() if count > 1 and _version(version)[1] > boundary}
    if duplicate_numbers:
        reasons.extend(f"{source}_DUPLICATE_VERSION:{version}" for version in sorted(duplicate_numbers))
    return index, reasons, numbers


def _destination_index(evidence: Mapping[str, Any], boundary: int) -> tuple[dict[str, list[dict[str, Any]]], list[str]]:
    index: dict[str, list[dict[str, Any]]] = {}
    reasons: list[str] = []
    rows = evidence.get("applied_migrations", ())
    if not isinstance(rows, (list, tuple)):
        return {}, ["DESTINATION_HISTORY_EVIDENCE_INVALID"]
    for row in rows:
        if not isinstance(row, Mapping):
            reasons.append("DESTINATION_HISTORY_ROW_INVALID")
            continue
        parsed = _version(row.get("version"))
        if parsed is None:
            reasons.append("DESTINATION_VERSION_INVALID")
            continue
        version, number = parsed
        if number <= boundary:
            continue
        index.setdefault(version, []).append(dict(row))
    for version, rows_for_version in sorted(index.items()):
        if len(rows_for_version) > 1:
            reasons.append(f"DESTINATION_DUPLICATE_VERSION:{version}")
    return index, reasons


def _identity_value(evidence: Mapping[str, Any]) -> str | None:
    for key in ("target_sha", "identity", "fingerprint"):
        value = evidence.get(key)
        if value:
            return str(value)
    return None


def promotion_plan_evaluation(
    *,
    repository_migrations: Sequence[Mapping[str, Any]],
    target_migrations: Sequence[Mapping[str, Any]],
    destination_evidence: Mapping[str, Any],
    requested_target_version: str,
    target_evidence: Mapping[str, Any],
    cutover_boundary_version: str = DEFAULT_BOUNDARY,
    same_operation_required: bool = False,
) -> dict[str, Any]:
    """Evaluate a forward promotion plan using sanitized, explicit evidence."""

    boundary_parsed = _version(cutover_boundary_version)
    requested_parsed = _version(requested_target_version)
    target_identity = dict(target_evidence) if isinstance(target_evidence, Mapping) else {}
    destination_identity = dict(destination_evidence) if isinstance(destination_evidence, Mapping) else {}
    if boundary_parsed is None:
        return _reason_result(reasons=["INVALID_CUTOVER_BOUNDARY_VERSION"], target_identity=target_identity,
                              destination_identity=destination_identity)
    boundary = boundary_parsed[1]
    if requested_parsed is None:
        return _reason_result(reasons=["REQUESTED_TARGET_VERSION_INVALID"], target_identity=target_identity,
                              destination_identity=destination_identity, requested_target=str(requested_target_version))
    requested_target, requested_number = requested_parsed
    base = {
        "status": "BLOCKED",
        "decision": "PROMOTION_PLAN_BLOCKED",
        "classification": "BLOCKED_DRIFT",
        "reasons": [],
        "requested_target_version": requested_target,
        "target_identity": target_identity,
        "destination_identity": destination_identity,
        "pending_migrations": [],
        "migration_execution_authorized": False,
        "plan_is_executable": False,
        "authorization_prerequisites": {
            "qa_approval_required": True,
            "explicit_prd_authorization_required": True,
            "execution_separate_from_planning": True,
        },
    }
    if requested_number <= boundary:
        base["reasons"] = ["UNSUPPORTED_DOWNGRADE"]
        return base

    target_reasons = _source_status(target_evidence, name="TARGET", same_operation_required=same_operation_required)
    destination_reasons = _source_status(destination_evidence, name="DESTINATION", same_operation_required=same_operation_required)
    if not _identity_value(target_evidence):
        target_reasons.append("TARGET_IDENTITY_MISSING")
    if not _identity_value(destination_evidence):
        destination_reasons.append("DESTINATION_IDENTITY_MISSING")
    if target_reasons or destination_reasons:
        base["reasons"] = target_reasons + destination_reasons
        if any(reason.endswith("EVIDENCE_STALE") for reason in base["reasons"]):
            base["classification"] = "EVIDENCE_STALE"
        else:
            base["classification"] = "EVIDENCE_UNVERIFIED"
        return base

    repository, repo_reasons, _ = _metadata_index(repository_migrations, "REPOSITORY", boundary)
    target, target_metadata_reasons, _ = _metadata_index(target_migrations, "TARGET", boundary)
    destination, destination_metadata_reasons = _destination_index(destination_evidence, boundary)
    reasons = repo_reasons + target_metadata_reasons + destination_metadata_reasons
    if reasons:
        base["reasons"] = sorted(set(reasons))
        return base

    if requested_target not in target:
        base["reasons"] = ["REQUESTED_TARGET_NOT_IN_AUTHORITATIVE_TARGET"]
        return base

    for version, item in target.items():
        repository_item = repository.get(version)
        if repository_item is None:
            reasons.append(f"TARGET_NOT_IN_REPOSITORY:{version}")
        elif repository_item["checksum"] != item["checksum"]:
            reasons.append(f"TARGET_REPOSITORY_CHECKSUM_MISMATCH:{version}")
    if reasons:
        base["reasons"] = sorted(set(reasons))
        return base

    post_target_numbers = range(boundary + 1, requested_number + 1)
    missing_target = [f"V{number:03d}" for number in post_target_numbers if f"V{number:03d}" not in target]
    if missing_target:
        base["reasons"] = [f"VERSION_GAP:{version}" for version in missing_target]
        return base

    destination_versions = set(destination)
    authoritative_versions = set(repository) | set(target)
    db_only = sorted(destination_versions - authoritative_versions, key=lambda value: int(value[1:]))
    if db_only:
        base["reasons"] = [f"DB_ONLY_VERSION:{version}" for version in db_only]
        base["classification"] = "BLOCKED_DRIFT"
        return base

    manual_versions = destination_evidence.get("manual_execution_unverified_versions", ())
    manual_parsed = [_version(value) for value in manual_versions or ()]
    manual_blocked = sorted({parsed[0] for parsed in manual_parsed if parsed and parsed[1] > boundary}, key=lambda value: int(value[1:]))
    if manual_blocked:
        base["reasons"] = [f"MANUAL_EXECUTION_UNVERIFIED:{version}" for version in manual_blocked]
        return base

    for version, rows in destination.items():
        row = rows[0]
        if row.get("success") is False:
            reasons.append(f"FAILED_HISTORY_PRESENT:{version}")
            continue
        if row.get("success") is not True:
            reasons.append(f"DESTINATION_SUCCESS_UNVERIFIED:{version}")
            continue
        expected = target.get(version) or repository.get(version)
        stored_checksum = str(row.get("checksum", "")).strip().lower()
        if expected and stored_checksum != expected["checksum"]:
            reasons.append(f"CHECKSUM_MISMATCH:{version}")
    if reasons:
        base["reasons"] = sorted(set(reasons))
        return base

    applied_numbers = sorted(int(version[1:]) for version in destination_versions)
    if applied_numbers:
        applied_gap = [f"V{number:03d}" for number in range(boundary + 1, max(applied_numbers) + 1)
                       if f"V{number:03d}" not in destination_versions]
        if applied_gap:
            base["reasons"] = [f"VERSION_GAP:{version}" for version in applied_gap]
            return base

    pending_versions = [f"V{number:03d}" for number in post_target_numbers if f"V{number:03d}" not in destination_versions]
    for version in pending_versions:
        item = target[version]
        dependencies = item.get("dependencies", [])
        for dependency in dependencies:
            parsed_dependency = _version(dependency)
            if parsed_dependency is None or parsed_dependency[1] > boundary and parsed_dependency[0] not in destination_versions and parsed_dependency[0] not in pending_versions[:pending_versions.index(version)]:
                reasons.append(f"DEPENDENCY_OR_ORDER_VIOLATION:{version}:{dependency}")
    if reasons:
        base["reasons"] = sorted(set(reasons))
        return base

    if not pending_versions:
        base.update(status="ALREADY_AT_TARGET", decision="ALREADY_AT_TARGET", classification="ALREADY_AT_TARGET")
        return base

    base.update(
        status="VERIFIED",
        decision="VERIFIED_ORDERED_PLAN",
        classification="PROMOTION_LAG",
        plan_is_executable=False,
    )
    base["pending_migrations"] = [
        {
            **{key: item[key] for key in ("version", "filename", "path", "checksum", "eligible", "dependencies")},
            "expected_predecessor_kind": (
                "PRE_GOVERNANCE_BOUNDARY" if int(item["version"][1:]) == boundary + 1
                else "GOVERNED_POST_CUTOVER"
            ),
            "expected_predecessor_version": (
                "V095" if int(item["version"][1:]) == boundary + 1
                else str(target[f"V{int(item['version'][1:]) - 1:03d}"]["filename"])
            ),
            "expected_predecessor_checksum": (
                "" if int(item["version"][1:]) == boundary + 1
                else str(target[f"V{int(item['version'][1:]) - 1:03d}"]["checksum"]).lower()
            ),
        }
        for item in (target[version] for version in pending_versions)
    ]
    base["reasons"] = ["ORDERED_PENDING_SET_VERIFIED", "EXECUTION_REQUIRES_SEPARATE_AUTHORIZATION"]
    return base
