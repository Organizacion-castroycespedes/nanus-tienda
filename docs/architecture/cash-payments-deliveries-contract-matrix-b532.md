# Matriz de contratos: caja, pagos y domicilios — B5.3.2

Clasificación: **confirmado por código** salvo donde se indique
**no verificado**. Las respuestas exactas dependen de los DTO y del manejo de
excepciones del servicio; no se reproducen payloads sensibles.

| Acción | Método y ruta | Control | Servicio | Efecto |
|---|---|---|---|---|
| Abrir caja | `POST /finance/cash-sessions/open` | JWT, roles, `FinanceAuthzGuard`, validación | `CashSessionsService.open` | crea sesión `OPEN` |
| Cerrar caja | `POST /finance/cash-sessions/:id/close` | mismos guards; sesión abierta | `CashSessionsService.close` | cuenta, diferencia y cierre |
| Movimiento | `POST /finance/cash-movements` | mismos guards + `RequireOpenCashSession` | `CashMovementsService.create` | ingreso/egreso y auditoría posterior |
| Crear pago | `POST /finance/payments` | mismos guards + caja abierta | `PaymentsService.create` | pago, asignaciones y movimiento si aplica |
| Pago documental | `POST /finance/payments/document` | mismos guards + caja abierta | `PaymentsService.createDocument` | pago completo o asignado al documento |
| Crear domicilio | `POST /deliveries` | JWT + permiso `CREATE` | `DeliveriesService.create` | domicilio vinculado a orden/venta |
| Preparar | `POST /deliveries/:id/prepare` | permiso `UPDATE` | state machine | `CREADO -> EN_PREPARACION` |
| Despachar | `POST /deliveries/:id/dispatch` | permiso `DISPATCH` | state machine | estado `DESPACHADO` |
| Entregar | `POST /deliveries/:id/mark-delivered` | permiso `MARK_DELIVERED` | state machine | estado final `ENTREGADO` |
| No entregar | `POST /deliveries/:id/mark-not-delivered` | permiso `MARK_NOT_DELIVERED` | state machine | `NO_ENTREGADO` |
| Cancelar | `POST /deliveries/:id/cancel` | permiso `CANCEL` | state machine | estado final `CANCELADO` |

## Requisitos de contexto

| Contexto | Caja | Pagos | Domicilios |
|---|---|---|---|
| tenant/sucursal | validado en servicios y asignaciones | documento y alcance financiero | validación de relación y sucursal |
| usuario/rol | guards y asignación activa | guards financieros | permiso por acción |
| terminal/sesión POS | sesión actual y caja | requerido para efectivo según DTO/contexto | requerido cuando el impacto usa caja |
| caja abierta | apertura/cierre son la excepción | exigida en rutas de escritura | exigida en creación/transiciones con contexto |

El frontend usa `web/modules/finance/services/finance.service.ts` y
`web/modules/deliveries/services/deliveries.service.ts`. La validación visual
de formularios no reemplaza los guards ni las validaciones autoritativas del
backend.

## Contratos no certificados

- No se demuestra un endpoint público universal de reversión de pagos.
- No se demuestra idempotencia universal para reenvío de pagos o domicilios.
- No se demuestra integración externa de reparto, geolocalización o tracking.
- No se certifica que todas las pantallas propaguen contexto vigente tras una
  expiración o cierre concurrente.
