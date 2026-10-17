## 1. Renderer y contrato

- [x] 1.1 Extraer renderer ESC/POS térmico puro con ancho seguro de 48 columnas, wrapping e importes alineados.
- [x] 1.2 Hacer que NETWORK RAW use el renderer compartido sin cambiar su contrato HTTP.
- [x] 1.3 Exponer capacidades veraces de transporte y corte físico.

## 2. USB RAW Windows

- [x] 2.1 Agregar transporte USB RAW por spooler Windows usando solo la cola descubierta.
- [x] 2.2 Agregar selección explícita RAW/GDI y errores controlados sin fallback silencioso.
- [x] 2.3 Mantener GDI legado solo como fallback configurado y declarar corte físico no disponible.

## 3. Tests y evidencia

- [x] 3.1 Cubrir layout térmico, wrapping, importes y bytes ESC/POS/CUT.
- [x] 3.2 Cubrir USB RAW exitoso, error controlado y fallback GDI configurado.
- [x] 3.3 Actualizar evidencia QA con causa, configuración RAW, limitaciones y checklist de hardware.
- [x] 3.4 Ejecutar tests, build, OpenSpec estricto y `git diff --check`.

## 4. Correccion QA de secuencia final

- [x] 4.1 Reemplazar feed final minimo por avance ESC/POS suficiente antes de CUT.
- [x] 4.2 Cubrir orden binario BODY -> FOOTER -> FINAL FEED -> CUT.
- [x] 4.3 Ejecutar validaciones tecnicas posteriores y actualizar evidencia QA.

## 5. QA hardware y certificacion

- [x] 5.1 Registrar QA hardware XP-80 USB RAW y corte fisico como PASS.
- [x] 5.2 Reiniciar Agent con certificacion habilitada y confirmar una impresion final.

## 6. QA_PRINT_08 safe diagnostics

- [x] 6.1 Add bounded typed USB print/drawer errors, controlled command categories, safe HTTP responses and sanitized existing logs without changing successful schemas or physical behavior. Final review: typed errors and route-scoped HTTP masking use bounded codes; Windows reserved statuses are scoped to RAW/GDI; failure logs exclude arbitrary exception text. Successful schemas, printer bytes and certification checks remain unchanged by the diagnostic diff.
- [x] 6.2 Synchronize explicit Electron/web code allowlists and test unknown-code masking, mocked GDI/RAW failures, queue resolution and drawer certification. Final validation: 68/68 backend printer/discovery/diagnostic/drawer tests, 33/33 Electron Agent-client tests and 2/2 pure web print-error tests pass. Backend process/socket guards assert zero attempts; Electron requests reach only test-owned random-port loopback servers, never the runtime Agent. The backend test also verifies allowlist parity.
- [ ] 6.3 Run mock-only tests, supported typechecks/build/lint, strict OpenSpec and diff checks; retain physical QA as untested in this increment.

6.3 remains incomplete: backend production noEmit typecheck/build and Electron TypeScript compilation plus preload bundle pass; strict OpenSpec and diff checks pass. Electron build steps ran without the package script's clean step to preserve existing outputs. Web lint/build remain BLOCKED because local next is absent; no dependencies installed. Only the two pure web print-error tests were refreshed, not the earlier broader web suite. Codex did not reproduce physical QA; subsequent operator-reported evidence is recorded in design.md with its scope and provenance. Do not close this task from operator QA alone.

MANUS_PRECOMMIT_FINAL_01 evidence (2026-10-16 session): current candidate remains 16 modified tracked files and six new files, nothing staged. No application source or tests were edited in this documentation/validation pass. No live discovery, print, cutter, drawer, scale read, sale or restart was performed. The user-reported XP-80 RAW/feed/cut and separate drawer success do not certify other devices or the unresolved POS weight-capture flow (remote observation HTTP 409). Historical section 5 evidence remains historical; it does not establish current USB supportsPhysicalCut=true.

## 7. QA_PRINT_08S diagnostic scope corrections

- [x] 7.1 Restrict reserved exit statuses to Agent-owned Windows USB commands and make connection/transport metadata accurate without changing physical behavior or error-code allowlists.
- [x] 7.2 Cover Windows and Unix statuses 41/42, USB/NETWORK/other metadata and sanitized unknown failures with injected runners and no-hardware guards. Evidence: 47/47 selected backend tests pass, including four new scope regressions and NETWORK drawer failure-log assertions; process/socket guard counters remain zero.
- [x] 7.3 Run safe backend tests, production typecheck/build, strict OpenSpec and diff checks; record missing web dependency and leave physical certification pending. Evidence: production noEmit typecheck and build exit 0; strict validation and diff check pass. Web next remains absent, so lint/build stay BLOCKED; Electron/web sources and allowlists unchanged by 08S, no rerun required. No physical certification in this increment.

## 8. QA_PRINT_18 Windows USB correlation

- [x] 8.1 Acquire and validate exact Windows parent/children/container/port evidence and preserve queue descriptor identity through reconciliation with fail-closed availability.
- [x] 8.2 Cover positive, ambiguous, absent, offline, mismatched and multi-printer inventories plus persisted canonical ID/profile/association and unplug using guarded injected fixtures.
- [x] 8.3 Run only guarded mock suites, production typecheck/build, strict validation and diff checks; keep runtime and physical QA pending. Evidence: 65/65 combined guarded tests (18 new correlation cases and 47 regressions), final correlation rerun 18/18; production typecheck/build exit 0; PowerShell inventory parsed without execution, zero syntax errors; strict OpenSpec and diff checks pass. Web next remains absent; no dependencies installed. No live discovery, restart, printing, pulse or scale capture. Runtime OS acquisition and physical certification remain pending.

## 9. QA_PRINT_21 bounded PnP candidate scope

- [x] 9.1 Filter present USB Class_07 and USBPRINT candidates before property acquisition without changing timeout, correlation or serial behavior.
- [x] 9.2 Cover script filter ordering, irrelevant inventory, exact/negative joins, timeout, canonical identity and mocked serial regression with no-hardware guards. Evidence: 21/21 correlation tests pass, including three new regressions; process/socket guard assertions pass with zero attempts. Script ordering is inspected statically, not executed in PowerShell; the 500-noise-device test exercises correlation, not OS acquisition latency.
- [x] 9.3 Run isolated tests, production typecheck/build, strict OpenSpec and diff checks; keep runtime latency and physical certification pending. Evidence: production noEmit typecheck and build exit 0; strict OpenSpec and diff checks pass. No live discovery, restart or hardware command. Web unchanged; next remains absent, lint/build remain BLOCKED and were not run.
