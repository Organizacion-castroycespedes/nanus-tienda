from __future__ import annotations

import hashlib
import unittest

from environment_promotion_orchestrator import orchestrate_promotion_plan


def checksum(version: str) -> str:
    return hashlib.sha256(version.encode("utf-8")).hexdigest()


def plan(versions: list[str], *, status: str = "VERIFIED", decision: str = "VERIFIED_ORDERED_PLAN") -> dict[str, object]:
    items: list[dict[str, object]] = []
    for version in versions:
        number = int(version[1:])
        if number == 96:
            predecessor = {
                "expected_predecessor_kind": "PRE_GOVERNANCE_BOUNDARY",
                "expected_predecessor_version": "V095",
                "expected_predecessor_checksum": "",
            }
        else:
            predecessor = {
                "expected_predecessor_kind": "GOVERNED_POST_CUTOVER",
                "expected_predecessor_version": f"V{number - 1:03d}__change.sql",
                "expected_predecessor_checksum": checksum(f"V{number - 1:03d}"),
            }
        items.append({
            "version": version,
            "filename": f"{version}__change.sql",
            "path": f"scripts/database/migrations/{version}__change.sql",
            "checksum": checksum(version),
            "eligible": True,
            "dependencies": [],
            **predecessor,
        })
    return {
        "status": status,
        "decision": decision,
        "pending_migrations": items,
    }


