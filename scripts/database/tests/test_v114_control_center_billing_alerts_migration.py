from pathlib import Path
import re
import shutil
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT / "scripts/database/migrations/V114__control_center_billing_alerts.sql"
ROLLBACK = ROOT / "scripts/database/rollbacks/V114__control_center_billing_alerts_rollback.sql"
RUNNER = ROOT / "scripts/database/apply_single_migration.sh"


class ControlCenterBillingAlertsMigrationTests(unittest.TestCase):
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

    def test_requires_v113_and_has_no_transaction_control(self):
        self.assertIn("CONTROL_CENTER_V113_REQUIRED", self.sql)
        self.assertNotRegex(
            self.sql,
            r"(?im)^\s*(?:begin|start transaction|commit|rollback|abort|savepoint|release)\s*;\s*$",
        )
        self.assertNotIn("migrations_history", self.lower)
        self.assertNotRegex(self.lower, r"\bdrop\s+(table|schema)\b")

    def test_worker_alerts_are_idempotent_per_charge_stage_and_channel(self):
        self.assertIn(
            "on control_center.billing_alerts (charge_id, stage, channel) where trigger_source = 'worker'",
            self.lower,
        )

    def test_one_active_notice_per_charge_and_final_once_resolved(self):
        self.assertIn("on public.tenant_billing_notices (charge_id) where resolved_at is null", self.lower)
        self.assertIn("control_center_final_row", self.lower)
        self.assertIn("before update or delete on public.tenant_billing_notices", self.lower)

    def test_operational_roles_only_read_notices(self):
        self.assertIn("grant select on public.tenant_billing_notices to %i", self.lower)
        self.assertNotRegex(self.lower, r"grant[^;]*(insert|update|delete)[^;]*to\s+(manus_user|manus_qa_user)\b")
        self.assertNotRegex(self.lower, r"grant[^;]*on\s+control_center\.[^;]*to\s+(manus_user|manus_qa_user)\b")
        self.assertNotRegex(self.lower, r"grant[^;]*\bdelete\b[^;]*to manus_control_center_app")

    def test_only_control_center_role_writes_notices(self):
        self.assertIn("grant select, insert, update on public.tenant_billing_notices to manus_control_center_app", self.lower)
        self.assertIn("revoke all on public.tenant_billing_notices from public", self.lower)

    def test_rollback_refuses_to_drop_data(self):
        self.assertIn("CONTROL_CENTER_ROLLBACK_BLOCKED_DATA", ROLLBACK.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
