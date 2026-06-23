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

## QA manual

Estado general: QA MANUAL PASS.

Fecha de registro: 2026-06-23.

Fuente: PASS reportado por usuario durante cierre de rama.

Rutas probadas reportadas:

- `/{tenant}/deliveries`
- Detalle de domicilio desde listado.

Rol/contexto reportado:

- Usuario operativo autenticado.

| Caso | Estado |
| --- | --- |
| Crear domicilio desde pedido | QA MANUAL PASS reportado |
| Ver estado inicial `CREADO` | QA MANUAL PASS reportado |
| Cambiar `CREADO -> EN_PREPARACION` | QA MANUAL PASS reportado |
| Cambiar `EN_PREPARACION -> DESPACHADO` | QA MANUAL PASS reportado |
| Cambiar `DESPACHADO -> ENTREGADO` | QA MANUAL PASS reportado |
| Confirmar `ENTREGADO` sin acciones | QA MANUAL PASS reportado |
| Cancelar desde `CREADO` | QA MANUAL PASS reportado |
| Confirmar `CANCELADO` sin acciones | QA MANUAL PASS reportado |
| Intentar transicion invalida y ver error | QA MANUAL PASS reportado |
| Filtro por estado funciona | QA MANUAL PASS reportado |
| Detalle refleja estado y timestamps | QA MANUAL PASS reportado |

## Modulos fuera de alcance

- Caja/recaudo: no modificado.
- POS: no modificado.
- Facturacion electronica: no modificada.
- Pagos: no modificados.
- Repartidores: no implementados; se conserva campo existente visible.
- Pedidos: no se cambian reglas funcionales; solo se mantiene vinculo existente.
