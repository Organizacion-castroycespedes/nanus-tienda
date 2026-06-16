# Evidencia QA ajustes operativos cierre de caja y permisos

Estado: PASS tecnico. QA manual en navegador: PENDIENTE tras fix de menu.

## Alcance

- Campo `Efectivo contado` en cierre de caja con formato monetario `$` y decimales controlados.
- Acciones completas para `ADMIN`, `SUPER_USER` y `SUPER_ADMIN` en inventario operativo.
- Terminales de configuracion restringidas a `SUPER_USER` y `SUPER_ADMIN`.
- Menu dinamico restaurado desde `menu_items` y `role_menu_permissions`.

## Causa raiz menu

- La vista estaba recibiendo/filtrando menu con atajos locales de frontend.
- Ese fallback podia reemplazar o reducir el arbol dinamico de `/me/menu`.
- La base local no tenia menu keys oficiales para `INVENTORY_LOCATIONS`, `INVENTORY_LOTS` y `CONFIG_TERMINALS`.
- La matriz historica de permisos no incluia `INVENTORY_LOCATIONS` ni `INVENTORY_LOTS` para `ADMIN`.
- `USER` conservaba grants antiguos de `INVENTORY_PRODUCTS` y `INVENTORY_TAXES`, incompatibles con la regla de no exponer catalogos administrativos.

## Causa raiz Terminales

- Ruta canonica real confirmada: `/{tenant}/config/terminals`.
- Ruta reportada por QA: `/{tenant}/terminales`.
- No existia pagina/redirect para `/{tenant}/terminales`.
- El menu BD ya apunta a `/{tenant}/config/terminals`.
- El guard frontend de ruta usa `CONFIG_TERMINALS`.
- El controller API de Terminales seguia exigiendo `CONFIG_GENERAL`, lo que dejaba incoherente menu/ruta/API para `SUPER_USER`.
- Diferencia SUPER_USER vs SUPER_ADMIN: `SUPER_ADMIN` pasa por bypass privilegiado; `SUPER_USER` depende de permiso/shortcut puntual y no tenia `CONFIG_TERMINALS` en esa regla.

## Cambios realizados

- Se removieron los atajos locales de sidebar para inventario/terminales.
- El sidebar vuelve a renderizar el arbol permitido que llega desde el menu dinamico.
- Se agrego `CONFIG_TERMINALS` como menu key frontend/backend.
- Se alinearon route guards frontend para:
  - `INVENTORY_LOCATIONS`
  - `INVENTORY_LOTS`
  - `CONFIG_TERMINALS`
- Se alineo `api/src/modules/terminals/terminals.controller.ts` para exigir `CONFIG_TERMINALS`.
- Se agrego redirect legado `/{tenant}/terminales` hacia `/{tenant}/config/terminals`.
- Se agrego autorizacion puntual de `SUPER_USER` para `CONFIG_TERMINALS` en guard frontend y backend.
- Se agrego SQL idempotente:
  - `scripts/database/013_operational_menu_inventory_locations_lots_terminals.sql`
- El SQL garantiza en BD:
  - `ADMIN`: `Productos`, `Unidades`, `Impuestos`, `Promociones`, `Ubicaciones`, `Lotes`.
  - `SUPER_USER`: lo anterior + `Terminales`.
  - `SUPER_ADMIN`: lo anterior + `Terminales`.
  - `USER`: sin menu administrativo de esos catalogos ni terminales.
- Se actualizo seed de menu/permisos para que ejecuciones futuras conserven la matriz.

## Confirmaciones de alcance

- Produccion: no tocada.
- Deploy: no realizado.
- SQL: SI, solo menu/permisos idempotente.
- Backend tocado: SI, constantes/guard ya dentro del alcance.
- Frontend tocado: SI.
- Permisos/guards tocados: SI.
- Contratos API: no modificados.
- Logica de negocio contable/inventario: no modificada.
- Commit: no realizado.

## SQL local

- Script aplicado localmente: `scripts/database/013_operational_menu_inventory_locations_lots_terminals.sql`.
- Idempotencia: aplicado dos veces sin error.
- Verificacion local por rol:
  - `ADMIN`: 6 grants esperados de inventario.
  - `SUPER_USER`: 6 grants de inventario + `CONFIG_TERMINALS`.
  - `SUPER_ADMIN`: 6 grants de inventario + `CONFIG_TERMINALS`.
  - `USER`: sin grants para los catalogos administrativos ni `CONFIG_TERMINALS`.

## Validaciones tecnicas

- `openspec.cmd validate ajustes-operativos-cierre-caja-permisos --type change --strict`: PASS.
- `openspec.cmd validate --all --strict`: PASS, 20 items.
- Tests especificos de parseo/formato de caja: PASS.
- Tests especificos de permisos/guards API y Terminales API: PASS, 23 tests.
- Tests especificos de visibilidad de menu/ruta web: PASS, 9 tests.
- `cd web && npm.cmd run lint`: PASS con warnings existentes.
- `cd web && npm.cmd run build`: PASS con warnings existentes.
- `cd api && npm.cmd run build`: PASS.
- `git diff --check`: PASS con warnings LF/CRLF existentes.
- `git status --short`: ejecutado.

## QA manual pendiente

- Requiere logout/login o limpiar cache local de menu para forzar nueva respuesta de `/me/menu`.
- Si el API queda levantado con cache anterior, reiniciar API o esperar TTL de menu.
- Intento de navegador local: NO EJECUTADO porque la herramienta de navegador fallo por sandbox local (`windows sandbox failed: spawn setup refresh`).

ADMIN:

- [ ] Ver `Productos`.
- [ ] Ver `Unidades`.
- [ ] Ver `Impuestos`.
- [ ] Ver `Promociones`.
- [ ] Ver `Ubicaciones`.
- [ ] Ver `Lotes`.
- [ ] No ver `Terminales`.

SUPER_USER:

- [ ] Ver `Productos`.
- [ ] Ver `Unidades`.
- [ ] Ver `Impuestos`.
- [ ] Ver `Promociones`.
- [ ] Ver `Ubicaciones`.
- [ ] Ver `Lotes`.
- [ ] Ver `Terminales`.
- [ ] Entrar manualmente a `/{tenant}/config/terminals` sin redirigir a `/unauthorized`.
- [ ] Entrar a `/{tenant}/terminales` y redirigir a `/{tenant}/config/terminals`.

SUPER_ADMIN:

- [ ] Ver `Productos`.
- [ ] Ver `Unidades`.
- [ ] Ver `Impuestos`.
- [ ] Ver `Promociones`.
- [ ] Ver `Ubicaciones`.
- [ ] Ver `Lotes`.
- [ ] Ver `Terminales`.
- [ ] Entrar manualmente a `/{tenant}/config/terminals` sin redirigir a `/unauthorized`.
- [ ] Entrar a `/{tenant}/terminales` y redirigir a `/{tenant}/config/terminals`.

USER:

- [ ] No ver modulos administrativos indebidos.
- [ ] Entrar manualmente a `/{tenant}/config/terminals` debe redirigir a `/unauthorized`.

## Pendientes reales

- QA manual navegador por rol tras refrescar menu/cache.
