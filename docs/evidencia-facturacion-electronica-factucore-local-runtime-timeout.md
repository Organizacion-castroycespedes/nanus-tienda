# Evidencia: timeout del runtime local FactuCore

## Guardas

- FactuCore branch: `main`.
- FactuCore HEAD: `ee1c132`.
- Manus branch: `feat/develop/implementando-facturacion-electronica`.
- Port `8000`: listening.
- Process: `node --enable-source-maps D:/Profe/Factucore/backend/dist/src/main`.
- Source/build match: PASS; process path points to the FactuCore repository and HEAD.
- No document processing or provider POST occurred.

## Diagnosis

The first local process on port `8000` was listening but hung on both health and
read-only requests. It was a stale/hung process started from the FactuCore
build. It was stopped and the normal `backend` runtime was started with
`npm run start:dev`.

FactuCore database connectivity was verified read-only against `factucore`:
`SELECT current_database(), current_user, current_schema(), now()` completed in
less than one second. This rules out a database connectivity failure.

## Smoke results

- `GET /api/health`: HTTP `200`; three sequential checks passed, under one second each.
- Authenticated `GET /api/v1/external/documents`: HTTP `200`; three sequential checks passed.
- Authenticated external-reference lookup: HTTP `404`; three sequential checks completed in about one second each.
- `404` means `NOT FOUND` for this external reference. It is not an authentication failure.
- API client and tenant association remain valid from prior read-only verification.

## Safety

- FactuCore create calls: `0`.
- Generate XML: `0`.
- Sign: `0`.
- Transmit: `0`.
- Manus document `41f5c937-9219-4d70-9848-14b46a7aa820` was not processed.
- Worker remained disabled.
- No secrets were recorded.

## Validation

- FactuCore code modified: `NO`.
- FactuCore build: PASS.
- FactuCore DB mutations: `0`.
- PROD touched: `NO`.

## Result

FactuCore local runtime is recovered. Read-only connectivity is stable. The
controlled provider retry is ready only after the separate final retry gate is
re-run; this phase did not process any document.
