# Caja, pagos y domicilios AS-IS — B5.3.2

## Alcance y clasificación

Esta ficha describe la implementación observada en el commit
`83266f361e0ef5c53219e19dbc8756f71b4fc7e6`. No sustituye B4.1 ni B5.3.1.
Separa sesión POS, sesión de caja, pagos financieros y domicilios.

- **Implementado:** existe evidencia en controlador, servicio, repositorio,
  SQL o prueba versionada.
- **Configurado:** existe ruta, permiso o parámetro, pero no se validó el
  ambiente instalado.
- **Histórico:** prueba o documento existente; no implica ejecución actual.
- **No verificado:** requiere ambiente, proveedor, hardware o prueba funcional.

## Arquitectura real

| Área | Entrada | Responsabilidad confirmada | Persistencia principal |
|---|---|---|---|
| Caja | `finance/cash-sessions` | Abrir, cerrar, auditar y consultar sesiones de caja | `cash_sessions`, conteos y auditoría |
| Movimientos | `finance/cash-movements` | Registrar ingresos y egresos con sesión abierta | movimientos de caja |
| Pagos | `finance/payments` | Crear pagos, asignarlos a documentos y crear movimientos cuando aplica | `payments`, asignaciones y operaciones |
| Domicilios | `deliveries` | Crear, asignar, preparar, despachar, entregar, no entregar y cancelar | `deliveries`, `delivery_status_history` |
| Sesión POS | `pos-user-sessions` | Contexto operativo de usuario, terminal y sesión POS | sesión POS; no es una caja |

La evidencia principal está en `api/src/modules/finance/`,
`api/src/modules/deliveries/`, `api/src/modules/pos-user-sessions/` y en los
clientes Web correspondientes. La integración fiscal, reportería remota y
hardware permanecen separadas de estas transacciones.

## Caja y sesiones

`CashSessionsController` expone apertura, cierre, sesión actual, historial,
resumen y auditorías bajo `finance/cash-sessions`. `CashMovementsController`
expone consulta y creación bajo `finance/cash-movements`.

La apertura comprueba si ya existe un registro abierto para la caja, inicia una
transacción y crea una sesión con estado `OPEN`. El cierre exige una sesión
abierta, calcula monto esperado y diferencia, y persiste monto contado,
esperado, diferencia y estado de cierre. El servicio contiene caminos de
cierre directo y de cierre con conteo/auditoría; no se afirma que ambos caminos
tengan idénticas reglas operativas sin prueba funcional.

Los movimientos validan tipo y sesión abierta. Su creación usa `BEGIN`,
`COMMIT` y `ROLLBACK`; el evento de auditoría se registra después del commit.
La selección de sesión actual también considera usuario y asignación activa de
caja. Esto no certifica que toda ruta frontend conserve un contexto vigente.

## Pagos por dominio

`PaymentsService` soporta referencias `SALE`, `PURCHASE`, `PURCHASE_ORDER` y
`SALES_ORDER`. La dirección esperada observada es:

| Referencia | Dirección observada |
|---|---|
| `SALE` | Depende del flujo de venta POS |
| `PURCHASE` / `PURCHASE_ORDER` | `OUT` |
| `SALES_ORDER` | `IN` |

`POST /finance/payments` crea pagos generales y
`POST /finance/payments/document` crea pagos documentales para compras u
órdenes de venta. Ambos requieren sesión de caja abierta. El servicio valida
método activo, institución financiera cuando el método la exige, caja para
métodos de efectivo, saldo, asignaciones y sobrepago.

El flujo POS de B4.1 puede invocar la creación de pagos usando el mismo
`PoolClient` de la venta. El endpoint financiero independiente abre su propia
transacción. Por tanto, no existe evidencia para presentar todos los pagos de
todos los dominios como una única transacción global.

El repositorio bloquea el documento y la sesión de caja con `FOR UPDATE`.
`document_payment_operations` registra operaciones y permite una lectura con
bloqueo. La clave lógica `${referenceType}:${referenceId}` ayuda a identificar
la operación, pero no demuestra por sí sola idempotencia universal ni entrega
exactamente una vez.

