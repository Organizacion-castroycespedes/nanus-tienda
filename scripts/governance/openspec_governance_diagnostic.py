"""Repository-only, diagnostic-only Manus governance checks."""

from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Iterable, Mapping

from migration_runner_policy import (
    cutover_evaluation, evaluate_cutover_state, evaluate_enforcement_state,
    load_baseline_manifest, promotion_evaluation, sha256_file,
)
from prd_evidence_executor import (
    build_prd_evidence_request, execute_prd_evidence_request,
)

CHANGE_ID = "implementar-gobernanza-openspec-migraciones-manus"
KNOWN_GLOBAL_FAILURE = "corregir-handoff-agent-local-perifericos-electron"
MANIFEST_RELATIVE = "scripts/governance/openspec-scope.json"
VERSIONED_RE = re.compile(r"^V[0-9]+__.+\.sql$", re.IGNORECASE)
LEGACY_RE = re.compile(r"^(?:[0-9]{8}|[0-9]{4}_[0-9]{2}_[0-9]{2})_.+\.sql$", re.IGNORECASE)
CHANGE_ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
COVERED_TECHNICAL_CHANGES = {
    "feature", "bugfix", "ui", "frontend", "backend", "api", "contract", "dto",
    "database", "migration", "functional-seed", "security", "rbac", "electron",
    "peripheral-agent", "electronic-billing", "runtime-config", "integration",
    "executable-infrastructure", "refactor",
}
VERIFIABLE_EXCEPTIONS = {
    "typo-only", "non-executable-documentation", "qa-evidence",
    "non-executable-artifact", "administrative-no-technical-impact",
}


def normalize_path(value: str) -> str:
    path = value.replace("\\", "/").strip()
    while path.startswith("./"):
        path = path[2:]
    return path.rstrip("/") if path != "/" else path


def classify_change(kind: str, executable_impact: bool = False) -> str:
    normalized = kind.strip().lower()
    if executable_impact or normalized in COVERED_TECHNICAL_CHANGES:
        return "OPENSPEC_REQUIRED"
    if normalized in VERIFIABLE_EXCEPTIONS:
        return "EXEMPT_IF_VERIFIED"
    return "REVIEW_REQUIRED"


def classify_changed_file(relative_path: str) -> str:
    path = normalize_path(relative_path).lower()
    name = path.rsplit("/", 1)[-1]
    if path.startswith("openspec/changes/archive/"):
        return "ARCHIVED_OPENSPEC_ARTIFACT"
    if path == "agents.md" or path.startswith("openspec/") or path.startswith("scripts/"):
        return "TECHNICAL_REQUIRES_OPENSPEC"
    if path.endswith((".md", ".txt")) and (path.startswith("docs/") or "/docs/" in path):
        return "NON_EXECUTABLE_DOCUMENTATION"
    if path.endswith((".png", ".jpg", ".jpeg", ".gif", ".svg")):
        return "NON_EXECUTABLE_ARTIFACT"
    if name.endswith((".ts", ".tsx", ".js", ".jsx", ".py", ".sh", ".sql", ".json", ".yaml", ".yml")):
        return "TECHNICAL_REQUIRES_OPENSPEC"
    return "REVIEW_REQUIRED"


def classify_sql_path(relative_path: str) -> str:
    path = normalize_path(relative_path).lower()
    name = path.rsplit("/", 1)[-1]
    if "/migrations/" in f"/{path}" and VERSIONED_RE.match(name):
        return "VERSIONED_MIGRATION"
    if "/migrations/" in f"/{path}" and LEGACY_RE.match(name):
        return "LEGACY_MIGRATION"
    if "/seed" in path or "/seeds/" in path:
        return "SEED"
    if "fixture" in path or "/tests/" in path:
        return "FIXTURE"
    if "backfill" in path:
        return "BACKFILL"
    if "rollback" in path or "/rollbacks/" in path:
        return "ROLLBACK"
    if "/tools/" in path or "repair" in path:
        return "REPAIR"
    if "readonly" in path or "read_only" in path:
        return "READ_ONLY"
    return "UNCLASSIFIED"


def valid_pattern(pattern: str) -> bool:
    normalized = normalize_path(pattern)
    if not normalized or normalized.startswith("/") or ".." in normalized.split("/"):
        return False
    if any(not segment for segment in normalized.split("/")):
        return False

    if normalized.endswith("/**"):
        prefix = normalized[:-3].rstrip("/")
        return bool(prefix) and not any(char in prefix for char in "*?")

    # Brackets are literal path characters (for example Next.js route groups).
    # Exact patterns do not implement glob syntax; only a terminal /** above is
    # supported as a recursive prefix pattern.
    return not any(char in normalized for char in "*?") and normalized not in {".", "./"}


def path_matches(pattern: str, path: str) -> bool:
    pattern = normalize_path(pattern)
    path = normalize_path(path)
    if pattern.endswith("/**"):
        prefix = pattern[:-3].rstrip("/")
        return path == prefix or path.startswith(prefix + "/")
    return pattern == path


def load_manifest(root: Path) -> tuple[dict[str, object] | None, list[str]]:
    manifest_path = root / MANIFEST_RELATIVE
    errors: list[str] = []
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None, [f"MANIFEST_MISSING: {MANIFEST_RELATIVE}"]
    except (OSError, json.JSONDecodeError) as error:
        return None, [f"MANIFEST_INVALID_JSON: {error}"]
    if not isinstance(data, dict) or data.get("version") != 1:
        errors.append("MANIFEST_SCHEMA_VERSION_MUST_BE_1")
    changes = data.get("changes") if isinstance(data, dict) else None
    if not isinstance(changes, list) or not changes:
        errors.append("MANIFEST_CHANGES_MUST_BE_NONEMPTY_LIST")
        changes = []
    seen: set[str] = set()
    for entry in changes:
        if not isinstance(entry, dict):
            errors.append("CHANGE_ENTRY_MUST_BE_OBJECT")
            continue
        change_id = entry.get("change_id")
        paths = entry.get("paths")
        if not isinstance(change_id, str) or not CHANGE_ID_RE.fullmatch(change_id):
            errors.append("CHANGE_ID_INVALID")
        elif change_id in seen:
            errors.append(f"CHANGE_ID_DUPLICATE: {change_id}")
        else:
            seen.add(change_id)
        if not isinstance(paths, list) or not paths:
            errors.append(f"PATHS_MUST_BE_NONEMPTY_LIST: {change_id}")
        else:
            for pattern in paths:
                if not isinstance(pattern, str) or not valid_pattern(pattern):
                    errors.append(f"PATH_PATTERN_INVALID: {change_id}: {pattern}")
        exemptions = entry.get("exemptions", [])
        if not isinstance(exemptions, list):
            errors.append(f"EXEMPTIONS_MUST_BE_LIST: {change_id}")
            exemptions = []
        for exemption in exemptions:
            if not isinstance(exemption, dict) or not isinstance(exemption.get("path"), str):
                errors.append(f"EXEMPTION_INVALID: {change_id}")
            elif not valid_pattern(exemption["path"]):
                errors.append(f"EXEMPTION_PATTERN_INVALID: {change_id}: {exemption['path']}")
            elif not isinstance(exemption.get("reason"), str) or not exemption["reason"].strip():
                errors.append(f"EXEMPTION_REASON_MISSING: {change_id}")
    return data if isinstance(data, dict) else None, errors


def run(command: list[str], cwd: Path) -> tuple[int, str]:
    if os.name == "nt" and command and command[0].lower().endswith(".cmd"):
        command = [os.environ.get("COMSPEC", "cmd.exe"), "/d", "/c", "call", *command]
    try:
        completed = subprocess.run(command, cwd=cwd, text=True, stdout=subprocess.PIPE,
                                   stderr=subprocess.STDOUT, check=False)
    except OSError as error:
        return 127, f"TOOL_UNAVAILABLE: {error}"
    return completed.returncode, completed.stdout


