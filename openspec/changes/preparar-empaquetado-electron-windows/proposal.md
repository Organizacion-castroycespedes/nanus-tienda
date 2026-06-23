## Why

Electron online ya puede abrir Manus POS Web y resolver contexto operativo local. Ahora hace falta preparar un empaquetado Windows minimo para validar una app desktop online sin avanzar todavia a instaladores firmados, auto-update, offline ni perifericos.

## What Changes

- Agregar `electron-builder` como dependencia de desarrollo en `desktop/electron`.
- Agregar configuracion Windows-first de empaquetado para Manus POS Electron.
- Agregar scripts de empaquetado local con target inicial `dir` y opcion `portable`.
- Mantener `main` apuntando al output TypeScript compilado.
- Ignorar artefactos locales de empaquetado para que no entren al repo.
- Documentar herramienta, comandos, targets, salidas y restricciones.
- Crear evidencia QA de typecheck, tests, build, empaquetado y runtime.
- No agregar firma de codigo, certificados, notarizacion, auto-update, publicacion automatica, offline, sync, perifericos ni cambios operativos.

## Capabilities

### New Capabilities

- `electron-windows-packaging`: Empaquetado Windows-first del shell Electron online para validacion local sin firma, auto-update ni publicacion automatica.

### Modified Capabilities

- None.

## Impact

- Afecta `desktop/electron/package.json`, `desktop/electron/package-lock.json`, `.gitignore`, documentacion y OpenSpec.
- Agrega dependencia dev `electron-builder`.
- Puede generar artefactos locales ignorados bajo `desktop/electron/release/`.
- No modifica backend, SQL, migraciones, permisos, frontend web, rutas web, POS, caja, pedidos, facturacion ni logica de negocio.
