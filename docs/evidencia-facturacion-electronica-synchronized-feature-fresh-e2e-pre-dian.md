# Evidencia: E2E fresco pre-DIAN

Fecha: 2026-09-11

## Resultado

- Rama: `feat/develop/implementando-facturacion-electronica`.
- HEAD usado para runtime: `6736b22`.
- Merge `999c80d` y `origin/develop` permanecen en el historial.
- API local: `4020`; Billing local: `4030`.
- Ambos runtimes arrancaron desde el checkout actual y fueron reconstruidos.
- `ELECTRONIC_BILLING_BACKGROUND_ENABLED=false`.
- `FACTUCORE_BACKGROUND_JOBS_ENABLED=false`.
- Dispatcher y workers globales permanecieron deshabilitados.

## Venta controlada

- Sale ID: `3c585eac-2a2a-4a35-a64d-346e07114c57`.
- Se creó una sola venta por la ruta normal `POST /api/sales`.
- Estado: `CONFIRMED`; pago: `PAID`.
- Se encontró exactamente un evento `SALE_COMPLETED_FOR_ELECTRONIC_BILLING` en estado `PENDING`.
- Se entregó únicamente ese evento al endpoint interno de Billing.
- Inbox: un evento, estado `PROCESSED`.
- Manus electronic document: uno, estado `PENDING`.

## Bloqueo seguro

El dry-run de FactuCore rechazó la preparación antes de cualquier llamada al proveedor. Faltan `municipalityCode` y `departmentCode` en los datos fiscales del adquirente. Por eso no hubo create, generación XML, firma, transmisión ni polling.

La venta y el documento pendiente quedan sin reparación manual. No se crea otra venta en esta tarea.

## Invariantes

- Documento terminal `SETP990000006`: no tocado.
- No se procesaron documentos históricos.
- No hubo llamada DIAN.
- No se habilitaron workers.
- No se imprimieron secretos, tokens, headers ni payloads sensibles.
