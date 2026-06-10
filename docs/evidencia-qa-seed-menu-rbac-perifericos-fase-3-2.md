# Evidencia QA - Seed/Menu/RBAC Perifericos POS - Fase 3.2

## Objetivo

Validar end-to-end local que el menu y RBAC de `POS_PERIPHERALS` funcionan despues de aplicar los seeds locales del proyecto.

## Alcance

- Seed local de menu y permisos.
- Consultas DB sanitizadas.
- Validacion API de menu y permisos por rol.
- Validacion Web de ruta de diagnostico de perifericos.
- Validacion de `backend-perifericos` en modo `MOCK`.
- Builds y pruebas requeridas.

Fuera de alcance:

- Hardware real.
- ESC/POS real.
- Electron.
- Capacitor.
- Cambios de core de ventas, inventario, compras, caja o facturacion.

## Ambiente usado

| Componente | Valor |
| --- | --- |
| Sistema | Windows local |
| Repo | `D:/Profe/manus-tienda` |
| Cambio OpenSpec | `add-pos-peripherals-platform` |
| DB local | `manus_tienda_prd` |
| API local | `http://localhost:4020/api` |
| Web local validada | `http://localhost:3029` |
| Agent local | `http://localhost:4050` |
| Modo agent | `MOCK` |

No se registraron credenciales ni tokens en esta evidencia.

## Seeds aplicados o validados

Comando ejecutado desde raiz:

```powershell
bash scripts/database/seed.sh scripts/config/db.env
```

Resultado:

- Seed general: PASS.
- Seed de menu `scripts/database/006_seed_menu_items.sql`: PASS.
- Seed de roles/permisos `scripts/database/007_seed_role_menu_permissions.sql`: PASS.
- Seed de usuarios/roles demo: PASS.
- Proceso completo: PASS.

## Consultas SQL ejecutadas

Las consultas se ejecutaron con variables locales de entorno y sin imprimir credenciales.

Validacion de `menu_items`:

```sql
SELECT key, label, route, module, icon, visible, parent_id
FROM menu_items
WHERE key = 'POS_PERIPHERALS';
```

Validacion de permisos por rol:

```sql
SELECT r.name, rmp.permission_level, rmp.actions
FROM role_menu_permissions rmp
JOIN roles r ON r.id = rmp.role_id
JOIN menu_items mi ON mi.id = rmp.menu_item_id
WHERE mi.key = 'POS_PERIPHERALS'
ORDER BY r.name;
```

Validacion de exclusion de `USER`:

```sql
SELECT r.name,
  CASE WHEN rmp.id IS NULL THEN 'NO_ACCESS' ELSE 'HAS_ACCESS' END AS access_status
FROM roles r
LEFT JOIN role_menu_permissions rmp
  ON rmp.role_id = r.id
 AND rmp.menu_item_id = (SELECT id FROM menu_items WHERE key = 'POS_PERIPHERALS')
WHERE r.name IN ('SUPER_ADMIN', 'SUPER_USER', 'ADMIN', 'USER')
ORDER BY r.name;
```

## Resultado DB

`menu_items` contiene:

| key | label | route | module | icon | visible | parent |
| --- | --- | --- | --- | --- | --- | --- |
| `POS_PERIPHERALS` | `Perifericos POS` | `/{tenant}/admin/peripherals` | `peripherals` | `Printer` | `true` | `CONFIGURACION_TENANT_CONFIGURACION` |

Permisos encontrados:

| Rol | Nivel | Acciones |
| --- | --- | --- |
| `SUPER_ADMIN` | `WRITE` | `read`, `manage` |
| `SUPER_USER` | `WRITE` | `read`, `manage` |
| `ADMIN` | `WRITE` | `read`, `manage` |
| `USER` | Sin permiso | Sin acciones |

Resultado DB: PASS.

## Resultado API

Endpoints validados:

- `POST /api/auth/login/force`
- `GET /api/me/menu`
- `GET /api/me/permissions`

Tokens usados solo en memoria durante la prueba. No se guardaron en evidencia.

