# Tasks

## 1. Discovery

- [x] 1.1 Ejecutar `git status --short`.
- [x] 1.2 Ejecutar `git branch --show-current`.
- [x] 1.3 Ejecutar `git log --oneline -3`.
- [x] 1.4 Revisar `desktop/electron/package.json`.
- [x] 1.5 Revisar `.gitignore`.
- [x] 1.6 Confirmar worktree limpio antes de empezar.

## 2. OpenSpec

- [x] 2.1 Crear `openspec/changes/preparar-empaquetado-electron-windows/`.
- [x] 2.2 Crear `proposal.md`.
- [x] 2.3 Crear `design.md`.
- [x] 2.4 Crear `tasks.md`.
- [x] 2.5 Crear `specs/electron-windows-packaging/spec.md`.

## 3. Packaging config

- [x] 3.1 Agregar `electron-builder` como dev dependency.
- [x] 3.2 Configurar `appId` y `productName`.
- [x] 3.3 Configurar output local para empaquetado.
- [x] 3.4 Configurar files necesarios para app empaquetada.
- [x] 3.5 Agregar target Windows `dir`.
- [x] 3.6 Agregar target Windows `portable` como opcion.
- [x] 3.7 Mantener `main` apuntando a `dist/main.js`.
- [x] 3.8 Agregar scripts `pack`, `pack:win` y `dist:win`.

## 4. Git ignore

- [x] 4.1 Verificar exclusiones actuales.
- [x] 4.2 Ignorar artefactos locales de empaquetado Electron.
- [x] 4.3 Confirmar que no se ignoran fuentes ni documentacion.

## 5. Documentation

- [x] 5.1 Crear `docs/architecture/electron-windows-packaging.md`.
- [x] 5.2 Actualizar `desktop/electron/README.md`.
- [x] 5.3 Actualizar `docs/architecture/electron-online-windows-implementation.md` si aplica.
- [x] 5.4 Crear `docs/evidencia-qa-electron-windows-packaging.md`.

## 6. QA and validation

- [x] 6.1 Ejecutar `npm run typecheck` en `desktop/electron`.
- [x] 6.2 Ejecutar `npm test` en `desktop/electron`.
- [x] 6.3 Ejecutar `npm run build` en `desktop/electron`.
- [x] 6.4 Ejecutar `npm run pack:win` en `desktop/electron`.
- [x] 6.5 Ejecutar `npm run dist:win` si el entorno lo permite.
- [x] 6.6 Ejecutar runtime empaquetado o registrar pendiente/bloqueado.
- [x] 6.7 Ejecutar `openspec.cmd validate preparar-empaquetado-electron-windows --type change --strict`.
- [x] 6.8 Ejecutar `openspec.cmd validate --all --strict`.
- [x] 6.9 Ejecutar `git diff --check`.

## 7. Confirmaciones de alcance

- [x] 7.1 Backend tocado: NO.
- [x] 7.2 SQL/migraciones tocadas: NO.
- [x] 7.3 Permisos tocados: NO.
- [x] 7.4 Logica de negocio tocada: NO.
- [x] 7.5 POS/caja/pedidos/facturacion tocados: NO.
- [x] 7.6 Offline implementado: NO.
- [x] 7.7 Sincronizacion implementada: NO.
- [x] 7.8 Perifericos integrados: NO.
- [x] 7.9 Firma de codigo implementada: NO.
- [x] 7.10 Auto-update implementado: NO.
- [x] 7.11 Instalador productivo creado: NO.
