# Evidencia QA AWS BD mejoras funcionales operativas

Estado: QA_DB_APPLIED_OK

## Datos

- Fecha: 2026-06-16 15:52:21 -05:00
- Rama local al ejecutar: `fix/security--restrict-roles-module-from-SUPER_USER`
- Release desplegado indicado: `release/evolutivo/0.0.1` `fb6ffae`
- Host QA: `ubuntu@api.apptiendamanus.space`
- DB validada por hard guard: `manus_tienda_qa`
- Produccion tocada: NO
- DB QA tocada: SI

## Metodo

- Conexion SSH con `plink` usando llave local `.ppk`.
- No se imprimio contenido de llave, password DB ni `DATABASE_URL`.
- Runtime env leido desde `/home/ubuntu/manustienda/build/.env`.
- Hard guard ejecutado antes de backup y SQL: `DB_NAME=manus_tienda_qa`.

## Backup

- Backup creado: `/home/ubuntu/backups/manus_tienda_qa_before_operational_menu_20260616_204516.dump`
- Tamano validado: `617790` bytes.

## SQL aplicado

Scripts copiados a `/home/ubuntu/sql-qa/` y aplicados en orden:

1. `scripts/database/006_seed_menu_items.sql`
2. `scripts/database/007_seed_role_menu_permissions.sql`
3. `scripts/database/009_seed_demo_operational_users.sql`
4. `scripts/database/013_operational_menu_inventory_locations_lots_terminals.sql`

Idempotencia QA:

- Segunda aplicacion de los mismos 4 scripts: PASS.
- Observacion esperada: `009` puede re-hashear passwords demo; `013` puede actualizar `updated_at`.

## PM2

- `pm2 list` confirmo `api-linux` online.
- Reinicio ejecutado: `pm2 restart api-linux --update-env`.
- Resultado: PASS, `api-linux` online.

## Validacion SQL

Resultado directo en `manus_tienda_qa`:

- `menu_items_required`: PASS, `count=7`.
- `menu_items_missing`: `NONE`.
- `menu_items_duplicates`: PASS, `count=0`.
- `role_permissions_required`: PASS, `missing=NONE`.
- `role_permissions_forbidden`: PASS, `present=NONE`.
- `role_menu_permissions_duplicates`: PASS, `count=0`.

## Validacion API admin

Via `SUPER_ADMIN` admin endpoints:

- Menu esperado: PASS.
- Duplicados de menu: PASS.
- `ADMIN`: PASS, 15 permisos, sin `CONFIG_TERMINALS`.
- `SUPER_USER`: PASS, 29 permisos, incluye inventario esperado y `CONFIG_TERMINALS`.
- `SUPER_ADMIN`: PASS, 31 permisos, incluye inventario esperado y `CONFIG_TERMINALS`.
- `USER`: PASS, 6 permisos, sin permisos administrativos indebidos.

## Smoke menu QA

Via `/me/menu` por rol:

- `USER`: PASS, 6 items, sin modulos administrativos indebidos.
- `ADMIN`: PASS, 15 items, inventario esperado, sin `CONFIG_TERMINALS`.
- `SUPER_USER`: PASS, 29 items, inventario esperado y `CONFIG_TERMINALS`.
- `SUPER_ADMIN`: PASS, 31 items, inventario esperado y `CONFIG_TERMINALS`.

## Smoke API rutas

- `ADMIN`: PASS en inventario esperado; `/api/terminals` bloqueado 403.
- `SUPER_USER`: PASS en inventario esperado; `/api/terminals` 200.
- `SUPER_ADMIN`: PASS en inventario esperado; `/api/terminals` 200.
- `USER`: PASS para bloqueo de `/api/terminals`, `/api/products`, `/api/units`, `/api/taxes`, `/api/suppliers`, `/api/pricing/promotions`.
- Observacion de codigo, fuera del SQL scope: `USER` recibe 200 en `/api/inventory/locations` y `/api/inventory/lots` porque esos controllers exigen `INVENTORY` READ, no las keys dedicadas.

## Pendientes

- Smoke visual en navegador autenticado: NO EJECUTADO.
- Decision separada: `SUPER_USER /roles` sigue siendo comportamiento de codigo.
- Decision separada: si `USER` debe bloquear tambien API `/inventory/locations` y `/inventory/lots`, requiere cambio de codigo, no SQL.
