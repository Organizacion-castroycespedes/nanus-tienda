# Domicilios - QA integracion backend con facturacion

## Alcance

Fase 6C valida integracion controlada Domicilios + facturacion sobre el documento operativo actual `sales`.

Implementado:

- `GET /api/sales/:id/delivery`
- `POST /api/sales/:id/delivery`
- Filtro `GET /api/deliveries?sale_id=...`
- Creacion desde venta en estado `CREATED`
- Snapshot de contacto/direccion desde cliente de la venta cuando existe
- Bloqueo de segundo domicilio para la misma venta
- Permisos `DELIVERIES_VIEW` y `DELIVERIES_CREATE`

Fuera de alcance:

- Caja
- POS
- Movimiento financiero
- Facturacion electronica
- Impuestos
- Totales de venta
- Frontend

## Decision tecnica

Se eligio `sales` como documento fiscal/operativo porque no existe una tabla `invoice` separada en este backend.

Ruta usada:

```text
GET  /api/sales/:id/delivery
POST /api/sales/:id/delivery
```

La logica queda en `DeliveriesService`:

- `getBySale(saleId, actor)`
- `createFromSale(saleId, payload, actor)`

`SaleController` solo delega.

## Casos QA cubiertos por tests

| Caso | Resultado |
| --- | --- |
| Crear domicilio desde venta valida | PASS |
| Crear inicia en `CREATED` | PASS |
| Guarda snapshot de cliente/contacto/direccion | PASS |
| Rechaza venta inexistente | PASS |
| Rechaza venta de otro tenant | PASS |
| Rechaza venta de otra branch | PASS |
| Rechaza segundo domicilio para la misma venta | PASS |
| Consulta domicilio por venta | PASS |
| `GET /api/sales/:id/delivery` requiere `DELIVERIES_VIEW` | PASS |
| `POST /api/sales/:id/delivery` requiere `DELIVERIES_CREATE` | PASS |
| Crear venta normal no llama `DeliveriesService` | PASS |
| No toca caja ni factura electronica | PASS |

## Comandos ejecutados

```text
npm.cmd run build
npx.cmd tsx --test src/**/*.spec.ts
openspec.cmd validate gestionar-domicilios-clientes-pedidos-facturacion-caja --type change --strict
openspec.cmd validate --all --strict
git diff --check
```

## Resultado

Validacion completada.

- Build: PASS
- Tests backend: PASS, 510 pass, 1 skipped
- OpenSpec change: PASS
- OpenSpec all: PASS, 32 passed
- git diff --check: PASS con warnings CRLF solamente
- Smoke HTTP local: no ejecutado

## Confirmaciones

- Produccion tocada: NO
- Frontend tocado: NO
- Caja tocada: NO
- Movimientos financieros creados: NO
- Facturacion electronica tocada: NO
- Totales/impuestos de factura modificados: NO
- POS tocado: NO
- Pedidos modificados: NO, salvo reutilizacion segura de la relacion ya existente
- SQL productivo aplicado: NO
- Permisos nuevos creados: NO
- Commit realizado: NO
