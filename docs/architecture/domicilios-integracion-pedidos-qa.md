# Domicilios - QA integracion backend con pedidos

## Alcance

Fase 6B valida integracion controlada Domicilios + Pedidos.

Implementado:

- `GET /api/orders/:id/delivery`
- `POST /api/orders/:id/delivery`
- Filtro `GET /api/deliveries?order_id=...`
- Creacion desde pedido en estado `CREATED`
- Snapshot de contacto/direccion desde cliente del pedido cuando existe
- Bloqueo de segundo domicilio para el mismo pedido
- Permisos `DELIVERIES_VIEW` y `DELIVERIES_CREATE`

Fuera de alcance:

- Caja
- Facturacion
- POS
- Inventario
- Frontend
- Movimiento financiero
- Cambio de flujo normal de pedidos

## Decision tecnica

Se eligieron endpoints wrapper bajo `OrderController` para que el cliente pueda navegar desde un pedido:

```text
GET  /api/orders/:id/delivery
POST /api/orders/:id/delivery
```

La regla queda en `DeliveriesService`:

```text
getByOrder(orderId, actor)
createFromOrder(orderId, payload, actor)
```

`OrderService` no asume state machine ni reglas internas de domicilios.

## Casos QA cubiertos por tests

| Caso | Resultado |
| --- | --- |
| Crear domicilio desde pedido valido | PASS |
| Crear inicia en `CREATED` | PASS |
| Guarda snapshot de cliente/contacto/direccion | PASS |
| Rechaza pedido inexistente | PASS |
| Rechaza pedido de otro tenant | PASS |
| Rechaza segundo domicilio para el mismo pedido, incluso final | PASS |
| Requiere `delivery_address` si pedido/cliente no trae direccion | PASS |
| Consulta domicilio por pedido | PASS |
| Endpoint de consulta requiere `DELIVERIES_VIEW` | PASS |
| Endpoint de creacion requiere `DELIVERIES_CREATE` | PASS |
| Creacion normal de pedido no llama `DeliveriesService` | PASS |
| No toca consultas de caja o facturacion | PASS |

## Comandos ejecutados

```text
npx.cmd tsx --test src/modules/deliveries/deliveries.service.spec.ts src/modules/inventory/controllers/order.controller.spec.ts
```

Resultado:

```text
tests 12
pass 12
fail 0
```

Validaciones completas quedan registradas al cierre de la fase:

```text
npm.cmd run build
npx.cmd tsx --test src/**/*.spec.ts
openspec.cmd validate gestionar-domicilios-clientes-pedidos-facturacion-caja --type change --strict
openspec.cmd validate --all --strict
git diff --check
```

Resultado de cierre:

| Validacion | Resultado |
| --- | --- |
| `npm.cmd run build` en `api` | PASS |
| `npx.cmd tsx --test src/**/*.spec.ts` en `api` | PASS, 499 pass, 1 skipped |
| `openspec.cmd validate gestionar-domicilios-clientes-pedidos-facturacion-caja --type change --strict` | PASS |
| `openspec.cmd validate --all --strict` | PASS, 32 passed |
| `git diff --check` | PASS con warnings CRLF |

## Confirmaciones

- Produccion tocada: NO.
- Frontend tocado: NO.
- Caja tocada: NO.
- Facturacion tocada: NO.
- POS tocado: NO.
- SQL productivo aplicado: NO.
- Commit realizado: NO.
