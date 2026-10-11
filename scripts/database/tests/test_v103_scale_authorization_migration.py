from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT / "scripts/database/migrations/V103__scale_authorization_persistence.sql"
RUNNER = ROOT / "scripts/database/apply_single_migration.sh"


class ScaleAuthorizationMigrationContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = MIGRATION.read_text(encoding="utf-8")
        cls.lower = cls.sql.lower()

    def test_runner_owns_transaction_and_migration_has_no_explicit_control(self):
        runner = RUNNER.read_text(encoding="utf-8").lower()
        self.assertIn("--single-transaction", runner)
        self.assertIn("if reject_transaction_control", runner)
        self.assertNotRegex(
            self.sql,
            r"(?im)^\s*(?:begin|start transaction|commit|rollback|abort|savepoint|release)\s*;\s*$",
        )
        self.assertNotRegex(self.lower, r"\b(drop|truncate)\s+(table|schema)\b")
        self.assertNotIn("migrations_history", self.lower)
        self.assertNotRegex(self.lower, r"\b(insert|update|delete)\s+into\s+.*migrations_history")

    def test_only_two_known_credential_binding_input_states_are_adopted(self):
        self.assertIn("SCALE_AUTH_UNKNOWN_TABLE_STATE", self.sql)
        self.assertIn("terminal_device_credentials_device_fk", self.sql)
        self.assertIn("terminal_scale_bindings_pos_fk", self.sql)
        self.assertIn("STATE B", self.sql)
        self.assertIn("STATE A", self.sql)
        self.assertIn("from public.terminal_device_credentials", self.lower)
        self.assertIn("from public.terminal_scale_bindings", self.lower)
        self.assertIn("known_shape", self.lower)

    def test_legacy_adoption_requires_exact_columns_constraints_indexes_and_empty_rows(self):
        for marker in (
            "SCALE_AUTH_CREDENTIAL_COLUMN_DEFINITION_INCOMPATIBLE",
            "SCALE_AUTH_BINDING_COLUMN_DEFINITION_INCOMPATIBLE",
            "SCALE_AUTH_CREDENTIAL_CONSTRAINT_DEFINITION_INCOMPATIBLE",
            "SCALE_AUTH_BINDING_INDEX_DEFINITION_INCOMPATIBLE",
            "SCALE_AUTH_KNOWN_QA_CREDENTIAL_ADOPTION_REQUIRES_EMPTY_TABLE",
            "SCALE_AUTH_KNOWN_QA_BINDING_ADOPTION_REQUIRES_EMPTY_TABLE",
        ):
            self.assertIn(marker, self.sql)
        self.assertIn("a.attname <> all", self.lower)
        self.assertIn("a.attnotnull <> expected.required", self.lower)

    def test_no_plaintext_credential_or_nonce_columns_and_verifiers_are_hashed(self):
        self.assertIn("verifier_sha256", self.lower)
        self.assertIn("nonce_verifier_sha256", self.lower)
        for forbidden in ("agent_secret", "credential_secret", "raw_nonce", "nonce text"):
            self.assertNotIn(forbidden, self.lower)

    def test_binding_and_capture_invariants_are_database_enforced(self):
        self.assertIn("authorized_requires_kg", self.lower)
        self.assertIn("unit_verification_method", self.lower)
        self.assertIn("operator_confirmation", self.lower)
        self.assertIn("measurement_source='real'", self.lower)
        self.assertIn("measurement_unit='kg'", self.lower)
        self.assertIn("nonce_verifier_sha256", self.lower)
        self.assertIn("consumed_sale_id", self.lower)
        self.assertIn("terminal_scale_weight_captures", self.lower)

    def test_tenant_and_context_composite_foreign_keys_are_present(self):
        self.assertIn("terminal_scale_weight_captures_context_fk", self.lower)
        self.assertIn("terminal_scale_weight_captures_session_fk", self.lower)
        self.assertIn("terminal_scale_weight_captures_product_fk", self.lower)
        self.assertIn("terminal_scale_weight_captures_sale_fk", self.lower)
        self.assertIn("terminal_scale_weight_captures_consumer_fk", self.lower)


if __name__ == "__main__":
    unittest.main()