def resolve_openspec_command(override: str | None = None) -> list[str] | None:
    value = override or os.environ.get("OPENSPEC_COMMAND")
    if value:
        tokens = shlex.split(value, posix=os.name != "nt")
        return [token.strip('"') for token in tokens]
    candidates = ["openspec.cmd", "openspec"] if os.name == "nt" else ["openspec"]
    for candidate in candidates:
        resolved = shutil.which(candidate)
        if resolved:
            return [resolved]
    return None


def validate_openspec(root: Path, change_id: str, cli_override: str | None = None) -> dict[str, object]:
    archived = sorted((root / "openspec" / "changes" / "archive").glob(f"*-{change_id}"))
    if archived and archived[0].is_dir():
        return {
            "change_id": change_id,
            "cli_available": True,
            "change_status_exit": 0,
            "change_strict_exit": 0,
            "change_strict_pass": True,
            "global_exit": 0,
            "global_preexisting_failures": [],
            "global_new_failures": [],
            "tool_status": "ARCHIVED_VALIDATED",
            "archive_path": archived[0].relative_to(root).as_posix(),
            "strict_output": "Archived change retained with complete validated artifacts",
        }
    cli = resolve_openspec_command(cli_override)
    if cli is None:
        return {"change_id": change_id, "cli_available": False,
                "change_strict_pass": False, "global_preexisting_failures": [],
                "global_new_failures": [], "tool_status": "TOOL_UNAVAILABLE"}
    status_code, status_output = run(cli + ["status", "--change", change_id, "--json"], root)
    strict_code, strict_output = run(cli + ["validate", change_id, "--type", "change", "--strict"], root)
    global_code, global_output = run(cli + ["validate", "--all", "--strict"], root)
    if 127 in {status_code, strict_code, global_code}:
        return {"change_id": change_id, "cli_available": False,
                "change_strict_pass": False, "global_preexisting_failures": [],
                "global_new_failures": [], "tool_status": "TOOL_UNAVAILABLE",
                "tool_output": (status_output + strict_output + global_output).strip()}
    failed = re.findall(r"(?:✗|FAIL)\s+(?:change|spec)/([^\s]+)", global_output)
    return {"change_id": change_id, "cli_available": True,
            "change_status_exit": status_code, "change_strict_exit": strict_code,
            "change_strict_pass": strict_code == 0, "global_exit": global_code,
            "global_preexisting_failures": [item for item in failed if item == KNOWN_GLOBAL_FAILURE],
            "global_new_failures": [item for item in failed if item != KNOWN_GLOBAL_FAILURE],
            "tool_status": "AVAILABLE", "status_output": status_output.strip(),
            "strict_output": strict_output.strip()}


def parse_git_status_entries(raw: bytes) -> list[dict[str, str]]:
    records = raw.decode("utf-8", errors="replace").split("\0")
    entries: list[dict[str, str]] = []
    index = 0
    while index < len(records):
        record = records[index]
        index += 1
        if len(record) < 4:
            continue
        status = record[:2]
        path = normalize_path(record[3:])
        if path:
            entries.append({"status": status, "path": path})
        if "R" in status or "C" in status:
            if index < len(records) and records[index]:
                entries[-1]["old_path"] = path
                entries[-1]["path"] = normalize_path(records[index])
                index += 1
    return entries


def parse_git_status_records(raw: bytes) -> list[str]:
    return sorted({path for entry in parse_git_status_entries(raw)
                   for path in (entry["path"], entry.get("old_path", "")) if path})


def git_changed_entries(root: Path) -> list[dict[str, str]]:
    completed = subprocess.run(["git", "status", "--porcelain=v1", "-z", "--untracked-files=all"],
                               cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)
    return parse_git_status_entries(completed.stdout)


def git_changed_paths(root: Path) -> list[str]:
    return sorted({path for entry in git_changed_entries(root)
                   for path in (entry["path"], entry.get("old_path", "")) if path})


MIGRATION_ROOT = "scripts/database/migrations/"


def resolve_target_ref(root: Path, requested: str | None = None) -> dict[str, str | bool]:
    candidates = [requested] if requested else ["origin/develop", "develop"]
    for candidate in candidates:
        if not candidate:
            continue
        # A governance target must be a named Git ref, not an object ID or
        # revision expression supplied as a convenient substitute for source
        # identity.  Resolve it only after Git accepts the complete ref name.
        if re.fullmatch(r"[0-9a-fA-F]{40}|[0-9a-fA-F]{64}", candidate):
            continue
        ref_code, _ = run(["git", "check-ref-format", "--allow-onelevel", candidate], root)
        if ref_code != 0:
            continue
        code, output = run(["git", "rev-parse", "--verify", f"{candidate}^{{commit}}"], root)
        if code == 0 and output.strip():
            return {"target_ref": candidate, "target_sha": output.strip().splitlines()[-1], "target_status": "VERIFIED"}
    return {"target_ref": requested or "origin/develop", "target_sha": "", "target_status": "UNVERIFIED"}


def source_status_report(root: Path, target_ref: str | None = None) -> dict[str, object]:
    """Report repository, target and documented authorized-source status.

    This function is repository-only. It reuses prior documented evidence and
    never connects to a database. Documentary evidence is not promoted to a
    live verification claim.
    """

    baseline, baseline_errors = load_baseline_manifest(root)
    repository_status = "VERIFIED" if (
        not baseline_errors and (root / MIGRATION_ROOT).is_dir()
    ) else "UNVERIFIED"
    target = resolve_target_ref(root, target_ref)
    boundary = baseline.get("cutover_boundary") if baseline else None
    evidence = boundary.get("evidence", {}) if isinstance(boundary, dict) else {}
    required = set(boundary.get("required_environments", [])) if isinstance(boundary, dict) else set()
    local = boundary.get("local", {}) if isinstance(boundary, dict) else {}

    environments: dict[str, dict[str, object]] = {}
    if local.get("cutover_requirement") == "NOT_REQUIRED":
        environments["LOCAL"] = {
            "status": "NOT_REQUIRED",
            "required_for_cutover": False,
            "live_verification": False,
        }
    else:
        environments["LOCAL"] = {
            "status": "UNVERIFIED",
            "required_for_cutover": "LOCAL" in required,
            "live_verification": False,
        }

    qa_evidence = evidence.get("qa")
    environments["QA"] = {
        "status": "VERIFIED" if qa_evidence == "READ_ONLY_RECONCILIATION" else "UNVERIFIED",
        "evidence": "REUSED_READ_ONLY_EVIDENCE" if qa_evidence == "READ_ONLY_RECONCILIATION" else qa_evidence or "MISSING",
        "required_for_cutover": "QA" in required,
        "live_verification": qa_evidence == "READ_ONLY_RECONCILIATION",
    }

    prd_evidence = evidence.get("prd")
    environments["PRD_SNAPSHOT"] = {
        "status": "DOCUMENTARY_ONLY" if prd_evidence == "OPERATOR_ACCEPTED_SNAPSHOT_NOT_LIVE" else "UNVERIFIED",
        "evidence": prd_evidence or "MISSING",
        "required_for_cutover": "PRD_SNAPSHOT" in required,
        "live_verification": False,
    }
    return {
        "repository": {"status": repository_status, "source": "working_tree"},
        "target": dict(target),
        "authorized_environments": environments,
        "false_pass_protection": True,
        "baseline_errors": baseline_errors,
    }


HISTORY_EVIDENCE_FIELDS = ("version", "filename", "path", "success", "checksum")


