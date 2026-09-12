# Evidencia — Gestión Operativa Phase 5.11

## Resultado

Phase 5.11 queda **PARTIAL**. Se revalidó la infraestructura PostgreSQL y la
suite Billing, pero este checkout todavía no contiene fixtures de agregado
Billing completos para ejecutar crash/recovery mediante los servicios reales.

## Entorno seguro

- PostgreSQL desechable local en `localhost:55432`.
- Base aislada: `manus_billing_concurrency_test`.
- Se usaron sesiones PostgreSQL reales y datos técnicos temporales.
- No se usó QA remoto ni PROD.
- No hubo documentos fiscales de negocio, FactuCore live ni DIAN.

## Pruebas ejecutadas

- Suite PostgreSQL real: `5/5 PASS`.
- Suite Billing completa: `157/157 PASS`.
- Las pruebas existentes cubren advisory locks, concurrencia, stale lease,
  recuperación por `external_reference` y mocks deterministas.
- No existe aún una fixture PostgreSQL del agregado Billing que cubra los
  checkpoints `PRE_PROVIDER_CREATE`, `PRE_TRANSMIT` y `REFRESH_STALE_FULL`
  mediante el flujo completo de servicios.

## Gaps no certificados

Quedan pendientes, sin alterar el modelo productivo:

- crash antes de provider create por el flujo completo;
- crash antes de transmisión por el flujo completo;
- carrera refresh/stale con dos sesiones y agregado completo;
- conteos de provider create/transmit durante esos escenarios.

Por eso stale processing, safe retry y la certificación full-service no se
marcan como completas. Retry API/UI siguen diferidos.

## Seguridad

No se llamó `retryDocument()` para QA real. No se llamó FactuCore live ni DIAN.
No se modificó V076 en QA. No hubo commit, push ni deploy.
