# Fallos y recuperación: caja, pagos y domicilios — B5.3.2

| Escenario | Tratamiento observado | Clasificación |
|---|---|---|
| Caja ya abierta | apertura consulta registro abierto y rechaza conflicto | implementado |
| Error al abrir/cerrar | rollback del `PoolClient` | implementado |
| Cierre con monto distinto | persiste esperado, contado y diferencia | implementado |
| Movimiento con caja cerrada | validación de sesión `OPEN` | implementado |
| Pago con método inactivo | validación de método | implementado |
| Pago de efectivo sin caja | exige `cashSessionId`/sesión abierta | implementado |
| Sobrepago no permitido | valida saldo y asignación | implementado |
| Documento concurrente | bloqueo `FOR UPDATE` | implementado en rutas observadas |
| Pago repetido o timeout | operación registrada y bloqueos; no garantía global | parcial/no verificado |
| Transición de domicilio inválida | state machine rechaza transición | implementado |
| Reintento tras no entrega | exige `retryAllowed` | implementado |
| Error de entrega o asignación | rollback de la transacción de servicio | implementado |
| Reversión de pago | helper de repositorio existe; endpoint general no demostrado | no verificado |
| Seguimiento de domicilio | no se encontró tracking externo | no verificado |

## Límites

Rollback protege las operaciones que muestran una transacción explícita antes
de `COMMIT`. No prueba recuperación después de una respuesta HTTP perdida, ni
reconciliación automática de pagos o domicilios. El frontend puede prevenir
doble envío visualmente, pero esta matriz no atribuye ese control a todos los
consumidores.

## Pendientes de validación

- repetir una solicitud después de timeout en QA controlado;
- comprobar duplicados con el mismo documento y referencia;
- probar cierre concurrente y movimiento posterior al cierre;
- validar reconciliación de pagos y diferencias de caja;
- verificar recuperación de transición de entrega interrumpida;
- revisar seguridad efectiva de tenant, sucursal, terminal y caja por ruta.
