from pathlib import Path
import os
import re
import shutil
import subprocess
import unittest
import uuid


ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT / "scripts/database/migrations/V117__product_serials.sql"
ROLLBACK = ROOT / "scripts/database/rollbacks/V117__product_serials_rollback.sql"
RUNNER = ROOT / "scripts/database/apply_single_migration.sh"
FIXTURE = ROOT / "scripts/database/tests/fixtures/v117_minimal_schema.sql"
SCENARIOS = ROOT / "scripts/database/tests/v117_product_serials_scenarios.sql"
# Servidor PostgreSQL DESECHABLE para la corrida funcional, p. ej. "host=/tmp/pg port=5433 user=postgres".
# Se crea y se borra una base temporal; nunca apuntar a LOCAL, QA ni PRD con datos.
SCRATCH_PG = os.environ.get("MANUS_SQL_SCRATCH_PG")

FUNCTIONS = (
    "fnc_product_serials_register",
    "fnc_product_serials_assign_sale",
    "fnc_product_serials_assign_order_delivery",
    "prc_product_serials_mark_returned",
    "fnc_product_serials_inspect",
    "fnc_product_serials_write_off",
    "fnc_product_serials_move_location",
)


class ProductSerialsMigrationTests(unittest.TestCase):
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
        self.assertIn("PRODUCT_SERIALS_V116_REQUIRED", self.sql)
        self.assertIn("PRODUCT_SERIALS_V117_ALREADY_APPLIED", self.sql)
        self.assertNotRegex(
            self.sql,
            r"(?im)^\s*(?:begin|start transaction|commit|rollback|abort|savepoint|release)\s*;\s*$",
        )
        self.assertNotRegex(self.lower, r"\bdrop\s+(table|schema|function)\b")

    def test_sale_process_is_not_modified(self):
        self.assertNotRegex(self.lower, r"function\s+public\.inventory_create_sale_v2")
        self.assertNotRegex(self.lower, r"alter\s+table\s+public\.(sales|sale_items|stock_movements|inventory_lot_balances)\b")

    def test_product_rule_and_tables(self):
        self.assertIn("add column requires_serial boolean not null default false", self.lower)
        self.assertIn("chk_products_serial_rules", self.lower)
        self.assertIn("create unique index ux_product_serials_tenant_product_serial", self.lower)
        self.assertIn("on public.product_serials (tenant_id, product_id, serial_number_normalized)", self.lower)
        self.assertIn("location_id uuid null references public.inventory_locations(id)", self.lower)
        self.assertIn("trg_product_serial_events_immutable", self.lower)

    def test_functions_and_menu_seed(self):
        for name in FUNCTIONS:
            self.assertIn(f"create or replace function public.{name}(", self.lower, name)
        self.assertIn("'inventory_serials'", self.lower)
        self.assertIn("role.nombre in ('super_admin', 'super_user', 'admin')", self.lower)

    def test_rollback_is_guarded_and_complete(self):
        self.assertIn("product_serials_rollback_blocked_data", self.rollback)
        for name in FUNCTIONS:
            self.assertIn(f"drop function if exists public.{name}(", self.rollback, name)
        self.assertIn("drop table if exists public.product_serials", self.rollback)
        self.assertIn("drop column if exists requires_serial", self.rollback)

    @unittest.skipUnless(SCRATCH_PG and shutil.which("psql"), "define MANUS_SQL_SCRATCH_PG con un PostgreSQL desechable")
    def test_functional_scenarios_on_scratch_database(self):
        database = f"v117_{uuid.uuid4().hex[:10]}"
        admin = ["psql", SCRATCH_PG + " dbname=postgres", "-v", "ON_ERROR_STOP=1", "-q"]
        target = ["psql", f"{SCRATCH_PG} dbname={database}", "-v", "ON_ERROR_STOP=1", "-q"]
        subprocess.run(admin + ["-c", f"CREATE DATABASE {database}"], check=True, capture_output=True)
        try:
            for step in (
                ["-f", str(FIXTURE)],
                ["--single-transaction", "-f", str(MIGRATION)],
                ["-f", str(SCENARIOS)],
            ):
                result = subprocess.run(target + step, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr[-2000:])
            self.assertNotRegex(result.stderr, re.compile(r"\bERROR\b"))
            blocked = subprocess.run(target + ["--single-transaction", "-f", str(ROLLBACK)], capture_output=True, text=True)
            self.assertNotEqual(blocked.returncode, 0)
            self.assertIn("PRODUCT_SERIALS_ROLLBACK_BLOCKED_DATA", blocked.stderr)
        finally:
            subprocess.run(admin + ["-c", f"DROP DATABASE IF EXISTS {database} WITH (FORCE)"], capture_output=True)


if __name__ == "__main__":
    unittest.main()
