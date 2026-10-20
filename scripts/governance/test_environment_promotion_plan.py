from __future__ import annotations

import hashlib
import unittest

from environment_promotion_plan import promotion_plan_evaluation


def checksum(label: str) -> str:
    return hashlib.sha256(label.encode("utf-8")).hexdigest()


def migrations(last: int, *, start: int = 96, dependencies: dict[str, list[str]] | None = None) -> list[dict[str, object]]:
    dependencies = dependencies or {}
    return [
        {
            "version": f"V{number:03d}",
            "filename": f"V{number:03d}__change_{number}.sql",
            "path": f"scripts/database/migrations/V{number:03d}__change_{number}.sql",
            "checksum": checksum(f"V{number:03d}"),
            "eligible": True,
            "dependencies": dependencies.get(f"V{number:03d}", []),
        }
        for number in range(start, last + 1)
    ]


def evidence(applied: list[dict[str, object]], *, identity: str = "qa-op-1", **extra: object) -> dict[str, object]:
    value = {
        "status": "VERIFIED",
        "freshness_status": "VERIFIED",
        "identity": identity,
        "identity_verified": True,
        "applied_migrations": applied,
    }
    value.update(extra)
    return value


def target_evidence(identity: str = "origin/develop@target-1") -> dict[str, object]:
    return {"status": "VERIFIED", "freshness_status": "VERIFIED", "identity": identity}


