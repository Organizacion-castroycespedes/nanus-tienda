from __future__ import annotations

import hashlib
import unittest

from environment_promotion_orchestrator import orchestrate_promotion_plan
from environment_promotion_plan import promotion_plan_evaluation
from promotion_execution_gates import governance_mode_evaluation, promotion_execution_gate


OFFICIAL = "scripts/database/apply_single_migration.sh"


def checksum(version: str) -> str:
    return hashlib.sha256(version.encode("utf-8")).hexdigest()


def metadata(last: int) -> list[dict[str, object]]:
    return [{
        "version": f"V{number:03d}",
        "filename": f"V{number:03d}__change.sql",
        "path": f"scripts/database/migrations/V{number:03d}__change.sql",
        "checksum": checksum(f"V{number:03d}"),
        "eligible": True,
        "dependencies": [],
    } for number in range(96, last + 1)]


def target_evidence(identity: str = "target-A") -> dict[str, object]:
    return {"status": "VERIFIED", "freshness_status": "VERIFIED", "identity": identity}


def destination_evidence(applied: list[dict[str, object]], identity: str = "qa-A", **extra: object) -> dict[str, object]:
    result: dict[str, object] = {
        "status": "VERIFIED", "freshness_status": "VERIFIED", "identity": identity,
        "correlation_id": "phase-e-op", "applied_migrations": applied,
    }
    result.update(extra)
    return result


def applied(*versions: str) -> list[dict[str, object]]:
    return [{"version": version, "checksum": checksum(version), "success": True} for version in versions]


