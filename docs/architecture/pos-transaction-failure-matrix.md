# Matriz de fallos y recuperación POS — B4.1

| Punto de fallo | Evidencia de rechazo | Efecto confirmado | Recuperación disponible | Límite |
|---|---|---|---|---|
| Falta tenant/sucursal/terminal/POS | `normalizeSaleContext`, función SQL | No inicia o revierte | Corregir contexto y reintentar | No prueba recuperación automática |
| Caja cerrada o usuario no asignado | `RequireOpenCashSession`, `PaymentsService` | Rechazo antes o durante pago | Abrir/asignar caja | QA requerido |
| Producto inactivo o inexistente | `SaleRepository`, `V051` | Rollback | Corregir catálogo | No se consulta ambiente |
| Stock insuficiente | `V051` y movimientos lotes | Rollback de venta y movimientos | Reponer o ajustar inventario | No hay reserva Web previa |
| Lote inválido o FEFO insuficiente | `V051`, `FOR UPDATE` | Rollback | Corregir lote/stock | Validación de ambiente pendiente |
| Precio/impuesto/promoción inválidos | `PricingService`, snapshot SQL | Rollback | Recalcular y reintentar | Redondeo debe verificarse con QA |
| Pago inválido o total CASH distinto | `SaleService`, `V051` | Rollback | Corregir método, monto o referencia | No hay sobrepago CASH autorizado en esta ruta |
| Clave idempotente con hash distinto | `reserveSaleCreationIdempotency` | `ConflictException` | Usar misma solicitud o nueva clave | No se fuerza una segunda venta |
| Timeout antes de conocer resultado | estado `UNKNOWN` en Web; endpoint de reconciliación | Cliente no repite ciegamente | `GET /sales/idempotency/:key` | Prueba de red no ejecutada |
| Fallo de outbox antes de commit | mismo `PoolClient` en enqueue automático | Rollback de ruta directa | Reintento de venta/reconciliación | Dispatcher posterior no probado |
| Fallo después de commit | auditoría y cliente ocurren después | Venta puede estar confirmada | Reconciliar por clave | No hay garantía global de entrega |
| Cancelación con error | `cancelSale` captura y hace rollback | No aplica compensación parcial | Reintentar cancelación | No se probó con datos QA |

## Estados no afirmados

No se afirma operación offline, entrega exactamente una vez, recuperación de una
base restaurada, certificación DIAN, impresión física, ni garantía de que un
timeout de red siempre sea reconciliable. Esos puntos requieren pruebas B4.2/B4.3,
QA o infraestructura autorizada.
