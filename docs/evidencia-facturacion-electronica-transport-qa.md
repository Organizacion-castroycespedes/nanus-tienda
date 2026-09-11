# Evidencia de transport QA - facturacion electronica

Fecha: 2026-08-28

## Contexto

Se valido el cruce real de una venta por:

- API `integration_outbox_events`
- `IntegrationOutboxDispatcher`
- HTTP interno autenticado
- backend-facturacion-electronica `ElectronicBillingSaleEventController`
- `electronic_billing_inbox_events`
- `ElectronicBillingSaleEventConsumer`
- `ElectronicBillingService`

El worker del backend quedo apagado.
No hubo HTTP real a FactuCore.

## Estado de runtime

- API dispatcher: ON durante la prueba, luego apagado al final
- Billing backend worker: OFF todo el tiempo
- Billing backend health: OK

## Config QA

- DB: `manus_tienda_qa`
- Schema: `public`
- API internal token: configurado
- Billing backend internal auth: configurado
- FactuCore real: no ejecutado

## Config de billing aplicada en QA

Se creo metadata de soporte para el tenant:

- `electronic_billing_providers`
  - `code = FACTUCORE`
  - `active = true`
- `tenant_electronic_billing_configs`
  - `tenant_id = 00000000-0000-0000-0000-000000000001`
  - `environment = TEST`
  - `enabled = true`
  - `credential_reference = env:FACTUCORE_TENANT_QA`

No se guardaron secretos en DB.

## Sale de prueba

- `saleId = 966060ae-3cd8-4a85-a4f0-33912cfbd295`
- `tenantId = 00000000-0000-0000-0000-000000000001`
- `sourceType = SALE`
- `eventType = SALE_COMPLETED_FOR_ELECTRONIC_BILLING`
- `schemaVersion = 1`

## Cadena validada

1. Sale confirmada en API.
2. Outbox creado en API.
3. Dispatcher envio evento por HTTP interno autenticado.
4. Backend recibio evento.
5. Inbox quedo `PROCESSED`.
6. Documento electronico quedo `PENDING`.
7. `provider_document_id = NULL`.
8. `provider_status = NULL`.

## Resultado DB para la sale de prueba

- `integration_outbox_events.status = PUBLISHED`
- `integration_outbox_events.published_at = NOT NULL`
- `electronic_billing_inbox_events.status = PROCESSED`
- `electronic_billing_inbox_events.processed_at = NOT NULL`
- `electronic_documents.status = PENDING`
- `electronic_documents.provider_document_id = NULL`
- `electronic_documents.provider_status = NULL`
- `external_reference = SALE-00000000-0000-0000-0000-000000000001-966060ae-3cd8-4a85-a4f0-33912cfbd295`

## Observaciones

- Hubo una sale previa de prueba con outbox pendiente:
  - `saleId = 2bcbf62c-3b93-43ad-a047-45800cc93bf1`
  - quedo `PENDING` con error de configuracion antes de aplicar la config de billing
- Ese residuo no afecto la sale valida final.

## Cierre

El transport QA paso.
El flujo valido fue:

`SALE -> OUTBOX -> HTTP -> INBOX -> ELECTRONIC DOCUMENT PENDING`