class PhaseEPromotionValidationTests(unittest.TestCase):
    def evaluate(self, *, target_last: int, requested: str, destination: list[dict[str, object]],
                 repo_last: int | None = None, destination_extra: dict[str, object] | None = None) -> dict[str, object]:
        repo_last = repo_last or target_last
        return promotion_plan_evaluation(
            repository_migrations=metadata(repo_last), target_migrations=metadata(target_last),
            destination_evidence=destination_evidence(destination, **(destination_extra or {})),
            requested_target_version=requested, target_evidence=target_evidence(),
        )

    def gate_and_orchestrate(self, plan: dict[str, object], *, stage: str = "QA",
                             authorization: dict[str, object] | None = None,
                             runner: str = OFFICIAL, fail_version: str | None = None,
                             verify_fail_version: str | None = None) -> tuple[dict[str, object], list[str]]:
        calls: list[str] = []
        current_target = target_evidence()
        current_environment = destination_evidence([])
        gate = promotion_execution_gate(
            plan, current_target_evidence=current_target,
            current_environment_evidence=current_environment,
            destination_stage=stage, authorization=authorization,
            runner_path=runner, strict_active=True,
        )
        result = orchestrate_promotion_plan(
            plan,
            execute_migration=lambda item: calls.append(f"execute:{item['version']}") or (
                {"status": "FAIL", "version": item["version"], "checksum": item["checksum"]}
                if item["version"] == fail_version else
                {"status": "PASS", "version": item["version"], "checksum": item["checksum"]}
            ),
            verify_migration=lambda item, _: calls.append(f"verify:{item['version']}") or (
                {"status": "FAIL", "version": item["version"], "checksum": item["checksum"]}
                if item["version"] == verify_fail_version else
                {"status": "PASS", "version": item["version"], "checksum": item["checksum"]}
            ),
            preflight_gate=lambda _: gate,
        )
        return result, calls

    def test_qa_v096_is_already_at_target_noop(self) -> None:
        result = self.evaluate(target_last=96, requested="V096", destination=applied("V096"))
        self.assertEqual(result["decision"], "ALREADY_AT_TARGET")
        orchestration, calls = self.gate_and_orchestrate(result)
        self.assertEqual(orchestration["status"], "ALREADY_AT_TARGET")
        self.assertEqual(calls, [])

    def test_v095_to_v096_reaches_only_fake_executor(self) -> None:
        result = self.evaluate(target_last=96, requested="V096", destination=[])
        self.assertEqual([item["version"] for item in result["pending_migrations"]], ["V096"])
        orchestration, calls = self.gate_and_orchestrate(result)
        self.assertEqual(orchestration["status"], "COMPLETE")
        self.assertEqual(calls, ["execute:V096", "verify:V096"])

    def test_several_pending_versions_preserve_order(self) -> None:
        result = self.evaluate(target_last=99, requested="V099", destination=[])
        orchestration, calls = self.gate_and_orchestrate(result)
        self.assertEqual([item["version"] for item in result["pending_migrations"]], ["V096", "V097", "V098", "V099"])
        self.assertEqual(calls, [f"{phase}:V{version:03d}" for version in range(96, 100) for phase in ("execute", "verify")])
        self.assertEqual(orchestration["status"], "COMPLETE")

    def test_blocked_planner_states_have_zero_execution(self) -> None:
        cases = [
            self.evaluate(target_last=99, requested="V099", destination=applied("V096", "V098")),
            self.evaluate(target_last=98, requested="V098", destination=applied("V100")),
            self.evaluate(target_last=96, requested="V096", destination=[{"version": "V096", "checksum": checksum("wrong"), "success": True}]),
            self.evaluate(target_last=96, requested="V096", destination=[{"version": "V096", "checksum": checksum("V096"), "success": False}]),
            self.evaluate(target_last=96, requested="V096", destination=[], destination_extra={"manual_execution_unverified_versions": ["V096"]}),
        ]
        for blocked in cases:
            orchestration, calls = self.gate_and_orchestrate(blocked)
            self.assertEqual(orchestration["execution_attempts"], 0)
            self.assertEqual(calls, [])

    def test_stale_target_and_environment_have_zero_execution(self) -> None:
        result = self.evaluate(target_last=96, requested="V096", destination=[])
        calls: list[str] = []
        stale_gate = promotion_execution_gate(
            result, current_target_evidence=target_evidence("target-B"),
            current_environment_evidence=destination_evidence([]), destination_stage="QA", strict_active=True,
        )
        orchestration = orchestrate_promotion_plan(
            result, execute_migration=lambda _: calls.append("execute") or {"status": "PASS"},
            verify_migration=lambda *_: {"status": "PASS"}, preflight_gate=lambda _: stale_gate,
        )
        self.assertIn("PLAN_STALE", stale_gate["reasons"])
        self.assertEqual(orchestration["execution_attempts"], 0)
        self.assertEqual(calls, [])

        stale_environment = promotion_execution_gate(
            result, current_target_evidence=target_evidence(),
            current_environment_evidence=destination_evidence([], freshness_status="STALE"),
            destination_stage="QA", strict_active=True,
        )
        self.assertFalse(stale_environment["execution_allowed"])

    def test_unsafe_runner_and_prd_authorization_have_zero_execution(self) -> None:
        result = self.evaluate(target_last=96, requested="V096", destination=[])
        unsafe, calls = self.gate_and_orchestrate(result, runner="scripts/database/migrate.sh")
        self.assertEqual(unsafe["execution_attempts"], 0)
        self.assertEqual(calls, [])

        missing_qa = promotion_execution_gate(
            result, current_target_evidence=target_evidence(), current_environment_evidence=destination_evidence([]),
            destination_stage="PRD", authorization={}, strict_active=True,
        )
        self.assertIn("QA_VERIFICATION_AND_APPROVAL_REQUIRED_BEFORE_PRD", missing_qa["reasons"])
        missing_auth = promotion_execution_gate(
            result, current_target_evidence=target_evidence(), current_environment_evidence=destination_evidence([]),
            destination_stage="PRD", authorization={"qa_verified": True, "qa_approved": True}, strict_active=True,
        )
        self.assertIn("PRD_EXPLICIT_AUTHORIZATION_REQUIRED", missing_auth["reasons"])

        allowed = promotion_execution_gate(
            result, current_target_evidence=target_evidence(), current_environment_evidence=destination_evidence([]),
            destination_stage="PRD", authorization={"qa_verified": True, "qa_approved": True, "explicit_prd_authorization": True}, strict_active=True,
        )
        self.assertTrue(allowed["execution_allowed"])

    def test_failure_injection_and_recovery_are_fail_closed(self) -> None:
        result = self.evaluate(target_last=99, requested="V099", destination=[])
        orchestration, calls = self.gate_and_orchestrate(result, fail_version="V098")
        self.assertEqual(orchestration["status"], "FAILED")
        self.assertEqual(calls, [
            "execute:V096", "verify:V096", "execute:V097", "verify:V097", "execute:V098",
        ])
        self.assertEqual(orchestration["steps"][-1]["status"], "NOT_ATTEMPTED_AFTER_FAILURE")

        verification_failure, _ = self.gate_and_orchestrate(result, verify_fail_version="V097")
        self.assertEqual(verification_failure["decision"], "VERIFICATION_FAILED")
        self.assertFalse(verification_failure["automatic_retry"])
        self.assertFalse(verification_failure["automatic_rollback"])

    def test_diagnostic_default_strict_hypothetical_and_rollback(self) -> None:
        self.assertFalse(governance_mode_evaluation(None)["strict_active"])
        self.assertTrue(governance_mode_evaluation("STRICT")["strict_active"])
        rollback = governance_mode_evaluation("STRICT")
        self.assertEqual(rollback["rollback_mode"], "WARNING")
        self.assertFalse(rollback["rollback_mutates_database"])
        self.assertFalse(rollback["rollback_mutates_history"])


if __name__ == "__main__":
    unittest.main()
