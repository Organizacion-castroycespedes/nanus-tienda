from pathlib import Path
import re
import shutil
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT / "scripts/database/migrations/V111__control_center_foundation.sql"
ROLLBACK = ROOT / "scripts/database/rollbacks/V111__control_center_foundation_rollback.sql"
RUNNER = ROOT / "scripts/database/apply_single_migration.sh"

FORBIDDEN_TENANT_DETAIL_COLUMNS = (
    "banco_principal",
    "numero_cuenta",
    "tipo_cuenta",
    "cuenta_contable_defecto",
)


class ControlCenterFoundationMigrationContractTests(unittest.TestCase):
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

    def test_no_explicit_transaction_control_or_history_writes(self):
        self.assertNotRegex(
            self.sql,
            r"(?im)^\s*(?:begin|start transaction|commit|rollback|abort|savepoint|release)\s*;\s*$",
        )
        self.assertNotIn("migrations_history", self.lower)
        self.assertNotRegex(self.lower, r"\bdrop\s+(table|schema)\b")

    def test_fails_fast_when_group_role_is_missing(self):
        self.assertIn("manus_control_center_app", self.sql)
        self.assertIn("CONTROL_CENTER_ROLE_MISSING", self.sql)
        role_check = self.sql.index("CONTROL_CENTER_ROLE_MISSING")
        self.assertLess(role_check, self.lower.index("create schema"))

    def test_schema_is_closed_to_public_and_granted_to_group_only(self):
        self.assertIn("create schema if not exists control_center", self.lower)
        self.assertIn("revoke all on schema control_center from public", self.lower)
        self.assertIn("grant usage on schema control_center to manus_control_center_app", self.lower)
        self.assertNotRegex(self.lower, r"grant[^;]*\bto\s+(manus_user|manus_qa_user)\b")

    def test_audit_table_is_append_only(self):
        self.assertIn("control_center.admin_audit_events", self.lower)
        self.assertIn(
            "grant select, insert on control_center.admin_audit_events to manus_control_center_app",
            self.lower,
        )
        self.assertNotRegex(
            self.lower,
            r"grant[^;]*\b(update|delete|truncate)\b[^;]*on\s+control_center\.admin_audit_events",
        )
        self.assertIn("before update or delete on control_center.admin_audit_events", self.lower)
        self.assertIn("before truncate on control_center.admin_audit_events", self.lower)
        self.assertIn("CONTROL_CENTER_AUDIT_IMMUTABLE", self.sql)
        self.assertIn("char_length(btrim(reason)) >= 10", self.lower)

    def test_public_reads_are_column_scoped_and_exclude_bank_data(self):
        grants = re.findall(r"grant\s+select\s*\((.*?)\)\s*on\s+public\.(\w+)", self.lower, re.S)
        tables = {table for _, table in grants}
        self.assertEqual(
            tables,
            {"tenants", "tenants_detalles", "tenant_branches", "pos_terminals", "taxes"},
        )
        detail_columns = dict((table, columns) for columns, table in grants)["tenants_detalles"]
        for column in FORBIDDEN_TENANT_DETAIL_COLUMNS:
            self.assertNotIn(column, detail_columns)
        self.assertNotRegex(self.lower, r"grant\s+(insert|update|delete|all)[^;]*on\s+public\.")
        self.assertNotRegex(self.lower, r"grant\s+select\s+on\s+public\.")

    def test_menu_is_seeded_only_for_platform_tenant(self):
        self.assertIn("'control_center'", self.lower)
        self.assertEqual(self.sql.count("'00000000-0000-0000-0000-000000000001'::uuid"), 2)
        self.assertIn("role.nombre = 'super_admin'", self.lower)

    def test_rollback_refuses_to_drop_business_data(self):
        rollback = ROLLBACK.read_text(encoding="utf-8")
        self.assertIn("CONTROL_CENTER_ROLLBACK_BLOCKED_BUSINESS_TABLES", rollback)
        self.assertIn("CONTROL_CENTER_ROLLBACK_BLOCKED_AUDIT_EVENTS", rollback)


if __name__ == "__main__":
    unittest.main()
