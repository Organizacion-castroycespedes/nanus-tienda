# Evidencia: documento QA fresco, detenido antes de FactuCore

Fecha: 2026-09-10
Entorno: `manus_tienda_qa` únicamente

## Alcance

- Se creó una sola venta QA con el flujo productivo `SaleService.createSale`.
- Cliente QA existente con ubicación fiscal completa. No se cambiaron datos del cliente.
- Workers Manus y FactuCore permanecieron deshabilitados.
- El evento se entregó una sola vez al endpoint interno, con allowlist exacta del evento nuevo.
- Se detuvo el flujo antes de cualquier llamada a FactuCore.

## Identificadores

- Venta nueva: `30a0a076-d3df-483f-8966-d6e3c9f3717e`.
- Evento outbox: `SALE_COMPLETED_FOR_ELECTRONIC_BILLING:00000000-0000-0000-0000-000000000001:30a0a076-d3df-483f-8966-d6e3c9f3717e`.
- Inbox: `29afdd82-974d-4fc4-8d86-d19f62ee1835`.
- Documento electrónico: `af28bfb8-cbf2-437a-988a-f534374bd6e9`.
- External reference: `SALE-00000000-0000-0000-0000-000000000001-30a0a076-d3df-483f-8966-d6e3c9f3717e`.

## Snapshots

| Campo | Venta/mapeador | Outbox | Inbox | Documento | Mapper FactuCore | Request FactuCore dry-run |
|---|---|---|---|---|---|---|
| `cityName` | PRESENT_NONEMPTY | PRESENT_NONEMPTY | PRESENT_NONEMPTY | PRESENT_NONEMPTY | PRESENT_NONEMPTY | PRESENT_NONEMPTY |
| `departmentCode` | PRESENT_NONEMPTY | PRESENT_NONEMPTY | PRESENT_NONEMPTY | PRESENT_NONEMPTY | PRESENT_NONEMPTY | PRESENT_NONEMPTY |
| `departmentName` | PRESENT_NONEMPTY | PRESENT_NONEMPTY | PRESENT_NONEMPTY | PRESENT_NONEMPTY | PRESENT_NONEMPTY | PRESENT_NONEMPTY |
| `countryName` | PRESENT_NONEMPTY | PRESENT_NONEMPTY | PRESENT_NONEMPTY | PRESENT_NONEMPTY | PRESENT_NONEMPTY | PRESENT_NONEMPTY |

El documento guarda los campos de ubicación dentro de `metadata.electronicBilling.customer.metadata`, que es la ruta consumida por `FactuCoreMapper`.

## Tiempos y estados

- Venta creada: `2026-09-10T22:51:44.151Z`.
- Outbox creado: `2026-09-10T22:51:40.963Z`.
- Inbox recibido: `2026-09-10T22:51:40.963Z`.
- Inbox procesado: `2026-09-10T22:51:44.139Z`.
- Documento creado: `2026-09-10T22:51:43.780Z`.
- Venta: `CONFIRMED`.
- Documento: `PENDING`; `provider_document_id` es `NULL`.

La entrega directa controlada creó el inbox y el documento. El dispatcher global estuvo apagado; por eso el registro outbox conserva `PENDING` y no fue modificado manualmente.

## Límites y seguridad

- Entregas/consumos controlados: `1` / `1`.
- Otros eventos enviados: `0`.
- Otros eventos consumidos: `0`.
- Llamadas FactuCore create/XML/sign/transmit: `0`.
- Documento histórico `41f5c937-9219-4d70-9848-14b46a7aa820`: no modificado ni procesado.
- No hubo reparación manual, replay global, migración ni cambio de configuración.
- No se registraron secretos ni PII.

## Dry run

El mapper productivo de billing y `FactuCoreMapper.buildInvoiceRequest` conservaron los cuatro campos. El `unitCode` normalizado fue `EA`; líneas, pago, totales y fechas estuvieron presentes. No se ejecutó HTTP contra FactuCore.

## Resultado

El nuevo documento es el único candidato fresco para la siguiente fase provider, sujeto a usar el documento explícito y mantener ambos workers apagados. No procesar el documento histórico.
