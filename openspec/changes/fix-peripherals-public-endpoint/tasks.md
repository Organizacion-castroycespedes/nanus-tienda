## 1. Frontend Configuration

- [x] 1.1 Add a centralized peripheral agent config resolver in `web/domains/peripherals/api.ts`.
- [x] 1.2 Preserve local development fallback to `http://localhost:4050` and `ws://localhost:4050/peripherals`.
- [x] 1.3 Block production fetch/WebSocket attempts when the HTTP URL is missing, local, or non-HTTPS.
- [x] 1.4 Derive `wss://.../peripherals` from HTTPS HTTP URL when WS URL is not configured.
- [x] 1.5 Return stable frontend error codes for missing config, invalid config, agent offline, network/CORS failure, and HTTP errors.

## 2. Admin UI

- [x] 2.1 Update `web/domains/peripherals/components/PeripheralsPage.tsx` to consume the centralized config.
- [x] 2.2 Remove hardcoded `localhost:4050` text from React components.
- [x] 2.3 Show distinct states for backend available, backend unavailable, missing config, invalid config, and CORS/red errors.
- [x] 2.4 Confirm `/[tenant]/admin/peripherals` route and permission rule stay unchanged.

## 3. Backend CORS

- [x] 3.1 Harden `backend-perifericos` CORS origin handling for configured origins.
- [x] 3.2 Ensure `OPTIONS /devices` and supported routes respond correctly for allowed origins.
- [x] 3.3 Add automated coverage or smoke validation for allowed preflight, no-origin smoke, and disallowed origin behavior.

## 4. Documentation And Evidence

- [x] 4.1 Update `web/.env.example` with development and production guidance for peripheral agent URLs.
- [x] 4.2 Update `web/domains/peripherals/README.md` and `backend-perifericos/README.md` with environment and CORS notes.
- [x] 4.3 Create technical evidence for the fix under `openspec/changes/fix-peripherals-public-endpoint/`.
- [x] 4.4 Run targeted validation: OpenSpec validate, grep for forbidden hardcoded component URLs, backend tests/build, web lint/build as feasible.
