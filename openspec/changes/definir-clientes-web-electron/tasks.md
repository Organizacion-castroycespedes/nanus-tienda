# Tasks

## 1. Discovery

- [x] 1.1 Ejecutar `git status --short`.
- [x] 1.2 Ejecutar `git rev-parse --abbrev-ref HEAD`.
- [x] 1.3 Ejecutar `git rev-parse --short HEAD`.
- [x] 1.4 Ejecutar `openspec validate --all --strict`.
- [x] 1.5 Registrar fallback Windows con `C:\nvm4w\nodejs\openspec.cmd` por bloqueo de `openspec.ps1`.

## 2. Revision sin modificar

- [x] 2.1 Revisar ausencia de `package.json` raiz.
- [x] 2.2 Revisar `web/package.json`.
- [x] 2.3 Revisar `api/package.json`.
- [x] 2.4 Revisar estructura frontend actual.
- [x] 2.5 Revisar rutas publicas e internas.
- [x] 2.6 Revisar modulos POS, caja, pedidos, clientes, proveedores, compras, inventario y reportes.
- [x] 2.7 Revisar autenticacion/sesion y permisos/roles.
- [x] 2.8 Revisar terminales y sesiones POS.
- [x] 2.9 Verificar soporte previo Electron, offline, service worker, sync queue y almacenamiento local.

## 3. Documentacion de arquitectura

- [x] 3.1 Crear `docs/architecture/clientes-web-electron-manus-pos.md`.
- [x] 3.2 Crear `docs/architecture/deployment-models-web-electron.md`.
- [x] 3.3 Crear `docs/architecture/electron-os-support-strategy.md`.
- [x] 3.4 Crear `docs/architecture/electron-future-offline-considerations.md`.

## 4. OpenSpec

- [x] 4.1 Crear `openspec/changes/definir-clientes-web-electron/proposal.md`.
- [x] 4.2 Crear `openspec/changes/definir-clientes-web-electron/design.md`.
- [x] 4.3 Crear `openspec/changes/definir-clientes-web-electron/tasks.md`.
- [x] 4.4 Crear spec delta requerido por strict en `openspec/changes/definir-clientes-web-electron/specs/clientes-web-electron/spec.md`.

## 5. Validacion final

- [x] 5.1 Ejecutar `openspec validate definir-clientes-web-electron --type change --strict`.
- [x] 5.2 Ejecutar `openspec validate --all --strict`.
- [x] 5.3 Ejecutar `git diff --check`.
- [x] 5.4 Confirmar que no se toco codigo.
- [x] 5.5 Confirmar que no se implemento offline.
- [x] 5.6 Confirmar que no se instalo Electron.
