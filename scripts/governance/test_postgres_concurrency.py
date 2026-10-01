"""Disposable local PostgreSQL certification for D.1B concurrency.

This test creates a private local cluster with trust authentication, uses only
synthetic schema/history/migrations, and removes the cluster on exit. It never
reads project environment files and never connects to QA or PRD.
"""

from __future__ import annotations

import hashlib
import os
import shutil
import socket
import subprocess
import tempfile
import time
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RUNNER = ROOT / "scripts" / "database" / "apply_single_migration.sh"
GIT_BASH = Path(r"C:\Program Files\Git\usr\bin\bash.exe")


def checksum(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def execution_binding(name: str, digest: str, predecessor_kind: str,
                      predecessor_version: str, predecessor_checksum: str) -> str:
    payload = "\n".join((
        name.split("/", 1)[-1],
        f"scripts/database/migrations/{name.split('/')[-1]}",
        digest,
        predecessor_kind,
        predecessor_version,
        predecessor_checksum,
        "scripts/database/apply_single_migration.sh",
    ))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class DisposablePostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.psql = shutil.which("psql")
        cls.initdb = shutil.which("initdb")
        cls.pg_ctl = shutil.which("pg_ctl")
        if not all((cls.psql, cls.initdb, cls.pg_ctl)) or not GIT_BASH.exists():
            raise unittest.SkipTest("local PostgreSQL binaries or Git Bash unavailable")

        # Windows initdb cannot create its restricted token from the sandbox's
        # redirected user temp path. Keep this unique disposable cluster under
        # the workspace and register cleanup even when setup fails.
        cls.root = Path(tempfile.mkdtemp(prefix="manus-governance-pg-", dir=str(ROOT)))
        cls.addClassCleanup(lambda: shutil.rmtree(cls.root, ignore_errors=True))
        cls.data = cls.root / "data"
        cls.port = cls._free_port()
        cls.db = "manus_tienda_qa"
        cls.schema = "public"
        cls._run([cls.initdb, "-D", str(cls.data), "--auth=trust", "--username=postgres", "--no-locale"], timeout=60)
        cls._run([
            cls.pg_ctl, "-D", str(cls.data), "-o", f"-p {cls.port} -h 127.0.0.1",
            "-l", str(cls.root / "postgres.log"), "-w", "start",
        ], capture=False)
        cls._run_psql("CREATE DATABASE manus_tienda_qa;", db="postgres")
        cls._run_psql(
            """
            CREATE TABLE public.migrations_history (
                version text,
                checksum text,
                success boolean,
                details text
            );
            CREATE TABLE public.governance_marker (name text PRIMARY KEY);
            CREATE TABLE public.governance_tx_observation (kind text, backend_pid integer, transaction_id bigint);
            CREATE OR REPLACE FUNCTION public.observe_governance_history()
            RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                INSERT INTO public.governance_tx_observation
                    VALUES ('history', pg_backend_pid(), txid_current());
                RETURN NEW;
            END $$;
            CREATE TRIGGER observe_governance_history
                BEFORE INSERT ON public.migrations_history
                FOR EACH ROW EXECUTE FUNCTION public.observe_governance_history();
            CREATE SCHEMA governance_alt;
            CREATE SCHEMA governance_commit;
            CREATE SCHEMA governance_rollback;
            CREATE SCHEMA governance_loss;
            CREATE SCHEMA governance_scope_a;
            CREATE SCHEMA governance_scope_b;
            """
        )

        cls.fixture_root = cls.root / "runner"
        (cls.fixture_root / "scripts" / "database" / "migrations").mkdir(parents=True)
        shutil.copy2(RUNNER, cls.fixture_root / "scripts" / "database" / "apply_single_migration.sh")
        cls.env_file = cls.root / "local.env"
        cls.env_file.write_text(
            "\n".join([
                "DB_HOST=127.0.0.1",
                f"DB_PORT={cls.port}",
                f"DB_NAME={cls.db}",
                "DB_USER=postgres",
                "DB_PASSWORD=local-disposable-only",
                "DB_ADMIN_USER=postgres",
                "DB_ADMIN_PASSWORD=local-disposable-only",
                "ENVIRONMENT=QA",
                "DB_SCHEMA=public",
                "MIGRATION_GOVERNANCE_ERA=POST_CUTOVER",
                "GOVERNANCE_CUTOVER_APPROVED=YES",
            ]) + "\n",
            encoding="utf-8",
        )

    @classmethod
    def tearDownClass(cls) -> None:
        if hasattr(cls, "pg_ctl") and hasattr(cls, "data"):
            subprocess.run([cls.pg_ctl, "-D", str(cls.data), "-m", "immediate", "stop"],
                           capture_output=True, text=True, timeout=15, check=False)
        if hasattr(cls, "root"):
            shutil.rmtree(cls.root, ignore_errors=True)

    @staticmethod
    def _free_port() -> int:
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            return int(sock.getsockname()[1])

    @classmethod
    def _run(cls, command: list[str | Path], *, timeout: int = 20,
             capture: bool = True) -> subprocess.CompletedProcess[str]:
        kwargs: dict[str, object] = {"text": True, "timeout": timeout, "check": True}
        if capture:
            kwargs.update(capture_output=True)
        else:
            kwargs.update(stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return subprocess.run([str(part) for part in command], **kwargs)

    @classmethod
    def _run_psql(cls, sql: str, *, db: str | None = None, timeout: int = 10) -> str:
        result = cls._run([
            cls.psql, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1",
            "-p", str(cls.port), "-U", "postgres", "-d", db or cls.db, "-At", "-c", sql,
        ], timeout=timeout)
        return result.stdout.strip()

    @classmethod
    def _lock_sql(cls, schema: str = "public") -> str:
        return (
            "pg_try_advisory_xact_lock(hashtextextended("
            f"'manus-governed-migration-v1:' || current_database() || ':{schema}', 0))"
        )

    @classmethod
    def _hold_lock(cls, schema: str = "public", seconds: int = 3) -> subprocess.Popen[str]:
        sql = f"BEGIN; SELECT {cls._lock_sql(schema)}; SELECT pg_sleep({seconds}); COMMIT;"
        return subprocess.Popen([
            str(cls.psql), "-X", "-q", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1",
            "-p", str(cls.port), "-U", "postgres", "-d", cls.db, "-At", "-c", sql,
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    @classmethod
    def _open_lock_session(cls, schema: str) -> subprocess.Popen[str]:
        process = subprocess.Popen([
            str(cls.psql), "-X", "-q", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1",
            "-p", str(cls.port), "-U", "postgres", "-d", cls.db, "-At", "-f", "-",
        ], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        assert process.stdin is not None
        process.stdin.write(f"BEGIN; SELECT {cls._lock_sql(schema)};\n")
        process.stdin.flush()
        return process

    @staticmethod
    def _finish_holder(process: subprocess.Popen[str]) -> None:
        process.wait(timeout=8)
        if process.stdout is not None:
            process.stdout.close()
        if process.stderr is not None:
            process.stderr.close()

    @classmethod
    def _write_fixture(cls, name: str, sql: str) -> tuple[str, str]:
        path = cls.fixture_root / "scripts" / "database" / "migrations" / name
        path.write_text(sql, encoding="utf-8", newline="")
        return name, hashlib.sha256(path.read_bytes()).hexdigest()

    @classmethod
    def _run_runner(cls, name: str, digest: str, *, predecessor_kind: str,
                    predecessor_version: str, predecessor_checksum: str = "") -> subprocess.CompletedProcess[str]:
        env = os.environ.copy()
        env.update({
            "MIGRATION_EXPECTED_PREDECESSOR_KIND": predecessor_kind,
            "MIGRATION_EXPECTED_PREDECESSOR_VERSION": predecessor_version,
            "MIGRATION_EXPECTED_PREDECESSOR_CHECKSUM": predecessor_checksum,
        })
        binding = execution_binding(name, digest, predecessor_kind, predecessor_version, predecessor_checksum)
        return subprocess.run([
            str(GIT_BASH), str(cls.fixture_root / "scripts" / "database" / "apply_single_migration.sh"),
            str(cls.env_file), name, digest, binding,
        ], capture_output=True, text=True, env=env, timeout=15, check=False)

    def test_same_scope_contention_is_fail_fast(self) -> None:
        holder = self._hold_lock()
        time.sleep(0.35)
        started = time.monotonic()
        self.assertEqual(self._run_psql(f"SELECT {self._lock_sql()};"), "f")
        self.assertLess(time.monotonic() - started, 5)
        self._finish_holder(holder)

    def test_commit_releases_lock(self) -> None:
        self._run_psql(f"BEGIN; SELECT {self._lock_sql('governance_commit')}; COMMIT;")
        self.assertEqual(self._run_psql(f"BEGIN; SELECT {self._lock_sql('governance_commit')}; COMMIT;"), "t")

    def test_rollback_releases_lock(self) -> None:
        self._run_psql(f"BEGIN; SELECT {self._lock_sql('governance_rollback')}; ROLLBACK;")
        self.assertEqual(self._run_psql(f"BEGIN; SELECT {self._lock_sql('governance_rollback')}; COMMIT;"), "t")

    def test_connection_loss_releases_lock(self) -> None:
        holder = self._open_lock_session("governance_loss")
        time.sleep(0.35)
        assert holder.stdin is not None
        holder.stdin.close()
        self._finish_holder(holder)
        if holder.stdout is not None:
            holder.stdout.close()
        if holder.stderr is not None:
            holder.stderr.close()
        deadline = time.monotonic() + 8
        acquired = "f"
        while time.monotonic() < deadline:
            acquired = self._run_psql(f"SELECT {self._lock_sql('governance_loss')};")
            if acquired == "t":
                break
            time.sleep(0.2)
        self.assertEqual(acquired, "t")

    def test_different_schema_scope_does_not_collide(self) -> None:
        holder = self._hold_lock("governance_scope_a")
        time.sleep(0.35)
        self.assertEqual(self._run_psql(f"SELECT {self._lock_sql('governance_scope_b')};"), "t")
        self._finish_holder(holder)

    def test_00_real_runner_applies_first_post_boundary_step(self) -> None:
        name, digest = self._write_fixture(
            "V096__synthetic_governance.sql",
            "CREATE TABLE public.synthetic_v096 (id integer); "
            "INSERT INTO public.synthetic_v096 VALUES (1); "
            "INSERT INTO public.governance_tx_observation VALUES ('migration', pg_backend_pid(), txid_current());\n",
        )
        result = self._run_runner(name, digest, predecessor_kind="PRE_GOVERNANCE_BOUNDARY",
                                  predecessor_version="V095")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self._run_psql("SELECT count(*) FROM public.synthetic_v096;"), "1")
        self.assertEqual(self._run_psql("SELECT checksum FROM public.migrations_history WHERE version = 'V096__synthetic_governance.sql';"), digest)
        self.assertEqual(self._run_psql(
            "SELECT count(DISTINCT backend_pid) || ':' || count(DISTINCT transaction_id) "
            "FROM public.governance_tx_observation WHERE kind IN ('migration', 'history');"
        ), "1:1")

    def test_expected_predecessor_and_checksum_assertions(self) -> None:
        digest = self._run_psql("SELECT checksum FROM public.migrations_history WHERE version = 'V096__synthetic_governance.sql';")
        self.assertEqual(digest, hashlib.sha256(
            (self.fixture_root / "scripts" / "database" / "migrations" / "V096__synthetic_governance.sql").read_bytes()
        ).hexdigest())
        self.assertEqual(self._run_psql(
            "SELECT count(*) FROM public.migrations_history "
            "WHERE version = 'V096__synthetic_governance.sql' AND success = true;"
        ), "1")
        name, target_digest = self._write_fixture("V097__synthetic_bad_predecessor.sql", "INSERT INTO public.governance_marker VALUES ('bad-predecessor');\n")
        result = self._run_runner(name, target_digest, predecessor_kind="GOVERNED_POST_CUTOVER",
                                  predecessor_version="V096__synthetic_governance.sql", predecessor_checksum="0" * 64)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("EXPECTED_PREDECESSOR_MISMATCH", result.stderr)
        self.assertEqual(self._run_psql("SELECT count(*) FROM public.governance_marker WHERE name = 'bad-predecessor';"), "0")

    def test_target_already_present_blocks_replay(self) -> None:
        name, digest = self._write_fixture("V097__synthetic_target.sql", "INSERT INTO public.governance_marker VALUES ('target');\n")
        self._run_psql(f"INSERT INTO public.migrations_history VALUES ('{name}', '{digest}', true, 'seed');")
        result = self._run_runner(name, digest, predecessor_kind="GOVERNED_POST_CUTOVER",
                                  predecessor_version="V096__synthetic_governance.sql",
                                  predecessor_checksum=self._run_psql("SELECT checksum FROM public.migrations_history WHERE version = 'V096__synthetic_governance.sql';"))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("TARGET_ALREADY_APPLIED", result.stderr)

    def test_predecessor_success_false_blocks_before_mutation(self) -> None:
        name, digest = self._write_fixture(
            "V097__synthetic_failed_predecessor.sql",
            "INSERT INTO public.governance_marker VALUES ('failed-predecessor');\n",
        )
        self._run_psql(
            "INSERT INTO public.migrations_history VALUES "
            "('V097__failed.sql', '1111111111111111111111111111111111111111111111111111111111111111', false, 'seed');"
        )
        result = self._run_runner(name, digest, predecessor_kind="GOVERNED_POST_CUTOVER",
                                  predecessor_version="V097__failed.sql", predecessor_checksum="1" * 64)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("EXPECTED_PREDECESSOR_MISMATCH", result.stderr)
        self.assertEqual(self._run_psql("SELECT count(*) FROM public.governance_marker WHERE name = 'failed-predecessor';"), "0")

    def test_sql_failure_rolls_back_synthetic_mutation(self) -> None:
        name, digest = self._write_fixture(
            "V097__synthetic_sql_failure.sql",
            "INSERT INTO public.governance_marker VALUES ('sql-failure'); SELECT 1/0;\n",
        )
        predecessor = self._run_psql("SELECT checksum FROM public.migrations_history WHERE version = 'V096__synthetic_governance.sql';")
        result = self._run_runner(name, digest, predecessor_kind="GOVERNED_POST_CUTOVER",
                                  predecessor_version="V096__synthetic_governance.sql", predecessor_checksum=predecessor)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self._run_psql("SELECT count(*) FROM public.governance_marker WHERE name = 'sql-failure';"), "0")
        self.assertEqual(self._run_psql(f"SELECT count(*) FROM public.migrations_history WHERE version = '{name}';"), "0")
        self.assertEqual(self._run_psql(f"SELECT {self._lock_sql()};"), "t")

    def test_history_failure_rolls_back_synthetic_mutation(self) -> None:
        name, digest = self._write_fixture(
            "V097__synthetic_history_failure.sql",
            "INSERT INTO public.governance_marker VALUES ('history-failure');\n",
        )
        self._run_psql("ALTER TABLE public.migrations_history ADD CONSTRAINT synthetic_history_failure CHECK (version <> 'V097__synthetic_history_failure.sql');")
        predecessor = self._run_psql("SELECT checksum FROM public.migrations_history WHERE version = 'V096__synthetic_governance.sql';")
        result = self._run_runner(name, digest, predecessor_kind="GOVERNED_POST_CUTOVER",
                                  predecessor_version="V096__synthetic_governance.sql", predecessor_checksum=predecessor)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self._run_psql("SELECT count(*) FROM public.governance_marker WHERE name = 'history-failure';"), "0")
        self.assertEqual(self._run_psql(f"SELECT {self._lock_sql()};"), "t")

    def test_z_partial_progress_requires_fresh_state_for_next_step(self) -> None:
        first_name, first_digest = self._write_fixture(
            "V097__synthetic_partial_first.sql",
            "INSERT INTO public.governance_marker VALUES ('partial-first');\n",
        )
        predecessor = self._run_psql("SELECT checksum FROM public.migrations_history WHERE version = 'V096__synthetic_governance.sql';")
        first = self._run_runner(first_name, first_digest, predecessor_kind="GOVERNED_POST_CUTOVER",
                                 predecessor_version="V096__synthetic_governance.sql", predecessor_checksum=predecessor)
        self.assertEqual(first.returncode, 0, first.stderr)
        second_name, second_digest = self._write_fixture(
            "V098__synthetic_partial_second.sql",
            "INSERT INTO public.governance_marker VALUES ('partial-second');\n",
        )
        self._run_psql(
            "INSERT INTO public.migrations_history VALUES "
            "('V099__newer.sql', '2222222222222222222222222222222222222222222222222222222222222222', true, 'competing');"
        )
        second = self._run_runner(second_name, second_digest, predecessor_kind="GOVERNED_POST_CUTOVER",
                                  predecessor_version=first_name, predecessor_checksum=first_digest)
        self.assertNotEqual(second.returncode, 0)
        self.assertIn("CONFLICTING_POST_CUTOVER_STATE", second.stderr)
        self.assertEqual(self._run_psql("SELECT count(*) FROM public.governance_marker WHERE name = 'partial-first';"), "1")
        self.assertEqual(self._run_psql("SELECT count(*) FROM public.governance_marker WHERE name = 'partial-second';"), "0")

    def test_zz_conflicting_post_cutover_state_blocks_before_mutation(self) -> None:
        name, digest = self._write_fixture(
            "V097__synthetic_conflict_target.sql",
            "INSERT INTO public.governance_marker VALUES ('conflict-target');\n",
        )
        self._run_psql(
            "INSERT INTO public.migrations_history VALUES "
            "('V098__conflict.sql', '3333333333333333333333333333333333333333333333333333333333333333', true, 'seed');"
        )
        predecessor = self._run_psql("SELECT checksum FROM public.migrations_history WHERE version = 'V096__synthetic_governance.sql';")
        result = self._run_runner(name, digest, predecessor_kind="GOVERNED_POST_CUTOVER",
                                  predecessor_version="V096__synthetic_governance.sql", predecessor_checksum=predecessor)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("CONFLICTING_POST_CUTOVER_STATE", result.stderr)
        self.assertEqual(self._run_psql("SELECT count(*) FROM public.governance_marker WHERE name = 'conflict-target';"), "0")

    def test_v095_boundary_does_not_require_historical_row(self) -> None:
        self.assertEqual(self._run_psql("SELECT count(*) FROM public.migrations_history WHERE version = 'V095';"), "0")
        self.assertEqual(self._run_psql("SELECT count(*) FROM public.migrations_history WHERE version = 'V096__synthetic_governance.sql';"), "1")


if __name__ == "__main__":
    unittest.main(verbosity=2)
