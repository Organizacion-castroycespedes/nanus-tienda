# Evidencia promotions admin fixes fase 6.9.3

Fecha: 2026-06-02
Rama: `feat/promotions-admin-fixes-fase-6-9-3`

## Alcance

Correccion minima de bugs QA de administracion frontend de promociones.

No se toco PricingService, POS venta, Orders, `inventory_create_sale_v2`, facturacion electronica, DIAN/GetAcquirer, suppliers, PRD real, remoto ni commits.

## Cambios

- `web/app/[tenant]/inventory/promotions/page.tsx`
  - Dejo de enviar el slug de ruta `default` como `tenantId` para productos y sucursales.
  - Ahora usa `useInventoryScope().currentTenant`, igual que otras pantallas de inventario.
  - Alineo validacion UX: `PERCENTAGE > 0`, `FIXED_AMOUNT > 0`, `SPECIAL_PRICE >= 0`.
- `api/src/modules/pricing/promotions.service.ts`
  - `PERCENTAGE`: rechaza `<= 0` y `> 100`.
  - `FIXED_AMOUNT`: rechaza `<= 0`.
  - `SPECIAL_PRICE`: permite `0` y rechaza negativos.
  - Permite deactivar filas legacy invalidas con `FIXED_AMOUNT = 0` cuando el cambio es solo `isActive=false`.
- `api/src/modules/pricing/promotions.service.spec.ts`
  - Agrego cobertura de `PERCENTAGE = 0`, `FIXED_AMOUNT = 0` y deactivacion legacy invalida.
- `scripts/database/migrations/20260606_pricing_promotions_menu_permissions.sql`
  - `INVENTORY_PROMOTIONS` queda `visible = TRUE`.
- `scripts/database/migrations/20260608_promotions_menu_visible_phase_6_9_3.sql`
  - Migracion idempotente para volver visible el menu en DBs que ya tenian el item.
- `scripts/database/009_seed_demo_operational_users.sql`
  - Seed demo deja `INVENTORY_PROMOTIONS` visible.

## QA local

Ambiente:

- Web local: `http://localhost:3029`.
- API stale existente: `http://localhost:4020`.
- API actual de esta rama levantada temporalmente en `http://localhost:4024` con `node dist/main.js`.
- DB local con host guard `localhost`, base `manus_tienda_prd`.

Acciones DB locales:

- `20260608_promotions_menu_visible_phase_6_9_3.sql`: `UPDATE 0`, porque el item no existia aun.
- `20260606_pricing_promotions_menu_permissions.sql`: `INSERT 0 1` menu, `INSERT 0 3` permisos.
- No se ejecuto migracion remota.

Resultados:

- `GET http://localhost:3029/default/inventory/promotions`: `200`.
- Browser in-app fallo dos veces con `windows sandbox failed: spawn setup refresh`; no hubo click visual.
- API actual `4024` con rol `ADMIN`:
  - `GET /api/inventory/products`: `6` productos.
  - `GET /api/branches`: `2` sucursales.
  - `GET /api/auth/menu`: contiene `INVENTORY_PROMOTIONS`.
  - `POST /api/pricing/promotions` con `FIXED_AMOUNT = 0`: `400`.
  - Crear promocion `PERCENTAGE = 1`: creada y visible en listado.
  - Deactivar promocion creada: `isActive=false`.
  - Buscar inactivas por nombre: la promocion aparece.
  - Cleanup `QA693-` activo: `[]`.

Notas:

- `http://localhost:3000/default/inventory/promotions` devolvio `500` por servidor Next dev stale (`__webpack_modules__[moduleId] is not a function`). La ruta en `3029` respondio OK y `npm run build` compilo la ruta.
- La primera prueba sobre API stale `4020` creo una fila legacy `FIXED_AMOUNT=0`; se corrigio la deactivacion para poder limpiar esa clase de fila.

## Validaciones

- OK: `cd api && npx.cmd tsx --test src/modules/pricing/*.spec.ts` (`51` tests).
- OK: `cd api && npm.cmd run build`.
- OK: `cd web && npm run lint`.
  - Warnings preexistentes de hooks deps e `<img>`.
- OK: `cd web && npm run build`.
  - Warnings preexistentes de hooks deps e `<img>`.
- OK: `openspec.cmd validate fortalecer-productos-inventario --type change --strict --json`.
  - `valid: true`.
- OK: `git diff --check`.
  - Exit code `0`; solo warnings de CRLF/LF del working copy.

## Riesgos pendientes

- La restriccion fuerte de DB aun permite `FIXED_AMOUNT = 0` por SQL manual; la API ya lo rechaza.
- Browser visual no se pudo ejecutar por bloqueo del plugin local.
- Servidor Next local `3000` estaba stale; usar `3029` o reiniciar `3000` para QA visual.
