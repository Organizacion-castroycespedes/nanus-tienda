# Evidencia Fase 6.5.2 - permiso dedicado para promociones

## Objetivo

Separar el CRUD backend de promociones del permiso amplio `INVENTORY_PRODUCTS` y usar el permiso dedicado `INVENTORY_PROMOTIONS`.

## Cambios realizados

- Se agrego `MENU_KEYS.INVENTORY_PROMOTIONS = "INVENTORY_PROMOTIONS"` en backend.
- `PromotionsController` ahora usa `INVENTORY_PROMOTIONS`.
- `GET /api/pricing/promotions` requiere `READ`.
- `GET /api/pricing/promotions/:id` requiere `READ`.
- `POST /api/pricing/promotions` requiere `WRITE`.
- `PATCH /api/pricing/promotions/:id` requiere `WRITE`.
- `PATCH /api/pricing/promotions/:id/deactivate` requiere `WRITE`.
- Se agrego migracion idempotente para crear `INVENTORY_PROMOTIONS` como menu oculto bajo Inventario.
- Se actualizaron seeds fresh DB de menu y permisos.
- Se agrego prueba de metadata RBAC para confirmar que promociones no usa `INVENTORY_PRODUCTS`.

## SQL versionado

Archivo:

- `scripts/database/migrations/20260606_pricing_promotions_menu_permissions.sql`

Comportamiento:

- Inserta o actualiza `menu_items.key = 'INVENTORY_PROMOTIONS'`.
- Usa `module = 'inventory'`.
- Usa `label = 'Promociones'`.
- Usa `route = '/{tenant}/inventory/promotions'` porque `menu_items.route` es `NOT NULL`.
- Usa `icon = 'tags'`.
- Usa `sort_order = 106`.
- Usa `visible = FALSE`.
- Asocia `parent_id` al menu `INVENTORY` si existe.
- Asigna permisos `WRITE` con acciones `read/create/update/delete` a `SUPER_ADMIN`, `SUPER_USER` y `ADMIN`.
- No asigna permisos por defecto a `USER`.

Seeds actualizados:

- `scripts/database/009_seed_demo_operational_users.sql`
- `scripts/database/007_seed_role_menu_permissions.sql`

## Validaciones ejecutadas

| Comando | Resultado |
| --- | --- |
| `cd api && npx.cmd tsx --test src/modules/pricing/promotions*.spec.ts` | OK, 23 tests passed |
| `cd api && npx.cmd tsx --test src/modules/pricing/*.spec.ts` | OK, 48 tests passed |
| `cd api && npm.cmd run build` | OK |
| `openspec.cmd validate fortalecer-productos-inventario --type change --strict --json` | OK |
| `git diff --check` | OK, solo warnings de LF/CRLF en Windows |

## Validacion local sugerida para SQL

No se ejecuto contra PRD real ni servidor remoto. Para validar en copia local/dev:

```bash
bash scripts/database/run_migrations.sh scripts/config/db.env
```

Checks sugeridos:

```sql
SELECT key, module, label, route, visible, sort_order
FROM public.menu_items
WHERE key = 'INVENTORY_PROMOTIONS';

SELECT r.nombre, rmp.access_level, rmp.actions
FROM public.role_menu_permissions rmp
INNER JOIN public.roles r ON r.id = rmp.role_id
INNER JOIN public.menu_items mi ON mi.id = rmp.menu_item_id
WHERE mi.key = 'INVENTORY_PROMOTIONS'
ORDER BY r.nombre;
```

Resultado esperado:

- `visible = false`.
- `SUPER_ADMIN`, `SUPER_USER` y `ADMIN` con `WRITE`.
- Sin permiso default para `USER`.

## Fuera de alcance confirmado

No se creo frontend.
No se creo pagina `/inventory/promotions`.
No se hizo visible el menu.
No se toco POS.
No se toco Orders.
No se toco `PricingService`.
No se toco facturacion electronica.
No se toco DIAN.
No se tocaron suppliers fiscales.
No se toco `backend-facturacion-electronica`.
No se toco PRD real.
No se ejecutaron comandos remotos.
No se hizo commit.

## Riesgos pendientes

- La migracion debe aplicarse en cada ambiente antes de depender del nuevo permiso con usuarios no privilegiados.
- Cache de menu/permisos puede requerir refresco de sesion o espera de TTL.
- El menu queda oculto; cuando exista frontend, se debe crear pagina y decidir si `visible` cambia a `TRUE`.
