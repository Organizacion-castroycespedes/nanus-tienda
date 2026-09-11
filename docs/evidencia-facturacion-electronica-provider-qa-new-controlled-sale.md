# Evidencia: nueva venta QA y provider FactuCore

Fecha de ejecución: 2026-09-10

## Alcance

- Rama: `feat/develop/implementando-facturacion-electronica`
- Runtime: API y billing local; FactuCore local en `http://127.0.0.1:8000`.
- Base de datos: `manus_tienda_qa`.
- Tenant: `00000000-0000-0000-0000-000000000001`.
- Worker global: deshabilitado antes y después.
- No se procesó el documento histórico `7fa040a9-0703-434d-954c-5f348f2d6544`.

## Nueva venta y transporte

- Nueva venta: `e06ea802-077a-4d03-865f-56075d44ce6c`.
- Evento: `SALE_COMPLETED_FOR_ELECTRONIC_BILLING:00000000-0000-0000-0000-000000000001:e06ea802-077a-4d03-865f-56075d44ce6c`.
- `schemaVersion`: `1`; `source`: `SALE`.
- Payload outbox: snapshot de cliente, líneas, impuestos, descuentos, pagos y totales presentes.
- Impuesto de tasa cero: identidad presente, tasa `0`, monto `0`.
- Transporte controlado: publicado una vez; inbox con una fila `PROCESSED`.
- Pérdida outbox → inbox: no.

## Documento canónico

- Documento nuevo: `41f5c937-9219-4d70-9848-14b46a7aa820`.
- Persistencia de cliente: correcta en `metadata.electronicBilling.customer`.
- Persistencia de impuestos: correcta; una fila `Exento`, tasa `0`, monto `0`.
- Preflight del mapper: cliente listo, impuestos listos, request construible.
- External reference: `SALE-00000000-0000-0000-0000-000000000001-e06ea802-077a-4d03-865f-56075d44ce6c`.
- Lookup FactuCore antes y después: `404 NOT FOUND`.

## Resultado provider

Se hizo una sola invocación manual de `ElectronicBillingProcessingService.processDocument(tenantId, documentId)`.

La ejecución terminó antes de cualquier HTTP FactuCore por un defecto de inyección local:

```text
TypeError: Cannot read properties of undefined (reading 'createInvoice')
```

Estado del documento nuevo: `TECHNICAL_ERROR`. No hubo `POST` provider, por lo tanto:

- Crear factura: `0`.
- Generar XML: `0`.
- Firmar: `0`.
- Transmitir: `0`.
- Documentos FactuCore creados: `0`.

No se reintentó. No se ejecutó otro documento. Debe corregirse la inyección de `FactuCoreClient` y luego repetirse con una nueva venta QA, sin reutilizar este documento técnico.

## Sentinelas

- Documento histórico: continúa `PENDING`, sin `provider_document_id` ni `provider_status`.
- Segundo documento histórico: continúa `PENDING`, sin `provider_document_id` ni `provider_status`.
- Documentos históricos tocados: no.

## Seguridad

- Secretos, contraseñas y tokens: no incluidos en evidencia, logs revisados sin valores expuestos.
- PII: no incluida.
- Migraciones: no.
- PROD: no tocado.
- Commit, push y deploy: no realizados.
