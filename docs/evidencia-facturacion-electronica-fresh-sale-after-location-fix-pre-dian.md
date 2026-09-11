# Evidencia: venta fresca después de corregir ubicación fiscal

Fecha: 2026-09-11

## Runtime y seguridad

- Rama: `feat/develop/implementando-facturacion-electronica`.
- HEAD: `6736b22`.
- API y Billing corrieron desde el checkout sincronizado.
- `ELECTRONIC_BILLING_BACKGROUND_ENABLED=false`.
- `FACTUCORE_BACKGROUND_JOBS_ENABLED=false`.
- No hubo workers globales ni polling DIAN.

## Flujo controlado

- Se creó una sola venta nueva por la ruta normal POS.
- Sale ID: `f239f47a-0978-4533-9667-5a72cded3b0c`.
- Estado: `CONFIRMED`; pago: `PAID`.
- Outbox: un evento `SALE_COMPLETED_FOR_ELECTRONIC_BILLING`, `PENDING`.
- Se entregó únicamente ese evento.
- Inbox: un evento, `PROCESSED`.
- Manus document: `adbf3247-8869-4d23-b96d-9f59dc3d71c0`, `PENDING`.

## Pre-DIAN

- Ubicación en snapshot y request: department `08`, municipality `08001`.
- Pago fiscal: `PaymentMeans/ID=1`, `PaymentMeansCode=10`.
- Línea con identificación de producto.
- FactuCore document: `1cacf000-93e5-4f31-9efa-368ae13e27ae`.
- Número: `SETP990000007`.
- Estado: `SIGNED`.
- XML firmado: presente, legible y no vacío.
- `TransmissionAttempt`: `0`.
- Create: `1`; generate XML: `1`; sign: `1`.
- Transmit: `0`; DIAN calls: `0`.

## Invariantes

- `CASH` no llegó a campos fiscales ni al XML.
- Venta anterior rechazada y snapshots anteriores no fueron tocados.
- No se creó una segunda venta.
- No se imprimieron secretos, tokens, headers ni PII innecesaria.

## Validación

- API focused tests: `30/30 PASS`.
- Billing tests: `142/142 PASS`.
- API build: PASS.
- Billing build: PASS.
- `git diff --check`: PASS.

Resultado: preparado para una transmisión DIAN controlada posterior. Esta tarea termina antes de transmitir.
