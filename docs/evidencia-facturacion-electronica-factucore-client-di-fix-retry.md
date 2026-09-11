# Evidencia: fix DI FactuCore y retry controlado

Fecha: 2026-09-10

## Guardas

- Rama: `feat/develop/implementando-facturacion-electronica`.
- HEAD: `7352ea7`.
- Base QA: `manus_tienda_qa`; guard de base de datos aprobado.
- Worker `ELECTRONIC_BILLING_BACKGROUND_ENABLED`: deshabilitado antes y después.
- Documento histórico `7fa040a9-0703-434d-954c-5f348f2d6544`: sin cambios.
- No se procesó ningún segundo documento.

## Defecto DI

El módulo registraba `FactuCoreClient` y el registry tenía `FACTUCORE`, pero `FactuCoreProvider` no recibía el cliente: el metadata runtime de parámetros no estaba disponible para ese constructor. La corrección agrega tokens explícitos `@Inject(FactuCoreClient)` y `@Inject(FactuCoreMapper)`. La prueba de contexto real confirma cliente, mapper, resolver y registry.

Los tests anteriores no detectaron esto porque eran unitarios y usaban mocks/manual wiring; no compilaban el grafo Nest real.

## Retry

- Documento: `41f5c937-9219-4d70-9848-14b46a7aa820`.
- Venta: `e06ea802-077a-4d03-865f-56075d44ce6c`.
- Estado antes: `TECHNICAL_ERROR`, sin ID provider.
- Método ejecutado una vez: `ElectronicBillingProcessingService.retryDocument(tenantId, documentId)`.
- Lookup FactuCore: un `GET` autenticado de estado por external reference; resultado `404`.
- POST create: `0`.
- POST generate XML: `0`.
- POST sign: `0`.
- POST transmit: `0`.
- Documentos FactuCore: `0`.
- Resultado: `REJECTED`, error sanitizado `FactuCore resource not found`.

El retry actual no reinicia el flujo de creación cuando el error ocurrió antes de crear documento provider. No se ejecutó otro retry. Queda bloqueado hasta corregir esa transición de estado.

## Seguridad y sentinelas

- Secretos y contraseñas: no incluidos.
- PII: no incluida.
- Documentos históricos: sin cambios.
- Migraciones: no.
- PROD: no tocado.
- Commit, push y deploy: no realizados.

## Validación

- Billing tests: `121 PASS`, `0 fail`.
- Billing build: PASS.
- OpenSpec relevante y global: PASS.
- `git diff --check`: PASS, con warnings normales de fin de línea CRLF.
