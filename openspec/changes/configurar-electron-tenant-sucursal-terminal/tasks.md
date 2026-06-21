# Tasks

## 1. Discovery

- [x] 1.1 Ejecutar `git status --short`.
- [x] 1.2 Ejecutar `git branch --show-current`.
- [x] 1.3 Ejecutar `git log --oneline -2`.
- [x] 1.4 Revisar `desktop/electron/main.ts`.
- [x] 1.5 Revisar `desktop/electron/preload.ts`.
- [x] 1.6 Revisar `desktop/electron/package.json`.
- [x] 1.7 Confirmar worktree limpio antes de empezar.

## 2. OpenSpec

- [x] 2.1 Crear `openspec/changes/configurar-electron-tenant-sucursal-terminal/`.
- [x] 2.2 Crear `proposal.md`.
- [x] 2.3 Crear `design.md`.
- [x] 2.4 Crear `tasks.md`.
- [x] 2.5 Crear `specs/electron-operational-context/spec.md`.

## 3. Electron config helper

- [x] 3.1 Crear `desktop/electron/config.ts`.
- [x] 3.2 Resolver `MANUS_WEB_URL` con default `http://localhost:3000`.
- [x] 3.3 Resolver `MANUS_START_PATH`.
- [x] 3.4 Resolver `MANUS_TENANT_ID`, `MANUS_BRANCH_ID` y `MANUS_TERMINAL_ID`.
- [x] 3.5 Construir URL inicial final.
- [x] 3.6 Rechazar `MANUS_START_PATH` invalido sin `/`.
- [x] 3.7 Mantener branch/terminal fuera de la URL en esta fase.

## 4. Tests

- [x] 4.1 Crear `desktop/electron/config.spec.ts`.
- [x] 4.2 Cubrir default sin variables.
- [x] 4.3 Cubrir `MANUS_WEB_URL` custom.
- [x] 4.4 Cubrir `MANUS_START_PATH=/login`.
- [x] 4.5 Cubrir `MANUS_START_PATH` sin slash como error.
- [x] 4.6 Cubrir tenant como path inicial sin start path.
- [x] 4.7 Cubrir prioridad de start path sobre tenant.
- [x] 4.8 Cubrir branch/terminal leidos sin alterar URL.
- [x] 4.9 Agregar script `test` liviano.

## 5. Integracion y docs

- [x] 5.1 Integrar helper en `desktop/electron/main.ts`.
- [x] 5.2 Mantener baseline seguro Electron.
- [x] 5.3 Actualizar `desktop/electron/README.md`.
- [x] 5.4 Crear `docs/architecture/electron-tenant-branch-terminal-context.md`.
- [x] 5.5 Crear `docs/evidencia-qa-electron-contexto-operativo.md`.

## 6. Validaciones

- [x] 6.1 Ejecutar `npm run typecheck` en `desktop/electron`.
- [x] 6.2 Ejecutar `npm test` en `desktop/electron`.
- [x] 6.3 Ejecutar `openspec.cmd validate configurar-electron-tenant-sucursal-terminal --type change --strict`.
- [x] 6.4 Ejecutar `openspec.cmd validate --all --strict`.
- [x] 6.5 Ejecutar `git diff --check`.
- [x] 6.6 Registrar QA visual Electron ejecutado o pendiente.

## 7. Confirmaciones de alcance

- [x] 7.1 Backend tocado: NO.
- [x] 7.2 SQL/migraciones tocadas: NO.
- [x] 7.3 Permisos tocados: NO.
- [x] 7.4 Logica de negocio tocada: NO.
- [x] 7.5 POS/caja/pedidos/facturacion tocados: NO.
- [x] 7.6 Offline implementado: NO.
- [x] 7.7 Sincronizacion implementada: NO.
- [x] 7.8 Perifericos integrados: NO.
- [x] 7.9 Instaladores creados: NO.
