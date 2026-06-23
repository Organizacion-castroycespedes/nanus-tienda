## Why

Electron online ya abre Manus POS Web, pero una instalacion desktop para clientes Tipo B y Tipo D necesita una forma minima y local de resolver su contexto operativo inicial. Esta fase prepara tenant, sucursal y terminal solo como configuracion del shell, sin cambiar negocio ni backend.

## What Changes

- Agregar un helper testeable en `desktop/electron/config.ts` para resolver URL web base, ruta inicial, tenant, sucursal y terminal desde variables de entorno.
- Mantener compatibilidad con `MANUS_WEB_URL` y default actual.
- Agregar soporte local para `MANUS_START_PATH`, `MANUS_TENANT_ID`, `MANUS_BRANCH_ID` y `MANUS_TERMINAL_ID`.
- Integrar el helper en `desktop/electron/main.ts` para cargar la URL inicial resuelta.
- Agregar tests unitarios simples del helper con Node test runner, sin frameworks pesados.
- Actualizar documentacion Electron y crear evidencia QA.
- No tocar backend, SQL, permisos, POS, caja, pedidos, facturacion, offline, sync, perifericos, instaladores ni auto-update.

## Capabilities

### New Capabilities

- `electron-operational-context`: Configuracion local inicial del shell Electron para resolver contexto operativo tenant/sucursal/terminal y URL de arranque online sin cambiar comportamiento backend.

### Modified Capabilities

- None.

## Impact

- Afecta solo `desktop/electron/`, documentacion y OpenSpec.
- Agrega tests locales para el helper de configuracion Electron.
- No modifica contratos API, backend, SQL, permisos, frontend web, rutas web ni logica operativa.
