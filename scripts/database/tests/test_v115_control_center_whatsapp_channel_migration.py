from pathlib import Path
import shutil
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT / "scripts/database/migrations/V115__control_center_whatsapp_channel.sql"
ROLLBACK = ROOT / "scripts/database/rollbacks/V115__control_center_whatsapp_channel_rollback.sql"
RUNNER = ROOT / "scripts/database/apply_single_migration.sh"


class ControlCenterWhatsappChannelMigrationTests(unittest.TestCase):
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

    def test_requires_v114_and_has_no_transaction_control(self):
        self.assertIn("CONTROL_CENTER_V114_REQUIRED", self.sql)
        self.assertNotRegex(
            self.sql,
            r"(?im)^\s*(?:begin|start transaction|commit|rollback|abort|savepoint|release)\s*;\s*$",
        )
        self.assertNotRegex(self.lower, r"\bdrop\s+(table|schema)\b")

    def test_whatsapp_channel_is_allowed(self):
        self.assertIn("channel in ('dashboard', 'email', 'whatsapp')", self.lower)

    def test_issuer_data_is_read_only_by_column(self):
        self.assertIn("grant select (direccion_principal, sitio_web) on public.tenants_detalles to manus_control_center_app", self.lower)
        self.assertIn("grant select (config) on public.tenants to manus_control_center_app", self.lower)
        self.assertNotRegex(self.lower, r"grant (insert|update|delete)[^;]*on public\.")

    def test_rollback_refuses_whatsapp_data(self):
        self.assertIn("CONTROL_CENTER_ROLLBACK_BLOCKED_DATA", ROLLBACK.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
