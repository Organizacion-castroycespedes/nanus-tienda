# FactuCore create 400: error detail preservation and payload validation

## Result

The final controlled retry returned this sanitized FactuCore validation detail:

`lines.0.unitCode must be one of the following values: UNIT, NIU, EA, HOUR, DAY, KILOGRAM, LITER, SERVICE`

Manus persisted the source value `UND`, which FactuCore does not accept. The
adapter now maps both `UNIT` and `UND` to `EA`. No second retry was performed.

## Error observability

FactuCore returns an envelope with `statusCode`, `message`, and `error`. The
previous client converted HTTP 400 to a generic message and discarded the
body. `FactuCoreValidationError` now preserves bounded `{ path, message }`
details after recursive redaction. Sensitive keys and values are excluded.

## Validation

- Nested validation arrays: PASS.
- Non-JSON error body: PASS.
- Secret redaction: PASS.
- HTTP status preservation: PASS.
- Billing tests: `133 PASS` after the final `UND -> EA` test update.
- FactuCore readiness test: `PASS`.
- FactuCore build: `PASS`.
- FactuCore code modified: `NO`.
- Provider create calls in the final diagnostic retry: `1` (HTTP 400).
- XML, signing, transmission: `0`.
- Provider documents: `0`.
- Worker: `DISABLED`.
- QA document remains `REJECTED` with provider ID `NULL`.

A further provider retry is required in a later explicitly approved phase
because this phase already used its single controlled retry.
