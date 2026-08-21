## Why

El Peripheral Agent certificó una XP-80 USB RAW en Windows x64, pero la capa
USB actual mezcla decisiones de Windows, CUPS y core. Esto bloquea una ruta
segura hacia Windows ARM64, Linux y macOS y hace frágil el empaquetado futuro.

## What Changes

- Extraer el transporte RAW de spooler Windows y el discovery Windows del core
  portable sin cambiar los bytes ESC/POS, el `deviceId` existente ni el flujo
  certificado TERM-001 -> XP-80.
- Formalizar puertos `PrinterTransport` y `DeviceDiscoveryProvider`, más
  `PlatformPaths` y un descriptor portátil de dispositivo/agente.
- Mantener `ThermalEscPosRenderer` y TCP RAW como componentes portables.
- Documentar la ruta futura para CUPS RAW, Linux, Windows ARM64, macOS, serial,
  BBG Market 30, cajón ESC/POS, lifecycle, empaquetado, CI y certificación.
- No implementar scanner, balanza, cajón, CUPS RAW ni serial en P0.
- Preparar una distribución portable reproducible solo para Windows x64, sin
  seleccionar todavía MSI, tray, auto-update ni una estrategia universal de
  empaquetado.

## Capabilities

### New Capabilities

- `portable-peripheral-agent-core`: Core portable, adapters por plataforma,
  identidad de dispositivo y compatibilidad de la XP-80 durante transición.
- `peripheral-agent-platform-support`: Matriz de soporte, lifecycle,
  empaquetado y certificación futura por SO/arquitectura.

### Modified Capabilities

- None.

## Impact

- Afecta `backend-perifericos/src/shared/adapters`, discovery USB, contratos de
  dispositivo, configuración y pruebas del Agent.
- No cambia APIs Browser/Electron, terminales POS, ventas, caja, DB ni V071.
- No agrega dependencias nativas ni elige estrategia final de empaquetado.
