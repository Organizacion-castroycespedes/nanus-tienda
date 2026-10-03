import json
import hashlib
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from openspec_governance_diagnostic import (
    classify_change,
    classify_sql_path,
    diagnostic_report,
    evaluate_coverage,
    load_manifest,
    migration_validation_report,
    parse_git_status_records,
    path_matches,
    resolve_openspec_command,
    source_status_report,
    build_environment_evidence,
    classify_environment_checksum,
    load_qa_runtime_config,
    qa_read_only_reconcile,
    prd_read_only_reconcile,
    render_warning_console,
    warning_mode_contract,
    repository_strict_gate,
    sanitize_environment_history_row,
    validate_openspec,
)
from migration_runner_policy import (
    OFFICIAL_RUNNER,
    classify_runner,
    failure_contract,
    simulated_execution,
    classify_history_checksum,
    cutover_evaluation,
    evaluate_cutover_state,
    evaluate_enforcement_state,
    promotion_evaluation,
    evaluate_migration_era,
    environment_gate_evaluation,
    combined_environment_gate_evaluation,
    next_safe_version_evaluation,
    load_baseline_manifest,
    sha256_bytes,
    sha256_file,
    validate_checksum_value,
    validate_versioned_request,
)


class GovernanceDiagnosticTests(unittest.TestCase):
    @staticmethod
    def _next_sources(*, qa=(), prd=(), repository=(), target=()):
        return {
            "Repository": {"status": "VERIFIED", "occupied_numeric_identities": list(repository)},
            "Target": {"status": "VERIFIED", "occupied_numeric_identities": list(target)},
            "QA": {"status": "VERIFIED", "evidence_type": "LIVE", "same_operation": True,
                   "occupied_numeric_identities": list(qa)},
            "PRD": {"status": "VERIFIED", "evidence_type": "LIVE", "same_operation": True,
                    "occupied_numeric_identities": list(prd)},
        }

    def test_next_version_empty_verified_union_returns_synthetic_v096(self):
        result = next_safe_version_evaluation(
            cutover_boundary_version="V095", cutover_approved=True,
            required_sources=self._next_sources(),
        )
        self.assertEqual(result["status"], "VERIFIED")
        self.assertEqual(result["candidate"], "V096")
        self.assertTrue(result["candidate_is_proposal"])
        self.assertFalse(result["candidate_is_reservation"])
        self.assertFalse(result["promotion_authorized"])
        self.assertFalse(result["migration_execution_authorized"])

    def test_next_version_uses_authoritative_union_and_skips_sparse_identities(self):
        result = next_safe_version_evaluation(
            cutover_boundary_version="V095", cutover_approved=True,
            required_sources=self._next_sources(qa=("V096",), prd=("V098",)),
        )
        self.assertEqual(result["candidate"], "V097")
        self.assertIn("V096", result["occupied_union"])
        self.assertIn("V098", result["occupied_union"])

    def test_next_version_counts_db_only_identity_as_occupied(self):
        sources = self._next_sources()
        sources["QA"]["occupied_numeric_identities"] = ["V096"]
        sources["QA"]["db_only_identities"] = ["V096"]
        result = next_safe_version_evaluation(
            cutover_boundary_version="V095", cutover_approved=True,
            required_sources=sources,
        )
        self.assertEqual(result["candidate"], "V097")

    def test_next_version_requires_verified_same_operation_sources(self):
        sources = self._next_sources()
        sources["PRD"]["same_operation"] = False
        result = next_safe_version_evaluation(
            cutover_boundary_version="V095", cutover_approved=True,
            required_sources=sources,
        )
        self.assertEqual(result["status"], "UNVERIFIED")
        self.assertIn("PRD_SAME_OPERATION_EVIDENCE_REQUIRED", result["reasons"])

    def test_next_version_stale_evidence_and_missing_required_source_never_pass(self):
        sources = self._next_sources()
        sources["QA"]["freshness_status"] = "STALE"
        stale = next_safe_version_evaluation(
            cutover_boundary_version="V095", cutover_approved=True,
            required_sources=sources,
        )
        self.assertEqual(stale["status"], "UNVERIFIED")
        self.assertIn("QA_EVIDENCE_FRESHNESS_UNVERIFIED", stale["reasons"])
        missing_target = dict(sources)
        missing_target.pop("Target")
        invalid = next_safe_version_evaluation(
            cutover_boundary_version="V095", cutover_approved=True,
            required_sources=missing_target,
        )
        self.assertEqual(invalid["status"], "BLOCKED")
        self.assertIn("AUTHORITATIVE_SOURCE_SET_INVALID", invalid["reasons"])

    def test_next_version_requires_target_revalidation_and_cutover(self):
        pending = next_safe_version_evaluation(
            cutover_boundary_version="V095", cutover_approved=True,
            required_sources=self._next_sources(), target_revalidated=False,
        )
        self.assertEqual(pending["status"], "UNVERIFIED")
        self.assertIn("TARGET_REVALIDATION_REQUIRED", pending["reasons"])
        blocked = next_safe_version_evaluation(
            cutover_boundary_version="V095", cutover_approved=False,
            required_sources=self._next_sources(),
        )
        self.assertEqual(blocked["status"], "BLOCKED")
        self.assertIsNone(blocked["candidate"])

    def test_next_version_repository_rejection_dominates(self):
        result = next_safe_version_evaluation(
            cutover_boundary_version="V095", cutover_approved=True,
            required_sources=self._next_sources(), repository_status="STRICT_REJECTED",
        )
        self.assertEqual(result["status"], "BLOCKED")
        self.assertIn("REPOSITORY_GATE_REJECTED", result["reasons"])

    def test_next_version_historical_duplicates_do_not_force_replay(self):
        result = next_safe_version_evaluation(
            cutover_boundary_version="V095", cutover_approved=True,
            required_sources=self._next_sources(repository=("V077", "V095", "V095")),
        )
        self.assertEqual(result["candidate"], "V096")
        self.assertFalse(result["version_reservation_created"])
        self.assertFalse(result["migration_execution_authorized"])

    def test_next_version_is_deterministic_independent_of_source_order(self):
        first = self._next_sources(qa=("V096",), prd=("V098",))
        second = {name: first[name] for name in ("PRD", "QA", "Target", "Repository")}
        first_result = next_safe_version_evaluation(
            cutover_boundary_version="V095", cutover_approved=True,
            required_sources=first,
        )
        second_result = next_safe_version_evaluation(
            cutover_boundary_version="V095", cutover_approved=True,
            required_sources=second,
        )
        self.assertEqual(first_result, second_result)
    def test_warning_mode_reports_without_blocking_and_is_owner_visible(self):
        report = {"coverage": {"uncovered_files": ["scripts/example.py"]},
                  "promotion_policy": {"decision": "PROMOTION_UNVERIFIED", "reasons": ["QA_SOURCE_UNVERIFIED"]},
                  "sources": {"authorized_environments": {}},
                  "enforcement_state": {
                      "mode": "WARNING", "status": "DEFAULT_ACTIVE",
                      "owner_activation": "NOT_GRANTED", "rollback": "NOT_REQUESTED",
                  }}
        warning = warning_mode_contract(report, "WARNING")
        self.assertEqual(warning["mode"], "WARNING")
        self.assertEqual(warning["status"], "WARNINGS_PRESENT")
        self.assertTrue(warning["warning_mode_active"])
        self.assertFalse(warning["warning_blocks_development"])
        self.assertFalse(warning["promotion_policy_bypass_allowed"])
        self.assertIn("GOVERNANCE_WARNING", render_warning_console({"warning_mode": warning}))

    def test_warning_mode_rolls_back_to_diagnostic_only(self):
        report = {"coverage": {}, "promotion_policy": {}, "sources": {},
                  "enforcement_state": {
                      "mode": "WARNING", "status": "DEFAULT_ACTIVE",
                      "owner_activation": "NOT_GRANTED", "rollback": "NOT_REQUESTED",
                  }}
        warning = warning_mode_contract(report, "DIAGNOSTIC_ONLY")
        self.assertEqual(warning["mode"], "DIAGNOSTIC_ONLY")
        self.assertFalse(warning["warning_mode_active"])
        self.assertEqual(warning["rollback_mode"], "DIAGNOSTIC_ONLY")

    def test_warning_mode_preserves_technical_failure_and_strict_is_explicit_only(self):
        report = {"coverage": {}, "promotion_policy": {}, "sources": {}}
        warning = warning_mode_contract(report, "STRICT")
        self.assertEqual(warning["mode"], "STRICT")
        self.assertFalse(warning["warning_mode_active"])
        self.assertTrue(warning["strict_mode_active"])

    def test_strict_clean_repository_passes_with_environment_out_of_scope(self):
        result = repository_strict_gate({
            "openspec": {"cli_available": True, "change_strict_pass": True,
                         "global_new_failures": [], "global_preexisting_failures": []},
            "coverage": {"manifest_valid": True},
            "migration_validation": {"target_status": "VERIFIED", "new_regressions": [],
                                     "baseline_findings": []},
            "sources": {"authorized_environments": {
                "QA": {"status": "UNVERIFIED"}, "PRD": {"status": "UNVERIFIED"}}},
        }, "STRICT")
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(result["decision"], "STRICT_PASS")
        self.assertEqual(result["exit_code"], 0)
        self.assertIn("ENVIRONMENT_EVIDENCE_NOT_ENFORCED", result["reasons"])

    def test_strict_uncovered_technical_file_is_rejected(self):
        result = repository_strict_gate({
            "coverage": {"manifest_valid": True, "uncovered_files": ["api/new.py"]},
            "migration_validation": {"target_status": "VERIFIED", "new_regressions": []},
        }, "STRICT")
        self.assertEqual(result["status"], "STRICT_REJECTED")
        self.assertEqual(result["exit_code"], 2)
        self.assertEqual(result["blocking_findings"][0]["code"], "UNCOVERED_TECHNICAL_FILE")

    def test_strict_historical_finding_is_visible_but_non_blocking(self):
        result = repository_strict_gate({
            "coverage": {"manifest_valid": True},
            "migration_validation": {"target_status": "VERIFIED", "new_regressions": [],
                                     "baseline_findings": [{"version": 95}]},
        }, "STRICT")
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(result["blocking_findings"], [])
        self.assertEqual(result["non_blocking_findings"][0]["code"],
                         "PREEXISTING_HISTORICAL_BASELINE")

    def test_strict_invalid_configuration_has_technical_exit(self):
        result = repository_strict_gate({}, "NOT_A_MODE")
        self.assertEqual(result["status"], "TECHNICAL_FAILURE")
        self.assertEqual(result["exit_code"], 1)

    def test_strict_rolls_back_to_warning_or_diagnostic_without_replay(self):
        warning_state = {
            "mode": "WARNING", "status": "DEFAULT_ACTIVE",
            "owner_activation": "NOT_GRANTED", "rollback": "NOT_REQUESTED",
        }
        for mode in ("WARNING", "DIAGNOSTIC_ONLY"):
            result = repository_strict_gate({"enforcement_state": warning_state}, mode)
            self.assertEqual(result["status"], "WARNING_ACTIVE" if mode == "WARNING" else "DIAGNOSTIC_ONLY")
            self.assertFalse(result["historical_sql_replay_allowed"])

    def test_environment_gate_verified_requires_sanitized_authorized_evidence(self):
        result = environment_gate_evaluation(
            environment="QA",
            expected_database="manus_tienda_qa",
            authorization_required=True,
            authorization_granted=True,
            read_only_required=True,
            evidence={
                "status": "VERIFIED", "evidence_type": "LIVE",
                "identity": {"current_database": "manus_tienda_qa"},
                "schema_status": "VERIFIED", "read_only_verified": True,
            },
        )
        self.assertEqual(result["status"], "VERIFIED")
        self.assertFalse(result["migration_execution_authorized"])

    def test_environment_gate_keeps_qa_approval_separate(self):
        evidence = {"status": "VERIFIED", "evidence_type": "LIVE",
                    "identity": {"current_database": "manus_tienda_qa"},
                    "schema_status": "VERIFIED", "read_only_verified": True}
        result = combined_environment_gate_evaluation(
            repository_result={"status": "PASS"},
            environment_results={"QA": environment_gate_evaluation(
                environment="QA", evidence=evidence, expected_database="manus_tienda_qa")},
            promotion_result={"decision": "PROMOTION_REJECTED",
                              "reasons": ["QA_APPROVAL_REQUIRED_BEFORE_PRD"]},
        )
        self.assertEqual(result["status"], "BLOCKED")
        self.assertIn("QA_APPROVAL_REQUIRED_BEFORE_PRD", result["reasons"])

    def test_prd_snapshot_never_satisfies_live_requirement(self):
        result = environment_gate_evaluation(
            environment="PRD", expected_database="emaus_tienda",
            evidence={"status": "VERIFIED", "evidence_type": "DOCUMENTARY",
                      "identity": {"current_database": "emaus_tienda"},
                      "schema_status": "VERIFIED"},
        )
        self.assertEqual(result["status"], "UNVERIFIED")
        self.assertIn("DOCUMENTARY_EVIDENCE_NOT_LIVE", result["reasons"])

    def test_environment_gate_fail_closed_for_identity_authorization_and_source(self):
        mismatch = environment_gate_evaluation(
            environment="PRD", expected_database="emaus_tienda",
            evidence={"status": "VERIFIED", "evidence_type": "LIVE",
                      "identity": {"current_database": "other"}},
        )
        self.assertEqual(mismatch["status"], "BLOCKED")
        self.assertIn("IDENTITY_MISMATCH", mismatch["reasons"])
        missing_auth = environment_gate_evaluation(
            environment="PRD", authorization_required=True,
            evidence={"status": "VERIFIED", "evidence_type": "LIVE",
                      "identity": {"current_database": "emaus_tienda"},
                      "schema_status": "VERIFIED"},
        )
        self.assertEqual(missing_auth["status"], "BLOCKED")
        unavailable = environment_gate_evaluation(environment="QA")
        self.assertEqual(unavailable["status"], "UNVERIFIED")

    def test_environment_gate_preserves_repository_rejection_and_freshness_gap(self):
        stale = environment_gate_evaluation(
            environment="QA", freshness_status="STALE",
            evidence={"status": "VERIFIED", "evidence_type": "LIVE",
                      "identity": {"current_database": "manus_tienda_qa"},
                      "schema_status": "VERIFIED", "read_only_verified": True},
        )
        self.assertEqual(stale["status"], "UNVERIFIED")
        self.assertIn("EVIDENCE_FRESHNESS_UNVERIFIED", stale["reasons"])
        combined = combined_environment_gate_evaluation(
            repository_result={"status": "STRICT_REJECTED"},
            environment_results={"QA": {"status": "VERIFIED"}},
        )
        self.assertEqual(combined["status"], "BLOCKED")
        self.assertEqual(combined["decision"], "REPOSITORY_GATE_REJECTED")

    def test_v095_local_not_required_remains_verified_without_evidence(self):
        result = environment_gate_evaluation(environment="LOCAL", required=False)
        self.assertEqual(result["status"], "VERIFIED")
        self.assertEqual(result["decision"], "ENVIRONMENT_NOT_REQUIRED")

    def test_combined_valid_evidence_still_does_not_authorize_execution(self):
        qa = environment_gate_evaluation(
            environment="QA", expected_database="manus_tienda_qa",
            evidence={"status": "VERIFIED", "evidence_type": "LIVE",
                      "identity": {"current_database": "manus_tienda_qa"},
                      "schema_status": "VERIFIED", "read_only_verified": True},
        )
        prd = environment_gate_evaluation(
            environment="PRD", expected_database="emaus_tienda",
            authorization_required=True, authorization_granted=True,
            evidence={"status": "VERIFIED", "evidence_type": "LIVE",
                      "identity": {"current_database": "emaus_tienda"},
                      "schema_status": "VERIFIED", "read_only_verified": True},
        )
        result = combined_environment_gate_evaluation(
            repository_result={"status": "PASS"},
            environment_results={"QA": qa, "PRD": prd},
            promotion_result={"decision": "PROMOTION_ALLOWED", "reasons": []},
        )
        self.assertEqual(result["status"], "VERIFIED")
        self.assertFalse(result["migration_execution_authorized"])

    def test_strict_never_bypasses_promotion_policy(self):
        result = repository_strict_gate({
            "coverage": {"manifest_valid": True},
            "migration_validation": {"target_status": "VERIFIED", "new_regressions": []},
            "promotion_policy": {"decision": "PROMOTION_REJECTED",
                                  "reasons": ["QA_APPROVAL_REQUIRED_BEFORE_PRD"]},
        }, "STRICT")
        self.assertEqual(result["status"], "PASS")
        self.assertFalse(result.get("promotion_policy_bypass_allowed", False))

    def test_strict_blocks_new_repository_policy_findings_but_not_history(self):
        result = repository_strict_gate({
            "coverage": {"manifest_valid": True},
            "migration_validation": {"target_status": "VERIFIED", "new_regressions": []},
            "repository_policy_findings": [
                {"code": "UNAUTHORIZED_RUNNER", "classification": "NEW_REPOSITORY_VIOLATION"},
                {"code": "HISTORICAL_CHECKSUM_DRIFT",
                 "classification": "PREEXISTING_HISTORICAL_BASELINE"},
            ],
        }, "STRICT")
        self.assertEqual(result["status"], "STRICT_REJECTED")
        self.assertEqual(result["exit_code"], 2)
        self.assertEqual(result["blocking_findings"][0]["code"], "UNAUTHORIZED_RUNNER")
        self.assertEqual(result["non_blocking_findings"][0]["code"],
                         "PREEXISTING_HISTORICAL_BASELINE")

    def test_warning_mode_never_allows_historical_replay(self):
        report = {"coverage": {}, "promotion_policy": {}, "sources": {}}
        warning = warning_mode_contract(report, "WARNING")
        self.assertFalse(warning["historical_sql_replay_allowed"])
        self.assertFalse(warning["historical_sql_reexecuted"])

    def test_promotion_policy_happy_path_is_diagnostic_only(self):
        result = promotion_evaluation(
            target_stage="PRD", local_status="VERIFIED", qa_status="VERIFIED",
            prd_status="VERIFIED", completed_stages=("LOCAL", "QA"),
            qa_approved=True, explicit_prd_authorization=True,
        )
        self.assertEqual(result["decision"], "PROMOTION_ALLOWED")
        self.assertEqual(result["status"], "ALLOWED_DIAGNOSTIC_ONLY")
        self.assertFalse(result["migration_execution_allowed"])
        self.assertEqual(result["next_safe_version"], "UNVERIFIED")

    def test_promotion_policy_requires_qa_approval_before_prd(self):
        result = promotion_evaluation(
            target_stage="PRD", local_status="VERIFIED", qa_status="VERIFIED",
            prd_status="VERIFIED", completed_stages=("LOCAL", "QA"),
            explicit_prd_authorization=True,
        )
        self.assertEqual(result["decision"], "PROMOTION_REJECTED")
        self.assertIn("QA_APPROVAL_REQUIRED_BEFORE_PRD", result["reasons"])

    def test_promotion_policy_does_not_infer_qa_approval_from_evidence(self):
        result = promotion_evaluation(
            target_stage="PRD", local_status="VERIFIED", qa_status="VERIFIED",
            prd_status="VERIFIED", completed_stages=("LOCAL", "QA"),
            explicit_prd_authorization=True, qa_approved=False,
        )
        self.assertIn("QA_APPROVAL_REQUIRED_BEFORE_PRD", result["reasons"])

    def test_promotion_policy_requires_explicit_prd_authorization(self):
        result = promotion_evaluation(
            target_stage="PRD", local_status="VERIFIED", qa_status="VERIFIED",
            prd_status="VERIFIED", completed_stages=("LOCAL", "QA"),
            qa_approved=True,
        )
        self.assertEqual(result["decision"], "PROMOTION_REJECTED")
        self.assertIn("PRD_EXPLICIT_AUTHORIZATION_REQUIRED", result["reasons"])

    def test_promotion_policy_fails_closed_for_unavailable_source(self):
        result = promotion_evaluation(
            target_stage="PRD", local_status="VERIFIED", qa_status="UNVERIFIED",
            prd_status="VERIFIED", completed_stages=("LOCAL", "QA"),
            qa_approved=True, explicit_prd_authorization=True,
        )
        self.assertEqual(result["status"], "UNVERIFIED")
        self.assertIn("QA_SOURCE_UNVERIFIED", result["reasons"])

    def test_promotion_policy_rejects_out_of_order_transition(self):
        result = promotion_evaluation(
            target_stage="PRD", local_status="VERIFIED", qa_status="VERIFIED",
            prd_status="VERIFIED", completed_stages=("PRD",),
            qa_approved=True, explicit_prd_authorization=True,
        )
        self.assertEqual(result["status"], "BLOCKED")
        self.assertIn("PROMOTION_ORDER_VIOLATION", result["reasons"])

    def test_prd_read_only_reconciliation_is_not_migration_promotion(self):
        result = promotion_evaluation(
            target_stage="PRD", prd_status="VERIFIED",
            operation="PRD_READ_ONLY_RECONCILIATION",
            prd_read_only_authorized=True,
        )
        self.assertEqual(result["decision"], "PRD_READ_ONLY_RECONCILIATION_ALLOWED")
        self.assertFalse(result["migration_execution_allowed"])
        self.assertTrue(result["prd_read_only_reconciliation_separate"])

    def test_v095_local_not_required_can_be_explicit_policy_input(self):
        result = promotion_evaluation(
            target_stage="PRD", local_status="NOT_REQUIRED", qa_status="VERIFIED",
            prd_status="VERIFIED", completed_stages=("QA",), local_required=False,
            qa_approved=True, explicit_prd_authorization=True,
        )
        self.assertEqual(result["decision"], "PROMOTION_ALLOWED")

    def test_qa_config_discovery_is_sanitized_and_requires_qa_database(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            env_path = root / "backend-reporteria" / ".env"
            env_path.parent.mkdir(parents=True)
            env_path.write_text(
                "DB_HOST=qa.example\nDB_PORT=5432\nDB_NAME=manus_tienda_qa\n"
                "DB_USER=qa_user\nDB_PASSWORD=secret\nJWT_SECRET=jwt\n",
                encoding="utf-8",
            )
            result = load_qa_runtime_config(root)
            self.assertEqual(result["status"], "READY")
            self.assertEqual(result["sanitized_identity"]["database_name"], "manus_tienda_qa")
            self.assertEqual(result["required_secret_fields"]["DB_PASSWORD"], "PRESENT")
            self.assertNotIn('"secret"', json.dumps({k: v for k, v in result.items() if k != "values"}))

            env_path.write_text(env_path.read_text(encoding="utf-8").replace(
                "manus_tienda_qa", "manus_tienda_prd"), encoding="utf-8")
            mismatch = load_qa_runtime_config(root)
            self.assertEqual(mismatch["reason"], "SOURCE_IDENTITY_MISMATCH")

    def test_qa_reconciliation_uses_read_only_queries_and_sanitized_evidence(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            env_path = root / "backend-reporteria" / ".env"
            env_path.parent.mkdir(parents=True)
            env_path.write_text(
                "DB_HOST=qa.example\nDB_PORT=5432\nDB_NAME=manus_tienda_qa\n"
                "DB_USER=qa_user\nDB_PASSWORD=secret\n",
                encoding="utf-8",
            )
            calls = []

            def executor(sql, _config):
                calls.append(sql)
                if "history_columns" in sql:
                    return 0, json.dumps({
                        "current_database": "manus_tienda_qa",
                        "current_schema": "public",
                        "transaction_read_only": "on",
                        "history_exists": True,
                        "history_columns": [{"name": "version", "data_type": "text", "nullable": "NO"}],
                    })
                return 0, json.dumps([
                    {"version": "V095", "checksum": "manual-legacy", "success": True},
                    {"version": "V095", "checksum": None, "success": False},
                ])

            report = qa_read_only_reconcile(root, executor=executor)
            self.assertEqual(report["status"], "VERIFIED")
            self.assertEqual(report["identity"]["current_database"], "manus_tienda_qa")
            self.assertEqual(report["history_row_count"], 2)
            self.assertEqual(report["success_false_count"], 1)
            self.assertEqual(report["qa_query_count"], 2)
            self.assertEqual(report["qa_write_count"], 0)
            self.assertTrue(all("READ ONLY" in call for call in calls))
            self.assertNotIn("applied_by", json.dumps(report))
            self.assertNotIn('"secret"', json.dumps(report))
            self.assertIn("095", report["duplicate_numeric_versions"])
            reconciliation = report["repository_qa_reconciliation"]
            self.assertEqual(reconciliation["status"], "VERIFIED")
            self.assertEqual(reconciliation["certification_status"], "PARTIAL")
            self.assertIn("identity_basis", reconciliation)

    def test_qa_reconciliation_missing_config_never_passes(self):
        with tempfile.TemporaryDirectory() as temporary:
            result = qa_read_only_reconcile(Path(temporary))
            self.assertEqual(result["status"], "UNAVAILABLE")
            self.assertTrue(result["false_pass_protection"])
            self.assertEqual(result["qa_query_count"], 0)

    def test_prd_reconciliation_requires_explicit_runtime_inputs(self):
        result = prd_read_only_reconcile(
            Path("."), ssh_target="", ssh_port=2798, ssh_user="ubuntu",
            ssh_key_path="unused", remote_env_path="/opt/emaus/tienda/emaus_reporteria/.env",
        )
        self.assertEqual(result["status"], "UNVERIFIED")
        self.assertTrue(result["false_pass_protection"])
        self.assertEqual(result["prd_query_count"], 0)

    def test_prd_executor_unavailable_fails_closed(self):
        result = prd_read_only_reconcile(
            Path("."), ssh_target="prd.example", ssh_port=2798,
            ssh_user="ubuntu", ssh_key_path="C:/private/key",
            remote_env_path="/opt/emaus/tienda/emaus_reporteria/.env",
            correlation_id="op-001",
        )
        self.assertEqual(result["status"], "UNVERIFIED")
        self.assertEqual(result["reason"], "EXECUTOR_UNAVAILABLE")
        self.assertEqual(result["prd_write_count"], 0)

    def test_prd_reconciliation_mock_success_is_sanitized_and_read_only(self):
        calls = []

        def executor(request):
            calls.append(request)
            return {
                "contract_version": "prd-evidence-v1",
                "operation": "collect_prd_migration_evidence",
                "correlation_id": request["correlation_id"],
                "status": "VERIFIED",
                "evidence": {
                    "evidence_type": "LIVE",
                    "provenance": "EXECUTOR_LIVE_READ_ONLY_EVIDENCE",
                    "same_operation": True,
                    "identity": {"environment": "prd", "hostname": "vmi3503021",
                                  "user": "ubuntu", "current_database": "emaus_tienda",
                                  "current_schema": "public"},
                    "schema": {"table": "public.migrations_history", "exists": True,
                               "columns": ["version", "checksum", "success"]},
                    "read_only_verified": True,
                    "history_rows": [{"version": "V095", "checksum": "manual-legacy", "success": True},
                                     {"version": "V095", "checksum": None, "success": False}],
                    "query_count": 2, "write_count": 0,
                },
            }

        with tempfile.TemporaryDirectory() as temporary:
            report = prd_read_only_reconcile(
                Path(temporary), ssh_target="prd.example", ssh_port=2798,
                ssh_user="ubuntu", ssh_key_path="C:/private/key",
                remote_env_path="/opt/emaus/tienda/emaus_reporteria/.env",
                correlation_id="op-001",
                executor=executor,
            )
        self.assertEqual(report["status"], "VERIFIED")
        self.assertEqual(report["identity"]["current_database"], "emaus_tienda")
        self.assertEqual(report["prd_query_count"], 2)
        self.assertEqual(report["prd_write_count"], 0)
        self.assertEqual(calls[0]["operation"], "collect_prd_migration_evidence")
        self.assertNotIn("sql", calls[0])
        self.assertNotIn("manual-legacy", json.dumps(report["config"]))
        self.assertEqual(report["success_false_count"], 1)
        self.assertEqual(report["highest_occupied_version"], "V095")
        self.assertTrue(report["v095_present"])
        self.assertFalse(report["v096_present"])
        self.assertEqual(report["post_v095_versions"], [])

    def test_prd_identity_mismatch_stops_before_history_query(self):
        calls = []

        def executor(request):
            calls.append(request)
            return {
                "contract_version": "prd-evidence-v1",
                "operation": "collect_prd_migration_evidence",
                "correlation_id": request["correlation_id"],
                "status": "VERIFIED",
                "evidence": {
                    "evidence_type": "LIVE",
                    "provenance": "EXECUTOR_LIVE_READ_ONLY_EVIDENCE",
                    "same_operation": True,
                    "identity": {"hostname": "vmi3503021", "current_database": "wrong_database",
                                  "current_schema": "public"},
                    "schema": {"table": "public.migrations_history", "exists": True},
                    "read_only_verified": True, "history_rows": [],
                    "query_count": 1, "write_count": 0,
                },
            }

        result = prd_read_only_reconcile(
            Path("."), ssh_target="host", ssh_port=2798, ssh_user="ubuntu",
            ssh_key_path="key", remote_env_path="/opt/emaus/tienda/emaus_reporteria/.env",
            correlation_id="op-001",
            executor=executor,
        )
        self.assertEqual(result["reason"], "SOURCE_IDENTITY_MISMATCH")
        self.assertEqual(result["prd_query_count"], 0)
        self.assertEqual(len(calls), 1)

    def test_qa_filename_path_conflict_and_missing_identity_are_explicit(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            env_path = root / "backend-reporteria" / ".env"
            env_path.parent.mkdir(parents=True)
            env_path.write_text(
                "DB_HOST=qa.example\nDB_PORT=5432\nDB_NAME=manus_tienda_qa\n"
                "DB_USER=qa_user\nDB_PASSWORD=secret\n",
                encoding="utf-8",
            )

            def executor(sql, _config):
                if "history_columns" in sql:
                    return 0, json.dumps({
                        "current_database": "manus_tienda_qa", "current_schema": "public",
                        "transaction_read_only": "on", "history_exists": True,
                        "history_columns": [],
                    })
                return 0, json.dumps([
                    {"version": "V001__raw.sql", "filename": "V001__other.sql",
                     "path": "migrations/V001__other.sql", "success": True, "checksum": None},
                    {"version": "V002__raw.sql", "success": True, "checksum": None},
                ])

            report = qa_read_only_reconcile(root, executor=executor)
            self.assertTrue(any(item["type"] == "FILENAME_CONFLICT" for item in report["filename_path_conflicts"]))
            self.assertEqual(report["identity_not_comparable"][0]["reason"], "FILENAME_PATH_NOT_AVAILABLE")

    def test_main_diagnostic_integrates_environment_findings_without_live_access(self):
        root = Path(__file__).parents[2]
        evidence = {
            "status": "VERIFIED", "live_verification": True,
            "history_rows": [{"version": "V095", "success": False}],
            "duplicate_numeric_versions": {"095": ["V095__a.sql", "V095__b.sql"]},
            "filename_path_conflicts": [], "identity_not_comparable": [],
            "repository_qa_reconciliation": {
                "repo_only": ["repo.sql"], "db_only": ["db.sql"],
                "checksum_drift_paths": ["V095__a.sql"],
                "historical_disposition": "PREEXISTING_HISTORICAL_BASELINE",
            },
        }
        report = diagnostic_report(root, changed_paths=[], validate_changes=False,
                                  environment_evidence=evidence)
        reconciliation = report["environment_reconciliation"]
        self.assertEqual(reconciliation["status"], "VERIFIED")
        self.assertEqual(reconciliation["repo_only"], ["repo.sql"])
        self.assertEqual(reconciliation["db_only"], ["db.sql"])
        self.assertEqual(reconciliation["numeric_duplicates"]["095"], ["V095__a.sql", "V095__b.sql"])
        self.assertEqual(reconciliation["success_failures"][0]["classification"], "HISTORICAL_REVIEW_REQUIRED")
        self.assertEqual(reconciliation["checksum_drift"][0]["basis"], "NORMALIZED_BASENAME_DIAGNOSTIC_ONLY")
    def test_environment_evidence_is_sanitized_and_machine_readable(self):
        evidence = build_environment_evidence(
            "QA",
            status="VERIFIED",
            identity={"environment": "qa", "current_database": "manus_tienda_qa", "password": "secret"},
            schema={"table": "public.migrations_history", "columns": ["version", "success", "checksum"]},
            history_rows=[
                {"version": "V095", "filename": "V095__x.sql", "success": True,
                 "checksum": "a" * 64, "applied_by": "private-user", "details": "private"},
                {"version": "V094", "success": False, "checksum": "manual-legacy"},
            ],
            live_verification=True,
            required_for_cutover=True,
        )
        self.assertEqual(evidence["identity"], {"environment": "qa", "current_database": "manus_tienda_qa"})
        self.assertEqual(evidence["history_row_count"], 2)
        self.assertEqual(evidence["success_false_count"], 1)
        self.assertNotIn("applied_by", evidence["history_rows"][0])
        self.assertNotIn("details", evidence["history_rows"][0])
        self.assertNotIn("password", evidence["identity"])
        self.assertTrue(evidence["sanitized"])

    def test_migration_evidence_aggregates_v095_and_post_cutover_versions(self):
        only_v095 = build_environment_evidence(
            "PRD_LIVE", status="VERIFIED", history_rows=[
                {"version": "V095", "success": True, "checksum": "a" * 64},
            ], live_verification=True,
        )
        self.assertEqual(only_v095["history_row_count"], 1)
        self.assertEqual(only_v095["highest_occupied_version"], "V095")
        self.assertTrue(only_v095["v095_present"])
        self.assertFalse(only_v095["v096_present"])
        self.assertEqual(only_v095["post_v095_versions"], [])

        v096 = build_environment_evidence(
            "PRD_LIVE", status="VERIFIED", history_rows=[
                {"version": "V095", "success": True},
                {"version": "V096", "success": True},
            ], live_verification=True,
        )
        self.assertEqual(v096["highest_occupied_version"], "V096")
        self.assertTrue(v096["v096_present"])
        self.assertEqual(v096["post_v095_versions"], ["V096"])

        v097_duplicate = build_environment_evidence(
            "PRD_LIVE", status="VERIFIED", history_rows=[
                {"version": "V095", "success": True},
                {"version": "V097", "success": True},
                {"version": "V097", "success": False},
            ], live_verification=True,
        )
        self.assertEqual(v097_duplicate["highest_occupied_version"], "V097")
        self.assertEqual(v097_duplicate["duplicate_numeric_versions"]["97"], ["V097", "V097"])
        self.assertEqual(v097_duplicate["post_v095_versions"], ["V097"])

    def test_environment_checksum_classes_do_not_false_certify_history(self):
        self.assertEqual(classify_environment_checksum(None), "MISSING")
        self.assertEqual(classify_environment_checksum("manual-x"), "LEGACY_UNVERIFIED")
        self.assertEqual(classify_environment_checksum("bad"), "MALFORMED_UNVERIFIED")
        self.assertEqual(classify_environment_checksum("a" * 64), "SHA256_FORMAT_CANDIDATE")
        self.assertEqual(
            classify_environment_checksum("a" * 64, "a" * 64),
            "VERIFIED_MATCH_CANDIDATE",
        )
        self.assertEqual(
            sanitize_environment_history_row({"version": "V1", "success": False, "checksum": "bundle-x"})[
                "checksum_classification"
            ],
            "LEGACY_UNVERIFIED",
        )
    def test_official_runner_accepts_only_authoritative_versioned_paths(self):
        accepted = validate_versioned_request(
            "scripts/database/migrations/V099__example.sql",
            OFFICIAL_RUNNER,
        )
        self.assertTrue(accepted["accepted"])
        self.assertEqual(accepted["runner_class"], "OFFICIAL_VERSIONED_ATOMIC")

        for path, reason in (
            ("scripts/database/migrations/../V099__example.sql", "PATH_TRAVERSAL"),
            ("scripts/database/products/V099__example.sql", "NON_AUTHORITATIVE_LOCATION"),
            ("scripts/database/migrations/bad.sql", "INVALID_VERSIONED_FILENAME"),
        ):
            result = validate_versioned_request(path, OFFICIAL_RUNNER)
            self.assertFalse(result["accepted"])
            self.assertIn(reason, result["reasons"])

        self.assertFalse(
            validate_versioned_request(
                "scripts/database/migrations/V099__example.sql",
                "scripts/database/migrate_prd.sh",
            )["accepted"]
        )

    def test_non_versioned_runner_classes_and_failure_contract_are_explicit(self):
        self.assertEqual(classify_runner("scripts/database/seed.sh"), "SEED")
        self.assertEqual(
            classify_runner("scripts/database/finance/run_finance_migrations.sh"),
            "FINANCE_LEGACY_NON_VERSIONED",
        )
        contract = failure_contract()
        self.assertEqual(contract["sql_failure"], "ROLLBACK_NO_SUCCESS_HISTORY")
        self.assertEqual(contract["history_failure"], "ROLLBACK_NO_APPLIED_SQL")
        self.assertEqual(contract["success"], "SQL_AND_SUCCESS_HISTORY_COMMIT_TOGETHER")

    def test_execution_failure_model_never_claims_success(self):
        self.assertEqual(simulated_execution(False)["executor_calls"], 0)
        self.assertEqual(simulated_execution(False)["status"], "REJECTED")
        self.assertEqual(simulated_execution(True, dry_run=True)["executor_calls"], 0)
        self.assertEqual(simulated_execution(True, sql_ok=False)["status"], "ROLLED_BACK")
        self.assertFalse(simulated_execution(True, history_ok=False)["history_success"])
        self.assertEqual(simulated_execution(True)["status"], "COMMITTED")

    def test_sha256_uses_exact_file_bytes(self):
        content = b"SELECT 1;\n"
        self.assertEqual(sha256_bytes(content), hashlib.sha256(content).hexdigest())
        self.assertNotEqual(sha256_bytes(content), sha256_bytes(b"SELECT 1;\r\n"))
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "V099__bytes.sql"
            path.write_bytes(content)
            self.assertEqual(sha256_file(path), sha256_bytes(content))
        self.assertTrue(validate_checksum_value("a" * 64))
        self.assertFalse(validate_checksum_value("a" * 63))

    def test_history_checksum_states_never_certify_legacy_evidence(self):
        checksum = sha256_bytes(b"SELECT 1;\n")
        self.assertEqual(
            classify_history_checksum(checksum, checksum)["status"],
            "VERIFIED_MATCH",
        )
        mismatch = classify_history_checksum(checksum, "b" * 64)
        self.assertEqual(mismatch["status"], "CHECKSUM_MISMATCH")
        self.assertTrue(mismatch["immutability_violation"])
        self.assertEqual(
            classify_history_checksum(checksum, None)["status"],
            "HISTORICAL_UNVERIFIED",
        )
        self.assertEqual(
            classify_history_checksum(checksum, checksum, history_success=False)["status"],
            "HISTORICAL_UNVERIFIED",
        )

    def test_official_shell_runner_uses_governed_checksum_and_atomic_history(self):
        runner = Path(__file__).parents[1] / "database" / "apply_single_migration.sh"
        source = runner.read_text(encoding="utf-8")
        self.assertIn("sha256sum", source)
        self.assertIn("--single-transaction", source)
        self.assertIn("migration_checksum", source)
        self.assertIn("CHECKSUM_MISMATCH", source)
        self.assertIn("Existing history checksum is unverified", source)
        self.assertIn("success=false", source)

    def test_baseline_is_legacy_evidence_not_history_certification(self):
        root = Path(__file__).parents[2]
        manifest, errors = load_baseline_manifest(root)
        self.assertEqual(errors, [])
        self.assertEqual(manifest["execution_status"], "EXECUTED_LEGACY_REPORTED")
        self.assertEqual(manifest["history_certification_status"], "PARTIAL")
        self.assertFalse(manifest["owner_statement"]["per_file_certification"])
        self.assertEqual(manifest["cutover_boundary"]["version"], "V095")
        self.assertEqual(manifest["cutover_boundary"]["status"], "ACTIVE")
        self.assertTrue(manifest["cutover_boundary"]["approved"])
        self.assertTrue(manifest["cutover_boundary"]["activated"])
        self.assertEqual(
            manifest["cutover_boundary"]["owner_approval"]["statement"],
            "APRUEBO EL CUTOVER V095",
        )
        self.assertEqual(manifest["cutover_boundary"]["required_environments"], ["QA", "PRD_SNAPSHOT"])
        self.assertEqual(manifest["cutover_boundary"]["local"]["cutover_requirement"], "NOT_REQUIRED")
        self.assertEqual(
            manifest["cutover_boundary"]["historical_disposition"]["repository"],
            "PREEXISTING_HISTORICAL_BASELINE",
        )
        with tempfile.TemporaryDirectory() as temporary:
            temp_root = Path(temporary)
            baseline_path = temp_root / "scripts" / "governance" / "migration-baseline.json"
            baseline_path.parent.mkdir(parents=True)
            baseline_path.write_text(
                json.dumps({"version": 1, "checksum": "fabricated"}),
                encoding="utf-8",
            )
            invalid, invalid_errors = load_baseline_manifest(temp_root)
            self.assertIsNone(invalid)
            self.assertTrue(invalid_errors)

    def test_baseline_replay_is_blocked_before_executor(self):
        result = evaluate_migration_era(is_pre_governance_baseline=True)
        self.assertEqual(result["replay_protection"], "HISTORICAL_REPLAY_PROHIBITED")
        self.assertFalse(result["executor_allowed"])
        post = evaluate_migration_era(
            is_pre_governance_baseline=False,
            requested_era="POST_CUTOVER",
        )
        self.assertEqual(post["replay_protection"], "CUTOVER_NOT_APPROVED")
        self.assertFalse(post["executor_allowed"])
        runner = Path(__file__).parents[1] / "database" / "apply_single_migration.sh"
        source = runner.read_text(encoding="utf-8")
        self.assertIn("HISTORICAL_REPLAY_PROHIBITED", source)
        self.assertIn("CUTOVER_NOT_APPROVED", source)

    def test_authoritative_cutover_state_requires_activation(self):
        manifest, errors = load_baseline_manifest(Path(__file__).parents[2])
        self.assertEqual(errors, [])
        inactive_boundary = json.loads(json.dumps(manifest["cutover_boundary"]))
        inactive_boundary["status"] = "APPROVED_NOT_ACTIVE"
        inactive_boundary["activated"] = False
        inactive_boundary["owner_approval"]["activation"] = "NOT_GRANTED"
        inactive_state, inactive_errors = evaluate_cutover_state(inactive_boundary)
        self.assertEqual(inactive_errors, [])
        self.assertEqual(inactive_state["state"], "APPROVED_NOT_ACTIVE")
        self.assertFalse(inactive_state["activated"])

        active_state, active_errors = evaluate_cutover_state(manifest["cutover_boundary"])
        self.assertEqual(active_errors, [])
        self.assertEqual(active_state["state"], "ACTIVE")

    def test_authoritative_cutover_state_rejects_contradictions(self):
        manifest, errors = load_baseline_manifest(Path(__file__).parents[2])
        self.assertEqual(errors, [])
        boundary = json.loads(json.dumps(manifest["cutover_boundary"]))
        boundary["status"] = "APPROVED_NOT_ACTIVE"
        boundary["owner_approval"]["activation"] = "NOT_GRANTED"
        state, state_errors = evaluate_cutover_state(boundary)
        self.assertIsNone(state)
        self.assertIn("CUTOVER_BOUNDARY_STATUS_MISMATCH", state_errors)
        self.assertIn("OWNER_APPROVAL_ACTIVATION_INVALID", state_errors)

        malformed = {"version": "V096", "approved": True, "activated": True}
        state, state_errors = evaluate_cutover_state(malformed)
        self.assertIsNone(state)
        self.assertTrue(state_errors)

    def test_authoritative_enforcement_state_is_strict_after_owner_activation(self):
        manifest, errors = load_baseline_manifest(Path(__file__).parents[2])
        self.assertEqual(errors, [])
        state = manifest["enforcement_state"]
        strict_default, strict_errors = evaluate_enforcement_state(state)
        self.assertEqual(strict_errors, [])
        self.assertEqual(strict_default["mode"], "STRICT")
        self.assertTrue(strict_default["strict_active"])
        strict, strict_errors = evaluate_enforcement_state(state, "STRICT")
        self.assertEqual(strict_errors, [])
        self.assertEqual(strict["mode"], "STRICT")
        self.assertTrue(strict["strict_active"])
        warning_state = {
            "mode": "WARNING", "status": "DEFAULT_ACTIVE",
            "owner_activation": "NOT_GRANTED", "rollback": "NOT_REQUESTED",
        }
        warning, warning_errors = evaluate_enforcement_state(warning_state)
        self.assertEqual(warning_errors, [])
        self.assertEqual(warning["mode"], "WARNING")
        self.assertFalse(warning["strict_active"])

    def test_authoritative_enforcement_state_rejects_downgrade_and_malformed_state(self):
        strict_state = {
            "mode": "STRICT", "status": "ACTIVE",
            "owner_activation": "EXPLICIT_OWNER_ACTIVATION",
            "rollback": "NOT_REQUESTED",
        }
        downgraded, downgrade_errors = evaluate_enforcement_state(strict_state, "WARNING")
        self.assertIsNone(downgraded)
        self.assertIn("STRICT_DOWNGRADE_NOT_AUTHORIZED", downgrade_errors)
        rolled_back = dict(strict_state)
        rolled_back["rollback"] = "EXPLICIT_OWNER_ROLLBACK"
        authorized, authorized_errors = evaluate_enforcement_state(
            rolled_back, "WARNING", rollback_authorized=True
        )
        self.assertEqual(authorized_errors, [])
        self.assertEqual(authorized["mode"], "WARNING")
        malformed, malformed_errors = evaluate_enforcement_state({"mode": "DIAGNOSTIC_ONLY"})
        self.assertIsNone(malformed)
        self.assertTrue(malformed_errors)

    def test_cutover_diagnostic_reports_authoritative_state(self):
        report = diagnostic_report(Path(__file__).parents[2], validate_changes=False)
        self.assertEqual(report["cutover"]["cutover_state"], "ACTIVE")
        self.assertTrue(report["cutover"]["activated_cutover"])
        self.assertEqual(report["cutover"]["post_cutover_strict_status"], "ACTIVE")
        self.assertEqual(report["next_safe_version"], "UNVERIFIED")

    def test_cutover_requires_sources_and_explicit_approval(self):
        pending = cutover_evaluation()
        self.assertEqual(pending["governance_cutover_status"], "NOT_APPROVED")
        self.assertFalse(pending["activated_cutover"])
        self.assertEqual(pending["next_safe_version"], "UNVERIFIED")
        approved = cutover_evaluation(
            repository_verified=True,
            target_verified=True,
            local_verified=True,
            qa_verified=True,
            prd_verified=True,
            runner_policy_verified=True,
            gate_policy_verified=True,
            drift_disposition_approved=True,
            explicit_approval=True,
            boundary_defined=True,
            activated=True,
        )
        self.assertEqual(approved["governance_cutover_status"], "GOVERNANCE_CUTOVER_APPROVED")
        self.assertTrue(approved["activated_cutover"])

    def test_v095_boundary_is_defined_without_approving_or_activating_cutover(self):
        root = Path(__file__).parents[2]
        manifest, errors = load_baseline_manifest(root)
        self.assertEqual(errors, [])
        cutover = cutover_evaluation(boundary_defined=True)
        self.assertEqual(cutover["boundary_defined"], True)
        self.assertEqual(cutover["governance_cutover_status"], "NOT_APPROVED")
        self.assertFalse(cutover["activated_cutover"])
        self.assertEqual(cutover["next_safe_version"], "UNVERIFIED")

    def test_v095_cutover_source_set_does_not_invent_local_evidence(self):
        cutover = cutover_evaluation(
            boundary_defined=True,
            required_environments=("QA", "PRD_SNAPSHOT"),
        )
        self.assertEqual(cutover["required_environments"], ["QA", "PRD_SNAPSHOT"])
        self.assertNotIn("local", cutover["missing_prerequisites"])
        self.assertIn("qa", cutover["missing_prerequisites"])
        self.assertIn("prd_snapshot", cutover["missing_prerequisites"])

    def test_diagnostic_report_exposes_baseline_and_cutover_states(self):
        report = diagnostic_report(Path(__file__).parents[2], validate_changes=False)
        self.assertEqual(report["historical_baseline_status"], "EXECUTED_LEGACY_REPORTED")
        self.assertEqual(report["history_certification_status"], "PARTIAL")
        self.assertEqual(report["cutover"]["governance_cutover_status"], "GOVERNANCE_CUTOVER_APPROVED")
        self.assertTrue(report["cutover"]["activated_cutover"])
        self.assertEqual(report["cutover"]["post_cutover_strict_status"], "ACTIVE")
        self.assertEqual(report["next_safe_version"], "UNVERIFIED")
        self.assertEqual(report["promotion_policy"]["decision"], "PROMOTION_UNVERIFIED")
        self.assertFalse(report["promotion_policy"]["migration_execution_allowed"])

    def test_source_status_reuses_evidence_without_false_live_pass(self):
        report = source_status_report(Path(__file__).parents[2], "refs/remotes/origin/develop")
        self.assertEqual(report["repository"]["status"], "VERIFIED")
        self.assertEqual(report["target"]["target_status"], "VERIFIED")
        self.assertEqual(report["authorized_environments"]["LOCAL"]["status"], "NOT_REQUIRED")
        self.assertEqual(report["authorized_environments"]["QA"]["status"], "VERIFIED")
        self.assertEqual(report["authorized_environments"]["PRD_SNAPSHOT"]["status"], "DOCUMENTARY_ONLY")
        self.assertFalse(report["authorized_environments"]["PRD_SNAPSHOT"]["live_verification"])
        self.assertTrue(report["false_pass_protection"])

    def test_unavailable_target_is_unverified(self):
        report = source_status_report(Path(__file__).parents[2], "missing-target")
        self.assertEqual(report["target"]["target_status"], "UNVERIFIED")
        self.assertTrue(report["false_pass_protection"])

    def test_technical_changes_require_openspec(self):
        for kind in ("feature", "api", "database", "electron", "runtime-config", "refactor"):
            self.assertEqual(classify_change(kind), "OPENSPEC_REQUIRED")

    def test_narrow_exceptions_are_not_general_bypass(self):
        self.assertEqual(classify_change("typo-only"), "EXEMPT_IF_VERIFIED")
        self.assertEqual(classify_change("unknown"), "REVIEW_REQUIRED")
        self.assertEqual(classify_change("documentation", executable_impact=True), "OPENSPEC_REQUIRED")

    def test_migration_classes_are_repository_only(self):
        self.assertEqual(classify_sql_path("scripts/database/migrations/V099__example.sql"), "VERSIONED_MIGRATION")
        self.assertEqual(classify_sql_path("scripts/database/migrations/20260929_example.sql"), "LEGACY_MIGRATION")
        self.assertEqual(classify_sql_path("scripts/database/seed.sh"), "SEED")
        self.assertEqual(classify_sql_path("scripts/database/fiscal_data_backfill.sh"), "BACKFILL")
        self.assertEqual(classify_sql_path("scripts/database/tools/read_only.sql"), "REPAIR")

    def test_portable_manifest_paths(self):
        self.assertTrue(path_matches("scripts/governance/**", "scripts\\governance\\tool.py"))
        self.assertTrue(path_matches("AGENTS.md", "AGENTS.md"))
        self.assertFalse(path_matches("scripts/governance/**", "scripts/database/migrate.sh"))

    def test_git_added_modified_deleted_and_renamed_records(self):
        raw = b"?? added.py\0 M modified.py\0 D deleted.py\0R  old.py\0renamed.py\0"
        self.assertEqual(
            parse_git_status_records(raw),
            ["added.py", "deleted.py", "modified.py", "old.py", "renamed.py"],
        )

    def test_single_zero_and_multiple_coverage(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for change_id in ("change-a", "change-b"):
                change_root = root / "openspec" / "changes" / change_id
                change_root.mkdir(parents=True)
                (change_root / ".openspec.yaml").write_text("schema: spec-driven\n", encoding="utf-8")
            manifest = {"version": 1, "changes": [{"change_id": "change-a", "paths": ["api/**"], "exemptions": []}]}
            validation = {"change_id": "change-a", "change_strict_pass": True}
            result = evaluate_coverage(root, ["api/src/a.ts", "web/src/b.ts"], manifest, [], validation, True)
            self.assertEqual(result["files"][0]["coverage_status"], "SINGLE_MATCH")
            self.assertEqual(result["files"][1]["coverage_status"], "ZERO_MATCH")
            manifest["changes"].append({"change_id": "change-b", "paths": ["api/**"], "exemptions": []})
            result = evaluate_coverage(root, ["api/src/a.ts"], manifest, [], validation, False)
            self.assertEqual(result["files"][0]["coverage_status"], "MULTIPLE_MATCH")

    def test_invalid_manifest_and_exemption(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            manifest = {"version": 1, "changes": [{"change_id": "change-a", "paths": ["**"], "exemptions": [{"path": "api/**", "reason": "bad"}]}]}
            path = root / "scripts" / "governance" / "openspec-scope.json"
            path.parent.mkdir(parents=True)
            path.write_text(json.dumps(manifest), encoding="utf-8")
            _, errors = load_manifest(root)
            self.assertTrue(errors)
            change_root = root / "openspec" / "changes" / "change-a"
            change_root.mkdir(parents=True)
            (change_root / ".openspec.yaml").write_text("schema: spec-driven\n", encoding="utf-8")
            result = evaluate_coverage(root, ["api/src/a.ts"], manifest, [], {"change_id": "change-a", "change_strict_pass": True}, True)
            self.assertEqual(result["files"][0]["coverage_status"], "INVALID_EXEMPTION")

    def test_valid_docs_exemption(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            change_root = root / "openspec" / "changes" / "change-a"
            change_root.mkdir(parents=True)
            (change_root / ".openspec.yaml").write_text("schema: spec-driven\n", encoding="utf-8")
            manifest = {"version": 1, "changes": [{"change_id": "change-a", "paths": ["docs/**"], "exemptions": [{"path": "docs/**", "reason": "non-executable documentation"}]}]}
            result = evaluate_coverage(root, ["docs/runbook.md"], manifest, [], {"change_id": "change-a", "change_strict_pass": True}, True)
            self.assertEqual(result["files"][0]["coverage_status"], "VALID_EXEMPTION")

    def test_cli_override_resolution_is_explicit(self):
        self.assertEqual(resolve_openspec_command("python fake-openspec.py"), ["python", "fake-openspec.py"])

    def test_cli_available_and_unavailable_are_distinct(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            fake = root / "fake_openspec.py"
            fake.write_text(
                "import sys\n"
                "if sys.argv[1] == 'status': print('STATUS')\n"
                "elif sys.argv[2:3] == ['--all']: print('FAIL change/corregir-handoff-agent-local-perifericos-electron')\n"
                "else: print('Change valid')\n",
                encoding="utf-8",
            )
            override = f'"{sys.executable}" "{fake}"'
            available = validate_openspec(root, "change-a", override)
            self.assertTrue(available["cli_available"])
            self.assertEqual(available["global_preexisting_failures"], ["corregir-handoff-agent-local-perifericos-electron"])
            unavailable = validate_openspec(root, "change-a", "definitely-missing-openspec")
            self.assertFalse(unavailable["cli_available"])
            self.assertEqual(unavailable["tool_status"], "TOOL_UNAVAILABLE")

    def test_migration_filename_duplicate_baseline_and_target_rules(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self._git_target(Path(temporary), {
                "V082__one.sql": "select 1;\n",
                "V082__two.sql": "select 2;\n",
                "V095__old.sql": "select 95;\n",
                "20260929_legacy.sql": "select 3;\n",
            })
            migration_dir = root / "scripts" / "database" / "migrations"
            (migration_dir / "V096__new.sql").write_text("select 96;\n", encoding="utf-8")
            report = migration_validation_report(root, "target", [{"status": "A", "path": "scripts/database/migrations/V096__new.sql"}])
            self.assertEqual(report["migration_validation_status"], "PREEXISTING_BASELINE")
            self.assertEqual(report["new_regressions"], [])
            self.assertEqual(report["next_safe_version"], "UNVERIFIED")
            self.assertEqual(len(report["baseline_findings"]), 1)

    def test_new_duplicate_and_target_collision_are_regressions(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self._git_target(Path(temporary), {"V096__target.sql": "select 96;\n"})
            migration_dir = root / "scripts" / "database" / "migrations"
            (migration_dir / "V096__feature.sql").write_text("select 97;\n", encoding="utf-8")
            report = migration_validation_report(root, "target", [{"status": "A", "path": "scripts/database/migrations/V096__feature.sql"}])
            self.assertEqual(report["migration_validation_status"], "NEW_REGRESSION")
            self.assertTrue(report["target_collisions"])
            (migration_dir / "V097__one.sql").write_text("select 1;\n", encoding="utf-8")
            (migration_dir / "V097__two.sql").write_text("select 2;\n", encoding="utf-8")
            report = migration_validation_report(root, "target", [
                {"status": "A", "path": "scripts/database/migrations/V097__one.sql"},
                {"status": "A", "path": "scripts/database/migrations/V097__two.sql"},
            ])
            self.assertTrue(any(item["type"] == "DUPLICATE_VERSION" for item in report["new_regressions"]))

    def test_invalid_filename_target_unavailable_and_rename(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = self._git_target(Path(temporary), {"V096__old.sql": "select 96;\n"})
            migration_dir = root / "scripts" / "database" / "migrations"
            old = migration_dir / "V096__old.sql"
            old.rename(migration_dir / "V096__renamed.sql")
            report = migration_validation_report(root, "target", [{"status": "R", "old_path": "scripts/database/migrations/V096__old.sql", "path": "scripts/database/migrations/V096__renamed.sql"}])
            self.assertEqual(report["new_regressions"], [])
            (migration_dir / "bad.sql").write_text("select 1;\n", encoding="utf-8")
            report = migration_validation_report(root, "target", [{"status": "A", "path": "scripts/database/migrations/bad.sql"}])
            self.assertIn("scripts/database/migrations/bad.sql", report["invalid_new_filenames"])
            unavailable = migration_validation_report(root, "missing-target")
            self.assertEqual(unavailable["migration_validation_status"], "UNVERIFIED")

    @staticmethod
    def _git_target(root, files):
        migration_dir = root / "scripts" / "database" / "migrations"
        migration_dir.mkdir(parents=True)
        for name, content in files.items():
            (migration_dir / name).write_text(content, encoding="utf-8")
        commands = [
            ["git", "init", "-q"],
            ["git", "config", "user.email", "test@example.invalid"],
            ["git", "config", "user.name", "Governance Test"],
            ["git", "add", "."],
            ["git", "commit", "-qm", "fixture"],
            ["git", "branch", "-M", "target"],
        ]
        for command in commands:
            subprocess.run(command, cwd=root, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return root


if __name__ == "__main__":
    unittest.main()
