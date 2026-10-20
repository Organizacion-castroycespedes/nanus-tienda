## 1. Gobernanza y decisiones

- [x] 1.3 Ratificar la alternativa C para compras de servicios y compras mixtas, incluyendo recepcion comercial separada de recepcion fisica.
- [x] 1.4 Confirmar que HU-PRODUCT no crea cuentas, asientos ni clasificaciones contables nuevas para servicios; el modulo contable queda en una fase independiente.
- [x] 1.5 Documentar impuestos de compra solo segun contratos existentes y definir el contrato documental del ledger futuro de idempotencia de recepcion.

- [x] 1.1 Ratificar el nombre `products.is_inventoryable` y el valor `BOOLEAN NOT NULL DEFAULT TRUE`.
- [x] 1.2 Aprobar alcance tenant/sucursal de `TRUE -> FALSE`, fuente `inventory_lot_balances.quantity_reserved` y criterio de lote regularizado basado en saldos, reservas y disponibilidad en todas las sucursales del tenant.
- [ ] 1.6 Resolver ownership con `fortalecer-productos-inventario`, `mejorar-reportes-productos-inventario`, `restringir-anulacion-dian-y-kardex`, `corregir-stock-insuficiente-y-recuperacion-carrito-pos` e `inmutabilizar-configuracion-estructural-productos`.
- [x] 1.7 Acordar ownership exacto para las cuatro rutas de compras; aplicar `current_ownership` con rutas concretas, razon auditable y sin reasignar owners ajenos.
- [x] 1.8 Validar nuevamente el target `origin/develop`, la unicidad de migraciones y el contrato del runner antes de crear cualquier migracion.

## 2. Modelo de producto y transiciones

- [x] 2.1 Agregar `products.is_inventoryable` con default `TRUE` mediante una migracion post-cutover aprobada, sin columnas nuevas de cantidad fisica.
- [x] 2.2 Agregar persistencia de auditoria para cambios de inventariabilidad con tenant, producto, usuario, valores, fecha y motivo.
- [x] 2.3 Implementar la transaccion `TRUE -> FALSE` con saldo fisico cero en todas las sucursales, `quantity_reserved` cero, lotes operativos regularizados y locks V108 en orden determinista.
- [x] 2.4 Implementar `FALSE -> TRUE` sin movimientos ni stock ficticio.
- [x] 2.5 Definir y probar el tratamiento de `branch_id NULL` antes de permitir una transicion.
- [x] 2.6 Actualizar `api/src/modules/inventory/entities/product.entity.ts`, `product.repository.ts`, `product.service.ts` y contratos DTO.
- [x] 2.7 Mantener inactivos, pero no destruir, `requires_lot`, `requires_expiration`, `is_perishable`, `min_stock` y `max_stock` cuando el producto sea no inventariable.

## 3. Importacion y configuracion web

- [ ] 3.1 Agregar `is_inventoryable` al contrato de importacion y a `product-import.columns.ts`.
- [ ] 3.2 Hacer que importacion use la misma validacion transaccional del servicio de productos.
- [x] 3.3 Agregar el control de inventariabilidad al formulario de producto y mostrar errores de transicion.
- [x] 3.4 Desactivar en UI los controles fisicos cuando la politica efectiva sea no inventariable, sin cambiar categorias ni subcategorias.
- [ ] 3.5 Agregar pruebas de creacion, importacion, aislamiento tenant y transiciones autorizadas.

## 4. POS y ventas SQL

- [x] 4.1 Exponer `isInventoryable` en `ProductResponse` y catalogo POS.
- [x] 4.2 Ajustar filtros, tarjeta, carrito y modal de cobro para que servicios no dependan de stock.
- [ ] 4.3 Mantener validaciones de stock y recuperacion segura para productos inventariables.
- [x] 4.4 Crear la migracion forward-only V110 para redefinir `inventory_create_sale_v2`, sin modificar V108 ni funciones historicas.
- [x] 4.5 Derivar inventariabilidad desde `products` en SQL; nunca confiar en un flag enviado por el navegador.
- [x] 4.6 Preservar lock advisory, orden ascendente, trigger de snapshots y rechazo de negativos V108.
- [x] 4.7 Omitir stock, FEFO, lotes y `OUT` solo para lineas no inventariables.
- [x] 4.8 Mantener `sale_items`, pricing snapshots, impuestos, descuentos, pagos, idempotencia y outbox.
- [ ] 4.9 Probar venta inventariable, servicio y venta mixta atomica.

## 5. Pedidos, compras, ajustes y movimientos