class PromotionPlanTests(unittest.TestCase):
    def evaluate(self, *, target_last: int = 99, destination: list[dict[str, object]] | None = None,
                 requested: str = "V099", repo_last: int | None = None,
                 destination_extra: dict[str, object] | None = None,
                 **kwargs: object) -> dict[str, object]:
        repo_last = repo_last or target_last
        target = migrations(target_last)
        repository = migrations(repo_last)
        return promotion_plan_evaluation(
            repository_migrations=repository,
            target_migrations=target,
            destination_evidence=evidence(destination or [], **(destination_extra or {})),
            requested_target_version=requested,
            target_evidence=target_evidence(),
            **kwargs,
        )

    def test_v095_to_v099_returns_complete_ordered_set(self) -> None:
        result = self.evaluate()
        self.assertEqual(result["decision"], "VERIFIED_ORDERED_PLAN")
        self.assertEqual([item["version"] for item in result["pending_migrations"]], ["V096", "V097", "V098", "V099"])

    def test_v096_to_v098_is_promotion_lag(self) -> None:
        applied = [{"version": "V096", "checksum": checksum("V096"), "success": True}]
        result = self.evaluate(target_last=98, requested="V098", destination=applied)
        self.assertEqual(result["classification"], "PROMOTION_LAG")
        self.assertEqual([item["version"] for item in result["pending_migrations"]], ["V097", "V098"])
        self.assertEqual(result["pending_migrations"][0]["expected_predecessor_kind"], "GOVERNED_POST_CUTOVER")
        self.assertEqual(result["pending_migrations"][0]["expected_predecessor_version"], "V096__change_96.sql")

    def test_first_post_cutover_step_uses_v095_boundary_contract(self) -> None:
        result = self.evaluate(requested="V096", destination=[])
        item = result["pending_migrations"][0]
        self.assertEqual(item["expected_predecessor_kind"], "PRE_GOVERNANCE_BOUNDARY")
        self.assertEqual(item["expected_predecessor_version"], "V095")
        self.assertEqual(item["expected_predecessor_checksum"], "")

    def test_applied_gap_blocks(self) -> None:
        applied = [
            {"version": "V096", "checksum": checksum("V096"), "success": True},
            {"version": "V098", "checksum": checksum("V098"), "success": True},
        ]
        result = self.evaluate(destination=applied)
        self.assertTrue(any(reason.startswith("VERSION_GAP:V097") for reason in result["reasons"]))

    def test_db_only_blocks(self) -> None:
        result = self.evaluate(destination=[{"version": "V100", "checksum": checksum("V100"), "success": True}])
        self.assertIn("DB_ONLY_VERSION:V100", result["reasons"])

    def test_checksum_mismatch_blocks(self) -> None:
        result = self.evaluate(destination=[{"version": "V096", "checksum": checksum("wrong"), "success": True}])
        self.assertIn("CHECKSUM_MISMATCH:V096", result["reasons"])

    def test_success_false_blocks(self) -> None:
        result = self.evaluate(destination=[{"version": "V096", "checksum": checksum("V096"), "success": False}])
        self.assertIn("FAILED_HISTORY_PRESENT:V096", result["reasons"])

    def test_manual_execution_unverified_blocks(self) -> None:
        result = self.evaluate(destination_extra={"manual_execution_unverified_versions": ["V096"]})
        self.assertIn("MANUAL_EXECUTION_UNVERIFIED:V096", result["reasons"])

    def test_already_at_target_is_empty_and_no_replay(self) -> None:
        applied = [{"version": f"V{number:03d}", "checksum": checksum(f"V{number:03d}"), "success": True} for number in range(96, 100)]
        result = self.evaluate(destination=applied)
        self.assertEqual(result["decision"], "ALREADY_AT_TARGET")
        self.assertEqual(result["pending_migrations"], [])

    def test_downgrade_blocks(self) -> None:
        result = self.evaluate(requested="V095")
        self.assertIn("UNSUPPORTED_DOWNGRADE", result["reasons"])

    def test_unknown_target_blocks(self) -> None:
        result = self.evaluate(requested="V100")
        self.assertIn("REQUESTED_TARGET_NOT_IN_AUTHORITATIVE_TARGET", result["reasons"])

    def test_duplicate_authoritative_version_blocks(self) -> None:
        target = migrations(97) + [migrations(97)[-1]]
        result = promotion_plan_evaluation(
            repository_migrations=migrations(97), target_migrations=target,
            destination_evidence=evidence([]), requested_target_version="V097",
            target_evidence=target_evidence(),
        )
        self.assertTrue(any("TARGET_DUPLICATE_VERSION:V097" in reason for reason in result["reasons"]))

    def test_duplicate_destination_version_blocks(self) -> None:
        applied = [
            {"version": "V096", "checksum": checksum("V096"), "success": True},
            {"version": "V096", "checksum": checksum("V096"), "success": True},
        ]
        result = self.evaluate(destination=applied)
        self.assertIn("DESTINATION_DUPLICATE_VERSION:V096", result["reasons"])

    def test_missing_evidence_blocks(self) -> None:
        result = self.evaluate()
        result = promotion_plan_evaluation(
            repository_migrations=migrations(99), target_migrations=migrations(99),
            destination_evidence={"status": "UNVERIFIED"}, requested_target_version="V099",
            target_evidence=target_evidence(),
        )
        self.assertEqual(result["classification"], "EVIDENCE_UNVERIFIED")

    def test_stale_evidence_blocks(self) -> None:
        result = promotion_plan_evaluation(
            repository_migrations=migrations(99), target_migrations=migrations(99),
            destination_evidence=evidence([], freshness_status="STALE"), requested_target_version="V099",
            target_evidence=target_evidence(),
        )
        self.assertEqual(result["classification"], "EVIDENCE_STALE")

    def test_target_identity_required_and_same_operation_can_be_required(self) -> None:
        result = promotion_plan_evaluation(
            repository_migrations=migrations(99), target_migrations=migrations(99),
            destination_evidence=evidence([]), requested_target_version="V099",
            target_evidence={"status": "VERIFIED", "freshness_status": "VERIFIED"},
        )
        self.assertIn("TARGET_IDENTITY_MISSING", result["reasons"])

        result = self.evaluate(same_operation_required=True)
        self.assertIn("DESTINATION_SAME_OPERATION_EVIDENCE_REQUIRED", result["reasons"])

    def test_predecessor_cannot_be_skipped(self) -> None:
        target = migrations(97, dependencies={"V097": ["V096"]})
        result = promotion_plan_evaluation(
            repository_migrations=target, target_migrations=target,
            destination_evidence=evidence([]), requested_target_version="V097",
            target_evidence=target_evidence(),
        )
        self.assertEqual(result["decision"], "VERIFIED_ORDERED_PLAN")
        self.assertEqual([item["version"] for item in result["pending_migrations"]], ["V096", "V097"])

    def test_historical_anomalies_do_not_become_pending(self) -> None:
        historical = [{"version": "V082", "checksum": "bad", "success": False}]
        result = self.evaluate(destination=historical)
        self.assertEqual([item["version"] for item in result["pending_migrations"]], ["V096", "V097", "V098", "V099"])

    def test_output_contains_no_commands_or_secrets(self) -> None:
        result = self.evaluate()
        forbidden_keys = {"command", "shell", "password", "private_key", "private_key_content", "dsn"}
        self.assertTrue(forbidden_keys.isdisjoint(result))
        self.assertTrue(all("sql" not in str(item.get("path", "")).lower() or str(item.get("path", "")).endswith(".sql")
                            for item in result["pending_migrations"]))

    def test_next_safe_api_is_not_replaced(self) -> None:
        self.assertEqual(promotion_plan_evaluation.__name__, "promotion_plan_evaluation")


if __name__ == "__main__":
    unittest.main()
