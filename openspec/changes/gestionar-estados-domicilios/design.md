## Current State

El backend y frontend ya tienen un estado de domicilio y acciones parciales con valores tecnicos en ingles (`CREATED`, `ASSIGNED`, `DISPATCHED`, `DELIVERED`, `NOT_DELIVERED`, `CANCELLED`). El requerimiento operativo nuevo usa valores de negocio en espanol y reemplaza `ASSIGNED` por `EN_PREPARACION`, porque preparar un domicilio no debe implicar asignar repartidor en este cambio.

## Decisions

### Canonical states

Los estados canonicos del flujo operativo seran:

| Estado canonico | Significado operativo | Valor legado compatible |
| --- | --- | --- |
| `CREADO` | Domicilio creado, pendiente de preparacion o despacho | `CREATED` |
| `EN_PREPARACION` | Domicilio alistandose en tienda | `ASSIGNED` |
| `DESPACHADO` | Domicilio salio a entrega | `DISPATCHED` |
| `ENTREGADO` | Domicilio cerrado por entrega exitosa | `DELIVERED` |
| `NO_ENTREGADO` | Intento fallido de entrega | `NOT_DELIVERED` |
| `CANCELADO` | Domicilio cerrado por cancelacion | `CANCELLED` |

La implementacion puede mapear datos legados para lectura y filtros durante el despliegue, pero la UI operativa no debe mostrar valores tecnicos en ingles.

### State transitions

El backend es la autoridad. La UI solo muestra acciones posibles, pero toda transicion se valida de nuevo en el servicio/API.

Transiciones permitidas:

- `CREADO -> EN_PREPARACION`
- `CREADO -> DESPACHADO`
- `CREADO -> CANCELADO`
- `EN_PREPARACION -> DESPACHADO`
- `EN_PREPARACION -> CANCELADO`
- `DESPACHADO -> ENTREGADO`
- `DESPACHADO -> NO_ENTREGADO`
- `NO_ENTREGADO -> DESPACHADO` solo cuando el reintento este explicitamente permitido

`ENTREGADO` y `CANCELADO` son finales. No muestran acciones de cambio de estado.

### API shape

Si existen endpoints de accion, se pueden conservar para compatibilidad, siempre que expresen el comportamiento operativo nuevo. Si falta cobertura, agregar un endpoint tenant-safe de cambio de estado o endpoints de accion faltantes. La UI debe depender de una capa de servicio que traduzca acciones operativas a la API real.

Nombres visibles esperados:

- "Enviar a preparacion"
- "Despachar"
- "Marcar entregado"
- "Marcar no entregado"
- "Reintentar despacho"
- "Cancelar"

### Traceability

Cada transicion debe escribir historial con actor, estado anterior, estado nuevo, fecha/hora y motivo/nota cuando aplique. Los campos directos se usan si existen:

- `dispatched_at` al pasar a `DESPACHADO`
- `delivered_at` al pasar a `ENTREGADO`
- `cancelled_at` al pasar a `CANCELADO`
- `failed_at` al pasar a `NO_ENTREGADO`

Si hay campos directos de usuario (`dispatched_by_user_id`, `delivered_by_user_id`, etc.), se actualizan. Si no existen, el actor queda en `delivery_status_history`.

### Isolation

Este cambio no integra recaudo contraentrega, caja, POS, facturacion electronica, pagos ni repartidores. Tampoco cambia reglas funcionales de pedidos; solo conserva o muestra el vinculo existente.

## Risks

- **Valores legados en DB:** mitigar con mapeo compatible y migracion aditiva/no destructiva si hace falta.
- **Acciones ocultas por permisos:** centralizar acciones por estado y permisos, y probar lista/detalle.
- **Transiciones invalidas desde cliente viejo:** validar siempre en backend y devolver error claro.
- **Reintento ambiguo:** si no hay regla/campo explicito para reintento, ocultar accion y rechazar en backend.

## QA Evidence

Crear `docs/evidencia-qa-gestionar-estados-domicilios.md` con resultados de validacion tecnica y checklist manual. No marcar PASS visual/manual si no se ejecuta.
