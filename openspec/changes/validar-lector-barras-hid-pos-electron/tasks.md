# Tasks

## 1. Discovery

- [x] 1.1 Ejecutar `git status --short`.
- [x] 1.2 Ejecutar `git branch --show-current`.
- [x] 1.3 Ejecutar `git log --oneline -6`.
- [x] 1.4 Buscar campos y helpers de codigo, SKU, barcode y referencia en POS.
- [x] 1.5 Revisar `PosScreen.tsx` y helpers de busqueda.
- [x] 1.6 Revisar tests existentes del scanner POS.
- [x] 1.7 Confirmar que Electron main/preload no necesitan integracion nativa de lector.

## 2. OpenSpec

- [x] 2.1 Crear `openspec/changes/validar-lector-barras-hid-pos-electron/`.
- [x] 2.2 Crear `proposal.md`.
- [x] 2.3 Crear `design.md`.
- [x] 2.4 Crear `tasks.md`.
- [x] 2.5 Crear `specs/pos-barcode-hid/spec.md`.

## 3. Documentation

- [x] 3.1 Crear `docs/architecture/pos-barcode-hid-electron.md`.
- [x] 3.2 Documentar por que HID es teclado.
- [x] 3.3 Documentar coincidencia exacta y Enter.
- [x] 3.4 Documentar foco consecutivo.
- [x] 3.5 Documentar stock, peso y riesgo de multiples coincidencias.
- [x] 3.6 Enlazar desde `docs/architecture/electron-pos-peripherals-windows.md` si aplica.

## 4. QA evidence

- [x] 4.1 Crear `docs/evidencia-qa-pos-barcode-hid-electron.md`.
- [x] 4.2 Registrar archivos revisados.
- [x] 4.3 Registrar que no se implemento hardware nativo.
- [x] 4.4 Registrar que no se instalaron SDKs/librerias de scanner.

## 5. Validations

- [x] 5.1 Ejecutar `openspec.cmd validate validar-lector-barras-hid-pos-electron --type change --strict`.
- [x] 5.2 Ejecutar `openspec.cmd validate --all --strict`.
- [x] 5.3 Ejecutar `git diff --check`.
- [x] 5.4 Ejecutar `npx.cmd tsx --test modules\\pos\\utils\\*.spec.ts`.
- [x] 5.5 Ejecutar `npm.cmd run lint`.
- [x] 5.6 Ejecutar `npm.cmd run build`.

## 6. Confirmaciones de alcance

- [x] 6.1 Backend tocado: NO.
- [x] 6.2 SQL/migraciones tocadas: NO.
- [x] 6.3 Permisos tocados: NO.
- [x] 6.4 Caja/pedidos/facturacion tocados: NO.
- [x] 6.5 Electron native scanner API implementada: NO.
- [x] 6.6 USB/serial implementado: NO.
- [x] 6.7 SDK/libreria de scanner instalada: NO.
- [x] 6.8 Offline implementado: NO.
- [x] 6.9 Sincronizacion implementada: NO.
- [x] 6.10 Commit realizado: NO.