def classify_environment_checksum(value: Any, repository_checksum: str | None = None) -> str:
    """Classify a history checksum without promoting it to certification."""
    if value is None or str(value).strip() == "":
        return "MISSING"
    text = str(value).strip()
    lowered = text.lower()
    if lowered.startswith(("manual-", "bundle-", "reporte-")):
        return "LEGACY_UNVERIFIED"
    if not re.fullmatch(r"[0-9a-fA-F]{64}", text):
        return "MALFORMED_UNVERIFIED"
    if repository_checksum:
        expected = repository_checksum.strip().lower()
        if expected == lowered:
            return "VERIFIED_MATCH_CANDIDATE"
        return "CHECKSUM_MISMATCH"
    return "SHA256_FORMAT_CANDIDATE"


def sanitize_environment_history_row(
    row: Mapping[str, Any], repository_checksum: str | None = None
) -> dict[str, object]:
    """Keep only migration evidence needed for governance reporting.

    Applied user, details, DSNs and connection metadata are intentionally not
    copied. A checksum match is a candidate until an authoritative contract
    verifies the environment record.
    """
    result: dict[str, object] = {}
    for field in HISTORY_EVIDENCE_FIELDS:
        if field in row and row[field] is not None:
            result[field] = row[field]
    if "success" in result:
        result["success"] = bool(result["success"])
    result["checksum_classification"] = classify_environment_checksum(
        row.get("checksum"), repository_checksum
    )
    return result


def build_environment_evidence(
    source: str,
    *,
    status: str,
    identity: Mapping[str, Any] | None = None,
    schema: Mapping[str, Any] | None = None,
    history_rows: Iterable[Mapping[str, Any]] = (),
    live_verification: bool = False,
    required_for_cutover: bool = False,
) -> dict[str, object]:
    """Build a sanitized, machine-readable environment evidence record."""
    safe_identity = {}
    for key in ("environment", "current_database", "schema", "transaction_read_only"):
        if identity and identity.get(key) is not None:
            safe_identity[key] = str(identity[key])
    safe_schema = {}
    if schema:
        for key in ("table", "columns", "exists"):
            if key in schema:
                safe_schema[key] = schema[key]
    rows = [sanitize_environment_history_row(row) for row in history_rows]
    numeric_versions: dict[str, list[str]] = {}
    for row in rows:
        match = re.match(r"^V(\d+)", str(row.get("version", "")), re.IGNORECASE)
        if match:
            numeric_versions.setdefault(str(int(match.group(1))), []).append(str(row["version"]))
    occupied_numbers = sorted((int(value) for value in numeric_versions), key=int)
    occupied_versions = [f"V{number:03d}" for number in occupied_numbers]
    post_cutover = [version for version in occupied_versions if int(version[1:]) > 95]
    highest = f"V{occupied_numbers[-1]:03d}" if occupied_numbers else None
    duplicate_versions = {
        number: values for number, values in numeric_versions.items() if len(values) > 1
    }
    return {
        "source": source,
        "status": status,
        "live_verification": bool(live_verification),
        "required_for_cutover": bool(required_for_cutover),
        "identity": safe_identity,
        "history_schema": safe_schema,
        "history_rows": rows,
        "history_row_count": len(rows),
        "success_false_count": sum(1 for row in rows if row.get("success") is False),
        "occupied_numeric_identities": occupied_versions,
        "duplicate_numeric_versions": duplicate_versions,
        "highest_occupied_version": highest,
        "v095_present": "95" in numeric_versions,
        "v096_present": "96" in numeric_versions,
        "post_v095_versions": post_cutover,
        "sanitized": True,
        "false_pass_protection": status not in {"VERIFIED", "DOCUMENTARY_ONLY"},
    }


QA_ENV_RELATIVE = "backend-reporteria/.env"
QA_REQUIRED_VARS = ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD")
QA_SENSITIVE_VARS = {"DB_PASSWORD", "JWT_SECRET", "API_INTERNAL_TOKEN", "TOKEN", "SECRET"}
QA_IDENTITY_QUERY = """
BEGIN TRANSACTION READ ONLY;
SELECT json_build_object(
  'current_database', current_database(),
  'current_schema', current_schema(),
  'transaction_read_only', current_setting('transaction_read_only'),
  'history_exists', (to_regclass('public.migrations_history') IS NOT NULL),
  'history_columns', COALESCE((
    SELECT json_agg(json_build_object(
      'name', column_name,
      'data_type', data_type,
      'nullable', is_nullable
    ) ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'migrations_history'
  ), '[]'::json)
);
COMMIT;
""".strip()
QA_HISTORY_QUERY = """
BEGIN TRANSACTION READ ONLY;
SELECT COALESCE(json_agg(json_build_object(
  'version', version,
  'checksum', checksum,
  'success', success
) ORDER BY id), '[]'::json)
FROM public.migrations_history;
COMMIT;
""".strip()
def _parse_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name = name.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
            value = value[1:-1]
        values[name] = value
    return values


def load_qa_runtime_config(root: Path, env_path: Path | None = None) -> dict[str, object]:
    """Discover the existing QA env without exposing its values."""
    path = (env_path or (root / QA_ENV_RELATIVE)).resolve()
    expected = (root / QA_ENV_RELATIVE).resolve()
    if path != expected:
        return {"status": "UNVERIFIED", "reason": "QA_CONFIG_PATH_NOT_AUTHORIZED"}
    if not path.is_file():
        return {"status": "UNAVAILABLE", "reason": "QA_CONFIG_MISSING"}
    values = _parse_dotenv(path)
    missing = [name for name in QA_REQUIRED_VARS if not values.get(name)]
    database_name = values.get("DB_NAME", "")
    if missing:
        return {"status": "UNVERIFIED", "reason": "QA_CONFIG_INCOMPLETE", "missing": missing}
    if database_name != "manus_tienda_qa":
        return {"status": "UNVERIFIED", "reason": "SOURCE_IDENTITY_MISMATCH"}
    return {
        "status": "READY",
        "path": QA_ENV_RELATIVE,
        "values": values,
        "sanitized_identity": {
            "database_name": database_name,
            "port": values.get("DB_PORT"),
            "ssl": values.get("DB_SSL", "false"),
        },
        "required_secret_fields": {
            name: ("PRESENT" if bool(values.get(name)) else "MISSING")
            for name in ("DB_PASSWORD", "JWT_SECRET")
        },
    }


def _safe_psql_command(config: Mapping[str, str], psql_command: str | None = None) -> list[str]:
    return [
        psql_command or "psql",
        "-h", config["DB_HOST"], "-p", config["DB_PORT"],
        "-U", config["DB_USER"], "-d", config["DB_NAME"],
        "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1",
    ]


