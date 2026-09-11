# Evidencia: retry controlado FactuCore

## Alcance

- Único documento autorizado: `41f5c937-9219-4d70-9848-14b46a7aa820`.
- Tenant Manus: `00000000-0000-0000-0000-000000000001`.
- Tenant FactuCore: `d5bacedc-c3cd-48bf-b1a9-e4327ef0ffdc`.
- No se creó venta ni documento nuevo.
- Worker global permaneció deshabilitado.

## Preflight

- Base QA: `manus_tienda_qa`; esquema: `public`.
- FactuCore local: `http://127.0.0.1:8000`; health `200`.
- Billing local: `http://127.0.0.1:4030`; health `200`.
- Autenticación read-only: `GET /api/v1/external/documents` respondió `200`.
- Lookup por `externalReference`: `404 NOT FOUND`.
- Contexto provider: `FACTUCORE`, URL y tenant externo correctos.
- Payload local: `unitCode=EA`; validación DTO sin errores.

## Ejecución única

- Método: `ElectronicBillingProcessingService.retryDocument(tenantId, documentId)`.
- Invocación correcta: `1`.
- Resultado create: `HTTP 400`.
- Error sanitizado: `La factura no tiene todos los datos requeridos para preparar el documento DIAN.`
- Create: `1`; generate XML: `0`; sign: `0`; transmit: `0`.
- No hubo documento FactuCore persistido; conteo por referencia: `0`.

## Estado Manus

- Estado antes: `TECHNICAL_ERROR`, sin `provider_document_id`.
- Estado después: `REJECTED`, sin `provider_document_id` ni `provider_status`.
- El resultado refleja el error de readiness reportado por FactuCore; no se ejecutaron etapas posteriores.
- El documento histórico `7fa040a9-0703-434d-954c-5f348f2d6544` y los demás documentos no fueron tocados.

## Seguridad y validación

- No se imprimieron credenciales ni contenido de `.env`.
- No se detectó fuga de secretos en la salida, evidencia o diff.
- No se ejecutaron migraciones.
- `ELECTRONIC_BILLING_BACKGROUND_ENABLED=false` antes y después.
- Tests de billing: `134 passed`, `0 failed`.
- Build billing: `PASS`.
- Build FactuCore: `PASS`.
- OpenSpec relevante y global: `80 passed`, `0 failed`.
- `git diff --check`: sin errores; warnings existentes de conversión LF/CRLF solamente.
