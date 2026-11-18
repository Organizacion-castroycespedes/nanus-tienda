from pathlib import Path
import os
import re
import shutil
import subprocess
import unittest
import uuid


ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT / "scripts/database/migrations/V118__product_decimal_quantity_and_units.sql"
ROLLBACK = ROOT / "scripts/database/rollbacks/V118__product_decimal_quantity_and_units_rollback.sql"
RUNNER = ROOT / "scripts/database/apply_single_migration.sh"
FIXTURE = ROOT / "scripts/database/tests/fixtures/v118_minimal_schema.sql"
SCENARIOS = ROOT / "scripts/database/tests/v118_product_decimal_quantity_scenarios.sql"
# Servidor PostgreSQL DESECHABLE para la corrida funcional, p. ej. "host=/tmp/pg port=5433 user=postgres".
# Se crea y se borra una base temporal; nunca apuntar a LOCAL, QA ni PRD con datos.
SCRATCH_PG = os.environ.get("MANUS_SQL_SCRATCH_PG")


class ProductDecimalQuantityMigrationTests(unittest.TestCase):
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
        self.assertIn("PRODUCT_DECIMAL_V117_REQUIRED", self.sql)
        self.assertIn("PRODUCT_DECIMAL_V118_ALREADY_APPLIED", self.sql)
        self.assertNotRegex(
            self.sql,
            r"(?im)^\s*(?:begin|start transaction|commit|rollback|abort|savepoint|release)\s*;\s*$",
        )
        self.assertNotRegex(self.lower, r"\bdrop\s+(table|schema|function|column)\b")

    def test_sale_process_is_not_modified(self):
        self.assertNotRegex(self.lower, r"function\s+public\.inventory_create_sale_v2")
        self.assertNotRegex(self.lower, r"alter\s+table\s+public\.(sales|sale_items|stock_movements|inventory_lot_balances|purchase_items)\b")

    def test_product_rules_and_units(self):
        self.assertIn("add column allows_decimal_quantity boolean not null default false", self.lower)
        self.assertIn("chk_products_decimal_quantity_rules", self.lower)
        self.assertIn("measurement_unit in ('und', 'm', 'l', 'cm', 'm2', 'kg', 'lb', 'g', 'oz')", self.lower)
        self.assertIn("sale_type = 'unit' and measurement_unit in ('und', 'm', 'l', 'cm', 'm2')", self.lower)
        self.assertIn("product_decimal_backfill", self.lower)

    def test_rollback_is_guarded_and_complete(self):
        self.assertIn("product_decimal_rollback_blocked_data", self.rollback)
        self.assertIn("drop column if exists allows_decimal_quantity", self.rollback)
        self.assertIn("check (measurement_unit in ('und', 'kg', 'lb', 'g', 'oz'))", self.rollback)

    @unittest.skipUnless(SCRATCH_PG and shutil.which("psql"), "define MANUS_SQL_SCRATCH_PG con un PostgreSQL desechable")
    def test_functional_scenarios_on_scratch_database(self):
        database = f"v118_{uuid.uuid4().hex[:10]}"
        admin = ["psql", SCRATCH_PG + " dbname=postgres", "-v", "ON_ERROR_STOP=1", "-q"]
        target = ["psql", f"{SCRATCH_PG} dbname={database}", "-v", "ON_ERROR_STOP=1", "-q"]
        subprocess.run(admin + ["-c", f"CREATE DATABASE {database}"], check=True, capture_output=True)
        try:
            # Sin V117 (sin requires_serial) la migracion se niega a correr.
            subprocess.run(target + ["-c", "CREATE TABLE products (id uuid); CREATE TABLE stock_movements (id uuid); CREATE TABLE purchase_items (id uuid);"], check=True, capture_output=True)
            missing = subprocess.run(target + ["--single-transaction", "-f", str(MIGRATION)], capture_output=True, text=True)
            self.assertNotEqual(missing.returncode, 0)
            self.assertIn("PRODUCT_DECIMAL_V117_REQUIRED", missing.stderr)
            subprocess.run(target + ["-c", "DROP TABLE products, stock_movements, purchase_items;"], check=True, capture_output=True)

            for step in (
                ["-f", str(FIXTURE)],
                ["--single-transaction", "-f", str(MIGRATION)],
                ["-f", str(SCENARIOS)],
            ):
                result = subprocess.run(target + step, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr[-2000:])
            self.assertNotRegex(result.stderr, re.compile(r"\bERROR\b"))

            again = subprocess.run(target + ["--single-transaction", "-f", str(MIGRATION)], capture_output=True, text=True)
            self.assertNotEqual(again.returncode, 0)
            self.assertIn("PRODUCT_DECIMAL_V118_ALREADY_APPLIED", again.stderr)

            blocked = subprocess.run(target + ["--single-transaction", "-f", str(ROLLBACK)], capture_output=True, text=True)
            self.assertNotEqual(blocked.returncode, 0)
            self.assertIn("PRODUCT_DECIMAL_ROLLBACK_BLOCKED_DATA", blocked.stderr)

            subprocess.run(target + ["-c", "UPDATE products SET measurement_unit = 'UND' WHERE measurement_unit IN ('M','L','CM','M2');"], check=True, capture_output=True)
            clean = subprocess.run(target + ["--single-transaction", "-f", str(ROLLBACK)], capture_output=True, text=True)
            self.assertEqual(clean.returncode, 0, clean.stderr[-2000:])
        finally:
            subprocess.run(admin + ["-c", f"DROP DATABASE IF EXISTS {database} WITH (FORCE)"], capture_output=True)


if __name__ == "__main__":
    unittest.main()
