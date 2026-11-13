## 0. Gobernanza

- [x] 0.1 Aprobación del propietario (2026-11-13: confirmar causa, no afectar /pos, implementar y luego ejercicio controlado). Open Questions con valor por defecto: lote vencido siempre bloqueado; anulación de entregas fuera de alcance.
- [x] 0.2 Rama propia desde `develop` (después de mergear `modernizar-inventario-lotes-ubicaciones`), mover este borrador a `openspec/changes/` y registrarlo en `scripts/governance/openspec-scope.json`.
- [x] 0.3 `openspec validate corregir-lotes-entrega-pedidos --strict`.

## 1. Código (pruebas primero)

- [x] 1.1 Specs en `order.service.spec.ts`: un lote, varios lotes (filtro ACTIVE/no vencido, orden FEFO, `FOR UPDATE`), stock de lote insuficiente sin efectos, producto sin lote sin cambios, bloqueo de alcance en orden ascendente.
- [x] 1.2 `deliverOrder`: `inventory_lock_stock_scope` por producto en orden ascendente, selección FEFO con `FOR UPDATE OF balance`, descuento atómico (`quantity_on_hand - x` con guarda de disponible) y vínculo en `stock_movement_lots`, con el `client` de la transacción (misma regla y SQL que el POS).
- [x] 1.3 Mensaje claro en `OrderDeliverForm.tsx` para stock de lote insuficiente (si aplica).
- [x] 1.4 `cd api && npx tsx --test src/modules/inventory/**/*.spec.ts && npm run build`; `cd web && npm run lint && npm run build`. Windows 2026-11-13: API 456/456 + build OK; web lint + build OK.

## 2. Corrección de datos (aprobación explícita, fuera del deploy)

- [x] 2.1 DESCARTADA por el propietario (2026-11-13): no se corrigen datos históricos. Conteo físico de los lotes de `AGUADIENTE003` en Sucursal Principal.
- [x] 2.2 DESCARTADA (2026-11-13); el borrador queda solo como referencia. Script SQL idempotente con verificación previa y posterior; revisión del propietario. Borrador: `correccion-datos-entregas-sin-lote.sql` (termina en ROLLBACK).
- [x] 2.3 DESCARTADA (2026-11-13). Ejecución en QA y verificación (conciliación limpia; lotes = kardex = 95).
- [x] 2.4 DESCARTADA (2026-11-13): AGUARDIENTE003 y CEC01002003 quedan como están. Decisión y ajuste del producto inactivo `AGUARDIENTE003` (lote "100", 99 u).
- [ ] 2.5 Opcional (no bloquea el cierre): revisar otros productos con la misma discrepancia: consulta de salidas `reference_table = 'orders'` sin vínculo de lote en todo el tenant.

## 3. QA

- [x] 3.1 PASS (propietario, 2026-11-13) con `CEC01002004`: compra 10 en dos lotes de 5; venta POS −2 (lote 1); ajuste +2 (lote 3); ajuste −1 (lote 2); entrega de pedido −2 vinculada al lote 1 por FEFO. Lotes 1 + 4 + 2 = 7 = kardex; conciliación 0/0. Plan original: repetir la reproducción con `CEC01002003` (compra 10, venta POS 2, ajustes −1/+2, pedido de 2 entregado y facturado): kardex = suma de lotes = 7; conciliación limpia.
- [x] 3.2 Rechazo sin efectos: QA manual PASS (2026-11-13) por stock de kardex insuficiente (pedido de 10 con 5 disponibles, sin movimientos); el caso de lotes vencidos/bloqueados con kardex suficiente lo cubre la prueba automática "rechaza sin efectos si los lotes vendibles no alcanzan". Mensajes en español en `OrderDeliverForm.tsx` para ambos casos.
- [ ] 3.3 Anular la venta generada desde la entrega: funciona con el reverso de lotes. Pospuesto por el propietario (2026-11-13): se prueba después; no bloquea el cierre.
- [x] 3.4 PASS (propietario, 2026-11-13; anulaciones pospuestas). Regresión POS: venta con producto con lote, sin lote, pesable y anulación en `/pos` (web y Electron), sin cambios de comportamiento.
- [x] 3.5 Regresión automática sin modificar: `sale.service.spec.ts`, `sale.repository.spec.ts`, `sale-stock-rejection.spec.ts`. Contenedor 50/50 y Windows dentro de 456/456 (2026-11-13).
- [x] 3.6 `git diff --name-only` sin `scripts/database/**`, `sale.service.ts`, `sale.repository.ts`, `operational-sales/**` ni `web/modules/pos/**`.
