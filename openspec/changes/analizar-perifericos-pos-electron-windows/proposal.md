## Why

Electron Windows ya existe como shell online y ya empaqueta en Windows. Antes de integrar hardware POS real, Manus POS necesita una estrategia documentada que separe perifericos, seguridad Electron y autoridad de negocio.

## What Changes

- Documentar estrategia futura para perifericos POS Windows en Electron.
- Analizar impresora termica/recibos, gaveta monedera, lector de codigo de barras, bascula e impresora fiscal.
- Definir arquitectura futura Web/Electron/preload/main para acceso controlado a hardware.
- Definir limites de seguridad para APIs de hardware futuras.
- Definir matriz inicial de compatibilidad, riesgos y fases futuras.
- Crear evidencia QA documental.
- No instalar SDKs, librerias de perifericos, comandos ESC/POS, serial/USB, fiscal printer SDK ni integracion real de hardware.

## Capabilities

### New Capabilities

- `electron-pos-peripherals`: Estrategia documental para integraciones futuras de perifericos POS Windows desde Electron, sin implementar hardware en esta fase.

### Modified Capabilities

- None.

## Impact

- Afecta solo documentacion y OpenSpec.
- No modifica backend, SQL, permisos, frontend web, POS, caja, pedidos, facturacion, Electron runtime, empaquetado funcional ni logica de negocio.
- No agrega dependencias.
- No agrega codigo de hardware.
