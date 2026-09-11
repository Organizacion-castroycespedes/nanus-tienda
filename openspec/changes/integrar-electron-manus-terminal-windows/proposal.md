## Why

ManusTerminalSetup ya cuenta con un ciclo de instalación Windows certificado, pero Manus POS Electron todavía no está integrado en ese flujo. Esta planificación define cómo entregar una instalación única que incluya Agent y POS, preserve las garantías de la fase 7.1 y permita abrir el frontend Manus de forma controlada.

## What Changes

- Descubrir y documentar la arquitectura Electron existente, sus entradas, configuración, seguridad y empaquetado Windows.
- Definir una estrategia productiva de carga del frontend, separando desarrollo local de ejecución instalada.
- Diseñar el contrato de integración entre Installer Core, paquete Electron, accesos directos y primer lanzamiento.
- Definir versionado, staging, activación, reparación, rollback, desinstalación estándar y `--remove-data` para Agent y POS.
- Diseñar los límites futuros de comunicación entre Electron y Peripheral Agent local, sin implementar discovery ni acciones de periféricos en este change.
- Mantener los modos QA y el change `crear-instalador-visual-manus-terminal-windows` como baseline certificado; no modificar su código en la fase de planificación.

## Capabilities

### New Capabilities

- `manus-pos-electron-shell`: Ejecutar Manus POS como shell Electron Windows con carga frontend productiva y configuración segura.
- `electron-windows-packaging`: Definir artefactos, versionado y empaquetado Electron para máquinas sin Node/npm.
- `installer-electron-integration`: Integrar Agent y POS en el ciclo Installer Core, incluyendo shortcuts, repair y uninstall.

### Modified Capabilities

<!-- No se modifican requisitos de capacidades existentes; la integración se diseña contra el baseline certificado de fase 7.1. -->

## Impact

- `desktop/electron/`: `main.ts`, `preload.ts`, `config.ts`, `package.json` y configuración de build serán la fuente de discovery.
- `backend-perifericos/windows-installer/`: únicamente seams de integración futuros; no se modifica código durante esta planificación.
- Windows: instalación versionada, servicio del Agent, accesos directos, rutas de recursos y desinstalación.
- Frontend Manus y backend remoto: disponibilidad HTTPS, autenticación, contexto tenant/sucursal/terminal y comunicación futura con loopback `127.0.0.1:4050`.
- Dependencias: Electron y electron-builder existentes; no se añade runtime Node externo como prerrequisito del usuario.
