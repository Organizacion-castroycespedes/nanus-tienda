# P9.1 validation

Date: 2026-09-11. Branch: `feat/develop/versionar-contratos-runtime-manus-terminal`.
HEAD/baseline: `5a393b475c5e96716f7d196cb0dd913b58c0e9f4`. Initial worktree clean.

P9.1 status: IMPLEMENTED / PENDING MERGE. Evidence distinguishes automated checks, operator-confirmed smoke and physical certification.

## A. Automated contract validation

| Area | Command | Result |
| --- | --- | --- |
| Electron | `npm run typecheck` | PASS |
| Electron | `npm test` (includes TypeScript build and bundled preload) | PASS, 33 tests, 7 suites, after scale transport correction |
| Electron query regression | `..\..\backend-perifericos\node_modules\.bin\tsx.cmd --test --test-name-pattern=getAgentCurrentWeight agent-client.spec.ts` | PASS, 2/2; both failed before the correction |
| Web runtime contract | `..\backend-perifericos\node_modules\.bin\tsx.cmd --test domains/peripherals/runtime-contract.spec.ts` | PASS, 6/6 after scale transport correction |
| Web relevant | `..\backend-perifericos\node_modules\.bin\tsx.cmd --test "domains/peripherals/*.spec.ts"` | PASS, 37 tests |
| Web baseline | `$specFiles = @(rg --files -g '*.spec.ts' -g '!node_modules' -g '!.next'); & ..\backend-perifericos\node_modules\.bin\tsx.cmd --test @specFiles` | PASS, 189 tests, 11 suites |
| Web | `npm run lint` | PASS; 19 existing warnings in unchanged login/configuration/layout/purchases/roles/users files |
| Web | `npm run build` | PASS; compiled, typechecked and generated routes |
| Agent | `npm test` | PASS, 92 tests from P9.1 validation; includes HTTP health generation assertion. Agent source unchanged by final scale transport correction; rerun not required |
| Agent | `npm run build` | PASS |
| OpenSpec 1.13.0 | `openspec validate versionar-contratos-runtime-manus-terminal --strict` | PASS |
| OpenSpec 1.13.0 | `openspec validate --all` | PASS, 85/85; 11 existing Purpose warnings |
| OpenSpec extra strict global | `openspec validate --all --strict` | 74 PASS, 11 FAIL due exclusively to existing Purpose placeholders |
| Git | `git diff --check` | PASS |

Strict-global failures are unchanged specs: access-role-audit, catalog-action-focus-ux, deliveries-cash-register-integration, deliveries-customer-integration, deliveries-dispatch-operation, deliveries-invoicing-integration, deliveries-management, deliveries-orders-integration, deliveries-permissions, deliveries-reporting, promotion-action-focus-ux. `git diff -- openspec/specs` is empty. They are outside P9.1 and remain unchanged.

Tests cover wire typing across Web/Electron, generation classification, missing callable methods, absent declarations, legacy partial bridges, absent browser/SSR bridge, malformed/unsupported metadata, timeout/rejection, fixed dispatch and no renderer HTTP fallback. Agent client tests cover valid/invalid/missing API generations. Existing browser transport and POS integration baseline tests pass.

### scale.currentWeight regression

Root cause: Electron constructed the query but its HTTP transport sent only `target.pathname`. Small correction sends `target.pathname + target.search`, preserving URL encoding. Method, Agent URL ownership, loopback restrictions, timeout model, retries, scale semantics and Agent defaults are unchanged.

Deterministic local HTTP server tests inspect the actual received `request.url` and GET method. They verify both context fields and special-character encoding, including `&`, `+`, `/`, `?`, `#` and `=`. Received target for the required case:

```text
/scale/current-weight?terminalId=terminal-review&deviceId=scale-review
```

Agent test server received terminalId=`terminal-review` and deviceId=`scale-review`. Both regression cases failed before the fix and passed after it. The unchanged capability list includes scale.currentWeight as API/contract support. This is transport validation, not a physical scale reading.

Manual code review confirms fixed zero-argument metadata IPC, sanitized health projection, unchanged loopback configuration and isolation settings. Runtime support is distinct from hardware readiness. Package versions remain unchanged; no release artifact is issued by this uncommitted implementation.

## B. Runtime smoke

Current branch Web started with `npm run dev` at `http://localhost:3000/`; HTTP 200 confirmed. Electron started using the current branch `npm run dev` workflow, which rebuilds main/preload, with local diagnostic flags for renderer inspection. Renderer URL, visible content and callable `getRuntimeInfo()` confirmed. Previously installed 7.2AB binary was not used as evidence.

Operator-confirmed results:

| Check | Result |
| --- | --- |
| Browser Web | PASS |
| Electron launch | PASS |
| Current Web loaded in Electron | PASS |
| POS navigation | PASS |
| Peripherals page | PASS |
| Visible runtime error | NO |

Startup errors: NONE. Non-blocking warning: outdated Browserslist data. Web/Electron processes were left running for operator QA after startup verification.

## C. Degraded-Agent startup validation

Observed development runtime metadata:

```json
{
  "electronRuntimeVersion": "0.1.0",
  "bridgeContractVersion": 1,
  "agentApiVersion": null,
  "capabilities": ["agent.health"]
}
```

Result: PASS, expected DEGRADED behavior. Agent metadata could not be verified in this development startup, which does not configure the packaged Agent client. Unknown/unavailable Agent does not cause Web/Electron runtime failure and does not advertise unverified Agent capabilities. Contract generation remains Agent API 1; null is the observed unknown state, not a new generation or an incompatibility failure. This smoke does not exercise all generation-1 Agent operations; automated contract tests and transport tests provide that scoped evidence.

## D. Physical hardware validation

NOT PERFORMED / NOT REQUIRED FOR P9.1. Physical peripherals certified: NO. No printer, drawer, scanner or scale certification is inferred from runtime capabilities or successful startup.

## Final scope audit

Only P9.1 runtime metadata/versioning, capability negotiation, graceful compatibility, scale query transport correction, related tests, active P9.1 OpenSpec and terminal architecture roadmap are included. Generated Electron build outputs are ignored and excluded from the final diff; no generated binaries are added. Installer source/artifacts unchanged and Installer not rebuilt. P7/P8 evidence/specs unchanged; no reopening or recertification.

P9.2-P9.6 remain PLANNED documentation only: no pairing/device registry, startup registration, recovery shell, updater or Linux implementation. Selective local business cache remains DEFERRED; offline sales remains FUTURE EPIC. No commit, push or merge performed.
