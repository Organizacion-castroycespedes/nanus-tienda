# Evidencia QA Finanzas menu USER ADMIN

Estado: PASS técnico

## Resumen

- QA manual navegador: NO EJECUTADO
- Rama: `fix/security--restrict-roles-module-from-SUPER_USER`
- Causa raiz: `scripts/database/007_seed_role_menu_permissions.sql` no incluia `FINANCE*` en matriz y allow-list de `USER` y `ADMIN`; al re-ejecutarse, el cleanup borraba permisos de Finanzas.
- Causa local adicional: `scripts/database/seed.sh` no corria `scripts/database/finance/patches/20260502_1135_finance_menu_access.sql`, por lo que una DB local fresca podia quedar sin menu Finanzas.
- SQL tocado: SÍ
- DB local: aplicado x2
- Idempotencia local: PASS
- DB QA tocada: NO
- Produccion tocada: NO

## Archivos modificados

- `scripts/database/007_seed_role_menu_permissions.sql`
- `scripts/database/seed.sh`
- `web/domains/menu/constants.ts`
- `web/lib/route-permissions.ts`
- `web/lib/permissions.spec.ts`
- `web/lib/route-permissions.spec.ts`

## Validaciones ejecutadas

- `openspec.cmd validate --all --strict`: PASS
- `web npx.cmd tsx --test lib\permissions.spec.ts lib\route-permissions.spec.ts`: PASS, 9 tests
- `api npx.cmd tsx --test src\common\guards\permissions.guard.spec.ts src\modules\finance\cash-sessions\cash-sessions.service.spec.ts`: PASS, 23 tests
- `web npm.cmd run lint`: PASS con warnings viejos
- `web npm.cmd run build`: PASS con warnings viejos
- `api npm.cmd run build`: PASS
- `git diff --check`: PASS con warnings LF/CRLF Windows

## QA manual navegador

NO EJECUTADO.

Intentos locales:

- Browser in-app: runtime fallo antes de abrir la prueba.
- Chrome CDP local: Chrome levanto en `127.0.0.1:9223`, pero el smoke de navegador no devolvio resultado antes del timeout.

Cobertura tecnica ya validada:

- `USER` ve/accede `FINANCE`, `FINANCE_CASH_SESSIONS`, `FINANCE_CASH_MOVEMENTS`.
- `ADMIN` ve/accede `FINANCE`, `FINANCE_CASH_SESSIONS`, `FINANCE_CASH_MOVEMENTS`, `FINANCE_CASH_REGISTERS`.
- `SUPER_USER` conserva Finanzas y Terminales.
- `SUPER_ADMIN` conserva Finanzas, Terminales y Roles.
- `USER` y `ADMIN` no ganan Terminales ni Roles.

## Pendiente separado

- `SUPER_USER /roles` sigue con shortcut viejo en `PermissionsGuard`; queda fuera de este commit.