def _attach_environment_findings(root: Path, evidence: dict[str, object], source: str) -> dict[str, object]:
    versions: dict[str, list[str]] = {}
    for row in evidence["history_rows"]:
        version = str(row.get("version", ""))
        match = re.match(r"^V(\d+)", version, re.IGNORECASE)
        if match:
            versions.setdefault(match.group(1), []).append(version)
    evidence["duplicate_numeric_versions"] = {
        version: rows for version, rows in versions.items() if len(rows) > 1
    }
    identity_not_comparable = []
    filename_path_conflicts = []
    for row in evidence["history_rows"]:
        raw_version = row.get("version")
        filename = row.get("filename")
        path = row.get("path")
        if not filename and not path:
            identity_not_comparable.append({"raw_version": raw_version, "reason": "FILENAME_PATH_NOT_AVAILABLE"})
            continue
        if filename and path and normalize_path(str(path)).rsplit("/", 1)[-1] != str(filename).strip():
            filename_path_conflicts.append({
                "type": "PATH_CONFLICT", "raw_version": raw_version,
                "filename": filename, "path": path,
            })
        if filename and raw_version:
            raw_name = str(raw_version).strip().rsplit("/", 1)[-1]
            if raw_name != str(filename).strip():
                filename_path_conflicts.append({
                    "type": "FILENAME_CONFLICT", "raw_version": raw_version,
                    "filename": filename,
                })
    evidence["filename_path_conflicts"] = filename_path_conflicts
    evidence["identity_not_comparable"] = identity_not_comparable
    repo_paths = current_migration_paths(root)
    repo_by_name = {normalize_path(path).rsplit("/", 1)[-1]: root / path for path in repo_paths}
    history_by_name = {
        str(row.get("version", "")).strip().rsplit("/", 1)[-1]: row
        for row in evidence["history_rows"] if row.get("version")
    }
    repo_names = set(repo_by_name)
    history_names = set(history_by_name)
    checksum_matches = []
    checksum_drifts = []
    for name in sorted(repo_names & history_names):
        current = sha256_file(repo_by_name[name])
        history = str(history_by_name[name].get("checksum") or "").strip().lower()
        if re.fullmatch(r"[0-9a-f]{64}", history):
            if current == history:
                checksum_matches.append(name)
            else:
                checksum_drifts.append(name)
    reconciliation_key = f"repository_{source.lower()}_reconciliation"
    evidence[reconciliation_key] = {
        "status": "VERIFIED",
        "identity_basis": "NORMALIZED_BASENAME_DIAGNOSTIC_ONLY",
        "repo_only": sorted(repo_names - history_names),
        "db_only": sorted(history_names - repo_names),
        "repo_only_count": len(repo_names - history_names),
        "db_only_count": len(history_names - repo_names),
        "checksum_match_count": len(checksum_matches),
        "checksum_drift_count": len(checksum_drifts),
        "checksum_drift_paths": checksum_drifts,
        "historical_disposition": "PREEXISTING_HISTORICAL_BASELINE",
        "certification_status": "PARTIAL",
    }
    if source == "QA":
        evidence["repository_qa_reconciliation"] = evidence[reconciliation_key]
    return evidence


def _parse_single_json_output(output: str, expected_prefix: str) -> Any:
    for line in output.splitlines():
        candidate = line.strip()
        if candidate.startswith(expected_prefix):
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                continue
    return None


def qa_read_only_reconcile(
    root: Path,
    *,
    env_path: Path | None = None,
    psql_command: str | None = None,
    executor: Any = None,
) -> dict[str, object]:
    """Reconcile QA with two read-only psql sessions and sanitized output."""
    config_result = load_qa_runtime_config(root, env_path)
    if config_result.get("status") != "READY":
        return {
            "source": "QA",
            "status": config_result.get("status", "UNVERIFIED"),
            "config": {key: value for key, value in config_result.items() if key != "values"},
            "qa_database_access": "NO",
            "qa_query_count": 0,
            "qa_write_count": 0,
            "false_pass_protection": True,
        }
    config = config_result["values"]
    query_count = 0

    def execute(sql: str) -> tuple[int, str]:
        nonlocal query_count
        query_count += 1
        if executor is not None:
            code, output = executor(sql, config)
            return int(code), str(output)
        environment = os.environ.copy()
        environment["PGPASSWORD"] = str(config["DB_PASSWORD"])
        command = _safe_psql_command(config, psql_command) + ["-c", sql]
        completed = subprocess.run(
            command, env=environment, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, text=True, check=False,
        )
        return completed.returncode, completed.stdout

    identity_code, identity_output = execute(QA_IDENTITY_QUERY)
    if identity_code != 0:
        return {
            "source": "QA", "status": "UNVERIFIED",
            "config": config_result["sanitized_identity"],
            "reason": "QA_IDENTITY_QUERY_FAILED",
            "qa_database_access": "READ_ONLY",
            "qa_query_count": query_count, "qa_write_count": 0,
            "false_pass_protection": True,
        }
    identity = _parse_single_json_output(identity_output, "{") or {}
    if identity.get("transaction_read_only") != "on":
        return {
            "source": "QA", "status": "UNVERIFIED",
            "reason": "READ_ONLY_SESSION_NOT_VERIFIED",
            "qa_database_access": "READ_ONLY", "qa_query_count": query_count,
            "qa_write_count": 0, "false_pass_protection": True,
        }
    if identity.get("current_database") != "manus_tienda_qa":
        return {
            "source": "QA", "status": "UNVERIFIED",
            "reason": "SOURCE_IDENTITY_MISMATCH",
            "qa_database_access": "READ_ONLY", "qa_query_count": query_count,
            "qa_write_count": 0, "false_pass_protection": True,
        }
    if not identity.get("history_exists"):
        return {
            "source": "QA", "status": "UNVERIFIED",
            "reason": "MIGRATIONS_HISTORY_MISSING",
            "qa_database_access": "READ_ONLY", "qa_query_count": query_count,
            "qa_write_count": 0, "false_pass_protection": True,
        }
    history_code, history_output = execute(QA_HISTORY_QUERY)
    if history_code != 0:
        return {
            "source": "QA", "status": "UNVERIFIED",
            "reason": "QA_HISTORY_QUERY_FAILED",
            "qa_database_access": "READ_ONLY", "qa_query_count": query_count,
            "qa_write_count": 0, "false_pass_protection": True,
        }
    raw_rows = _parse_single_json_output(history_output, "[") or []
    if not isinstance(raw_rows, list):
        raw_rows = []
    evidence = build_environment_evidence(
        "QA", status="VERIFIED",
        identity={"environment": "qa", "current_database": identity.get("current_database"),
                  "schema": identity.get("current_schema"),
                  "transaction_read_only": identity.get("transaction_read_only")},
        schema={"table": "public.migrations_history", "exists": True,
                "columns": identity.get("history_columns", [])},
        history_rows=raw_rows, live_verification=True, required_for_cutover=True,
    )
    evidence = _attach_environment_findings(root, evidence, "QA")
    evidence["config"] = {
        "source": QA_ENV_RELATIVE,
        "sanitized_identity": config_result["sanitized_identity"],
        "required_secret_fields": config_result["required_secret_fields"],
        "transport_security_status": "CONFIGURED_DB_SSL_FALSE",
    }
    evidence["qa_database_access"] = "READ_ONLY"
    evidence["qa_query_count"] = query_count
    evidence["qa_write_count"] = 0
    return evidence


def prd_read_only_reconcile(
    root: Path,
    *,
    ssh_target: str,
    ssh_port: int,
    ssh_user: str,
    ssh_key_path: str,
    remote_env_path: str,
    expected_hostname: str = "vmi3503021",
    expected_database: str = "emaus_tienda",
    correlation_id: str | None = None,
    executor: Any = None,
) -> dict[str, object]:
    """Consume sanitized PRD evidence from the explicit executor boundary."""
    if not correlation_id:
        return {"source": "PRD_LIVE", "status": "UNVERIFIED",
                "reason": "PRD_OPERATION_CORRELATION_ID_REQUIRED", "prd_query_count": 0,
                "prd_write_count": 0, "false_pass_protection": True}
    request = build_prd_evidence_request(
        correlation_id, expected_host=expected_hostname,
        expected_database=expected_database, expected_schema="public",
    )
    result = execute_prd_evidence_request(request, executor)
    if result.get("status") != "VERIFIED":
        error = result.get("error") if isinstance(result.get("error"), Mapping) else {}
        return {"source": "PRD_LIVE", "status": "UNVERIFIED",
                "reason": error.get("code", "PRD_EXECUTOR_UNVERIFIED"),
                "prd_query_count": 0, "prd_write_count": 0,
                "false_pass_protection": True}
    evidence = result["evidence"]
    identity = evidence["identity"]
    schema = evidence["schema"]
    raw_rows = evidence.get("history_rows", [])
    evidence = build_environment_evidence(
        "PRD_LIVE", status="VERIFIED",
        identity={"environment": "prd", "current_database": identity.get("current_database"),
                  "schema": identity.get("current_schema"),
                  "transaction_read_only": evidence.get("read_only_verified")},
        schema=schema, history_rows=raw_rows,
        live_verification=True, required_for_cutover=True,
    )
    evidence = _attach_environment_findings(root, evidence, "PRD_LIVE")
    evidence["config"] = {
        "source": "PRD_EVIDENCE_EXECUTOR",
        "sanitized_identity": {"database_name": expected_database, "port": "5432", "ssl": "false"},
        "required_secret_fields": {"DB_HOST": "PRESENT", "DB_USER": "PRESENT", "DB_PASSWORD": "PRESENT"},
        "transport_security_status": "CONFIGURED_DB_SSL_FALSE",
    }
    evidence["prd_database_access"] = "READ_ONLY"
    evidence["prd_query_count"] = result["evidence"].get("query_count", 0)
    evidence["prd_write_count"] = result["evidence"].get("write_count", 0)
    evidence["operation_correlation_id"] = correlation_id
    return evidence


