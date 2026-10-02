import inspect
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

from migration_runner_policy import next_safe_version_evaluation
from prd_evidence_executor import (
    ALLOWED_OPERATION,
    CONTRACT_VERSION,
    LIVE_PROVENANCE,
    BEGIN_MARKER,
    END_MARKER,
    READ_ONLY_SQL,
    build_read_only_sql_plan,
    build_prd_evidence_request,
    collect_prd_migration_evidence,
    execute_read_only_transport,
    execute_prd_evidence_request,
    execute_prd_evidence_process,
    validate_prd_evidence_request,
    validate_prd_evidence_response,
    validate_runtime_config,
    parse_read_only_transport_output,
)


def valid_request(correlation_id="op-001"):
    return build_prd_evidence_request(correlation_id)


def valid_response(request, **overrides):
    evidence = {
        "evidence_type": "LIVE",
        "provenance": LIVE_PROVENANCE,
        "same_operation": True,
        "identity": {
            "environment": "prd",
            "hostname": "vmi3503021",
            "user": "ubuntu",
            "current_database": "emaus_tienda",
            "current_schema": "public",
        },
        "schema": {"table": "public.migrations_history", "exists": True,
                   "columns": ["version", "checksum", "success"]},
        "read_only_verified": True,
        "history_rows": [],
        "occupied_numeric_identities": ["V095"],
        "query_count": 2,
        "write_count": 0,
    }
    evidence.update(overrides.pop("evidence", {}))
    response = {
        "contract_version": CONTRACT_VERSION,
        "operation": ALLOWED_OPERATION,
        "correlation_id": request["correlation_id"],
        "status": "VERIFIED",
        "evidence": evidence,
    }
    response.update(overrides)
    return response


def trusted_runtime_config():
    return {
        "PRD_SSH_EXECUTABLE": r"C:\Windows\System32\OpenSSH\ssh.exe",
        "PRD_SSH_TARGET_HOST": "169.58.165.38",
        "PRD_SSH_PORT": "2798",
        "PRD_SSH_USER": "ubuntu",
        "PRD_SSH_KEY_PATH": r"C:\opaque\fake-key",
        "PRD_REMOTE_ENV_PATH": "/opt/emaus/tienda/emaus_reporteria/.env",
        "PRD_EXPECTED_HOSTNAME": "vmi3503021",
        "PRD_EXPECTED_DATABASE": "emaus_tienda",
        "PRD_EXPECTED_SCHEMA": "public",
    }


def mocked_remote_payload(request):
    return {
        "identity": {
            "current_database": request["expected_database"],
            "current_schema": request["expected_schema"],
            "user": "ubuntu",
        },
        "schema": {"table": "public.migrations_history", "exists": True,
                   "columns": []},
        "read_only_verified": True,
        "history_rows": [],
        "query_count": 1,
        "write_count": 0,
    }


