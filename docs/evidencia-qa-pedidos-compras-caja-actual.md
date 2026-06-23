# Evidencia QA - Pedidos y compras por caja actual

Fecha: 2026-06-23

## Casos

- [x] Backend guarda `orders.cash_session_id` al crear pedido con caja abierta.
- [x] Backend guarda `purchases.cash_session_id` al crear compra con caja abierta.
- [x] Backend filtra pedidos por `cashScope=current`.
- [x] Backend filtra compras por `cashScope=current`.
- [x] Backend mantiene `cashScope=all` solo para roles autorizados.
- [x] Frontend Pedidos envia `cashScope=current` por defecto.
- [x] Frontend Compras envia `cashScope=current` por defecto.
- [x] Frontend muestra indicador de alcance `Caja actual` / `Todas`.
- [ ] USER con caja abierta crea pedido y lo ve en Pedidos.
- [ ] Pedido de otra caja/sesion no aparece en `cashScope=current`.
- [ ] API `/api/orders?cashScope=current` devuelve solo caja actual.
- [ ] USER con caja abierta crea compra y la ve en Compras.
- [ ] Compra de otra caja/sesion no aparece en `cashScope=current`.
- [ ] API `/api/purchases?cashScope=current` devuelve solo caja actual.
- [ ] USER sin caja no ve historico como operacion actual.
- [ ] ADMIN/SUPER_USER puede cambiar explicitamente a Todas.
- [ ] `cashScope=all` queda bloqueado para USER.
- [ ] Crear/pagar/facturar/recibir sigue exigiendo caja abierta.
- [ ] Cierre, arqueo y ticket no cambian.

## Validaciones

- [x] `cd api && npx.cmd tsx --test src\modules\inventory\services\order.service.spec.ts src\modules\inventory\services\purchase.service.spec.ts src\common\guards\jwt-auth.guard.spec.ts`
- [x] `cd api && npm.cmd run build`
- [x] `cd web && npm.cmd run lint`
- [x] `cd web && npm.cmd run build`
- [x] `openspec.cmd validate filtrar-pedidos-compras-por-caja-actual --type change --strict`
- [x] `openspec.cmd validate --all --strict`
- [x] `psql --single-transaction -f scripts/database/migrations/V069__orders_purchases_current_cash_scope.sql`

## Seed/Migracion QA

- [x] V069 aplicado en base local QA: `manus_tienda_prd`.
- [x] Confirmada columna `orders.cash_session_id`.
- [x] Confirmada columna `purchases.cash_session_id`.
- [x] Registrado en `public.migrations_history` como `migrations/V069__orders_purchases_current_cash_scope.sql`.
- [x] Archivo queda versionado en `scripts/database/migrations/` para que `migrate_prd.sh` lo tome en QA/PRD.

## Resultado

Validacion tecnica PASS. QA manual pendiente con usuario real y caja abierta/cerrada.

Notas:
- `npm.cmd run lint` y `npm.cmd run build` reportan warnings existentes de hooks/imagenes, sin fallo.
- Migracion aditiva creada: `scripts/database/migrations/V069__orders_purchases_current_cash_scope.sql`.
- Migracion aplicada localmente para QA manual.
- No se modifico cierre, arqueo ni ticket.
- No se hizo commit.
