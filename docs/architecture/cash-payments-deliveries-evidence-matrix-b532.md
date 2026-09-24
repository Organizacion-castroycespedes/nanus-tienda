# Matriz de evidencias: caja, pagos y domicilios — B5.3.2

| Área | Evidencia principal | Evidencia técnica | Estado |
|---|---|---|---|
| Caja API | `api/src/modules/finance/cash-sessions/cash-sessions.controller.ts` | rutas de apertura, cierre, historial, auditoría y resumen | confirmado |
| Caja servicio | `api/src/modules/finance/cash-sessions/cash-sessions.service.ts` | `BEGIN`, `COMMIT`, `ROLLBACK`, estado y diferencia | confirmado |
| Caja persistencia | `cash-sessions.repository.ts` | `OPEN`, cierre, conteo y resumen SQL | confirmado |
| Movimientos | `api/src/modules/finance/cash-movements/cash-movements.service.ts` | validación de caja y transacción | confirmado |
| Pagos API | `api/src/modules/finance/payments/payments.controller.ts` | rutas generales y documentales | confirmado |
| Pagos servicio | `api/src/modules/finance/payments/payments.service.ts` | referencias, saldos, sobrepago y transacción | confirmado |
| Pagos persistencia | `api/src/modules/finance/payments/payments.repository.ts` | `FOR UPDATE`, operaciones y asignaciones | confirmado |
| Domicilios API | `api/src/modules/deliveries/deliveries.controller.ts` | rutas y permisos por acción | confirmado |
| Domicilios estados | `api/src/modules/deliveries/deliveries.constants.ts` y `services/delivery-state-machine.service.ts` | estados y matriz de transición | confirmado |
| Domicilios servicio | `api/src/modules/deliveries/deliveries.service.ts` | vínculos, contexto de caja y transacciones | confirmado |
| Web finanzas | `web/modules/finance/services/finance.service.ts` | clientes HTTP de caja y pagos | confirmado |
| Web domicilios | `web/modules/deliveries/services/deliveries.service.ts` | creación, acciones, consulta y ticket | confirmado |
| DDL | `scripts/database/migrations/V063__deliveries_base.sql`, `V069__orders_purchases_current_cash_scope.sql`, `V093__cash_multiuser_and_document_parameters.sql` | tablas, FK e índices versionados | confirmado en repositorio |
| QA/ambiente | pruebas versionadas y ambientes | no ejecutados en B5.3.2 | histórico/no verificado |

## OpenSpec relacionado

Se contrastaron, sin modificar, cambios sobre cierre de caja, alcance caja-
terminal POS, homologación de pagos y vinculación de domicilios con ventas y
pedidos. Un cambio OpenSpec describe intención o trabajo; no se toma como
prueba de comportamiento implementado.

## Faltantes

Faltan ejecución QA de concurrencia y timeouts, verificación de esquema por
ambiente, prueba física, DIAN, seguridad del Peripheral Agent, SBOM completo,
licencias externas y revisión jurídica de B5.2.