class PrdEvidenceExecutorTests(unittest.TestCase):
    def test_valid_request_is_accepted(self):
        result = validate_prd_evidence_request(valid_request())
        self.assertEqual(result["status"], "ACCEPTED")

    def test_only_allowlisted_operation_is_accepted(self):
        request = valid_request()
        request["operation"] = "run_remote_command"
        self.assertEqual(validate_prd_evidence_request(request)["error"]["code"],
                         "OPERATION_NOT_ALLOWLISTED")

    def test_forbidden_command_sql_and_query_fields_are_rejected(self):
        for field in ("command", "shell", "script", "sql", "query"):
            request = valid_request()
            request[field] = "SELECT 1"
            self.assertEqual(validate_prd_evidence_request(request)["status"], "UNVERIFIED")

    def test_unknown_fields_are_rejected(self):
        request = valid_request()
        request["unexpected"] = "value"
        self.assertEqual(validate_prd_evidence_request(request)["error"]["code"],
                         "UNKNOWN_REQUEST_FIELD")

    def test_invalid_correlation_is_rejected(self):
        for value in ("", "\n", "x" * 129):
            request = valid_request("op-001")
            request["correlation_id"] = value
            self.assertEqual(validate_prd_evidence_request(request)["error"]["code"],
                             "CORRELATION_ID_INVALID")

    def test_private_key_content_field_is_rejected(self):
        request = valid_request()
        request["private_key"] = "PRIVATE KEY CONTENT"
        self.assertEqual(validate_prd_evidence_request(request)["error"]["code"],
                         "FORBIDDEN_REQUEST_FIELD")

    def test_executor_unavailable_fails_closed(self):
        result = execute_prd_evidence_request(valid_request(), None)
        self.assertEqual(result["error"]["code"], "EXECUTOR_UNAVAILABLE")

    def test_executor_exception_fails_closed(self):
        def unavailable(_request):
            raise RuntimeError("transport failure")

        result = execute_prd_evidence_request(valid_request(), unavailable)
        self.assertEqual(result["error"]["code"], "EXECUTOR_FAILURE")

    def test_malformed_response_fails_closed(self):
        result = execute_prd_evidence_request(valid_request(), lambda _request: {})
        self.assertEqual(result["error"]["code"], "CORRELATION_ID_MISMATCH")

    def test_contract_version_mismatch_fails_closed(self):
        request = valid_request()
        response = valid_response(request, contract_version="old")
        result = validate_prd_evidence_response(response, request)
        self.assertEqual(result["error"]["code"], "CONTRACT_VERSION_MISMATCH")

    def test_correlation_mismatch_fails_closed(self):
        request = valid_request()
        response = valid_response(request, correlation_id="other-op")
        result = validate_prd_evidence_response(response, request)
        self.assertEqual(result["error"]["code"], "CORRELATION_ID_MISMATCH")

    def test_operation_mismatch_fails_closed(self):
        request = valid_request()
        response = valid_response(request, operation="other_operation")
        result = validate_prd_evidence_response(response, request)
        self.assertEqual(result["error"]["code"], "OPERATION_MISMATCH")

    def test_fixture_provenance_cannot_masquerade_as_live(self):
        request = valid_request()
        response = valid_response(request, evidence={"provenance": "SYNTHETIC_FIXTURE"})
        result = validate_prd_evidence_response(response, request)
        self.assertEqual(result["error"]["code"], "EVIDENCE_PROVENANCE_UNVERIFIED")

    def test_verified_response_missing_history_version_fails_closed(self):
        request = valid_request()
        response = valid_response(request, evidence={"history_rows": [{"success": True}]})
        result = validate_prd_evidence_response(response, request)
        self.assertEqual(result["error"]["code"], "EVIDENCE_MALFORMED")

    def test_verified_status_only_capture_fails_closed(self):
        request = valid_request()
        response = valid_response(request)
        del response["evidence"]["history_rows"]
        result = validate_prd_evidence_response(response, request)
        self.assertEqual(result["error"]["code"], "EVIDENCE_MALFORMED")

    def test_history_allowlist_drops_secret_like_fields(self):
        request = valid_request()
        response = valid_response(request, evidence={
            "history_rows": [{"version": "V095", "success": True,
                               "checksum": "a" * 64, "password": "secret",
                               "details": "secret"}],
        })
        result = validate_prd_evidence_response(response, request)
        self.assertEqual(result["status"], "VERIFIED")
        row = result["evidence"]["history_rows"][0]
        self.assertNotIn("password", row)
        self.assertNotIn("details", row)

    def test_same_operation_is_required(self):
        request = valid_request()
        response = valid_response(request, evidence={"same_operation": False})
        result = validate_prd_evidence_response(response, request)
        self.assertEqual(result["error"]["code"], "SAME_OPERATION_EVIDENCE_REQUIRED")

    def test_read_only_and_zero_writes_are_required(self):
        request = valid_request()
        response = valid_response(request, evidence={"read_only_verified": False})
        result = validate_prd_evidence_response(response, request)
        self.assertEqual(result["error"]["code"], "READ_ONLY_EVIDENCE_INVALID")

    def test_identity_mismatch_fails_closed(self):
        request = valid_request()
        response = valid_response(request, evidence={
            "identity": {"hostname": "wrong", "current_database": "emaus_tienda",
                          "current_schema": "public"},
        })
        result = validate_prd_evidence_response(response, request)
        self.assertEqual(result["error"]["code"], "SOURCE_HOST_MISMATCH")

    def test_success_is_sanitized(self):
        request = valid_request()
        response = valid_response(request, evidence={
            "password": "secret", "raw_stderr": "password=secret",
        })
        result = execute_prd_evidence_request(request, lambda _request: response)
        self.assertEqual(result["status"], "VERIFIED")
        self.assertNotIn("password", result["evidence"])
        self.assertNotIn("raw_stderr", result["evidence"])

    def test_request_cannot_change_execution_semantics(self):
        request = valid_request()
        seen = []
        execute_prd_evidence_request(request, lambda value: (seen.append(value) or valid_response(value)))
        self.assertEqual(set(seen[0]), {"contract_version", "operation", "correlation_id",
                                        "expected_host", "expected_database", "expected_schema"})

    def test_no_shell_true_or_subprocess_in_executor_boundary(self):
        source = inspect.getsource(execute_prd_evidence_request)
        self.assertNotIn("shell=True", source)
        self.assertNotIn("subprocess", source)

    def test_next_version_stays_unverified_without_prd_live_evidence(self):
        sources = {
            "Repository": {"status": "VERIFIED", "occupied_numeric_identities": ["V096"]},
            "Target": {"status": "VERIFIED", "occupied_numeric_identities": ["V096"]},
            "QA": {"status": "VERIFIED", "evidence_type": "LIVE", "same_operation": True,
                   "occupied_numeric_identities": ["V096"]},
            "PRD": {"status": "UNVERIFIED", "occupied_numeric_identities": []},
        }
        result = next_safe_version_evaluation(
            cutover_boundary_version="V095", cutover_approved=True,
            required_sources=sources,
        )
        self.assertEqual(result["status"], "UNVERIFIED")
        self.assertIsNone(result["candidate"])

    def test_process_round_trip_uses_utf8_and_one_json_stdout_payload(self):
        environment = os.environ.copy()
        environment["PRD_EVIDENCE_EXECUTOR_TEST_BACKEND"] = "fixture"
        request = valid_request("utf8-ñ-001")
        completed = subprocess.run(
            [sys.executable, str(Path(__file__).with_name("prd_evidence_executor.py")), "--process"],
            input=json.dumps(request, ensure_ascii=False).encode("utf-8"),
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=False,
            env=environment, check=False,
        )
        self.assertEqual(completed.returncode, 0)
        self.assertEqual(completed.stderr, b"")
        response = json.loads(completed.stdout.decode("utf-8"))
        self.assertEqual(response["correlation_id"], "utf8-ñ-001")
        self.assertEqual(response["evidence"]["provenance"], "EXECUTOR_TEST_FIXTURE")
        self.assertEqual(response["evidence"]["history_rows"][0]["version"], "V095")

    def test_process_launcher_rejects_untrusted_fixture_as_live(self):
        environment = os.environ.copy()
        environment["PRD_EVIDENCE_EXECUTOR_TEST_BACKEND"] = "fixture"
        result = execute_prd_evidence_process(valid_request(), process_environment=environment)
        self.assertEqual(result["error"]["code"], "EVIDENCE_PROVENANCE_UNVERIFIED")

    def test_process_malformed_request_is_nonzero_and_machine_readable(self):
        completed = subprocess.run(
            [sys.executable, str(Path(__file__).with_name("prd_evidence_executor.py")), "--process"],
            input=b"not-json", stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            shell=False, check=False,
        )
        self.assertEqual(completed.returncode, 2)
        self.assertEqual(completed.stderr, b"")
        self.assertEqual(json.loads(completed.stdout.decode("utf-8"))["status"], "UNVERIFIED")

    def test_process_launcher_unavailable_fails_closed(self):
        result = execute_prd_evidence_process(valid_request(), executable="missing-python")
        self.assertEqual(result["error"]["code"], "EXECUTOR_PROCESS_UNAVAILABLE")

    def test_process_launcher_has_fixed_entrypoint_and_no_request_argv_control(self):
        source = inspect.getsource(execute_prd_evidence_process)
        self.assertIn('"--process"', source)
        self.assertNotIn("request[\"executable\"]", source)
        self.assertNotIn("request[\"argv\"]", source)

    def test_runtime_config_is_trusted_and_key_path_is_opaque(self):
        result = validate_runtime_config(trusted_runtime_config())
        self.assertEqual(result["status"], "READY")
        self.assertIn("PRD_SSH_KEY_PATH", trusted_runtime_config())

    def test_missing_runtime_config_fails_closed(self):
        self.assertEqual(validate_runtime_config({})["status"], "UNVERIFIED")

    def test_plan_has_fixed_read_only_argv_and_sql(self):
        request = valid_request()
        plan = build_read_only_sql_plan(request, trusted_runtime_config())
        self.assertEqual(plan["status"], "READY")
        self.assertEqual(plan["argv"][-2:], ["bash", "-s"])
        self.assertNotIn("StrictHostKeyChecking=no", plan["argv"])
        self.assertNotRegex(READ_ONLY_SQL, r"(?i)\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE)\b")
        self.assertNotIn("sql", request)
        self.assertNotIn("password", plan["argv"])
        self.assertIn(BEGIN_MARKER, plan["remote_script"])
        self.assertIn(END_MARKER, plan["remote_script"])

    def test_request_cannot_change_transport_plan_identity_or_ssh(self):
        request = valid_request()
        request["expected_host"] = "attacker.example"
        result = build_read_only_sql_plan(request, trusted_runtime_config())
        self.assertEqual(result["status"], "UNVERIFIED")

    def test_mocked_backend_assigns_live_provenance_only_after_parse(self):
        request = valid_request("mock-live-001")
        payload = json.dumps(mocked_remote_payload(request), ensure_ascii=False).encode("utf-8")
        completed = subprocess.CompletedProcess([], 0, BEGIN_MARKER.encode() + b"\n" + payload + b"\n" + END_MARKER.encode(), b"")
        environment = os.environ.copy()
        environment.update({name: str(value) for name, value in trusted_runtime_config().items()})
        environment["PRD_EVIDENCE_EXECUTOR_ENABLE_LIVE"] = "YES"
        with patch.dict(os.environ, environment, clear=False):
            with patch("prd_evidence_executor.subprocess.run", return_value=completed) as run:
                result = collect_prd_migration_evidence(request)
        self.assertEqual(result["status"], "VERIFIED")
        self.assertEqual(result["evidence"]["provenance"], LIVE_PROVENANCE)
        self.assertEqual(result["evidence"]["identity"]["hostname"], "vmi3503021")
        run.assert_called_once()

    def test_mocked_transport_nonzero_and_timeout_fail_closed(self):
        request = valid_request()
        plan = build_read_only_sql_plan(request, trusted_runtime_config())
        failed = subprocess.CompletedProcess([], 22, b"", b"technical sanitized error")
        with patch("prd_evidence_executor.subprocess.run", return_value=failed):
            result = execute_read_only_transport(plan, request)
        self.assertEqual(result["error"]["code"], "PRD_TRANSPORT_FAILED")

    def test_markers_malformed_or_multiple_fail_closed(self):
        request = valid_request()
        payload = json.dumps(mocked_remote_payload(request)).encode("utf-8")
        for output in (
            payload,
            BEGIN_MARKER.encode() + b"\n" + payload + b"\n" + END_MARKER.encode() + b"\n" + END_MARKER.encode(),
        ):
            result = parse_read_only_transport_output(output, request, "vmi3503021")
            self.assertEqual(result["status"], "UNVERIFIED")

    def test_mocked_timeout_and_stderr_fail_closed(self):
        request = valid_request()
        plan = build_read_only_sql_plan(request, trusted_runtime_config())
        with patch("prd_evidence_executor.subprocess.run", side_effect=subprocess.TimeoutExpired(plan["argv"], 1)):
            timeout_result = execute_read_only_transport(plan, request)
        self.assertEqual(timeout_result["error"]["code"], "PRD_TRANSPORT_UNAVAILABLE")
        failed = subprocess.CompletedProcess([], 0, b"", b"sanitized diagnostic")
        with patch("prd_evidence_executor.subprocess.run", return_value=failed):
            stderr_result = execute_read_only_transport(plan, request)
        self.assertEqual(stderr_result["error"]["code"], "PRD_TRANSPORT_DIAGNOSTIC")


if __name__ == "__main__":
    unittest.main()
