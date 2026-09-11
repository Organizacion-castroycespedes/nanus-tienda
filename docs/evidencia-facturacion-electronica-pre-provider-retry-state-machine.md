# Evidencia: máquina de estados de retry pre-provider

Fecha: 2026-09-10

## Diagnóstico

- El retry anterior llamaba siempre `provider.retryDocument()`.
- Eso era incorrecto cuando `provider_document_id` era `NULL`.
- Un lookup por external reference `404` fue convertido en `REJECTED` por el flujo anterior.
- La corrección separa recuperación pre-provider y post-provider.

## Diseño aplicado

- Pre-provider: sin ID provider, lookup por external reference; `NOT FOUND` reinicia emisión desde `CREATE`.
- Post-provider: con ID provider, usa retry/reconciliación de transmisión.
- External reference sigue siendo la llave de idempotencia.
- Solo se permite recuperar la REJECTED heredada con código `FACTUCORE_VALIDATION` y mensaje de recurso inexistente. Rechazos fiscales normales no son retriables.
- Si `CREATE` devuelve ID y falla una etapa posterior, el ID se conserva para evitar duplicados.

## Validación

- Base QA: `manus_tienda_qa`; guard aprobado.
- Worker: deshabilitado antes y después.
- Documento: `41f5c937-9219-4d70-9848-14b46a7aa820`.
- Estado antes: `REJECTED`, sin ID provider.
- Lookup previo: `404 NOT FOUND`.
- Recuperación ejecutada: una vez.
- HTTP: un `GET` de preflight y un `POST /api/v1/external/documents/invoices`.
- Create: `400` validación provider; mensaje sanitizado `FactuCore request failed with status 400`.
- Generate XML, sign, transmit: `0`.
- Documentos FactuCore: `0`.
- Estado Manus final: `REJECTED`, sin ID provider. Esta clasificación corresponde a la validación `400` del provider.

## Tests y seguridad

- Billing suite: `128 PASS`, `0 fail`.
- DI, pre-provider, post-provider, external-reference, technical error, fiscal rejection y partial-success tests: PASS.
- Billing build: PASS.
- OpenSpec: `80 passed, 0 failed`.
- Secretos y PII: no incluidos.
- Migraciones: no.
- Documentos históricos: sin cambios.
- PROD: no tocado.
- Commit, push y deploy: no realizados.