No se identificó un endpoint público general de devolución o reversión en el
controlador de pagos. Existen helpers de estado y movimiento compensatorio en
el repositorio; su uso por un flujo público debe validarse por separado.

## Domicilios y entregas

`DeliveriesController` usa `JwtAuthGuard` y `PermissionsGuard`. Las rutas
observadas son creación, consulta, actualización, asignación, preparación,
despacho, entrega, no entrega, cancelación y resumen.

Estados operativos:

`CREADO -> EN_PREPARACION -> DESPACHADO -> ENTREGADO`.

Desde `DESPACHADO` también puede ocurrir `NO_ENTREGADO`. Un reintento desde
`NO_ENTREGADO` requiere `retryAllowed`. La cancelación está permitida desde
`CREADO` y `EN_PREPARACION`; `ENTREGADO` y `CANCELADO` son finales. El servicio
acepta estados legacy y los normaliza, pero la matriz operativa usa los nombres
actuales.

Un domicilio puede vincularse con una orden, una venta o ambas relaciones
según el flujo de creación. Valida coincidencia de sucursal, relación entre
orden y venta, cliente, método de pago y contexto de caja. La fila puede
conservar `cash_session_id`, `cash_register_id`, `terminal_id`,
`cash_impact_amount` y `cash_impact_recorded_at`. Esto demuestra contexto e
impacto registrado en el domicilio; no demuestra que siempre se cree una fila
de pago independiente.

No se encontró evidencia de seguimiento en tiempo real, geolocalización,
asignación automática de repartidor ni flota externa. El CRUD y la asignación
manual de conductor sí están implementados.

## Fronteras y recuperación

Apertura, cierre, movimientos, creación de pagos, creación de domicilios y
transiciones de domicilio muestran transacciones con `BEGIN`, `COMMIT` y
`ROLLBACK` en sus servicios. Las transiciones de domicilio bloquean la fila con
`FOR UPDATE`. Las consultas de lectura no se documentan como transacciones de
negocio.

La recuperación observada es principalmente rollback antes de commit, bloqueo
de filas y compensación explícita cuando un helper la usa. No se demuestra una
política general de reintento, reconciliación `UNKNOWN` o `Idempotency-Key`
para caja, pagos financieros y domicilios. El estado `UNKNOWN` de B4 pertenece
al flujo POS documentado allí y no se extiende automáticamente a estos
dominios.

## Seguridad y límites

Los controladores financieros usan JWT, roles, `FinanceAuthzGuard` y pipe de
validación. Domicilios usa JWT y permisos por acción. El código aplica filtros
de tenant, sucursal, terminal, usuario o caja en rutas concretas; esta ficha no
certifica cobertura completa de aislamiento multi-tenant.

No se consultaron bases activas, QA, producción, credenciales ni datos reales.
Las pruebas versionadas son evidencia histórica, no ejecución de esta fase.

## Fuentes

- `api/src/modules/finance/cash-sessions/cash-sessions.controller.ts`
- `api/src/modules/finance/cash-sessions/cash-sessions.service.ts`
- `api/src/modules/finance/cash-sessions/cash-sessions.repository.ts`
- `api/src/modules/finance/cash-movements/cash-movements.controller.ts`
- `api/src/modules/finance/cash-movements/cash-movements.service.ts`
- `api/src/modules/finance/payments/payments.controller.ts`
- `api/src/modules/finance/payments/payments.service.ts`
- `api/src/modules/finance/payments/payments.repository.ts`
- `api/src/modules/deliveries/deliveries.controller.ts`
- `api/src/modules/deliveries/deliveries.constants.ts`
- `api/src/modules/deliveries/services/delivery-state-machine.service.ts`
- `api/src/modules/deliveries/deliveries.service.ts`
- `web/modules/finance/services/finance.service.ts`
- `web/modules/deliveries/services/deliveries.service.ts`
- `scripts/database/migrations/V063__deliveries_base.sql`
- `scripts/database/migrations/V069__orders_purchases_current_cash_scope.sql`
- `scripts/database/migrations/V093__cash_multiuser_and_document_parameters.sql`
