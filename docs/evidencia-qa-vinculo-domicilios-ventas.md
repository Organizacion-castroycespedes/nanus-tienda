# Evidencia QA - Vinculo Domicilios con Ventas

Fecha: 2026-06-22

## Alcance validado

- `deliveries.sale_id` ya existe en `scripts/database/migrations/V063__deliveries_base.sql`.
- `GET /api/deliveries?sale_id=...` ya esta soportado por `DeliveriesService.list`.
- `GET /api/sales/:id/delivery` ya consulta por `sale_id` o por `order_id` de la venta.
- `DeliveryRelationCard` ya se usa desde pedidos y reporteria de ventas para ver/gestionar domicilio asociado.
- La asociacion nueva se ejecuta en `SaleService.createSaleFromOrderDelivery` y en `SaleService.createSale` cuando la venta queda con `order_id`.

## Casos cubiertos por pruebas

- Venta generada desde pedido actualiza el domicilio existente del pedido con `sale_id`.
- La actualizacion ocurre dentro de la misma transaccion de creacion de venta.
- Crear domicilio manual con `sale_id` conserva tambien el `order_id` de la venta asociada.
- Listado por `sale_id` sigue funcionando.
- Creacion desde venta bloquea duplicados por venta o pedido vinculado.

## Validaciones ejecutadas

- `openspec.cmd validate vincular-domicilios-con-ventas --type change --strict`: OK.
- `openspec.cmd validate --all --strict`: OK, 54 items passed.
- `cd api && npx.cmd tsx --test src/modules/deliveries/deliveries.service.spec.ts src/modules/inventory/services/sale.service.spec.ts`: OK, 29 tests passed.
- `cd api && npm.cmd run build`: OK.
- Fix posterior por error PostgreSQL `para el parámetro $3 se dedujeron tipos de dato inconsistentes`: OK, `sale_id` se castea como `uuid` y metadata usa `($3::uuid)::text`.
- Revalidacion posterior del fix con los mismos focused tests API: OK, 29 tests passed.
- Revalidacion posterior del fix con `cd api && npm.cmd run build`: OK.
- Frontend focused tests: N/A, no se tocaron helpers frontend.
- `cd web && npm.cmd run lint`: OK con warnings existentes de hooks e `<img>`.
- `cd web && npm.cmd run build`: OK con los mismos warnings existentes.
- `git diff --check`: OK, con advertencias CRLF de Git en archivos API modificados.

## Comprobaciones de no alcance

- Caja/recaudo: no se modificaron servicios ni tablas.
- Pagos: no se modificaron reglas ni payloads de pagos.
- Facturacion fiscal/electronica: no se modificaron modulos ni estados.
- Inventario: no se modificaron movimientos ni stock.
- POS: no se modifico UI POS ni flujo de venta.
- SQL destructivo: no aplica; no se agrego migracion.

## QA manual pendiente

- Crear pedido.
- Crear domicilio desde pedido.
- Facturar/generar venta desde pedido.
- Confirmar que el domicilio conserva `order_id`.
- Confirmar que el domicilio queda con `sale_id`.
- Abrir `/deliveries?order_id=...`.
- Abrir `/deliveries?sale_id=...`.
- Confirmar detalle muestra Pedido y Venta.
- Confirmar que desde venta se muestra Ver/Abrir domicilio y no se crea duplicado.