| Rol | Login | `/api/me/menu` contiene `POS_PERIPHERALS` | Ruta devuelta | `peripherals.manage` |
| --- | --- | --- | --- | --- |
| `SUPER_ADMIN` | PASS | Si | `/{tenant}/admin/peripherals` | Si |
| `SUPER_USER` | PASS | Si | `/{tenant}/admin/peripherals` | Si |
| `ADMIN` | PASS | Si | `/{tenant}/admin/peripherals` | Si |
| `USER` | PASS | No | No aplica | No |

Resultado API: PASS.

## Resultado Web

Ruta validada:

```text
http://localhost:3029/00000000-0000-0000-0000-000000000001/admin/peripherals
```

Validaciones realizadas:

- Ruta web responde HTTP `200` con agent offline: PASS.
- Ruta web responde HTTP `200` con agent online: PASS.
- `GET /health` del agent online responde HTTP `200`: PASS.
- `GET /devices` del agent online responde HTTP `200`: PASS.
- `GET /logs` del agent online responde HTTP `200`: PASS.

Observaciones:

- El servidor existente en `localhost:3000` devolvio un error de chunk stale de Next.js: `Cannot find module './1682.js'`.
- El servidor existente en `localhost:3029` respondio correctamente y se uso para validar la ruta.
- La validacion visual de sidebar/menu autenticado por rol no se pudo ejecutar porque el Browser plugin fallo por sandbox (`node_repl kernel exited unexpectedly` / `windows sandbox failed: spawn setup refresh`).
- La visibilidad por rol queda validada por API (`/api/me/menu`) y DB. Queda pendiente confirmacion visual con navegador autenticado.

Resultado Web: PASS para ruta HTTP y manejo online/offline. Visual sidebar por rol: PENDIENTE por bloqueo de herramienta.

## Resultado backend-perifericos

Comandos:

```powershell
cd backend-perifericos
npm.cmd run build
npm.cmd test
```

Resultados:

- Build: PASS.
- Tests: PASS, 18 tests, 18 pass.

Smoke MOCK con servicio temporal:

| Check | Resultado |
| --- | --- |
| Agent inicialmente offline | PASS |
| `GET /health` online | PASS |
| `GET /devices` online | PASS |
| `GET /logs` online | PASS |
| `POST /printer/test-print` | PASS |
| `POST /cash-drawer/open` | PASS |
| `GET /scale/current-weight` | PASS |
| `POST /scanner/simulate` | PASS |

El proceso temporal fue detenido al terminar el smoke.

## Resultado build/test

| Componente | Comando | Resultado |
| --- | --- | --- |
| `backend-perifericos` | `npm.cmd run build` | PASS |
| `backend-perifericos` | `npm.cmd test` | PASS |
| `api` | `npm.cmd run build` | PASS |
| `api` | `npx.cmd tsx --test "src/**/*.spec.ts"` | PASS, 357 pass, 1 skipped |
| `web` | `npm.cmd run build` | PASS |
| `web` | `npm.cmd test` | No existe script `test` |

El build de `web` mantiene warnings existentes de lint/images/hooks, sin fallar el build.

## OpenSpec y Git

| Comando | Resultado |
| --- | --- |
| `openspec.cmd validate add-pos-peripherals-platform --type change --strict` | PASS, change valid |
| `git diff --check` | PASS, sin errores de whitespace; Git reporto warnings LF/CRLF |
| `git status --short` | PASS, muestra cambios esperados de fases 2, 2.1, 3, 3.1 y evidencia 3.2 |
| `rg -n "[ \t]+$" docs/evidencia-qa-seed-menu-rbac-perifericos-fase-3-2.md openspec/changes/add-pos-peripherals-platform/tasks.md` | PASS, sin trailing whitespace |

## Riesgos pendientes

- Falta validacion visual del sidebar/menu por rol con navegador autenticado.
- `localhost:3000` tenia un proceso Next.js con chunk stale; se valido con `localhost:3029`.
- `USER` queda bloqueado por menu/API/permisos; acceso directo depende de la proteccion frontend existente en `web/lib/route-permissions.ts` y `web/app/[tenant]/layout.tsx`.

## Confirmacion de restricciones

- No se conecto hardware real.
- No se uso ESC/POS real.
- No se implemento Electron.
- No se implemento Capacitor.
- No se instalaron drivers.
- No se crearon migraciones estructurales.
- No se expusieron credenciales ni tokens en evidencia.
- No se modifico core de ventas, inventario, compras, caja ni facturacion.
