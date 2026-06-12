# Evidence: fix-peripherals-public-endpoint

## Branch

- Branch: `fix/develop/perifericos`
- OpenSpec change: `fix-peripherals-public-endpoint`

## Technical Changes

- Frontend URL resolution is centralized in `web/domains/peripherals/api.ts`.
- Development fallback remains `http://localhost:4050` and `ws://localhost:4050/peripherals`.
- Production requires `NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL` to be a public `https://` URL.
- Production rejects missing URL, `http://`, `localhost`, and `127.0.0.1` before any `fetch`.
- WebSocket URL is explicit through `NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL` or derived as `wss://<host>/peripherals`.
- React component source under `web/domains/peripherals/components` no longer contains `localhost:4050`.
- `GET` requests no longer force `Content-Type: application/json`, avoiding unnecessary preflight for `/devices`.
- `backend-perifericos` CORS options are centralized and tested.
- `OPTIONS /devices` is covered for allowed and disallowed origins.
- Multi-tenant route and permission rule remain unchanged.

## Validation

```text
openspec.cmd validate fix-peripherals-public-endpoint --type change --strict
PASS: Change 'fix-peripherals-public-endpoint' is valid
```

```text
backend-perifericos> npm.cmd test
PASS: 33 tests, 33 pass
Includes runtime HTTP smoke for GET /health, GET /devices, GET /logs, POST /devices/discover, POST /printer/test-print, and CORS preflight OPTIONS /devices.
```

```text
backend-perifericos> npm.cmd run build
PASS: tsc -p tsconfig.build.json
```

```text
web> npm.cmd run lint
PASS with existing warnings in unrelated files.
No new blocking lint error.
```

```text
web> npm.cmd run build
PASS: Next.js production build completed.
Route present: /[tenant]/admin/peripherals
Existing warnings remain in unrelated files.
Note: one rerun hit a stale `.next` missing chunk; deleting generated `web/.next` and rebuilding passed.
```

```text
git diff --check
PASS: exit code 0
Note: Git reported CRLF normalization warnings only.
```

```text
rg -n "localhost:4050" web\domains\peripherals\components web\app -S
PASS: no matches
```

```text
web dev server
PASS: http://localhost:3000/00000000-0000-0000-0000-000000000001/admin/peripherals returned HTTP 200.
PASS: http://localhost:4050/health returned HTTP 200 from MOCK backend-perifericos.
PASS: http://localhost:4050/devices returned HTTP 200 from MOCK backend-perifericos.
```

```text
rg -n "peripherals|admin\\/peripherals" web\lib\route-permissions.ts -S
PASS:
29: pattern: /^\/[^/]+\/admin\/peripherals\/?$/i,
30: requirement: { module: "peripherals", action: "manage" },
```

## Deployment Notes

- Web production must set:

```text
NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL=https://<public-peripherals-host>
NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL=wss://<public-peripherals-host>/peripherals
```

- `NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL` can be omitted only if the derived `wss://<host>/peripherals` path is correct.
- `backend-perifericos` production must set:

```text
PERIPHERALS_ALLOWED_ORIGINS=https://www.apptiendamanus.space
```

- Add QA/staging origins separated by comma when needed.
- Do not use wildcard `*`.
