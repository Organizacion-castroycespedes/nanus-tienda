# Evidencia — incorporar-trazabilidad-series-productos

Rama: `feature/develop/incorporar-trazabilidad-series-productos` (base `develop` @ `88a1d87`), sin commit.
Discovery y decisiones: proyecto "manus tienda" → `claude/series-productos-discovery.md`, `claude/series-productos-decisiones.md`.

## Fase 1 — Base de datos (V117)
- `scripts/database/migrations/V117__product_serials.sql`:
  - `products.requires_serial` + `chk_products_serial_rules` (solo inventariable, `UNIT`/`UND`, sin lote ni vencimiento);
  - `product_serials` con estado actual, ubicación opcional y unicidad `(tenant_id, product_id, serial_number_normalized)`;
  - `product_serial_events`, historial de solo inserción protegido por trigger;
  - 9 funciones (`fnc_product_serials_register`, `_assign_sale`, `_assign_order_delivery`, `prc_product_serials_mark_returned`, `_inspect`, `_write_off`, `_move_location`, más la normalización y el trigger);
  - menú `INVENTORY_SERIALS` con permiso para SUPER_ADMIN, SUPER_USER y ADMIN.
  - No modifica `inventory_create_sale_v2`, `sales`, `sale_items`, `stock_movements` ni los lotes (lo verifica la prueba `test_sale_process_is_not_modified`).
- Rollback `scripts/database/rollbacks/V117__product_serials_rollback.sql`: falla si hay series o productos con serie.
- Pruebas: `scripts/database/tests/test_v117_product_serials_migration.py`, `v117_product_serials_scenarios.sql`, `fixtures/v117_minimal_schema.sql`.

### Validación (Cowork, 2026-11-14, PostgreSQL 16.15 desechable sobre el esquema mínimo)
- La migración aplica en una sola transacción. Una segunda aplicación se rechaza con `PRODUCT_SERIALS_V117_ALREADY_APPLIED`. El rollback queda bloqueado con datos, funciona sin datos y la migración se puede volver a aplicar después.
- 51 escenarios funcionales OK:
  - reglas del producto;
  - recepción: conteo = movimiento, duplicados en la carga y en la BD, formato, ubicación por línea y por serie, ubicación de otra sucursal rechazada;
  - venta: conteo, otra sucursal, producto sin serie, serie ya vendida, retorno temprano sin series;
  - anulación con y sin retorno, idempotente;
  - inspección y bloqueo;
  - mover ubicación;
  - baja por ajuste;
  - entrega de pedido;
  - historial inmutable;
  - conciliación series = kardex.
- Concurrencia real con dos sesiones vendiendo la misma serie: la segunda espera el bloqueo de fila y recibe `SERIAL_NOT_AVAILABLE`, y la serie queda solo en la primera venta.
- `python -m unittest scripts/database/tests/test_v117_product_serials_migration.py` con `MANUS_SQL_SCRATCH_PG`: 7/7 (incluida la corrida funcional y la verificación del runner).

## Fase 2 — Producto (`requiresSerial`)
- API:
  - `product.entity.ts` y `product.service.ts` (`validateSerialRules`; `requiresSerial` en `PRODUCT_STRUCTURAL_FIELDS`, inmutable tras la creación);
  - `product.repository.ts` (select e insert);
  - `product.controller.ts`.
- Web:
  - casilla "Requiere número de serie" en `ProductOperationalSection` (deshabilitada al editar, si no es inventariable o si no se vende por unidad; excluyente con lote, vencimiento y perecedero);
  - validación y payload en `ProductForm`;
  - tipos, DTO y `payload.ts` (campo inmutable).
- Pruebas: `product.service.spec.ts` 51/51 (5 nuevas, más `requiresSerial` en la prueba de campos estructurales). `tsc --noEmit` del API OK; `tsc` de la web sin errores en código de producción.

## Validación en Windows (propietario, 2026-11-14)
- `openspec.cmd validate incorporar-trazabilidad-series-productos --strict`: válido.
- API `npx tsx --test src/**/*.spec.ts`: 1149 pruebas, 1141 pass, 0 fail, 8 omitidas (5 más que la línea base de 1136: las nuevas de producto). `npm run build` OK.
- Web `npm run lint` sin advertencias; `npm run build` OK.
- V117 aplicada en la base local real `manus_prd_local_test` con `node "Claude outputs\aplicar-V117-local.cjs" --aplicar`: SHA-256 `89e6d21052a051a5c3c057c158f3353672dec286d23184f66777fd60935b9410`; 9 funciones, columna `requires_serial` y menú "Series" en 3 tenants. Esto confirma las FK y columnas contra el esquema real. Sin registro en `migrations_history` (método local, igual que V116).

## Pendiente
- [ ] QA del formulario: crear un producto con serie (UNIT, sin lote); la casilla se deshabilita al editar; no se combina con lote ni vencimiento.
- Nota: el menú "Series" ya aparece en local, pero la página `/inventory/serials` llega en la fase 7; mientras tanto abre la página de "no encontrado".