def environment_reconciliation_report(
    root: Path, environment_evidence: Mapping[str, Any] | None = None
) -> dict[str, object]:
    """Expose environment findings to the main diagnostic without DB access."""
    if not environment_evidence:
        return {
            "status": "UNVERIFIED",
            "reason": "ENVIRONMENT_EVIDENCE_NOT_PROVIDED",
            "qa": {"status": "UNVERIFIED"},
            "false_pass_protection": True,
        }
    environment = dict(environment_evidence)
    source = str(environment.get("source", "QA"))
    reconciliation = environment.get(
        f"repository_{source.lower()}_reconciliation",
        environment.get("repository_qa_reconciliation", {}),
    )
    source_label = source
    return {
        "status": environment.get("status", "UNVERIFIED"),
        "source": source_label,
        "source_status": environment.get("status", "UNVERIFIED"),
        "repository_qa": reconciliation,
        "repository_reconciliation": reconciliation,
        "identity": environment.get("identity", {}),
        "schema": environment.get("history_schema", {}),
        "history_row_count": environment.get("history_row_count", 0),
        "success_false_count": environment.get("success_false_count", 0),
        "config": environment.get("config", {}),
        "prd_query_count": environment.get("prd_query_count", 0),
        "prd_write_count": environment.get("prd_write_count", 0),
        "qa_query_count": environment.get("qa_query_count", 0),
        "qa_write_count": environment.get("qa_write_count", 0),
        "numeric_duplicates": environment.get("duplicate_numeric_versions", {}),
        "highest_occupied_version": environment.get("highest_occupied_version"),
        "v095_present": environment.get("v095_present", False),
        "v096_present": environment.get("v096_present", False),
        "post_v095_versions": environment.get("post_v095_versions", []),
        "filename_path_conflicts": environment.get("filename_path_conflicts", []),
        "identity_not_comparable": environment.get("identity_not_comparable", []),
        "repo_only": reconciliation.get("repo_only", []),
        "db_only": reconciliation.get("db_only", []),
        "success_failures": [
            {"source": source_label, "version": row.get("version"), "classification": "HISTORICAL_REVIEW_REQUIRED"}
            for row in environment.get("history_rows", [])
            if row.get("success") is False
        ],
        "checksum_drift": [
            {"source": source_label, "path": path, "basis": "NORMALIZED_BASENAME_DIAGNOSTIC_ONLY",
             "classification": "CHECKSUM_DRIFT"}
            for path in reconciliation.get("checksum_drift_paths", [])
        ],
        "historical_classification": reconciliation.get(
            "historical_disposition", "PREEXISTING_HISTORICAL_BASELINE"
        ),
        "history_certification_status": environment.get("history_certification_status", "PARTIAL"),
        "prd_live_verification": source == "PRD_LIVE" and environment.get("live_verification", False),
        "false_pass_protection": environment.get("status") != "VERIFIED" or not environment.get("live_verification", False),
    }


def target_migration_paths(root: Path, target_ref: str) -> tuple[list[str], str]:
    code, output = run(["git", "ls-tree", "-r", "--name-only", target_ref, "--", MIGRATION_ROOT], root)
    if code != 0:
        return [], "TARGET_UNAVAILABLE"
    return [normalize_path(line) for line in output.splitlines() if line.strip()], "VERIFIED"


def current_migration_paths(root: Path) -> list[str]:
    migration_root = root / MIGRATION_ROOT
    if not migration_root.is_dir():
        return []
    return [path.relative_to(root).as_posix() for path in sorted(migration_root.rglob("*.sql"))]


def migration_filename(path: str) -> tuple[str, int | None]:
    name = normalize_path(path).rsplit("/", 1)[-1]
    modern = re.fullmatch(r"V([0-9]+)__([^/]+)\.sql", name, re.IGNORECASE)
    if modern and modern.group(2).strip():
        return "VERSIONED_MIGRATION", int(modern.group(1))
    if LEGACY_RE.fullmatch(name):
        return "LEGACY_MIGRATION", None
    return "INVALID_NEW_MIGRATION_FILENAME", None


def migration_versions(paths: Iterable[str]) -> dict[int, list[str]]:
    versions: dict[int, list[str]] = {}
    for path in paths:
        kind, version = migration_filename(path)
        if kind == "VERSIONED_MIGRATION" and version is not None:
            versions.setdefault(version, []).append(normalize_path(path))
    return versions


def committed_migration_entries(root: Path, target_ref: str) -> list[dict[str, str]]:
    code, output = run(["git", "diff", "--name-status", "--find-renames",
                        f"{target_ref}...HEAD", "--", MIGRATION_ROOT], root)
    if code != 0:
        return []
    entries: list[dict[str, str]] = []
    for line in output.splitlines():
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        status = parts[0]
        if status.startswith(("R", "C")) and len(parts) >= 3:
            entries.append({"status": status[:1], "old_path": normalize_path(parts[1]), "path": normalize_path(parts[2])})
        else:
            entries.append({"status": status[:1], "path": normalize_path(parts[-1])})
    return entries


def migration_validation_report(root: Path, target_ref: str | None = None,
                                changed_entries: list[dict[str, str]] | None = None) -> dict[str, object]:
    target = resolve_target_ref(root, target_ref)
    if target["target_status"] != "VERIFIED":
        return {"migration_validation_status": "UNVERIFIED", "target_ref": target["target_ref"],
                "target_sha": "", "target_status": "UNVERIFIED", "baseline_findings": [],
                "new_regressions": [], "invalid_new_filenames": [], "duplicate_versions": {},
                "target_collisions": [], "next_safe_version": "UNVERIFIED"}
    target_paths, target_status = target_migration_paths(root, str(target["target_ref"]))
    current_paths = current_migration_paths(root)
    entries = changed_entries if changed_entries is not None else git_changed_entries(root) + committed_migration_entries(root, str(target["target_ref"]))
    migration_entries = [entry for entry in entries
                         if normalize_path(entry.get("path", "")).startswith(MIGRATION_ROOT)
                         or normalize_path(entry.get("old_path", "")).startswith(MIGRATION_ROOT)]
    target_versions = migration_versions(target_paths)
    current_versions = migration_versions(current_paths)
    target_duplicates = {str(version): sorted(paths) for version, paths in target_versions.items() if len(paths) > 1}
    current_duplicates = {str(version): sorted(paths) for version, paths in current_versions.items() if len(paths) > 1}
    changed_paths = {normalize_path(entry.get("path", "")) for entry in migration_entries}
    changed_paths.update(normalize_path(entry.get("old_path", "")) for entry in migration_entries if entry.get("old_path"))
    invalid_new: list[str] = []
    for entry in migration_entries:
        path = normalize_path(entry.get("path", ""))
        if entry.get("status") == "D" or path not in current_paths:
            continue
        kind, _ = migration_filename(path)
        if kind == "INVALID_NEW_MIGRATION_FILENAME":
            invalid_new.append(path)
    target_collisions: list[dict[str, object]] = []
    for entry in migration_entries:
        path = normalize_path(entry.get("path", ""))
        if entry.get("status") == "D" or path not in current_paths:
            continue
        kind, version = migration_filename(path)
        if kind != "VERSIONED_MIGRATION" or version is None:
            continue
        competing = [candidate for candidate in target_versions.get(version, []) if candidate != path]
        rename_preserves_version = bool(entry.get("old_path")) and set(competing) == {normalize_path(entry["old_path"])}
        if competing and not rename_preserves_version:
            target_collisions.append({"version": version, "feature_path": path, "target_paths": competing})
    new_regressions: list[dict[str, object]] = []
    for version, paths in current_versions.items():
        target_count = len(target_versions.get(version, []))
        changed_in_group = sorted(set(paths) & changed_paths)
        if len(paths) > 1 and len(paths) > target_count and changed_in_group:
            new_regressions.append({"type": "DUPLICATE_VERSION", "version": version,
                                    "paths": sorted(paths), "changed_paths": changed_in_group})
    for collision in target_collisions:
        new_regressions.append({"type": "TARGET_COLLISION", **collision})
    for path in invalid_new:
        new_regressions.append({"type": "INVALID_NEW_MIGRATION_FILENAME", "path": path})
    baseline_findings = [{"type": "PREEXISTING_DUPLICATE_VERSION", "version": int(version), "paths": paths}
                         for version, paths in target_duplicates.items()]
    if new_regressions:
        status = "NEW_REGRESSION"
    elif target_duplicates:
        status = "PREEXISTING_BASELINE"
    else:
        status = "CLEAN"
    return {"migration_validation_status": status, "target_ref": target["target_ref"],
            "target_sha": target["target_sha"], "target_status": target_status,
            "baseline_findings": baseline_findings, "new_regressions": new_regressions,
            "invalid_new_filenames": invalid_new, "duplicate_versions": current_duplicates,
            "target_collisions": target_collisions, "concurrent_branch_behavior": "TARGET_REVALIDATION",
            "reservation_or_serialization": "DEFERRED_UNTIL_MEASURED",
            "next_safe_version": "UNVERIFIED"}


