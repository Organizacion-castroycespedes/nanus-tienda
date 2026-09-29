## Context

The Web login is a client component. Next.js exposes the two visual values through `next.config.mjs`; Electron packaged shells select a remote Web origin through `desktop/electron/scripts/environments.mjs`. The existing fallback used different brands by `NODE_ENV` and allowed one configured value to combine with a fallback value.

## Goals / Non-Goals

**Goals:**

- Resolve the two login values as one atomic public visual configuration.
- Use `/login-bg.png` and `MANUS POS` when DEV or QA explicitly configures both values.
- Preserve EMAUS POS as the complete fallback.
- Keep Electron origin selection and Peripheral Agent contracts unchanged.

**Non-Goals:**

- No authentication, API, database, cookie, CSP, Electron bridge, Agent, or installer behavior changes.
- No remote Web deployment, installer build, physical device test, or production configuration change.

## Decisions

- Use a small pure resolver in `web/lib/login-branding.mjs`. This avoids duplicated partial-value logic and is directly testable with Node's built-in test runner.
- Inject the resolver result through Next.js `env`. This is public visual data only; no secret is accepted or copied to the client bundle.
- Treat partial configuration as invalid and use both EMAUS fallback values. This prevents a Manus image with an EMAUS name, or the reverse.
- Keep packaged Electron environment URLs unchanged. The Electron shell loads the remote frontend selected by `manus-shell.config.json`; login branding must be configured in that Web deployment, not assumed to come from the installer.
- Resolve the Agent version from one helper: QA is pinned to `0.1.1-qa.13`, while production resolves to the package source version `0.1.1-prd.2`. The installer filename remains an output label, not the version source.

## Risks / Trade-offs

- [A Web deployment sets only one branding variable] → The resolver intentionally falls back to the complete EMAUS pair and the test covers this case.
- [A packaged QA shell points to the wrong Web origin] → Existing `select-shell-environment.mjs` and shell validation remain the authority; packaging stays unexecuted.
- [The host cannot build the approved QA version] → Require Node `>=24.21.0` before packaging; the current host reports `24.13.1`, so packaging remains blocked until the toolchain is updated.
