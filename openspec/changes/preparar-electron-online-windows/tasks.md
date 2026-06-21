# Tasks

## 1. Discovery

- [x] 1.1 Ejecutar `git status --short`.
- [x] 1.2 Confirmar rama actual.
- [x] 1.3 Revisar `web/package.json`.
- [x] 1.4 Revisar estructura frontend Next.js.
- [x] 1.5 Revisar si existe `package.json` raiz.
- [x] 1.6 Revisar si existe soporte previo Electron real.

## 2. OpenSpec

- [x] 2.1 Crear `openspec/changes/preparar-electron-online-windows/`.
- [x] 2.2 Crear `proposal.md`.
- [x] 2.3 Crear `design.md`.
- [x] 2.4 Crear `tasks.md`.
- [x] 2.5 Crear `specs/electron-online/spec.md`.

## 3. Electron shell minimo

- [x] 3.1 Crear `desktop/electron/package.json`.
- [x] 3.2 Crear `desktop/electron/tsconfig.json`.
- [x] 3.3 Crear `desktop/electron/main.ts`.
- [x] 3.4 Crear `desktop/electron/preload.ts`.
- [x] 3.5 Configurar URL base con `MANUS_WEB_URL` y default `http://localhost:3000`.
- [x] 3.6 Configurar baseline seguro de `BrowserWindow`.
- [x] 3.7 Agregar scripts `dev`, `build` y `typecheck`.

## 4. Documentacion

- [x] 4.1 Crear `desktop/electron/README.md`.
- [x] 4.2 Crear `docs/architecture/electron-online-windows-implementation.md`.
- [x] 4.3 Actualizar docs de arquitectura Web/Electron solo para enlazar esta fase.
- [x] 4.4 Crear `docs/evidencia-qa-electron-online-windows.md`.

## 5. Validaciones

- [x] 5.1 Instalar dependencias en `desktop/electron/` si hace falta.
- [x] 5.2 Ejecutar `npm run typecheck` en `desktop/electron/`.
- [x] 5.3 Ejecutar `openspec.cmd validate preparar-electron-online-windows --type change --strict`.
- [x] 5.4 Ejecutar `openspec.cmd validate --all --strict`.
- [x] 5.5 Ejecutar `git diff --check`.
- [x] 5.6 Registrar QA local ejecutado o pendiente.
- [x] 5.7 Ejecutar QA real de ventana Electron cargando `http://localhost:3000/login`.

## 6. Confirmaciones de alcance

- [x] 6.1 Confirmar backend tocado: NO.
- [x] 6.2 Confirmar SQL/migraciones tocadas: NO.
- [x] 6.3 Confirmar permisos tocados: NO.
- [x] 6.4 Confirmar logica de negocio tocada: NO.
- [x] 6.5 Confirmar offline implementado: NO.
- [x] 6.6 Confirmar Capacitor/PWA instalado: NO.
- [x] 6.7 Confirmar perifericos integrados: NO.
- [x] 6.8 Confirmar instaladores creados: NO.