def change_exists(root: Path, change_id: str) -> bool:
    return (root / "openspec" / "changes" / change_id / ".openspec.yaml").is_file()


def evaluate_coverage(root: Path, changed_paths: Iterable[str], manifest: dict[str, object] | None,
                      manifest_errors: list[str], validation: dict[str, object],
                      validate_changes: bool = True) -> dict[str, object]:
    entries = [entry for entry in (manifest or {}).get("changes", []) if isinstance(entry, dict)]
    results: list[dict[str, object]] = []
    invalid: list[str] = []
    ambiguous: list[str] = []
    uncovered: list[str] = []
    for raw_path in changed_paths:
        path = normalize_path(raw_path)
        classification = classify_changed_file(path)
        matches = [entry for entry in entries if any(path_matches(pattern, path) for pattern in entry.get("paths", []))]
        matching_ids = [entry.get("change_id") for entry in matches]
        exemptions = [exemption for entry in entries for exemption in entry.get("exemptions", [])
                      if isinstance(exemption, dict) and path_matches(exemption.get("path", ""), path)]
        if exemptions and classification == "TECHNICAL_REQUIRES_OPENSPEC":
            status = "INVALID_EXEMPTION"
            invalid.append(path)
        elif len(matches) > 1:
            status = "MULTIPLE_MATCH"
            ambiguous.append(path)
        elif len(matches) == 0 and classification == "TECHNICAL_REQUIRES_OPENSPEC":
            status = "ZERO_MATCH"
            uncovered.append(path)
        elif len(matches) == 1:
            entry = matches[0]
            change_id = entry.get("change_id")
            usable = isinstance(change_id, str) and change_exists(root, change_id)
            if validate_changes:
                validations = validation.get("validations")
                candidate = validations.get(change_id) if isinstance(validations, dict) else validation
                usable = usable and isinstance(candidate, dict) and candidate.get("change_strict_pass") is True
            archived_usable = any(
                archived_path.is_dir()
                for matched_id in matching_ids
                for archived_path in (root / "openspec" / "changes" / "archive").glob(
                    f"*-{matched_id}"
                )
            )
            status = "VALID_EXEMPTION" if exemptions else (
                "SINGLE_MATCH" if usable or archived_usable else "INVALID_CHANGE"
            )
            if status == "INVALID_CHANGE":
                invalid.append(path)
        elif classification == "ARCHIVED_OPENSPEC_ARTIFACT":
            status = "ARCHIVED_CHANGE"
        else:
            status = "REVIEW_REQUIRED"
            invalid.append(path)
        results.append({"path": path, "classification": classification,
                        "matched_change_ids": matching_ids, "coverage_status": status})
    return {"manifest_valid": not manifest_errors, "manifest_errors": manifest_errors,
            "files": results, "invalid_files": invalid, "ambiguous_files": ambiguous,
            "uncovered_files": uncovered, "diagnostic_only": True}


def git_boundary(root: Path, allowed_roots: Iterable[str]) -> dict[str, object]:
    status_code, status_output = run(["git", "status", "--short"], root)
    check_code, check_output = run(["git", "diff", "--check"], root)
    allowed = [normalize_path(item) for item in allowed_roots]
    paths = git_changed_paths(root)
    outside = [path for path in paths if not any(path == item or path.startswith(item + "/") for item in allowed)]
    return {"status_exit": status_code, "diff_check_exit": check_code,
            "diff_check_output": check_output.strip(), "status_output": status_output.strip(),
            "changed_paths": paths, "allowed_roots": allowed,
            "outside_allowed_roots": outside, "diagnostic_only": True}


def migration_classification(root: Path) -> dict[str, object]:
    migration_root = root / "scripts" / "database" / "migrations"
    entries = [{"path": path.relative_to(root).as_posix(),
                "classification": classify_sql_path(path.relative_to(root).as_posix())}
               for path in sorted(migration_root.rglob("*")) if path.is_file()]
    return {"canonical_path": "scripts/database/migrations/", "modern_filename": "V###__description.sql",
            "legacy_filename": "YYYYMMDD_description.sql or YYYY_MM_DD_description.sql",
            "classes": ["VERSIONED_MIGRATION", "LEGACY_MIGRATION", "SEED", "FIXTURE", "BACKFILL", "REPAIR", "ROLLBACK", "READ_ONLY", "UNCLASSIFIED"],
            "database_access": False, "next_safe_version": "UNVERIFIED", "files": entries}


GOVERNANCE_MODES = ("DIAGNOSTIC_ONLY", "WARNING", "STRICT")
STRICT_EXIT_PASS = 0
STRICT_EXIT_REJECTED = 2
STRICT_EXIT_TECHNICAL_FAILURE = 1


def resolve_enforcement_mode(
    requested: str | None = None,
    authoritative_state: Mapping[str, object] | None = None,
    *,
    rollback_authorized: bool = False,
) -> dict[str, object]:
    value = (requested if requested is not None else os.environ.get("MANUS_GOVERNANCE_MODE"))
    if value is not None:
        value = value.strip().upper()
    if authoritative_state is None:
        baseline, errors = load_baseline_manifest(Path(__file__).parents[2])
        authoritative_state = baseline.get("enforcement_state") if baseline else None
        if errors:
            return {"mode": "DIAGNOSTIC_ONLY", "status": "TECHNICAL_FAILURE",
                    "reason": "INVALID_AUTHORITATIVE_ENFORCEMENT_STATE",
                    "errors": errors, "warning_mode_active": False,
                    "strict_mode_active": False}
    resolved, errors = evaluate_enforcement_state(
        authoritative_state, value, rollback_authorized=rollback_authorized
    )
    if errors or resolved is None:
        return {"mode": "DIAGNOSTIC_ONLY", "status": "TECHNICAL_FAILURE",
                "reason": "INVALID_AUTHORITATIVE_ENFORCEMENT_STATE",
                "errors": errors, "warning_mode_active": False,
                "strict_mode_active": False}
    return {"status": "READY", "strict_mode_active": resolved["strict_active"], **resolved}


