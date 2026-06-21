## Why

El modulo Domicilios ya permite crear y listar registros, pero el flujo operativo queda incompleto cuando los domicilios permanecen en estado "Creado" y el listado muestra "Sin acciones". La tienda necesita avanzar, cerrar o cancelar domicilios desde listado y detalle con reglas seguras y trazabilidad.

## What Changes

- Definir los estados operativos canonicos de domicilios como `CREADO`, `EN_PREPARACION`, `DESPACHADO`, `ENTREGADO`, `NO_ENTREGADO` y `CANCELADO`.
- Aplicar reglas de transicion del lado backend y bloquear transiciones invalidas.
- Mostrar acciones visibles en listado y detalle segun estado, permisos y regla de reintento.
- Agregar o completar API de cambio de estado si la API actual no cubre todas las transiciones operativas.
- Registrar timestamps de ciclo de vida: `dispatched_at`, `delivered_at`, `cancelled_at` y `failed_at`.
- Registrar el usuario actor en campos existentes cuando el modelo lo permita, o en historial de estado cuando no exista campo directo.
- Mantener filtros por estado funcionando con los estados operativos.
- Mostrar mensajes claros de exito/error y mantener responsive sin overflow horizontal.
- Actualizar evidencia QA documental para el flujo de estados.

## Capabilities

### New Capabilities

### Modified Capabilities

- `deliveries-management`: Actualiza el modelo de estados, reglas de transicion, acciones UI, contrato API, trazabilidad y evidencia QA de la operacion basica de domicilios.

## Impact

- Backend: `api/src/modules/deliveries/**`, pruebas focalizadas y SQL seguro/aditivo solo si faltan campos o constraints para estados/timestamps.
- Frontend: `web/app/[tenant]/deliveries/**` y `web/modules/deliveries/**`.
- Docs/evidencia: nuevo documento QA para estados operativos de domicilios.
- Sin cambios funcionales en caja, POS, facturacion electronica, pagos, repartidores ni pedidos.
- Sin SQL destructivo.
