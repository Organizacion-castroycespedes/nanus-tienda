## Why

La fase anterior definio que Manus POS tendra clientes Tipo B y Tipo D con Electron online, priorizando Windows. Ahora se necesita una base tecnica minima y controlada para ejecutar la web existente dentro de Electron sin duplicar frontend ni tocar reglas de negocio.

## What Changes

- Agregar un paquete separado en `desktop/electron/` para el shell Electron online.
- Configurar `main.ts`, `preload.ts`, `package.json` y `tsconfig.json` minimos.
- Cargar por defecto `http://localhost:3000` y permitir override con `MANUS_WEB_URL`.
- Mantener Electron como contenedor desktop online que consume la web existente.
- Agregar baseline razonable de seguridad para `BrowserWindow`.
- Documentar ejecucion local, variables de entorno, restricciones, decisiones y QA tecnico.
- No modificar backend, SQL, permisos, POS, caja, pedidos, clientes, facturacion, perifericos ni logica de negocio.
- No implementar offline, PWA, service worker, IndexedDB, sync queue, instaladores, firma ni auto-update.

## Capabilities

### New Capabilities

- `electron-online`: Base tecnica minima para ejecutar Manus POS en Electron online, Windows-first, cargando la web existente mediante URL configurable y sin offline.

### Modified Capabilities

- None.

## Impact

- Agrega `desktop/electron/` como paquete aislado con dependencia Electron.
- Agrega documentacion en `docs/architecture/` y evidencia QA.
- Agrega OpenSpec change `preparar-electron-online-windows`.
- No cambia contratos API, backend, SQL, frontend web, rutas, permisos ni reglas de negocio.
