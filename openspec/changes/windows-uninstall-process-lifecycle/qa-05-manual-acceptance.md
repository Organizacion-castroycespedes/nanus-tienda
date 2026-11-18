# QA-05 manual acceptance protocol

Scope: authorized non-production Dell QA workstation only. This protocol is manual. Do not use it on production.

1. Preflight

- Confirm branch `fix/develop/windows-uninstall-process-lifecycle` and HEAD `1c024c90a6583a0cde91d7ef126c15f8906da4f7`.
- Verify BUILD-04 SHA256 is `15BFF3563C29518E3EED415A9DE36BC5694260DB29B19AD45494054459EA77A5`.
- Confirm no active POS transaction, no unsaved work, readable recovery bundle, and PostgreSQL 18 is unchanged.
- Record service, process, port, registry, installation-root, and backup fingerprints. Do not print secrets. Do not reboot automatically.

2. Controlled uninstall

- Use only the BUILD-04 executable and the documented uninstall action. Do not use the old registered command and do not pass `--remove-data`.
- Run the supported elevated action once. Capture the authoritative process exit code.
- If exit code is `2`, poll `C:\ProgramData\Manus\PeripheralAgent\state\uninstall-result.json` for the new operationId. Accept success only when that matching operation reaches terminal `completed`.
- Verify SCM 1060, zero scoped POS/Agent processes, port `127.0.0.1:4050` closed, POS/Agent payload roots absent, uninstall registration absent, shortcuts removed, and ProgramData/LocalService configuration retained. Verify PostgreSQL and unrelated services/processes are unchanged.
- Any `1`, timeout, missing result, foreign operationId, failed/partial outcome, unknown observation, or retained payload/registration is FAIL or BLOCKED. Do not manually delete or retry.

3. Install and restore

- Launch the same BUILD-04 executable with the supported elevated install action. For a PowerShell operator, use the existing installer UI/action through `Start-Process -Verb RunAs -Wait -PassThru`; record its real exit code.
- Verify version `0.1.1-qa.13`, one `ManusPeripheralAgent` service, `Running`, `Automatic`, `NT AUTHORITY\\LocalService`, corrected ImagePath, loopback port 4050, HTTP 200/API v2 health, QA URLs, retained installationId/configuration, POS manifest 75/75, and POS version 0.1.0.
- Launch POS manually. Verify login and authentication. Do not claim GUI PASS from automation alone.

4. Physical peripheral check

- Confirm XP-58 is recognized on `USB001` and associated with the QA configuration.
- With an operator present, run one non-fiscal diagnostic/test print only if the supported UI exposes it. Record paper output and errors. No invoice, fiscal issuance, payment, or real business transaction.
- Scanner, scale, and cash drawer: `NOT_TESTED` if absent.

5. Closeout

- Preserve logs, exit codes, result JSON, service/process/port snapshots, device evidence, and before/after hashes.
- Leave the workstation operational with BUILD-04 installed, or stop and report the exact recovery blocker. Do not delete evidence, reboot, or perform manual registry/filesystem cleanup.