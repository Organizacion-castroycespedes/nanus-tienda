from pathlib import Path
import re
import shutil
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT / "scripts/database/migrations/V113__control_center_charges_receipts.sql"
ROLLBACK = ROOT / "scripts/database/rollbacks/V113__control_center_charges_receipts_rollback.sql"
RUNNER = ROOT / "scripts/database/apply_single_migration.sh"

TABLES = ("charges", "charge_lines", "receipts", "receipt_allocations", "billing_runs")


class ControlCenterChargesReceiptsMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = MIGRATION.read_text(encoding="utf-8")
        cls.lower = cls.sql.lower()

    def test_runner_transaction_control_check_accepts_the_file(self):
        bash = shutil.which("bash")
        probe = subprocess.run([bash, "-c", "exit 0"], capture_output=True) if bash else None
        if probe is None or probe.returncode != 0:
            self.skipTest("bash no disponible en este equipo; el CI (Ubuntu) ejecuta esta verificacion")
        runner = RUNNER.read_text(encoding="utf-8").replace("\r\n", "\n")
        start = runner.index("reject_transaction_control() {")
        end = runner.index("\n}\n", start) + 3
        script = runner[start:end] + f'\nif reject_transaction_control "{MIGRATION}"; then exit 1; fi\n'
        result = subprocess.run([bash, "-c", script], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_requires_v112_and_has_no_transaction_control(self):
        self.assertIn("CONTROL_CENTER_V112_REQUIRED", self.sql)
        self.assertIn("CONTROL_CENTER_PAYMENT_CATALOG_MISSING", self.sql)
        self.assertNotRegex(
            self.sql,
            r"(?im)^\s*(?:begin|start transaction|commit|rollback|abort|savepoint|release)\s*;\s*$",
        )
        self.assertNotIn("migrations_history", self.lower)
        self.assertNotRegex(self.lower, r"\bdrop\s+(table|schema)\b")

    def test_all_tables_live_in_control_center_and_are_closed_to_public(self):
        revoke = self.lower.split("revoke all on control_center.charges", 1)[1].split(";", 1)[0]
        for table in TABLES:
            self.assertIn(f"create table if not exists control_center.{table}", self.lower)
            self.assertTrue(table == "charges" or f"control_center.{table}" in revoke, table)
        self.assertNotRegex(self.lower, r"create table if not exists public\.")
        self.assertNotRegex(self.lower, r"(insert into|update|alter table)\s+public\.")

    def test_one_live_charge_per_period_and_one_proration_per_version(self):
        self.assertIn("on control_center.charges (contract_id, kind, billing_frequency, period_start)", self.lower)
        self.assertIn("where status <> 'void' and kind in ('period', 'one_time')", self.lower)
        self.assertIn("on control_center.charges (contract_version_id, billing_frequency)", self.lower)

    def test_duplicate_payment_reference_is_rejected(self):
        self.assertIn("(account_id, payment_method_code, upper(btrim(reference)))", self.lower)

    def test_balances_are_verified_at_commit(self):
        for table in ("charges", "receipts", "receipt_allocations"):
            self.assertRegex(
                self.lower,
                rf"create constraint trigger \w+\s+after insert or update on control_center\.{table}\s+deferrable initially deferred",
            )
        self.assertIn("control_center_charge_overallocated", self.lower)
        self.assertIn("control_center_receipt_overallocated", self.lower)
        self.assertIn("control_center_allocation_account_mismatch", self.lower)

    def test_money_columns_and_lines_are_immutable(self):
        self.assertIn("before update or delete on control_center.charge_lines", self.lower)
        self.assertIn("execute function control_center.prevent_mutation()", self.lower)
        self.assertIn(
            "guard_mutable_columns(\n    'paid_amount', 'status', 'void_reason', 'voided_at', 'voided_by', 'updated_at', 'updated_by')",
            self.lower,
        )
        self.assertIn("guard_mutable_columns(\n    'reversed_at', 'reversed_by', 'reversal_reason')", self.lower)

    def test_void_and_reversal_require_reason(self):
        for constraint in ("chk_cc_charges_void", "chk_cc_receipts_status", "chk_cc_ra_reversal"):
            self.assertIn(constraint, self.lower)
        self.assertGreaterEqual(self.lower.count(">= 10"), 3)

    def test_role_has_no_delete_and_only_reads_payment_catalog(self):
        grant = re.search(r"grant ([a-z, ]+) on control_center\.charge_lines to manus_control_center_app", self.lower)
        self.assertIsNotNone(grant)
        self.assertNotIn("update", grant.group(1))
        self.assertNotRegex(self.lower, r"grant[^;]*\bdelete\b[^;]*to manus_control_center_app")
        self.assertRegex(self.lower, r"grant select \([^)]*\)\s+on public\.payment_methods to manus_control_center_app")
        self.assertRegex(self.lower, r"grant select \([^)]*\)\s+on public\.financial_institutions to manus_control_center_app")
        self.assertNotRegex(self.lower, r"grant (insert|update)[^;]*on public\.")

    def test_rollback_refuses_to_drop_business_data(self):
        self.assertIn("CONTROL_CENTER_ROLLBACK_BLOCKED_DATA", ROLLBACK.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
