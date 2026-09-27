## Why

The login already accepts visual branding variables, but development and QA can fall back to a different brand than production, and partial configuration can mix an image from one brand with the name of another. This change makes the environment contract deterministic before TERM-002 and TERM-003 installer QA.

## What Changes

- Define `LOGIN_BG_IMAGE` and `LOGIN_BRAND_NAME` as an all-or-nothing public visual configuration.
- Use the configured pair for DEV and QA (`/login-bg.png` and `MANUS POS`).
- Use the complete EMAUS POS fallback when both values are absent or only one value is present.
- Test configured, absent, and partial branding without exposing secrets.
- Document that Electron packaged shells load the remote frontend selected by their environment profile.
- Select the approved `0.1.1-qa.13` Agent version for the QA Windows packaging profile while keeping production at `0.1.1-prd.2`.

## Capabilities

### New Capabilities

- `login-branding`: Deterministic visual branding configuration for the Web login.

### Modified Capabilities

None.

## Impact

- Web login metadata, visual background, Next.js public environment injection, and environment example configuration.
- No API, database, Electron bridge, Peripheral Agent, installer binary, authentication, or production URL changes.
- Installer scripts receive a profile-aware Agent version source; output-name override and isolated packaging validation remain required before distribution.
