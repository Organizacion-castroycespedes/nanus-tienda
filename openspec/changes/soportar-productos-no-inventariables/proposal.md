## Why

El catalogo actual no distingue productos fisicos de servicios. `products` no tiene `is_inventoryable`, el POS exige existencias para vender y `inventory_create_sale_v2` aplica validacion de stock, lotes y movimientos `OUT` a todos los productos. Esto impide vender y facturar servicios como fotocopias, impresiones, alquileres de servicios y mano de obra sin inventar existencias.

La funcionalidad debe agregar una politica explicita por producto, conservar `TRUE` para productos existentes y mantener atomicidad, aislamiento tenant/branch, pagos, impuestos, descuentos, DIAN y las protecciones de concurrencia de V108.

El alcance aprobado por el propietario es la alternativa C: ventas de servicios, compras comerciales de servicios y compras mixtas. La compra de un servicio conserva proveedor, costo, subtotal, documento y estado financiero/comercial cuando esos contratos ya existen, pero no crea inventario fisico. La recepcion comercial de servicios requiere accion explicita del usuario y permite recepcion parcial. El modulo contable sera una fase independiente posterior. Esta HU excluye plan de cuentas, asientos automaticos, libros, balances, estados financieros y clasificacion contable automatica; solo conserva informacion comercial auditable para esa integracion futura.

## What Changes

- Usar `products.is_inventoryable BOOLEAN NOT NULL DEFAULT TRUE` como contrato ratificado de diseno; los productos existentes conservan `TRUE`.
- Exponer la propiedad en entidad, repositorios, DTOs, importacion, formularios y catalogo POS.
- Mantener el flujo actual de stock, movimientos, lotes y FEFO para productos inventariables.
- Permitir vender productos no inventariables sin stock previo, sin movimientos `IN`/`OUT`, sin consumo de lotes y sin FEFO.
- Conservar para productos no inventariables `sale_items`, precios, costos comerciales, descuentos, impuestos, pagos, categorias, subcategorias y campos fiscales DIAN.
- Hacer atomicas las ventas mixtas: stock y lotes solo para lineas inventariables; cualquier error revierte toda la transaccion.
- Definir transiciones `TRUE -> FALSE` y `FALSE -> TRUE` con validacion de stock, reservas, lotes y auditoria.
- Definir comportamiento para pedidos, entregas, compras, recepciones, ajustes, cancelaciones, devoluciones e importaciones.
- Permitir compras solo de servicios y compras mixtas: las lineas `FALSE` tienen recepcion comercial sin `IN`; las lineas `TRUE` conservan recepcion fisica, lotes, FEFO y valoracion existentes.
- Mantener `ordered_quantity` y `received_quantity` como cantidades comerciales. Los efectos fisicos de lineas `TRUE` se derivan de movimientos de inventario y enlaces de lotes existentes; no se agrega una cantidad fisica nueva sin necesidad demostrada.
- Conservar pagos de compras mediante las referencias existentes `PURCHASE` y `PURCHASE_ORDER`, proveedor, costos y documentos; no asumir soporte de impuestos de compra ni contabilizacion si no existe contrato real.
- Exigir `purchaseItemId` cuando una compra tenga lineas repetidas del mismo producto y conservar un resultado recuperable para recepciones idempotentes.
- Definir cancelacion de pendientes y reverso comercial auditable de servicios recibidos, sin crear reversos fisicos ficticios ni cancelar compras con pagos o efectos no revertidos.
- Usar `inventory_lot_balances.quantity_reserved` como evidencia actual de reserva, sin inventar una entidad de reservas; estados de lote operativos se derivan del contrato existente de `inventory_lots.status`.
- Diferenciar servicios de productos agotados en reporterias comerciales, inventario y BI.
- Preservar `inventory_lock_stock_scope`, locks ordenados, snapshots V108, rechazo de stock negativo y el tratamiento explicito de `branch_id NULL`.
- Mantener las funciones historicas y V108 sin edicion; cualquier cambio SQL futuro sera una migracion forward-only gobernada.

## Capabilities

### New Capabilities

- `productos-no-inventariables`: configuracion, transiciones, venta POS, facturacion, operaciones mixtas y reglas de no afectacion fisica.
- `compras-no-inventariables`: compra comercial de servicios, compras mixtas, recepcion comercial/fisica, pagos, cancelaciones, idempotencia y limites contables.

### Modified Capabilities

- `productos`: agrega la politica `is_inventoryable`, default compatible y transiciones auditadas.
- `inventario`: limita stock, movimientos, lotes, FEFO, reservas, compras y ajustes fisicos a productos inventariables, sin impedir el registro comercial de servicios.
- `reporteria-inventario`: distingue `NOT_APPLICABLE` de `OUT_OF_STOCK` y excluye servicios de metricas fisicas.
- `deliveries-orders-integration`: permite entregar o facturar servicios sin validacion ni salida de stock.
- `deliveries-invoicing-integration`: conserva venta, pagos, impuestos y facturacion DIAN para servicios y ventas mixtas.

## Impact

- Base de datos futura: `products`, auditoria de transiciones y funciones de venta/invoice order.
- API: productos, importacion, ventas, pedidos, compras, ajustes, movimientos, lotes, reservas y cancelaciones.
- Web: formulario de producto, catalogo POS, filtros, carrito y reportes.
- `backend-reporteria`: reportes de inventario y BI.
- Facturacion electronica y outbox: conservar contratos comerciales y fiscales.
- Gobernanza: la asociacion historica del directorio OpenSpec se conserva en `scripts/governance/openspec-scope.json`; el manifiesto asigna ahora, de forma aditiva y exacta, las cuatro rutas de compras autorizadas a esta HU. No se reasignan owners ajenos.
- Compras actuales: `api/src/modules/inventory/controllers/purchase.controller.ts`, `api/src/modules/inventory/services/purchase.service.ts`, `api/src/modules/inventory/entities/purchase.entity.ts`, `api/src/modules/inventory/entities/purchase-item.entity.ts`, pagos y reportes de compras son contratos afectados. El flujo actual registra `purchase_items`, pagos y recepcion fisica con `stock_movements IN`, pero no expone aun una politica por linea ni un estado separado de recepcion comercial.
- Desarrollo y validacion de esta HU quedan limitados al repositorio y herramientas locales. No incluye implementacion funcional en esta fase, migracion SQL, ejecucion DDL/DML, conexiones de base de datos, despliegue, Vercel, QA/PRD remoto, commit, push ni PR.
