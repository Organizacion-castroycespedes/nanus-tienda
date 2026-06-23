## Why

Manus POS v0.0.1 ya tiene base operativa documentada y ahora necesita una decision clara de uso/despliegue por tipo de cliente antes de abrir una fase Electron. Esta fase evita mezclar arquitectura con implementacion: define Web, Electron online y combinacion Web + Electron sin tocar runtime.

## What Changes

- Documentar la clasificacion oficial de clientes solo como Tipo A Web 100%, Tipo B Electron 100% y Tipo D Web + Electron.
- Documentar el modelo conceptual de despliegue para Web cloud, Electron desktop online y operacion combinada.
- Documentar soporte conceptual Electron por sistema operativo con prioridad Windows, luego Linux, luego macOS.
- Documentar limites de esta fase: sin Electron instalado, sin Capacitor, sin PWA, sin service worker, sin offline, sin sync engine, sin cambios backend/frontend/SQL/permisos/API.
- Documentar consideraciones futuras de offline solo como investigacion posterior.
- Crear documentos de arquitectura en `docs/architecture/` y artefactos OpenSpec para guiar fases posteriores.

## Capabilities

### New Capabilities

- `clientes-web-electron`: Define la arquitectura documental para clasificar clientes Manus POS en Tipo A, Tipo B y Tipo D, con despliegue Web/Electron online, soporte conceptual por sistema operativo y limites de offline futuro.

### Modified Capabilities

- None.

## Impact

- Afecta solo documentacion y OpenSpec: `docs/architecture/*` y `openspec/changes/definir-clientes-web-electron/*`.
- No afecta codigo fuente, SQL, frontend, backend, contratos API, rutas, permisos, dependencias ni logica de negocio.
- No instala Electron, Capacitor, PWA, service worker, sync engine ni almacenamiento local nuevo.
