"""Unit and disposable-local-PostgreSQL tests for QA certification mode."""

from __future__ import annotations

import hashlib
import json
import shutil
import unittest
from pathlib import Path

from qa_certification import (
    CERTIFICATION_EXECUTOR_ID,
    CERTIFICATION_OBJECT,
    CERTIFICATION_OPERATION,
    CertificationError,
    build_certification_descriptor,
    certification_sql,
    fixture_checksum,
    history_fingerprint,
    run_local_certification,
    validate_qa_execution_request,
    validate_certification_descriptor,
)
from test_postgres_concurrency import DisposablePostgresTests


ROOT = Path(__file__).resolve().parents[2]


class CertificationContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fingerprint = "0123456789abcdef0123456789abcdef"
        self.descriptor = build_certification_descriptor(
            database="manus_governance_qa_unit",
            schema="public",
            correlation_id="qa-cert-unit-1",
            history_fingerprint=self.fingerprint,
        )

    def test_descriptor_is_certification_only_and_has_no_version(self) -> None:
        self.assertEqual(self.descriptor["operation"], CERTIFICATION_OPERATION)
        self.assertNotRegex(json.dumps(self.descriptor), r"V[0-9]{3}__")
        self.assertEqual(self.descriptor["executor"], CERTIFICATION_EXECUTOR_ID)
        self.assertNotIn("password", json.dumps(self.descriptor).lower())

    def test_descriptor_tampering_and_cross_mode_confusion_fail_closed(self) -> None:
        tampered = dict(self.descriptor)
        tampered["operation"] = "GOVERNED_MIGRATION"
        with self.assertRaisesRegex(CertificationError, "CERTIFICATION_OPERATION_REQUIRED"):
            validate_certification_descriptor(tampered, local_disposable=True)

        tampered = dict(self.descriptor)
        tampered["fixture_checksum"] = "0" * 64
        with self.assertRaisesRegex(CertificationError, "FIXTURE_CHECKSUM_MISMATCH"):
            validate_certification_descriptor(tampered, local_disposable=True)

        with self.assertRaisesRegex(CertificationError, "CERTIFICATION_QA_ONLY"):
            validate_certification_descriptor(self.descriptor, expected_environment="PROD", local_disposable=True)

    def test_sql_is_fixed_allowlisted_and_never_mutates_history(self) -> None:
        sql = certification_sql(
            database="manus_governance_qa_unit",
            schema="public",
            history_fingerprint=self.fingerprint,
        ).decode("utf-8")
        self.assertIn("pg_try_advisory_xact_lock", sql)
        self.assertIn("ROLLBACK;", sql)
        self.assertNotIn("COMMIT;", sql)
        self.assertNotRegex(sql, r"(?is)\b(?:insert|update|delete|truncate|alter)\s+.*migrations_history")
        self.assertIn(f"CREATE TABLE public.{CERTIFICATION_OBJECT}", sql)
        self.assertNotIn("V096", sql)
        self.assertNotIn("V097", sql)

    def test_fixture_checksum_changes_when_snapshot_bytes_change(self) -> None:
        original = certification_sql(
            database="manus_governance_qa_unit",
            schema="public",
            history_fingerprint=self.fingerprint,
        )
        self.assertEqual(fixture_checksum(
            database="manus_governance_qa_unit",
            schema="public",
            history_fingerprint=self.fingerprint,
        ), hashlib.sha256(original).hexdigest())
        self.assertNotEqual(hashlib.sha256(original + b"\n-- tampered").hexdigest(), fixture_checksum(
            database="manus_governance_qa_unit",
            schema="public",
            history_fingerprint=self.fingerprint,
        ))

    def test_runtime_rejects_non_loopback_and_non_disposable_database(self) -> None:
        with self.assertRaisesRegex(CertificationError, "LOCAL_CERTIFICATION_REQUIRES_LOOPBACK"):
            run_local_certification(config={
                "host": "qa.example", "port": "5432", "user": "x",
                "password": "x", "database": "manus_governance_qa_x",
            }, correlation_id="qa-cert-unit-2")
        with self.assertRaisesRegex(CertificationError, "LOCAL_CERTIFICATION_DATABASE_NOT_DISPOSABLE"):
            run_local_certification(config={
                "host": "127.0.0.1", "port": "5432", "user": "x",
                "password": "x", "database": "manus_tienda_qa",
            }, correlation_id="qa-cert-unit-3")

    def test_future_qa_interface_requires_explicit_authorization_and_qa_identity(self) -> None:
        config = {
            "environment": "QA", "host": "qa.example", "port": "5432",
            "user": "qa_user", "password": "opaque", "database": "manus_tienda_qa",
            "schema": "public",
        }
        with self.assertRaisesRegex(CertificationError, "AUTHORIZATION_REQUIRED"):
            validate_qa_execution_request(config, operator_authorized=False)
        self.assertEqual(validate_qa_execution_request(config, operator_authorized=True)["database"], "manus_tienda_qa")
        config["environment"] = "PROD"
        with self.assertRaisesRegex(CertificationError, "CERTIFICATION_QA_ONLY"):
            validate_qa_execution_request(config, operator_authorized=True)


class DisposableCertificationPostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        DisposablePostgresTests.setUpClass()
        cls.psql = DisposablePostgresTests.psql
        cls.port = DisposablePostgresTests.port
        cls.database = "manus_governance_qa_cert"
        cls._run_psql("CREATE DATABASE manus_governance_qa_cert;", database="postgres")
        cls._run_psql(
            "CREATE TABLE public.migrations_history (version text, checksum text, success boolean);",
        )

    @classmethod
    def tearDownClass(cls) -> None:
        DisposablePostgresTests.tearDownClass()

    @classmethod
    def _config(cls) -> dict[str, str]:
        return {
            "host": "127.0.0.1", "port": str(cls.port), "user": "postgres",
            "password": "local-disposable-only", "database": cls.database,
        }

    @classmethod
    def _run_psql(cls, sql: str, *, database: str | None = None) -> str:
        return DisposablePostgresTests._run_psql(sql, db=database or cls.database)

    def test_real_certification_writes_then_always_rolls_back(self) -> None:
        before = history_fingerprint(self._config(), psql=str(self.psql))
        result = run_local_certification(
            config=self._config(), correlation_id="qa-cert-pg-1", psql=str(self.psql),
        )
        self.assertEqual(result["status"], "PASS")
        self.assertTrue(result["synthetic_write_visible_inside_transaction"])
        self.assertTrue(result["intentional_rollback"])
        self.assertTrue(result["post_rollback_object_absent"])
        self.assertTrue(result["history_fingerprint_unchanged"])
        self.assertTrue(result["lock_released"])
        self.assertNotEqual(result["transaction_observation"]["backend_pid"], None)
        self.assertEqual(history_fingerprint(self._config(), psql=str(self.psql)), before)
        self.assertEqual(self._run_psql(
            "SELECT to_regclass('public.governance_certification_probe_v1') IS NULL;"
        ), "t")

    def test_existing_certification_object_blocks_without_mutation(self) -> None:
        self._run_psql(
            "CREATE TABLE public.governance_certification_probe_v1 (marker text PRIMARY KEY, created_by text NOT NULL);"
        )
        before = history_fingerprint(self._config(), psql=str(self.psql))
        with self.assertRaisesRegex(CertificationError, "CERTIFICATION_TRANSACTION_FAILED"):
            run_local_certification(
                config=self._config(), correlation_id="qa-cert-pg-2", psql=str(self.psql),
            )
        self.assertEqual(history_fingerprint(self._config(), psql=str(self.psql)), before)
        self._run_psql("DROP TABLE public.governance_certification_probe_v1;")


if __name__ == "__main__":
    unittest.main()
