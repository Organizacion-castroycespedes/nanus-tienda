# Evidencia QA - Menu/RBAC Perifericos POS - Fase 3.1

## Objetivo

Integrar la ruta `/[tenant]/admin/peripherals` al menu administrativo de Manus POS y protegerla con el sistema RBAC existente.

## Alcance

- Agregar opcion de menu `Perifericos POS`.
- Agregar permiso funcional `peripherals.manage`.
- Usar seeds existentes de menu y permisos.
- Usar guard frontend existente por ruta y permisos.
- No conectar hardware real.
- No implementar Electron.
- No implementar Capacitor.
- No modificar core de ventas, inventario, compras, caja ni facturacion.

## Patron RBAC encontrado

- El menu se construye desde Backend API con `GET /me/menu`.
- El catalogo vive en `menu_items`.
- Los permisos por rol viven en `role_menu_permissions`.
- El seed activo de menu es `scripts/database/006_seed_menu_items.sql`.
- El seed activo de permisos por rol es `scripts/database/007_seed_role_menu_permissions.sql`.
- Web carga permisos desde `GET /me/permissions`.
- Web protege rutas en `web/lib/route-permissions.ts`.
- `web/app/[tenant]/layout.tsx` aplica `getRoutePermissionRequirement` + `hasPermission`.
- El tenant se resuelve en rutas con `/{tenant}` y el layout reemplaza `{tenant}` por el tenant autenticado.

## Permiso creado

- Menu key: `POS_PERIPHERALS`.
- Modulo: `peripherals`.
- Accion funcional: `manage`.
- Permiso funcional documentado: `peripherals.manage`.
- Label: `Perifericos POS`.
- Ruta seed: `/{tenant}/admin/peripherals`.
- Icono: `Printer` de `lucide-react`.

## Roles autorizados

- `SUPER_ADMIN`: acceso por seed y rol privilegiado.
- `SUPER_USER`: acceso por seed de permisos.
- `ADMIN`: acceso por seed y rol privilegiado frontend existente.

No existe rol `SOPORTE` en `scripts/database/003_seed_roles.sql`, por eso no se creo ni se asigno.

`USER` no recibe `POS_PERIPHERALS` por defecto.

## Archivos modificados

- `scripts/database/006_seed_menu_items.sql`
- `scripts/database/007_seed_role_menu_permissions.sql`
- `api/src/common/constants/menu-keys.ts`
- `api/src/modules/menu/menu-admin.service.spec.ts`
- `api/src/modules/users/users.service.spec.ts`
- `web/app/[tenant]/layout.tsx`
- `web/domains/menu/constants.ts`
- `web/lib/route-permissions.ts`
- `openspec/changes/add-pos-peripherals-platform/tasks.md`
- `docs/evidencia-qa-menu-rbac-perifericos-fase-3-1.md`

## Ruta validada

```text
http://localhost:3000/00000000-0000-0000-0000-000000000001/admin/peripherals
```

Regla frontend:

```text
/[tenant]/admin/peripherals -> peripherals.manage
```

## Aplicacion de seed

No se aplico a ninguna base productiva.

Para aplicar en local/QA segun patron existente:

```powershell
bash scripts/database/seed.sh scripts/config/db.env
```

El seed es idempotente por `ON CONFLICT`.

## Comandos ejecutados

```powershell
cd backend-perifericos
npm.cmd run build
npm.cmd test
```

Resultado: `PASS`.

- Build backend-perifericos: `PASS`.
- Tests backend-perifericos: `PASS`, 18/18.

```powershell
cd web
npm.cmd run build
```

Resultado: `PASS`.

Nota: warnings preexistentes de ESLint en varias pantallas; no fallan build.

```powershell
cd api
npm.cmd run build
```

Resultado: `PASS`.

`api/package.json` no define script `test`. Se ejecuto fallback del runbook del proyecto:

```powershell
cd api
npx.cmd tsx --test "src/**/*.spec.ts"
```

Resultado: `PASS`.

- 358 tests.
- 357 pass.
- 0 fail.
- 1 skipped.

Se hicieron ajustes test-only para que los fakes de `MenuAdminService` y `UsersService` coincidan con los servicios actuales. No se cambio logica funcional.

## Validacion OpenSpec

Comando:

```powershell
openspec.cmd validate add-pos-peripherals-platform --type change --strict
```

Resultado: `PASS`.

Salida:

```text
Change 'add-pos-peripherals-platform' is valid
```

## git diff --check

Comando:

```powershell
git diff --check
```

Resultado: `PASS`.

Nota: Git reporto normalizacion futura LF -> CRLF en archivos modificados, sin fallar el comando.

## Riesgos pendientes

- El item de menu aparece en ambientes donde se haya aplicado el seed actualizado o se haya creado el menu manualmente.
- La pantalla de administracion de permisos no modela acciones custom por UI; el seed conserva `manage`, pero ediciones manuales del rol podrian requerir revisar acciones.
- No se hizo smoke con login real porque depende de credenciales y base local.
- No se agrego rol `SOPORTE` porque no existe en el catalogo actual.

## Confirmaciones

- No se conecto hardware real.
- No se agregaron drivers ESC/POS, serialport, USB ni HID.
- No se modifico `backend-perifericos`.
- No se implemento Electron.
- No se implemento Capacitor.
- No se crearon migraciones estructurales.
- No se modifico core de ventas, inventario, compras, caja ni facturacion.
