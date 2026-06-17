# Evidencia QA - Restringir Roles a SUPER_ADMIN

Estado tecnico: PASS
Rama: fix/security--restrict-roles-module-from-SUPER_USER
Fecha: 2026-06-16

## Causa raiz

SUPER_USER conservaba acceso a Roles por un shortcut viejo en
`api/src/common/guards/permissions.guard.ts` y por el metadata de
`RolesController.list`, que permitia `SUPER_ADMIN` y `SUPER_USER`.

## Resultado

- Roles queda exclusivo para SUPER_ADMIN.
- SUPER_USER no ve Roles y no puede acceder por ruta/manual endpoint.
- ADMIN y USER siguen bloqueados para Roles.
- SUPER_USER conserva Terminales.
- USER, ADMIN y SUPER_USER conservan Finanzas segun permisos esperados.

## Archivos modificados

- `api/src/common/guards/permissions.guard.ts`
- `api/src/common/guards/permissions.guard.spec.ts`
- `api/src/modules/roles/roles.controller.ts`
- `api/src/modules/roles/roles.controller.spec.ts`
- `web/lib/permissions.ts`
- `web/lib/permissions.spec.ts`
- `web/lib/route-permissions.spec.ts`
- `docs/evidencia-qa-restringir-roles-super-user.md`

## Alcance

- SQL tocado: NO
- DB QA tocada: NO
- Produccion tocada: NO
- Deploy: NO
- Push: NO
- Merge: NO

## Validaciones

- `openspec.cmd validate --all --strict`: PASS
- `cd api && npm.cmd run build`: PASS
- `cd api && npx.cmd tsx --test src\common\guards\permissions.guard.spec.ts src\modules\roles\roles.controller.spec.ts`: PASS, 22 tests
- `cd web && npm.cmd run lint`: PASS con warnings viejos
- `cd web && npm.cmd run build`: PASS con warnings viejos
- `cd web && npx.cmd tsx --test lib\permissions.spec.ts lib\route-permissions.spec.ts`: PASS, 11 tests

## QA manual navegador

NO EJECUTADO.

## No regresion

- Terminales para SUPER_USER/SUPER_ADMIN: cubierto por tests.
- Finanzas para USER/ADMIN/SUPER_USER: cubierto por tests.
