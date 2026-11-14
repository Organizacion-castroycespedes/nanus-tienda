from pathlib import Path
import shutil
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT / "scripts/database/migrations/V116__order_delivery_idempotency.sql"
ROLLBACK = ROOT / "scripts/database/rollbacks/V116__order_delivery_idempotency_rollback.sql"
RUNNER = ROOT / "scripts/database/apply_single_migration.sh"


class OrderDeliveryIdempotencyMigrationTests(unittest.TestCase):
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
        self.assertIn("ORDER_DELIVERY_IDEMPOTENCY_ORDERS_REQUIRED", self.sql)
        self.assertIn("ORDER_DELIVERY_IDEMPOTENCY_V109_REQUIRED", self.sql)
        self.assertNotRegex(
            self.sql,
            r"(?im)^\s*(?:begin|start transaction|commit|rollback|abort|savepoint|release)\s*;\s*$",
        )
        self.assertNotRegex(self.lower, r"\bdrop\s+(table|schema)\b")

    def test_table_matches_purchase_receipt_idempotency_design(self):
        self.assertIn("create table public.order_delivery_idempotency", self.lower)
        self.assertIn("primary key (tenant_id, order_id, idempotency_key)", self.lower)
        self.assertIn("request_hash char(64) not null", self.lower)
        self.assertIn("status in ('pending', 'completed', 'failed')", self.lower)
        self.assertIn("references public.orders(id) on delete restrict", self.lower)

    def test_rollback_drops_only_the_new_objects(self):
        self.assertIn("drop table if exists public.order_delivery_idempotency", self.rollback)
        self.assertNotIn("orders cascade", self.rollback)


if __name__ == "__main__":
    unittest.main()