- [ ] 5.1 Redefinir `inventory_invoice_order` con la misma politica de venta mixta.
- [ ] 5.2 Ajustar `order.service.ts` para entregar servicios sin stock y conservar movimientos de productos fisicos.
- [x] 5.3 Extender el contrato de `purchase.service.ts` para compra solo de servicios: exigir accion explicita del usuario para recibir, permitir parcialidad, conservar proveedor, costo, subtotal, documento, estado comercial y pagos, sin `IN`, lotes, FEFO, reservas ni valoracion fisica.
- [x] 5.4 Extender recepcion por linea: `ordered_quantity` y `received_quantity` siguen comerciales; `TRUE` exige movimientos/lotes fisicos y `FALSE` solo avanza estado comercial.
- [x] 5.5 Crear y usar el ledger de idempotencia scoped por tenant, compra y `Idempotency-Key`, con hash, resultado recuperable y efectos atomicos; reutilizar solo convenciones, no tablas de ventas o pagos.
- [ ] 5.6 Mantener referencias de pago `PURCHASE`/`PURCHASE_ORDER`, direccion `OUT`, asignaciones y sincronizacion financiera; no inventar impuestos ni asientos.
- [ ] 5.7 Definir cancelacion, devolucion y liquidacion parcial para compras de servicios y mixtas, revirtiendo fisico solo para `TRUE`; cubrir el bloqueo actual por `received_quantity` positivo y rechazar cancelaciones sin reverso comercial autorizado.
- [ ] 5.8 Ajustar `stock-adjustment.service.ts` y `stock-movement.service.ts` para rechazar movimientos fisicos de servicios.
- [ ] 5.9 Revisar `inventory_lot_balances.quantity_reserved`, lotes, FEFO y reconciliacion para ignorar productos no inventariables.
- [ ] 5.10 Preparar locks de conjuntos multi-producto en orden estable antes de leer o escribir stock, incluyendo transiciones concurrentes.
- [ ] 5.11 Agregar pruebas de compras solo servicio, compras mixtas, recepcion parcial, errores atomicos, idempotencia, pagos, cancelacion, pedidos mixtos y aislamiento de sucursal.
- [x] 5.12 Exigir `purchaseItemId` o asignacion determinista cuando una compra repita el mismo producto en varias lineas.

## 6. Cancelaciones, devoluciones y fiscal

- [ ] 6.1 Ajustar cancelacion y devolucion para reversar solo lineas inventariables.
- [ ] 6.2 Mantener auditoria y trazabilidad comercial de servicios sin crear movimientos reversos.
- [ ] 6.3 Verificar que impuestos, descuentos, pagos, `sale_type`, `measurement_unit`, costos y codigos DIAN permanezcan intactos.
- [ ] 6.4 Verificar outbox, idempotencia y factura DIAN para servicio y venta mixta.
- [x] 6.5 Coordinar cualquier cambio en `SaleService` y `SaleRepository` con el owner de `corregir-stock-insuficiente-y-recuperacion-carrito-pos`.

## 7. Reporteria y BI

- [ ] 7.1 Actualizar `inventory_bi_base` para exponer o excluir servicios con estado `NOT_APPLICABLE`.
- [ ] 7.2 Actualizar `fnc_report_product_inventory` con la politica de inventariabilidad.
- [ ] 7.3 Ajustar servicios de `backend-reporteria` y contratos web de inventario.
- [ ] 7.4 Mantener servicios en reportes comerciales y excluirlos de stock, lotes, FEFO, minimos y valorizacion fisica.
- [ ] 7.5 Agregar pruebas de reportes historicos, tenant, sucursal, estados y filtros.
- [ ] 7.6 Extender reportes de compras y caja para distinguir lineas de servicio, lineas fisicas, recepcion comercial, recepcion fisica y valoracion sin duplicar totales.

## 8. Validacion y despliegue

- [ ] 8.1 Ejecutar pruebas unitarias de producto, ventas, movimientos, pedidos, compras, lotes y reporteria.
- [ ] 8.2 Ejecutar pruebas de concurrencia para dos ventas, venta/recepcion, transicion/venta y dos recepciones sobre la misma compra.
- [ ] 8.3 Verificar que no existan `OUT` ni lotes para servicios y que snapshots V108 sigan correctos para fisicos.
- [ ] 8.3a Probar timeout despues de `COMMIT`, doble clic, misma clave con payload distinto, clave distinta con cantidad pendiente y recepcion parcial repetida.
- [ ] 8.4 Antes de una futura migracion, verificar local autorizado, host loopback, nombre permitido, esquema y `migrations_history`; ejecutar `MIGRATION_DRY_RUN=YES` y luego solo `scripts/database/apply_single_migration.sh`, sin reejecutar historicas ni elegir `NEXT_SAFE_VERSION`.
- [x] 8.5 Ejecutar validacion OpenSpec estricta, governance diagnostic y `git diff --check`.
- [x] 8.6 Mantener desarrollo, pruebas y QA de esta HU en local; cualquier promocion `LOCAL -> QA -> PRD` queda fuera y requiere una autorizacion posterior.
- [ ] 8.7 Documentar rollback operativo sin borrar ventas, pagos, movimientos, lotes ni documentos DIAN.
- [x] 8.8 Cerrar la fase documental y comenzar implementacion local solo despues de ownership formal, V109 aplicada localmente, recepcion comercial e idempotencia persistente; mantener contabilidad, ventas SQL y reporteria como dependencias coordinadas pendientes.
