# POS P3: soporte y dependencias

Fecha de revisión: 2026-09-16.

## POS-P3-001

La pantalla `/[tenant]/admin/peripherals` incluye `Diagnóstico de conexión` con tres estados separados:

- `Web`: confirma que la interfaz técnica está cargada. No afirma que API o Agent estén sanos.
- `API`: comprueba el health estable existente de versión (`/system/version`). Solo muestra `VERIFICADO` o `NO DISPONIBLE`.
- `Agent local`: reutiliza el health existente (`/health`) por el transporte HTTP o por IPC tipado de Electron. Solo muestra `VERIFICADO` o `NO DISPONIBLE`.

La vista no muestra tokens, URLs de conexión, identificadores de instalación, trazas ni datos de negocio. El fallback de Electron, su reintento de 3 segundos y el comportamiento online/static no fueron modificados. Si un health no responde, el diagnóstico no inventa un endpoint alternativo: conserva `NO DISPONIBLE`.

## POS-P3-002

Warnings reproducidos con `npm ci --ignore-scripts --no-audit --no-fund --loglevel=warn`:

- `desktop/electron`: `inflight@1.0.6`, `rimraf@2.6.3`, `glob@7.2.3` y `boolean@3.2.0`.
- `web`: `inflight@1.0.6`, `rimraf@3.0.2`, `glob@7.2.3`, `@humanwhocodes/config-array@0.13.0`, `@humanwhocodes/object-schema@2.0.3` y `eslint@8.57.1`.

Las cadenas son transitivas. Electron las recibe desde `electron-builder@26.15.3`; web las recibe principalmente desde `eslint@8.57.1` y su árbol de `eslint-config-next@14.2.35`. Actualizarlas de forma aislada puede cambiar el empaquetado Electron o exigir ESLint/Next mayores. No se actualizaron dependencias ni lockfiles.

La consulta `npm ls browserslist caniuse-lite --all --depth=6` mostró `browserslist@4.28.1` con `caniuse-lite@1.0.30001764`. `npm run build` reprodujo el warning real de Browserslist: la base de datos tiene 9 meses y recomienda `npx update-browserslist-db@latest`. La consulta `npx --yes browserslist@latest --coverage` sí respondió, pero no sustituye la actualización de la base de datos. No se ejecutó el actualizador porque cambia el lockfile y requiere revisión del impacto.

## Plan reproducible posterior

1. Abrir una tarea separada para revisar la matriz `Next 14`/`ESLint 8` y el empaquetado Electron.
2. Actualizar primero en rama aislada, con lockfile generado por el gestor correspondiente.
3. Validar `desktop/electron: npm run build`, `npm test`, `web: npm run lint` y `npm run build`.
4. Revisar el diff de lockfile y probar el fallback/reintento Electron antes de aprobar cualquier upgrade.
