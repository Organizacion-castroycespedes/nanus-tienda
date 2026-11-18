from pathlib import Path
import os
import re
import shutil
import subprocess
import unittest
import uuid


ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT / "scripts/database/migrations/V119__order_sale_void_serials.sql"
ROLLBACK = ROOT / "scripts/database/rollbacks/V119__order_sale_void_serials_rollback.sql"
RUNNER = ROOT / "scripts/database/apply_single_migration.sh"
V117 = ROOT / "scripts/database/migrations/V117__product_serials.sql"
FIXTURE = ROOT / "scripts/database/tests/fixtures/v117_minimal_schema.sql"
SCENARIOS = ROOT / "scripts/database/tests/v119_order_sale_void_serials_scenarios.sql"
# Servidor PostgreSQL DESECHABLE para la corrida funcional, p. ej. "host=/tmp/pg port=5433 user=postgres".
SCRATCH_PG = os.environ.get("MANUS_SQL_SCRATCH_PG")


class OrderSaleVoidSerialsMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = MIGRATION.read_text(encoding="utf-8")
        cls.lower = cls.sql.lower()
        cls.rollback = ROLLBACK.read_text(encoding="utf-8").lower()

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

    def test_prerequisites_and_no_transaction_control(self):
        self.assertIn("ORDER_SALE_VOID_SERIALS_V117_REQUIRED", self.sql)
        self.assertIn("ORDER_SALE_VOID_SERIALS_V119_ALREADY_APPLIED", self.sql)
        self.assertNotRegex(
            self.sql,
            r"(?im)^\s*(?:begin|start transaction|commit|rollback|abort|savepoint|release)\s*;\s*$",
        )
        self.assertNotRegex(self.lower, r"\bdrop\s+(table|schema|function|column)\b")

    def test_existing_functions_are_not_modified(self):
        self.assertNotRegex(self.lower, r"function\s+public\.inventory_create_sale_v2")
        self.assertNotRegex(self.lower, r"function\s+public\.prc_product_serials_mark_returned\s*\(")
        self.assertNotRegex(self.lower, r"alter\s+table")

    def test_function_contract(self):
        self.assertIn("create or replace function public.prc_product_serials_mark_returned_order_sale(", self.lower)
        self.assertIn("s.order_id = p_order_id", self.lower)
        self.assertIn("s.sale_id is null", self.lower)
        self.assertIn("serial_order_sale_lines_invalid", self.lower)

    def test_rollback_drops_only_the_new_function(self):
        self.assertIn("drop function if exists public.prc_product_serials_mark_returned_order_sale(", self.rollback)

    @unittest.skipUnless(SCRATCH_PG and shutil.which("psql"), "define MANUS_SQL_SCRATCH_PG con un PostgreSQL desechable")
    def test_functional_scenarios_on_scratch_database(self):
        database = f"v119_{uuid.uuid4().hex[:10]}"
        admin = ["psql", SCRATCH_PG + " dbname=postgres", "-v", "ON_ERROR_STOP=1", "-q"]
        target = ["psql", f"{SCRATCH_PG} dbname={database}", "-v", "ON_ERROR_STOP=1", "-q"]
        subprocess.run(admin + ["-c", f"CREATE DATABASE {database}"], check=True, capture_output=True)
        try:
            missing = subprocess.run(target + ["--single-transaction", "-f", str(MIGRATION)], capture_output=True, text=True)
            self.assertNotEqual(missing.returncode, 0)
            self.assertIn("ORDER_SALE_VOID_SERIALS_V117_REQUIRED", missing.stderr)
            for step in (
                ["-f", str(FIXTURE)],
                ["--single-transaction", "-f", str(V117)],
                ["--single-transaction", "-f", str(MIGRATION)],
                ["-f", str(SCENARIOS)],
            ):
                result = subprocess.run(target + step, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr[-2000:])
            self.assertNotRegex(result.stderr, re.compile(r"\bERROR\b"))
            again = subprocess.run(target + ["--single-transaction", "-f", str(MIGRATION)], capture_output=True, text=True)
            self.assertNotEqual(again.returncode, 0)
            self.assertIn("ORDER_SALE_VOID_SERIALS_V119_ALREADY_APPLIED", again.stderr)
            clean = subprocess.run(target + ["--single-transaction", "-f", str(ROLLBACK)], capture_output=True, text=True)
            self.assertEqual(clean.returncode, 0, clean.stderr[-2000:])
        finally:
            subprocess.run(admin + ["-c", f"DROP DATABASE IF EXISTS {database} WITH (FORCE)"], capture_output=True)


if __name__ == "__main__":
    unittest.main()
