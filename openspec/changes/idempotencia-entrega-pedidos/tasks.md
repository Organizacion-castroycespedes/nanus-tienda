## 0. Gobernanza

- [x] 0.1 Aprobación del propietario del borrador (2026-11-14).
- [x] 0.2 Rama `feature/develop/idempotencia-entrega-pedidos` desde `develop`; mover el borrador a `openspec/changes/`; registrarlo en `scripts/governance/openspec-scope.json`.
- [x] 0.3 `openspec validate idempotencia-entrega-pedidos --strict`.

## 1. Base de datos

- [x] 1.1 `V116__order_delivery_idempotency.sql` (tabla, CHECK, índice de recuperación), rollback y prueba estática `scripts/database/tests/test_v116_order_delivery_idempotency_migration.py` (4/4).

## 2. API (pruebas primero)

- [x] 2.1 Specs en `order.service.spec.ts`: replay con el mismo hash, 409 con hash distinto, `FOR UPDATE` del pedido antes de leer ítems, flujo sin cambios con clave nueva (incluido FEFO).
- [x] 2.2 Spec en `order.controller.spec.ts`: 400 sin encabezado y propagación de la clave.
- [x] 2.3 Implementar los helpers de idempotencia y el bloqueo en `deliverOrder`; el controlador lee `idempotency-key`.

## 3. Web

- [x] 3.1 `deliverOrder(id, items, idempotencyKey)` envía `Idempotency-Key`; `OrderDeliverForm.tsx` genera la clave una vez por apertura (mismo patrón que `PurchaseReceiveForm.createReceiptIdempotencyKey`).

## 4. Validación

- [x] 4.1 `cd api && npx tsx --test src/**/*.spec.ts && npm run build`; `cd web && npm run lint && npm run build` (la web no tiene script `test`). Windows 2026-11-14: API 1136/1136 + build OK; web lint + build OK. V116 aplicada en local (`manus_prd_local_test`).
- [x] 4.2 QA: doble clic en "Entregar" (una sola salida), entregas concurrentes, regresión de entrega con lote (FEFO) y de facturación del pedido.
- [x] 4.3 Evidencia en `docs/evidencia-idempotencia-entrega-pedidos.md`.