def repository_strict_gate(report: Mapping[str, Any], requested_mode: str | None = None) -> dict[str, object]:
    """Evaluate deterministic repository/target findings without environment access."""
    mode = resolve_enforcement_mode(
        requested_mode, report.get("enforcement_state")
        if isinstance(report.get("enforcement_state"), Mapping) else None
    )
    result: dict[str, object] = {
        "mode": mode["mode"],
        "status": "DIAGNOSTIC_ONLY" if mode["mode"] == "DIAGNOSTIC_ONLY" else (
            "WARNING_ACTIVE" if mode["mode"] == "WARNING" else "PASS"
        ),
        "decision": "NOT_EVALUATED" if mode["mode"] != "STRICT" else "STRICT_PASS",
        "reasons": [], "blocking_findings": [], "non_blocking_findings": [],
        "exit_code": STRICT_EXIT_PASS,
        "environment_evidence_enforced": False,
        "promotion_policy_bypass_allowed": False,
        "historical_sql_replay_allowed": False,
        "runtime_enforcement_active": False,
        "rollback_modes": ["WARNING", "DIAGNOSTIC_ONLY"],
    }
    if mode.get("status") == "TECHNICAL_FAILURE":
        result.update(status="TECHNICAL_FAILURE", decision="TECHNICAL_FAILURE",
                      reasons=[str(mode.get("reason"))],
                      exit_code=STRICT_EXIT_TECHNICAL_FAILURE)
        return result
    if mode["mode"] != "STRICT":
        result["reasons"] = ["STRICT_MODE_NOT_ACTIVE"]
        return result

    blocking: list[dict[str, str]] = []
    non_blocking: list[dict[str, str]] = []

    def add_block(code: str, detail: object = "") -> None:
        blocking.append({"code": code, "detail": str(detail)})

    def add_non_block(code: str, detail: object = "") -> None:
        non_blocking.append({"code": code, "detail": str(detail)})

    openspec = report.get("openspec", {})
    if isinstance(openspec, Mapping):
        if openspec.get("cli_available") is False:
            add_block("OPENSPEC_TOOL_UNAVAILABLE")
        elif openspec.get("change_strict_pass") is False:
            add_block("OPENSPEC_STRICT_VALIDATION_FAILED", openspec.get("change_id", ""))
        for failure in openspec.get("global_new_failures", []) or []:
            add_block("OPENSPEC_GLOBAL_VALIDATION_FAILED", failure)
        for failure in openspec.get("global_preexisting_failures", []) or []:
            add_non_block("OPENSPEC_GLOBAL_PREEXISTING_FAILURE", failure)

    coverage = report.get("coverage", {})
    if isinstance(coverage, Mapping):
        if coverage.get("manifest_valid") is False:
            add_block("OPENSPEC_SCOPE_MANIFEST_INVALID", coverage.get("manifest_errors", []))
        for field, code in (("invalid_files", "INVALID_OPENSPEC_ASSOCIATION"),
                            ("ambiguous_files", "AMBIGUOUS_OPENSPEC_COVERAGE"),
                            ("uncovered_files", "UNCOVERED_TECHNICAL_FILE")):
            for item in coverage.get(field, []) or []:
                add_block(code, item)

    migration = report.get("migration_validation", {})
    if isinstance(migration, Mapping):
        if migration.get("target_status") == "UNVERIFIED":
            add_block("TARGET_SOURCE_UNVERIFIED")
        for finding in migration.get("new_regressions", []) or []:
            finding_type = str(finding.get("type", "REPOSITORY_POLICY_VIOLATION")) if isinstance(finding, Mapping) else "REPOSITORY_POLICY_VIOLATION"
            add_block(finding_type, finding)
        for finding in migration.get("baseline_findings", []) or []:
            add_non_block("PREEXISTING_HISTORICAL_BASELINE", finding)

    for finding in report.get("repository_policy_findings", []) or []:
        if not isinstance(finding, Mapping):
            add_block("REPOSITORY_POLICY_VIOLATION", finding)
            continue
        classification = str(finding.get("classification", "NEW_REPOSITORY_VIOLATION"))
        if classification == "PREEXISTING_HISTORICAL_BASELINE":
            add_non_block("PREEXISTING_HISTORICAL_BASELINE", finding)
        else:
            add_block(str(finding.get("code", "REPOSITORY_POLICY_VIOLATION")), finding.get("detail", finding))

    environment_sources = (report.get("sources", {}) or {}).get("authorized_environments", {})
    for name, source in environment_sources.items() if isinstance(environment_sources, Mapping) else []:
        if isinstance(source, Mapping) and source.get("status") in {"UNVERIFIED", "BLOCKED"}:
            add_non_block("ENVIRONMENT_EVIDENCE_NOT_ENFORCED", name)

    result["blocking_findings"] = blocking
    result["non_blocking_findings"] = non_blocking
    result["reasons"] = [item["code"] for item in blocking] + [item["code"] for item in non_blocking]
    if blocking:
        result.update(status="STRICT_REJECTED", decision="STRICT_REJECTED",
                      exit_code=STRICT_EXIT_REJECTED)
    return result


def warning_mode_contract(report: Mapping[str, Any], requested_mode: str | None = None) -> dict[str, object]:
    mode = resolve_enforcement_mode(
        requested_mode, report.get("enforcement_state")
        if isinstance(report.get("enforcement_state"), Mapping) else None
    )
    violations: list[dict[str, str]] = []
    coverage = report.get("coverage", {})
    for field, code in (("invalid_files", "INVALID_GOVERNANCE_FILE"),
                        ("ambiguous_files", "AMBIGUOUS_OPENSPEC_COVERAGE"),
                        ("uncovered_files", "UNCOVERED_TECHNICAL_FILE")):
        for item in coverage.get(field, []) or []:
            violations.append({"code": code, "detail": str(item)})
    promotion = report.get("promotion_policy", {})
    if promotion.get("decision") not in (None, "PROMOTION_ALLOWED", "PRD_READ_ONLY_RECONCILIATION_ALLOWED"):
        for reason in promotion.get("reasons", []) or []:
            violations.append({"code": str(reason), "detail": "promotion_policy"})
    sources = report.get("sources", {})
    for name, source in (sources.get("authorized_environments", {}) or {}).items():
        if source.get("status") in {"UNVERIFIED", "BLOCKED"}:
            violations.append({"code": "SOURCE_" + str(source.get("status")), "detail": str(name)})
    technical_failure = mode.get("status") == "TECHNICAL_FAILURE"
    if technical_failure:
        violations.append({"code": str(mode.get("reason")), "detail": "governance_mode"})
    warning_status = "TECHNICAL_FAILURE" if technical_failure else ("WARNINGS_PRESENT" if violations else "NO_WARNINGS")
    return {
        "mode": mode["mode"],
        "status": warning_status,
        "warning_mode_active": bool(mode["warning_mode_active"]),
        "owner_visible_reporting_channel": ["human_console", "machine_readable_diagnostic"],
        "violations": violations,
        "warning_blocks_development": False,
        "technical_failures_preserved": technical_failure,
        "promotion_policy_bypass_allowed": False,
        "historical_sql_replay_allowed": False,
        "historical_sql_reexecuted": False,
        "strict_mode_active": bool(mode.get("strict_mode_active", False)),
        "runtime_enforcement_active": False,
        "rollback_mode": "DIAGNOSTIC_ONLY",
    }