class OrchestratorTests(unittest.TestCase):
    def run_plan(self, versions: list[str], *, fail_execute: str | None = None,
                 fail_verify: str | None = None, execute_exception: str | None = None,
                 verify_exception: str | None = None, calls: list[tuple[str, str]] | None = None,
                 supplied_plan: dict[str, object] | None = None) -> dict[str, object]:
        calls = calls if calls is not None else []

        def execute(item: dict[str, object]) -> dict[str, object]:
            calls.append(("execute", str(item["version"])))
            if str(item["version"]) == execute_exception:
                raise RuntimeError("secret stderr must not escape")
            if str(item["version"]) == fail_execute:
                return {"status": "FAIL", "version": item["version"], "checksum": item["checksum"], "stderr": "secret"}
            return {"status": "EXECUTION_PASS", "version": item["version"], "checksum": item["checksum"], "evidence_id": f"exec-{item['version']}"}

        def verify(item: dict[str, object], execution: dict[str, object]) -> dict[str, object]:
            calls.append(("verify", str(item["version"])))
            if str(item["version"]) == verify_exception:
                raise RuntimeError("secret verifier detail")
            if str(item["version"]) == fail_verify:
                return {"status": "FAIL", "version": item["version"], "checksum": item["checksum"], "raw_stderr": "secret"}
            return {"status": "VERIFICATION_PASS", "version": item["version"], "checksum": item["checksum"], "evidence_id": f"verify-{item['version']}"}

        def precheck(item: dict[str, object]) -> dict[str, object]:
            calls.append(("precheck", str(item["version"])))
            return {"status": "PASS", "version": item["version"], "checksum": item["checksum"]}

        return orchestrate_promotion_plan(
            supplied_plan or plan(versions), execute_migration=execute,
            verify_migration=verify, precheck_migration=precheck,
        )

    def test_complete_sequence_is_ordered_precheck_execute_verify(self) -> None:
        calls: list[tuple[str, str]] = []
        result = self.run_plan(["V096", "V097", "V098", "V099"], calls=calls)
        self.assertEqual(result["status"], "COMPLETE")
        self.assertEqual(calls, [
            ("precheck", "V096"), ("execute", "V096"), ("verify", "V096"),
            ("precheck", "V097"), ("execute", "V097"), ("verify", "V097"),
            ("precheck", "V098"), ("execute", "V098"), ("verify", "V098"),
            ("precheck", "V099"), ("execute", "V099"), ("verify", "V099"),
        ])

    def test_first_execution_failure_stops_all_later_steps(self) -> None:
        calls: list[tuple[str, str]] = []
        result = self.run_plan(["V096", "V097", "V098"], fail_execute="V096", calls=calls)
        self.assertEqual(result["status"], "FAILED")
        self.assertEqual(calls, [("precheck", "V096"), ("execute", "V096")])
        self.assertEqual([step["status"] for step in result["steps"]], ["EXECUTION_FAILED", "NOT_ATTEMPTED_AFTER_FAILURE", "NOT_ATTEMPTED_AFTER_FAILURE"])

    def test_middle_execution_failure_preserves_prior_success(self) -> None:
        result = self.run_plan(["V096", "V097", "V098", "V099"], fail_execute="V098")
        self.assertEqual([step["status"] for step in result["steps"]], ["VERIFIED", "VERIFIED", "EXECUTION_FAILED", "NOT_ATTEMPTED_AFTER_FAILURE"])
        self.assertEqual(result["execution_attempts"], 3)

    def test_verification_failure_stops_later_steps(self) -> None:
        calls: list[tuple[str, str]] = []
        result = self.run_plan(["V096", "V097"], fail_verify="V096", calls=calls)
        self.assertEqual(result["decision"], "VERIFICATION_FAILED")
        self.assertEqual(calls, [("precheck", "V096"), ("execute", "V096"), ("verify", "V096")])
        self.assertEqual(result["steps"][1]["status"], "NOT_ATTEMPTED_AFTER_FAILURE")

    def test_executor_and_verifier_exceptions_fail_closed(self) -> None:
        execution = self.run_plan(["V096", "V097"], execute_exception="V096")
        self.assertEqual(execution["decision"], "EXECUTOR_EXCEPTION")
        verification = self.run_plan(["V096", "V097"], verify_exception="V096")
        self.assertEqual(verification["decision"], "VERIFIER_EXCEPTION")

    def test_blocked_plan_has_zero_calls(self) -> None:
        calls: list[tuple[str, str]] = []
        result = self.run_plan(["V096"], supplied_plan=plan(["V096"], status="BLOCKED", decision="PROMOTION_PLAN_BLOCKED"), calls=calls)
        self.assertEqual(result["status"], "BLOCKED")
        self.assertEqual(result["execution_attempts"], 0)
        self.assertEqual(result["verification_attempts"], 0)
        self.assertEqual(calls, [])

    def test_already_at_target_is_noop(self) -> None:
        calls: list[tuple[str, str]] = []
        result = self.run_plan([], supplied_plan=plan([], status="ALREADY_AT_TARGET", decision="ALREADY_AT_TARGET"), calls=calls)
        self.assertEqual(result["status"], "ALREADY_AT_TARGET")
        self.assertEqual(result["execution_attempts"], 0)
        self.assertEqual(calls, [])

    def test_empty_verified_plan_is_rejected(self) -> None:
        result = self.run_plan([], supplied_plan=plan([], status="VERIFIED", decision="VERIFIED_ORDERED_PLAN"))
        self.assertEqual(result["status"], "BLOCKED")
        self.assertIn("VERIFIED_ORDERED_PLAN_MUST_HAVE_STEPS", result["reasons"])

    def test_malformed_duplicate_and_out_of_order_plans_have_zero_calls(self) -> None:
        duplicate = plan(["V096", "V096"])
        out_of_order = plan(["V097", "V096"])
        for malformed in (duplicate, out_of_order):
            calls: list[tuple[str, str]] = []
            result = self.run_plan([], supplied_plan=malformed, calls=calls)
            self.assertEqual(result["status"], "BLOCKED")
            self.assertEqual(calls, [])

    def test_executor_receives_exact_identity_and_checksum(self) -> None:
        received: list[dict[str, object]] = []

        def execute(item: dict[str, object]) -> dict[str, object]:
            received.append(item)
            return {"status": "PASS", "version": item["version"], "checksum": item["checksum"]}

        def verify(item: dict[str, object], execution: dict[str, object]) -> dict[str, object]:
            return {"status": "PASS", "version": item["version"], "checksum": item["checksum"]}

        result = orchestrate_promotion_plan(plan(["V096"]), execute_migration=execute, verify_migration=verify)
        self.assertEqual(result["status"], "COMPLETE")
        self.assertEqual(received[0]["version"], "V096")
        self.assertEqual(received[0]["checksum"], checksum("V096"))
        self.assertEqual(received[0]["runner"], "scripts/database/apply_single_migration.sh")
        self.assertRegex(str(received[0]["execution_binding"]), r"^[0-9a-f]{64}$")

    def test_executor_receives_expected_state_contract_unchanged(self) -> None:
        supplied = plan(["V097"])
        supplied["pending_migrations"][0].update(
            expected_predecessor_kind="GOVERNED_POST_CUTOVER",
            expected_predecessor_version="V096__change.sql",
            expected_predecessor_checksum=checksum("V096"),
        )
        received: list[dict[str, object]] = []

        def execute(item: dict[str, object]) -> dict[str, object]:
            received.append(item)
            return {"status": "PASS", "version": item["version"], "checksum": item["checksum"]}

        def verify(item: dict[str, object], execution: dict[str, object]) -> dict[str, object]:
            return {"status": "PASS", "version": item["version"], "checksum": item["checksum"]}

        result = orchestrate_promotion_plan(supplied, execute_migration=execute, verify_migration=verify)
        self.assertEqual(result["status"], "COMPLETE")
        self.assertEqual(received[0]["expected_predecessor_kind"], "GOVERNED_POST_CUTOVER")
        self.assertEqual(received[0]["expected_predecessor_version"], "V096__change.sql")
        self.assertEqual(received[0]["expected_predecessor_checksum"], checksum("V096"))

    def test_no_retry_no_blind_resume_and_no_rollback(self) -> None:
        result = self.run_plan(["V096", "V097"], fail_execute="V097")
        self.assertFalse(result["automatic_retry"])
        self.assertFalse(result["automatic_rollback"])
        self.assertEqual(result["steps"][0]["status"], "VERIFIED")

    def test_output_is_sanitized(self) -> None:
        result = self.run_plan(["V096"], execute_exception="V096")
        serialized = repr(result).lower()
        self.assertNotIn("secret stderr", serialized)
        self.assertNotIn("private_key", serialized)
        self.assertNotIn("password", serialized)
        self.assertNotIn("raw_stderr", serialized)

    def test_plan_forbidden_fields_are_rejected(self) -> None:
        supplied = plan(["V096"])
        supplied["command"] = "rm -rf"
        calls: list[tuple[str, str]] = []
        result = self.run_plan([], supplied_plan=supplied, calls=calls)
        self.assertEqual(result["status"], "BLOCKED")
        self.assertEqual(calls, [])

    def test_missing_expected_state_contract_is_rejected(self) -> None:
        supplied = plan(["V096"])
        del supplied["pending_migrations"][0]["expected_predecessor_kind"]
        calls: list[tuple[str, str]] = []
        result = self.run_plan([], supplied_plan=supplied, calls=calls)
        self.assertEqual(result["status"], "BLOCKED")
        self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main()
