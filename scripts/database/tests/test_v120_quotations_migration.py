from pathlib import Path
import os
import re
import shutil
import subprocess
import unittest
import uuid


ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT / "scripts/database/migrations/V120__quotations.sql"
ROLLBACK = ROOT / "scripts/database/rollbacks/V120__quotations_rollback.sql"
RUNNER = ROOT / "scripts/database/apply_single_migration.sh"
FIXTURE = ROOT / "scripts/database/tests/fixtures/v120_minimal_schema.sql"
SCENARIOS = ROOT / "scripts/database/tests/v120_quotations_scenarios.sql"
# Servidor PostgreSQL DESECHABLE para la corrida funcional, p. ej. "host=/tmp/pg port=5433 user=postgres".
# Se crea y se borra una base temporal; nunca apuntar a LOCAL, QA ni PRD con datos.
SCRATCH_PG = os.environ.get("MANUS_SQL_SCRATCH_PG")


class QuotationsMigrationTests(unittest.TestCase):
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
        self.assertIn("QUOTATIONS_PREREQUISITES_MISSING", self.sql)
        self.assertIn("QUOTATIONS_V120_ALREADY_APPLIED", self.sql)
        self.assertNotRegex(
            self.sql,
            r"(?im)^\s*(?:begin|start transaction|commit|rollback|abort|savepoint|release)\s*;\s*$",
        )
        self.assertNotRegex(self.lower, r"\bdrop\s+(table|schema|function|column)\b")

    def test_sale_and_order_process_is_not_modified(self):
        self.assertNotRegex(self.lower, r"function\s+public\.inventory_create_sale_v2")
        self.assertNotRegex(
            self.lower,
            r"alter\s+table\s+public\.(sales|sale_items|stock_movements|order_items|inventory_lot_balances)\b",
        )
        # orders solo gana la columna de trazabilidad.
        alters = re.findall(r"alter\s+table\s+public\.orders\s+([^;]+);", self.lower)
        self.assertEqual(len(alters), 1)
        self.assertIn("add column quotation_id uuid null references public.quotations(id)", alters[0])

    def test_quotation_rules(self):
        self.assertIn("customer_id uuid not null references public.customers(id)", self.lower)
        self.assertIn("product_id uuid not null references public.products(id)", self.lower)
        self.assertIn("check (status in ('draft', 'sent', 'approved', 'rejected', 'converted'))", self.lower)
        self.assertIn("check ((status = 'converted') = (converted_order_id is not null))", self.lower)
        self.assertIn("uq_orders_quotation_id", self.lower)
        self.assertIn("default_validity_days integer not null default 15", self.lower)
        self.assertIn("america/bogota", self.lower)
        self.assertIn("'cot-' || lpad(v_next::text, 6, '0')", self.lower)

    def test_menu_and_permissions(self):
        self.assertIn("'quotations',\n  'quotations',\n  'cotizaciones'", self.lower)
        for action in ("view", "create", "update", "approve", "convert", "settings"):
            self.assertIn(f'"quotations_{action}": true', self.lower)
        self.assertIn("on conflict (tenant_id, role_id, menu_item_id) do update", self.lower)

    def test_rollback_is_guarded_and_complete(self):
        self.assertIn("quotations_rollback_blocked_data quotations", self.rollback)
        self.assertIn("quotations_rollback_blocked_data orders.quotation_id", self.rollback)
        self.assertIn("alter table public.orders drop column if exists quotation_id", self.rollback)
        for table in ("quotation_settings", "quotation_sequences", "quotation_items", "quotations"):
            self.assertIn(f"drop table if exists public.{table};", self.rollback)

    @unittest.skipUnless(SCRATCH_PG and shutil.which("psql"), "define MANUS_SQL_SCRATCH_PG con un PostgreSQL desechable")
    def test_functional_scenarios_on_scratch_database(self):
        database = f"v120_{uuid.uuid4().hex[:10]}"
        admin = ["psql", SCRATCH_PG + " dbname=postgres", "-v", "ON_ERROR_STOP=1", "-q"]
        target = ["psql", f"{SCRATCH_PG} dbname={database}", "-v", "ON_ERROR_STOP=1", "-q"]
        subprocess.run(admin + ["-c", f"CREATE DATABASE {database}"], check=True, capture_output=True)
        try:
            # Sin las tablas base la migracion se niega a correr.
            missing = subprocess.run(target + ["--single-transaction", "-f", str(MIGRATION)], capture_output=True, text=True)
            self.assertNotEqual(missing.returncode, 0)
            self.assertIn("QUOTATIONS_PREREQUISITES_MISSING", missing.stderr)

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
            self.assertIn("QUOTATIONS_V120_ALREADY_APPLIED", again.stderr)

            blocked = subprocess.run(target + ["--single-transaction", "-f", str(ROLLBACK)], capture_output=True, text=True)
            self.assertNotEqual(blocked.returncode, 0)
            self.assertIn("QUOTATIONS_ROLLBACK_BLOCKED_DATA", blocked.stderr)

            subprocess.run(
                target + ["-c", "UPDATE orders SET quotation_id = NULL; DELETE FROM quotations;"],
                check=True,
                capture_output=True,
            )
            clean = subprocess.run(target + ["--single-transaction", "-f", str(ROLLBACK)], capture_output=True, text=True)
            self.assertEqual(clean.returncode, 0, clean.stderr[-2000:])
            leftover = subprocess.run(
                target + ["-tAc", "SELECT to_regclass('public.quotations') IS NULL AND NOT EXISTS (SELECT 1 FROM menu_items WHERE key = 'QUOTATIONS' AND deleted_at IS NULL)"],
                capture_output=True,
                text=True,
            )
            self.assertEqual(leftover.stdout.strip(), "t")

            # El rollback deja la base lista para volver a aplicar V120.
            reapply = subprocess.run(target + ["--single-transaction", "-f", str(MIGRATION)], capture_output=True, text=True)
            self.assertEqual(reapply.returncode, 0, reapply.stderr[-2000:])
        finally:
            subprocess.run(admin + ["-c", f"DROP DATABASE IF EXISTS {database} WITH (FORCE)"], capture_output=True)


if __name__ == "__main__":
    unittest.main()
