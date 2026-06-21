## Why

Manus POS Electron Windows ya puede operar como shell online y ya tiene estrategia de perifericos documentada. Antes de tocar impresoras termicas o ESC/POS, conviene formalizar una primera estrategia de impresion basada en capacidades web/Windows existentes y separar recibo operativo, ticket, factura y documento fiscal.

## What Changes

- Documentar estrategia inicial de impresion de recibos/tickets en Electron Windows.
- Registrar flujos web existentes que ya usan `window.print`, iframes PDF o ventanas PDF.
- Definir `window.print` y la impresion estandar del sistema como base inicial.
- Documentar `webContents.print` como evolucion futura controlada.
- Mantener ESC/POS directo, impresion silenciosa obligatoria, gaveta e impresora fiscal fuera de alcance.
- Crear evidencia QA documental.
- No modificar POS, caja, pedidos, facturacion, backend, SQL, permisos ni logica de negocio.

## Capabilities

### New Capabilities

- `electron-receipt-printing`: Estrategia inicial de impresion de recibos/tickets en Electron Windows usando impresion web/Windows sin integrar ESC/POS ni hardware fiscal.

### Modified Capabilities

- None.

## Impact

- Afecta solo documentacion y OpenSpec.
- No agrega dependencias.
- No agrega APIs Electron.
- No modifica codigo Electron, frontend, backend, SQL, permisos, POS, caja, pedidos ni facturacion.
- No implementa impresion real nueva, impresion silenciosa, gaveta, ESC/POS ni fiscal printer.
