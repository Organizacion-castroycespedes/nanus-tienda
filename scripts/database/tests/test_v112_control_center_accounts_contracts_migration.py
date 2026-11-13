from pathlib import Path
import re
import shutil
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT / "scripts/database/migrations/V112__control_center_accounts_contracts.sql"
ROLLBACK = ROOT / "scripts/database/rollbacks/V112__control_center_accounts_contracts_rollback.sql"
RUNNER = ROOT / "scripts/database/apply_single_migration.sh"

TABLES = (
    "commercial_accounts", "account_tenants", "plans", "plan_price_versions",
    "plan_price_components", "contracts", "contract_versions", "contract_items", "idempotency_keys",
)


class ControlCenterAccountsContractsMigrationTests(unittest.TestCase):
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

    def test_requires_v111_and_has_no_transaction_control(self):
        self.assertIn("CONTROL_CENTER_V111_REQUIRED", self.sql)
        self.assertNotRegex(
            self.sql,
            r"(?im)^\s*(?:begin|start transaction|commit|rollback|abort|savepoint|release)\s*;\s*$",
        )
        self.assertNotIn("migrations_history", self.lower)
        self.assertNotRegex(self.lower, r"\bdrop\s+(table|schema)\b")

    def test_all_tables_live_in_control_center_and_are_closed_to_public(self):
        for table in TABLES:
            self.assertIn(f"create table if not exists control_center.{table}", self.lower)
            self.assertIn(f"control_center.{table}", self.lower.split("revoke all on", 1)[1])
        self.assertNotRegex(self.lower, r"create table if not exists public\.")

    def test_database_enforces_business_uniqueness(self):
        self.assertIn("on control_center.account_tenants (tenant_id) where status = 'active'", self.lower)
        self.assertIn("on control_center.contracts (tenant_id) where status in ('draft', 'active')", self.lower)
        self.assertIn("unique (tax_id_type, tax_id)", self.lower)
        self.assertIn("references public.tenants(id) on delete restrict", self.lower)

    def test_versions_and_items_are_immutable(self):
        self.assertIn("before update or delete on control_center.contract_items", self.lower)
        self.assertIn("before update or delete on control_center.plan_price_components", self.lower)
        self.assertIn("allow_close_once('valid_to')", self.lower)
        self.assertIn("allow_close_once('effective_to')", self.lower)

    def test_role_has_no_delete_and_no_update_on_immutable_tables(self):
        for table in ("plan_price_components", "contract_items", "idempotency_keys"):
            grant = re.search(rf"grant ([a-z, ]+) on control_center\.{table} to manus_control_center_app", self.lower)
            self.assertIsNotNone(grant, table)
            self.assertNotIn("update", grant.group(1))
            self.assertNotIn("delete", grant.group(1))
        self.assertNotRegex(self.lower, r"grant[^;]*\bdelete\b[^;]*to manus_control_center_app")
        self.assertNotRegex(self.lower, r"grant[^;]*to\s+(manus_user|manus_qa_user)\b")

    def test_whatsapp_requires_explicit_consent_and_e164_phone(self):
        self.assertIn("chk_cc_accounts_whatsapp", self.lower)
        self.assertIn("chk_cc_accounts_phone", self.lower)

    def test_rollback_refuses_to_drop_business_data(self):
        self.assertIn("CONTROL_CENTER_ROLLBACK_BLOCKED_DATA", ROLLBACK.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
