# FactuCore patched runtime startup

## Result

- Repository: `D:/Profe/Factucore`.
- Branch: `main`.
- Commit: `ee1c132`.
- Current build includes the patched `HttpExceptionFilter` marker `DIAN_READINESS_VALIDATION`.
- No provider document was created or processed.

## Startup diagnosis

- Port `8000` had no active listener after the prior restart attempt.
- One attempt used `dist/main.js`; that path does not exist. The real build entry is `dist/src/main.js`.
- The correct entry starts Nest, initializes Prisma and pg-boss drivers, then binds successfully. Startup is slow while DB/pg-boss initialize; it is not a code hang.
- The filter patch has no constructor, module, or top-level side effects.

## Runtime checks

- Runtime command: `node --enable-source-maps dist/src/main.js`.
- Runtime process: PID `51312`, working directory `D:/Profe/Factucore/backend`.
- Port `8000`: listening on `0.0.0.0:8000` and `[::]:8000`.
- Health: three `200` responses.
- Authenticated documents GET: three `200` responses.
- External-reference lookup: three `404` responses, meaning `NOT FOUND`.
- Compiled patch marker: present.
- Database connection: PASS.

## Focused filter test

- Direct launcher: `node node_modules/ts-node/dist/bin.js --transpile-only -r tsconfig-paths/register scripts/test-http-exception-filter.ts`.
- Assertions: PASS.
- Clean exit: PASS with `--transpile-only`; the previous hang came from the full ts-node typecheck launcher/open handle, not the filter.
- Tests cover structured readiness details, multiple checks, bounded output, redaction, and generic errors.

## Safety

- The single application recovery invocation was attempted once, but the document was already `REJECTED`; production retry rejected it before provider HTTP.
- FactuCore create, XML, sign, and transmit calls: `0`.
- Provider count: `0`.
- Worker: disabled.
- Historical documents: untouched.
- No secrets or PII recorded.

## Conclusion

FactuCore local runtime is ready and serves the patched build. The authorized document remains unprocessed because its current state is `REJECTED`, so no provider retry was allowed in this startup phase.