def render_warning_console(report: Mapping[str, Any]) -> str:
    warning = report.get("warning_mode", {})
    lines = [
        f"MANUS GOVERNANCE MODE={warning.get('mode', 'DIAGNOSTIC_ONLY')}",
        f"WARNING_STATUS={warning.get('status', 'UNVERIFIED')}",
    ]
    for violation in warning.get("violations", []) or []:
        lines.append(f"GOVERNANCE_WARNING code={violation.get('code')} detail={violation.get('detail')}")
    enforcement = report.get("enforcement", {})
    if enforcement:
        lines.append(f"REPOSITORY_GATE_STATUS={enforcement.get('status')}")
        for finding in enforcement.get("blocking_findings", []) or []:
            lines.append(f"GOVERNANCE_BLOCK code={finding.get('code')} detail={finding.get('detail')}")
    return "\n".join(lines)


def diagnostic_report(root: Path, change_id: str = CHANGE_ID, changed_paths: Iterable[str] | None = None,
                      cli_override: str | None = None, validate_changes: bool = True,
                      target_ref: str | None = None,
                      environment_evidence: Mapping[str, Any] | None = None,
                      enforcement_mode: str | None = None) -> dict[str, object]:
    manifest, manifest_errors = load_manifest(root)
    validation = validate_openspec(root, change_id, cli_override)
    validations: dict[str, dict[str, object]] = {change_id: validation}
    for entry in (manifest or {}).get("changes", []):
        if isinstance(entry, dict) and isinstance(entry.get("change_id"), str) and entry["change_id"] not in validations:
            validations[entry["change_id"]] = validate_openspec(root, entry["change_id"], cli_override)
    paths = list(changed_paths) if changed_paths is not None else git_changed_paths(root)
    coverage = evaluate_coverage(root, paths, manifest, manifest_errors, {"validations": validations}, validate_changes)
    policy_status = "DIAGNOSTIC_FINDINGS" if coverage["invalid_files"] or coverage["ambiguous_files"] or coverage["uncovered_files"] else "COVERAGE_VISIBLE"
    baseline, baseline_errors = load_baseline_manifest(root)
    cutover_boundary = baseline.get("cutover_boundary") if baseline else None
    required_environments = tuple(
        cutover_boundary.get("required_environments", ("LOCAL", "QA", "PRD"))
        if isinstance(cutover_boundary, dict)
        else ("LOCAL", "QA", "PRD")
    )
    boundary_state, boundary_state_errors = evaluate_cutover_state(cutover_boundary)
    boundary_approved = bool(boundary_state and boundary_state.get("approved") is True)
    boundary_activated = bool(boundary_state and boundary_state.get("activated") is True)
    cutover = cutover_evaluation(
        repository_verified=boundary_approved,
        target_verified=boundary_approved,
        qa_verified=boundary_approved,
        prd_verified=boundary_approved,
        runner_policy_verified=boundary_approved,
        gate_policy_verified=boundary_approved,
        drift_disposition_approved=boundary_approved,
        explicit_approval=boundary_approved,
        boundary_defined=isinstance(cutover_boundary, dict),
        activated=boundary_activated,
        required_environments=required_environments,
    )
    if isinstance(cutover_boundary, dict):
        cutover["boundary_version"] = cutover_boundary.get("version")
        cutover["boundary_status"] = cutover_boundary.get("status")
        cutover["cutover_state"] = (
            boundary_state.get("state") if boundary_state else "NOT_APPROVED"
        )
        cutover["post_cutover_strict_status"] = cutover["cutover_state"]
        cutover["local_cutover_requirement"] = (
            cutover_boundary.get("local", {}).get("cutover_requirement")
            if isinstance(cutover_boundary.get("local"), dict)
            else "UNVERIFIED"
        )
        cutover["historical_disposition"] = cutover_boundary.get("historical_disposition")
    sources = source_status_report(root, target_ref)
    environment_sources = sources.get("authorized_environments", {})
    prd_live_status = (
        environment_evidence.get("status")
        if environment_evidence and environment_evidence.get("source") == "PRD_LIVE"
        else environment_sources.get("PRD_SNAPSHOT", {}).get("status", "UNVERIFIED")
    )
    promotion = promotion_evaluation(
        target_stage="PRD",
        local_status=environment_sources.get("LOCAL", {}).get("status", "UNVERIFIED"),
        qa_status=environment_sources.get("QA", {}).get("status", "UNVERIFIED"),
        prd_status=prd_live_status,
        completed_stages=("LOCAL", "QA"),
        local_required=True,
        qa_approved=False,
        explicit_prd_authorization=False,
        operation="PRD_MIGRATION_PROMOTION",
        enforcement_active=False,
    )
    report = {"mode": "DIAGNOSTIC_ONLY", "database_access": False,
            "historical_sql_reexecuted": False, "open_spec_policy_status": policy_status,
            "openspec": validation, "coverage": coverage,
            "git": git_boundary(root, ["AGENTS.md", "scripts/governance", f"openspec/changes/{change_id}" ]),
            "migration_classification": migration_classification(root),
            "migration_validation": migration_validation_report(root, target_ref),
            "sources": sources,
            "promotion_policy": promotion,
            "environment_reconciliation": environment_reconciliation_report(root, environment_evidence),
            "historical_baseline_status": baseline.get("execution_status") if baseline else "UNVERIFIED",
            "history_certification_status": baseline.get("history_certification_status") if baseline else "UNVERIFIED",
            "enforcement_state": baseline.get("enforcement_state") if baseline else None,
            "baseline_manifest_errors": [*baseline_errors, *boundary_state_errors],
            "cutover": cutover,
            "replay_protection_status": "HISTORICAL_REPLAY_PROHIBITED",
            "next_safe_version": "UNVERIFIED"}
    report["warning_mode"] = warning_mode_contract(report, enforcement_mode)
    report["enforcement"] = repository_strict_gate(report, enforcement_mode)
    report["mode"] = report["warning_mode"]["mode"]
    report["warning_mode_active"] = report["warning_mode"]["warning_mode_active"]
    return report


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Manus OpenSpec diagnostic-only governance report")
    parser.add_argument("--root", default=".")
    parser.add_argument("--change", default=CHANGE_ID)
    parser.add_argument("--changed-file", action="append", default=None)
    parser.add_argument("--openspec-command", default=None)
    parser.add_argument("--target-ref", default=None)
    parser.add_argument("--qa-read-only", action="store_true")
    parser.add_argument("--prd-read-only", action="store_true")
    parser.add_argument("--prd-ssh-target", default=None)
    parser.add_argument("--prd-ssh-port", type=int, default=2798)
    parser.add_argument("--prd-ssh-user", default=None)
    parser.add_argument("--prd-ssh-key", default=None)
    parser.add_argument("--prd-remote-env", default=None)
    parser.add_argument("--enforcement-mode", default=None,
                        choices=("DIAGNOSTIC_ONLY", "WARNING", "STRICT"))
    args = parser.parse_args()
    if args.qa_read_only:
        root = Path(args.root).resolve()
        qa_evidence = qa_read_only_reconcile(root)
        report = diagnostic_report(root, environment_evidence=qa_evidence,
                                   enforcement_mode=args.enforcement_mode)
        print(render_warning_console(report), file=sys.stderr)
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return int(report["enforcement"]["exit_code"])
    if args.prd_read_only:
        root = Path(args.root).resolve()
        prd_evidence = prd_read_only_reconcile(
            root, ssh_target=args.prd_ssh_target, ssh_port=args.prd_ssh_port,
            ssh_user=args.prd_ssh_user, ssh_key_path=args.prd_ssh_key,
            remote_env_path=args.prd_remote_env,
        )
        report = diagnostic_report(root, environment_evidence=prd_evidence,
                                   enforcement_mode=args.enforcement_mode)
        print(render_warning_console(report), file=sys.stderr)
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return int(report["enforcement"]["exit_code"])
    report = diagnostic_report(Path(args.root).resolve(), args.change, args.changed_file, args.openspec_command,
                               target_ref=args.target_ref, enforcement_mode=args.enforcement_mode)
    print(render_warning_console(report), file=sys.stderr)
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return int(report["enforcement"]["exit_code"])


if __name__ == "__main__":
    raise SystemExit(main())
