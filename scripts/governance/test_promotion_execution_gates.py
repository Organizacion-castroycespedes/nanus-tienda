from __future__ import annotations

import hashlib
import unittest

from environment_promotion_orchestrator import orchestrate_promotion_plan
from migration_runner_policy import runner_inventory
from promotion_execution_gates import governance_mode_evaluation, promotion_execution_gate


OFFICIAL = "scripts/database/apply_single_migration.sh"


def checksum(version: str) -> str:
    return hashlib.sha256(version.encode("utf-8")).hexdigest()


def plan() -> dict[str, object]:
    return {
        "status": "VERIFIED",
        "decision": "VERIFIED_ORDERED_PLAN",
        "target_identity": {"status": "VERIFIED", "freshness_status": "VERIFIED", "identity": "target-A"},
        "destination_identity": {"status": "VERIFIED", "freshness_status": "VERIFIED", "identity": "qa-A", "correlation_id": "op-A"},
        "pending_migrations": [{
            "version": "V096", "filename": "V096__change.sql",
            "path": "scripts/database/migrations/V096__change.sql",
            "checksum": checksum("V096"), "eligible": True, "dependencies": [],
            "expected_predecessor_kind": "PRE_GOVERNANCE_BOUNDARY",
            "expected_predecessor_version": "V095",
            "expected_predecessor_checksum": "",
        }],
    }


def target(identity: str = "target-A", **extra: object) -> dict[str, object]:
    value = {"status": "VERIFIED", "freshness_status": "VERIFIED", "identity": identity}
    value.update(extra)
    return value


def environment(identity: str = "qa-A", **extra: object) -> dict[str, object]:
    value = {"status": "VERIFIED", "freshness_status": "VERIFIED", "identity": identity, "correlation_id": "op-A"}
    value.update(extra)
    return value


class PromotionGateTests(unittest.TestCase):
    def gate(self, *, target_value: dict[str, object] | None = None,
             environment_value: dict[str, object] | None = None,
             stage: str = "QA", authorization: dict[str, object] | None = None,
             runner: str = OFFICIAL, strict: bool = True) -> dict[str, object]:
        return promotion_execution_gate(
            plan(), current_target_evidence=target_value or target(),
            current_environment_evidence=environment_value or environment(),
            destination_stage=stage, authorization=authorization,
            runner_path=runner, strict_active=strict,
        )

    def test_matching_target_and_environment_pass(self) -> None:
        result = self.gate()
        self.assertEqual(result["status"], "PASS")
        self.assertTrue(result["execution_allowed"])

    def test_target_change_is_plan_stale_and_blocked(self) -> None:
        result = self.gate(target_value=target("target-B"))
        self.assertEqual(result["status"], "BLOCKED")
        self.assertIn("PLAN_STALE", result["reasons"])
        self.assertIn("TARGET_CHANGED", result["reasons"])

    def test_missing_or_unverified_target_blocks(self) -> None:
        for value in ({"status": "VERIFIED", "freshness_status": "VERIFIED"}, target(status="UNVERIFIED")):
            result = self.gate(target_value=value)
            self.assertFalse(result["execution_allowed"])

    def test_stale_environment_and_correlation_block(self) -> None:
        stale = self.gate(environment_value=environment(freshness_status="STALE"))
        self.assertIn("ENVIRONMENT_EVIDENCE_STALE", stale["reasons"])
        mismatch = self.gate(environment_value=environment(correlation_id="op-B"))
        self.assertIn("EVIDENCE_CORRELATION_MISMATCH", mismatch["reasons"])

    def test_unsafe_legacy_and_unknown_runner_block(self) -> None:
        for runner in ("scripts/database/migrate.sh", "scripts/database/unknown.sh"):
            result = self.gate(runner=runner)
            self.assertIn("UNSAFE_RUNNER", result["reasons"])
            self.assertFalse(result["execution_allowed"])

    def test_every_known_non_official_runner_is_rejected(self) -> None:
        for entry in runner_inventory():
            if entry["path"] == OFFICIAL:
                continue
            result = self.gate(runner=entry["path"])
            self.assertIn("UNSAFE_RUNNER", result["reasons"], entry["path"])
            self.assertFalse(result["execution_allowed"], entry["path"])

    def test_qa_does_not_require_prd_authorization(self) -> None:
        result = self.gate(stage="QA", authorization={})
        self.assertEqual(result["status"], "PASS")

    def test_prd_requires_qa_and_explicit_authorization(self) -> None:
        missing = self.gate(stage="PRD", authorization={})
        self.assertIn("QA_VERIFICATION_AND_APPROVAL_REQUIRED_BEFORE_PRD", missing["reasons"])
        self.assertIn("PRD_EXPLICIT_AUTHORIZATION_REQUIRED", missing["reasons"])
        valid = self.gate(stage="PRD", authorization={"qa_verified": True, "qa_approved": True, "explicit_prd_authorization": True})
        self.assertEqual(valid["status"], "PASS")

    def test_diagnostic_mode_preserved_but_execution_still_fail_closed(self) -> None:
        result = self.gate(target_value=target("target-B"), strict=False)
        self.assertEqual(result["status"], "DIAGNOSTIC")
        self.assertFalse(result["blocking"])
        self.assertFalse(result["execution_allowed"])

    def test_governance_mode_is_default_off_and_rollback_is_config_only(self) -> None:
        warning = governance_mode_evaluation(None)
        self.assertFalse(warning["strict_active"])
        strict = governance_mode_evaluation("STRICT")
        self.assertTrue(strict["strict_active"])
        self.assertFalse(strict["rollback_mutates_database"])
        self.assertFalse(strict["rollback_mutates_history"])

    def test_orchestrator_gate_blocks_before_executor(self) -> None:
        calls: list[str] = []

        def gate(_: dict[str, object]) -> dict[str, object]:
            return {"status": "BLOCKED", "execution_allowed": False, "reasons": ["PLAN_STALE"]}

        result = orchestrate_promotion_plan(
            plan(),
            execute_migration=lambda _: calls.append("execute") or {"status": "PASS"},
            verify_migration=lambda *_: calls.append("verify") or {"status": "PASS"},
            preflight_gate=gate,
        )
        self.assertEqual(result["decision"], "PRE_EXECUTION_GATE_BLOCKED")
        self.assertEqual(result["execution_attempts"], 0)
        self.assertEqual(calls, [])

    def test_valid_gate_reaches_fake_execution(self) -> None:
        calls: list[str] = []
        gate_result = self.gate()
        result = orchestrate_promotion_plan(
            plan(),
            execute_migration=lambda _: calls.append("execute") or {"status": "PASS"},
            verify_migration=lambda *_: calls.append("verify") or {"status": "PASS"},
            preflight_gate=lambda _: gate_result,
        )
        self.assertEqual(result["status"], "COMPLETE")
        self.assertEqual(calls, ["execute", "verify"])


if __name__ == "__main__":
    unittest.main()
