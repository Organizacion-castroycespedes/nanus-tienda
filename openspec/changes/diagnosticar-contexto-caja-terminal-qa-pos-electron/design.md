# Design: diagnose cash-session and terminal QA blocker for packaged Electron POS

## Approach

Use local code review and existing runtime evidence only.

1. Inspect POS context selection flow.
2. Inspect finance cash-session APIs.
3. Inspect current-shift report scope rules.
4. Compare the user-visible messages.
5. Document the likely blocker and safe next step.

## Likely source of truth

The operational chain is:

`authenticated user -> tenant -> branch -> terminal -> cash register -> cash session -> POS session`

The blocker appears when one endpoint sees an existing open cash register session while other views report no open session for the currently selected scope.

## Expected diagnosis output

- Exact endpoints and pages involved.
- Exact error messages.
- Probable scope mismatch.
- Safe remediation path for QA.

## Safety

This phase is read-only. It must not mutate cash-session data or bypass auth.

