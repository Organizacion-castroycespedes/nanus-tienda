# Runbook de cutover seguro - Facturacion electronica

Estado de corte:

- `API` produce `integration_outbox_events`.
- `backend-facturacion-electronica` consume `SaleCompletedForElectronicBilling`.
- `API` no debe tener runtime productivo de facturacion electronica.
- `Billing Backend` no debe procesar en productivo hasta que `worker` y credenciales esten listos.

## Flags de runtime

- `INTEGRATION_OUTBOX_DISPATCHER_ENABLED=false` por defecto.
- `ELECTRONIC_BILLING_WORKER_ENABLED=false` por defecto.
- `API_INTERNAL_TOKEN` requerido para el transporte interno.
- `BILLING_BACKEND_INTERNAL_BASE_URL` requerido en `API`.
- `credential_reference` guarda solo la referencia neutral del secreto.
- El secreto real vive en una variable de entorno con el nombre indicado por `credential_reference` sin el prefijo `env:`.
- El valor de esa variable debe ser JSON con `clientKey` y `clientSecret`.
- `FactuCoreClient` no lee `process.env` directo.

## Estado A: pre-cutover

Uso:

- `API dispatcher`: OFF
- `Billing worker`: OFF
- No hay delivery real.

Valido cuando:

- `V073__electronic_billing_inbox_events.sql` aplicada.
- `V074__integration_outbox_events.sql` aplicada.
- `API` y `Billing Backend` compilan.
- No existe codigo viejo de runtime en `api/src/modules/electronic-billing/`.

## Estado B: validacion de transporte

Uso:

- `API dispatcher`: ON
- `Billing worker`: OFF
- Flujo: `Sale -> outbox -> inbox -> electronic_document PENDING`.

Objetivo:

- Validar transporte interno.
- Validar idempotencia del inbox.
- No procesar provider.

## Estado C: cutover completo

Uso:

- `API dispatcher`: ON
- `Billing worker`: ON

Solo si:

- `V073` y `V074` estan aplicadas.
- Credenciales del provider estan resueltas.
- `Billing Backend` tiene `DB`, `internal auth` y `base URL` correctos.
- No existe worker viejo en `API`.

## Secuencia

1. Aplicar `V073`.
2. Aplicar `V074`.
3. Configurar `BILLING_BACKEND_INTERNAL_BASE_URL` en `API`.
4. Configurar `API_INTERNAL_TOKEN` en ambos lados.
5. Desplegar `backend-facturacion-electronica`.
6. Desplegar `api` con outbox.
7. Encender dispatcher de `API`.
8. Validar evento `SALE_COMPLETED_FOR_ELECTRONIC_BILLING`.
9. Validar inbox idempotente.
10. Resolver credenciales del provider.
11. Encender worker del `Billing Backend`.
12. Validar `PENDING`, `PROCESSING`, `ACCEPTED`, `REJECTED`.

## Reconciliacion

Verificar:

- outbox `PENDING`
- outbox `FAILED`
- inbox `RECEIVED`
- inbox `PROCESSED`
- `electronic_documents` en `PENDING`
- `PROCESSING`
- `TECHNICAL_ERROR`

## Rollback

### Si falla el dispatcher

- Apagar `INTEGRATION_OUTBOX_DISPATCHER_ENABLED`.
- Dejar eventos en outbox.

### Si falla el Billing Backend

- Apagar `ELECTRONIC_BILLING_WORKER_ENABLED`.
- Dejar documentos en `PENDING` o `PROCESSING`.

### Si falla el transporte interno

- Deshabilitar dispatcher.
- Corregir `API_INTERNAL_TOKEN` o `BILLING_BACKEND_INTERNAL_BASE_URL`.

### Si se revierte la aplicacion

- No volver a una version vieja con runtime doble.
- Revisar eventos pendientes antes de hacer rollback.

## Regla dura

- No habilitar a la vez el worker viejo de `API` y el worker nuevo del `Billing Backend`.
- No saltar directo a provider real sin credenciales.
- No tocar QA ni PROD en este paso.
