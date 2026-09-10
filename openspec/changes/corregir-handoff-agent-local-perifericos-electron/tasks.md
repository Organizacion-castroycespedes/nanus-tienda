## 1. Contract and source trace

- [x] 1.1 Confirm the Electron preload/API allowlist and fixed Agent loopback;
      verify with Electron source inspection and the Electron regression suite.
- [x] 1.2 Trace browser versus Electron transport selection in peripheral UI;
      verify with the focused Web transport tests.
- [x] 1.3 Record authenticated cloud terminal and assignment endpoints;
      verify with `local-config-sync.spec.ts` and terminal-config source review.

## 2. Implementation

- [x] 2.1 Add explicit Electron bridge capability resolution in the Web
      peripheral transport without changing browser HTTPS validation; verify
      with `api.spec.ts`.
- [x] 2.2 Reuse existing typed IPC methods for health, devices, discovery,
      update, print, drawer, scale, and logs; verify with bridge routing tests.
- [x] 2.3 Keep cloud synchronization gated by authenticated operational
      terminal context; verify with `local-config-sync.spec.ts`.
- [x] 2.4 Preserve primary, drawer, queue-only, and installation identity
      semantics; verify with Agent persistence and peripheral regression tests.

## 3. Tests

- [x] 3.1 Test Electron bridge health/devices/discovery/update routing;
      focused API tests pass.
- [x] 3.2 Test pure browser HTTPS validation and unknown-path fail-closed
      behavior; focused API tests pass.
- [x] 3.3 Run Electron and Agent regressions; Electron 19/19 and Agent 92/92
      pass.
- [x] 3.4 Run relevant Web peripheral/cloud handoff tests; 49/49 pass,
      including the Electron subscription bypass regression.

## 4. Validation and QA

- [x] 4.1 Validate the active OpenSpec change and preserve the known global
      71/82 baseline; active change passes and historical 11 failures remain.
- [x] 4.2 Run `git diff --check`; no whitespace errors.
- [x] 4.3 Web-only fix confirmed; fresh Electron/Installer rebuild is not
      required because preload/main/IPC sources are unchanged.
- [ ] 4.4 Perform one physical packaged-Electron handoff reproduction; pending
      candidate installation.
