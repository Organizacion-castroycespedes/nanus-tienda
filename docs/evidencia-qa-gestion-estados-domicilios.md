# Evidencia QA - Gestion estados domicilios

## Alcance validado

- Cambio OpenSpec: `gestionar-estados-domicilios`.
- Backend: estados operativos, transiciones, bloqueo de transiciones invalidas, timestamps y trazabilidad por historial.
- Frontend: labels operativos, badges, acciones en listado/detalle, filtro por estado y mensajes de accion.
- DB: migracion aditiva `V065__deliveries_operational_state_timestamps.sql` agrega `dispatched_at` y `failed_at`.

## Estados operativos

| Estado UI/API | Estado DB compatible |
| --- | --- |
| `CREADO` | `CREATED` |
| `EN_PREPARACION` | `ASSIGNED` |
| `DESPACHADO` | `DISPATCHED` |
| `ENTREGADO` | `DELIVERED` |
| `NO_ENTREGADO` | `NOT_DELIVERED` |
| `CANCELADO` | `CANCELLED` |

## Validacion tecnica

| Check | Resultado |
| --- | --- |
| Backend state machine, service y controller tests focalizados | PASS |
| Frontend helpers/query/quick-create tests focalizados | PASS |
| OpenSpec strict change | PASS |
| OpenSpec strict all | PASS |
| Web lint | PASS con warnings preexistentes de hooks/img fuera de Domicilios |
| Web build | PASS con los mismos warnings preexistentes |
| API build | PASS |
| `git diff --check` | PASS con warnings CRLF de Git |

## QA manual esperado

| Caso | Estado |
| --- | --- |
| Crear domicilio desde pedido | Pendiente manual |
| Ver estado inicial `CREADO` | Pendiente manual |
| Cambiar `CREADO -> EN_PREPARACION` | Pendiente manual |
| Cambiar `EN_PREPARACION -> DESPACHADO` | Pendiente manual |
| Cambiar `DESPACHADO -> ENTREGADO` | Pendiente manual |
| Confirmar `ENTREGADO` sin acciones | Pendiente manual |
| Cancelar desde `CREADO` | Pendiente manual |
| Confirmar `CANCELADO` sin acciones | Pendiente manual |
| Intentar transicion invalida y ver error | Pendiente manual |
| Filtro por estado funciona | Pendiente manual |
| Detalle refleja estado y timestamps | Pendiente manual |

## Modulos fuera de alcance

- Caja/recaudo: no modificado.
- POS: no modificado.
- Facturacion electronica: no modificada.
- Pagos: no modificados.
- Repartidores: no implementados; se conserva campo existente visible.
- Pedidos: no se cambian reglas funcionales; solo se mantiene vinculo existente.
