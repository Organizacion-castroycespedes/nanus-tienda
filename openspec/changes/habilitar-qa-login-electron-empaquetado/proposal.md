## Why

Electron packaged QA got blocked at the login screen because the current web login flow requires a manual human-check gate before credentials are accepted. The app already has a real auth flow, so the fix should unlock QA only in an explicit non-production path, not weaken production login.

## What Changes

- Add a safe QA-only login path for packaged Electron testing.
- Keep production login behavior unchanged.
- Gate the human-check bypass behind an explicit local/QA configuration.
- Document the QA login route and its risks.
- Add tests for the QA login gate helper.

## Capabilities

### New Capabilities
- `electron-qa-access`: safe QA access path for packaged Electron manual testing without a production bypass.

### Modified Capabilities
- None.

## Impact

- `web/app/login/page.tsx`
- `web/domains/auth/*`
- `web/.env.example`
- `docs/architecture/*`
- `docs/evidence/*`
- OpenSpec change artifacts for QA login access
