from __future__ import annotations

import base64
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from load_migration_env import DotenvFormatError, encode_values, parse_dotenv


class MigrationDotenvTests(unittest.TestCase):
    def test_shell_like_values_are_data_and_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            marker = Path(directory) / "must-not-execute"
            command = f'-h "qa host" $(touch {marker}) --flag'
            parsed = parse_dotenv(
                "DB_HOST=qa.example\n"
                "DB_PASSWORD='secret fixture'\n"
                f"QA_BACKUP_COMMAND={command}\n"
                "MIGRATION_DRY_RUN=NO\n"
            )
            self.assertEqual(parsed["DB_HOST"], "qa.example")
            self.assertEqual(parsed["DB_PASSWORD"], "secret fixture")
            self.assertEqual(parsed["QA_BACKUP_COMMAND"], command)
            self.assertEqual(parsed["MIGRATION_DRY_RUN"], "NO")
            self.assertFalse(marker.exists())

            encoded = encode_values(parsed)
            decoded = {
                key: base64.b64decode(value).decode("utf-8")
                for key, value in (row.split("\t", 1) for row in encoded.splitlines())
            }
            self.assertEqual(decoded["DB_HOST"], parsed["DB_HOST"])
            self.assertEqual(decoded["DB_PASSWORD"], parsed["DB_PASSWORD"])
            self.assertEqual(decoded["MIGRATION_DRY_RUN"], parsed["MIGRATION_DRY_RUN"])
            self.assertNotIn("QA_BACKUP_COMMAND", decoded)

    def test_multiline_and_export_assignments_parse_without_evaluation(self) -> None:
        parsed = parse_dotenv(
            'export DB_NAME = manus_tienda_qa\n'
            'DB_PASSWORD="line one\nline two"\n'
            'SERVICE.URL="https://example.test/\\"quoted\\""\n'
        )
        self.assertEqual(parsed["DB_NAME"], "manus_tienda_qa")
        self.assertEqual(parsed["DB_PASSWORD"], "line one\nline two")
        self.assertEqual(parsed["SERVICE.URL"], 'https://example.test/"quoted"')
        self.assertNotIn("SERVICE.URL", encode_values(parsed))

    def test_application_database_names_map_to_runner_contract(self) -> None:
        parsed = parse_dotenv(
            "DB_DATABASE=manus_tienda_qa\nDB_USERNAME=qa_migration_user\n"
        )
        decoded = {
            key: base64.b64decode(value).decode("utf-8")
            for key, value in (row.split("\t", 1) for row in encode_values(parsed).splitlines())
        }
        self.assertEqual(decoded["DB_NAME"], "manus_tienda_qa")
        self.assertEqual(decoded["DB_USER"], "qa_migration_user")
        self.assertNotIn("DB_DATABASE", decoded)
        self.assertNotIn("DB_USERNAME", decoded)

    def test_malformed_or_unclosed_values_fail_without_echoing_value(self) -> None:
        for content in ("not an assignment\n", 'DB_PASSWORD="unclosed\n'):
            with self.subTest(content=content), self.assertRaises(DotenvFormatError):
                parse_dotenv(content)

    def test_missing_required_config_is_rejected_by_runner_without_secret_output(self) -> None:
        # The runner reports the missing key by name; it never prints any parsed value.
        parsed = parse_dotenv("DB_HOST=qa.example\nDB_USER=qa_user\n")
        self.assertNotIn("DB_PASSWORD", parsed)
        output = encode_values(parsed)
        self.assertNotIn("fixture-secret", output)

    def test_cli_does_not_print_secret_values_or_evaluate_command_text(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            marker = Path(directory) / "must-not-execute"
            env_file = Path(directory) / "qa.env"
            env_file.write_text(
                f"DB_PASSWORD=fixture-secret\nQA_BACKUP_COMMAND=-h $(touch {marker})\n",
                encoding="utf-8",
            )
            result = subprocess.run(
                [sys.executable, str(Path(__file__).with_name("load_migration_env.py")), str(env_file)],
                check=False,
                capture_output=True,
                text=True,
            )
        self.assertEqual(result.returncode, 0)
        self.assertNotIn("fixture-secret", result.stdout + result.stderr)
        self.assertFalse(marker.exists())


if __name__ == "__main__":
    unittest.main()
