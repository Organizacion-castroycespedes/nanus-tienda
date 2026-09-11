# Evidencia - Fase X9

## Objetivo

Remover ownership runtime de facturacion electronica desde `api/` y dejar un solo owner real en `backend-facturacion-electronica/`.

## Resultado

- `api/src/modules/electronic-billing/` removido.
- `api/src/modules/app.module.ts` ya no wirea `ElectronicBillingModule`.
- `SaleService` ya no depende de:
  - `ElectronicBillingService`
  - `ElectronicBillingProcessingService`
  - `ElectronicBillingBackgroundService`
  - `ElectronicBillingProvider`
  - `ElectronicBillingProviderResolver`
  - `FactuCoreProvider`
  - `FactuCoreClient`
  - `TenantElectronicBillingConfigRepository`
- `api` sigue emitiendo el evento de outbox para ventas.
- `backend-facturacion-electronica` sigue siendo el owner del runtime fiscal.

## Control de corte

- `API` outbox dispatcher: presente, pero no habilitado por defecto.
- `Billing Backend` worker: presente, pero no habilitado por defecto.
- Credenciales: pendientes.
- Cutover real: no ejecutado.

## Riesgos

- No habilitar dual worker.
- No habilitar provider real sin credenciales.
- No aplicar `V073` ni `V074` en esta fase.

