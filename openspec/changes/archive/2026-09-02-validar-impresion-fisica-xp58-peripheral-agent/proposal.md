## Why

La XP-58 ya imprime una pagina de prueba fisica mediante Windows y su cola
`Local / USB001` cumple el filtro actual, pero la estacion QA sigue ejecutando
PeripheralAgent `0.1.0` con runtime MOCK antiguo. Necesitamos un despliegue QA
versionado y verificable para validar el flujo completo desde Manus Web hasta
papel real sin mezclarlo con el repair same-version pausado.

## What Changes

- Publicar un runtime Windows x64 self-contained con version QA superior a
  `0.1.0`, modo REAL, discovery USB, CORS/PNA y version visible en `/health`.
- Desplegarlo como upgrade controlado, preservando configuracion local e
  identidad `agentInstallationId`; no reparar reinstalaciones same-version.
- Detectar la cola XP-58 `Local / USB001` sin ampliar discovery a
  LPT/WSD/IP/COM.
- Permitir asociar la XP-58 con `THERMAL_58MM` a una terminal y ejecutar test
  print directo y desde Manus Web.
- Documentar evidencia separada para Windows, Agent, Web y POS. `bytesSent` no
  constituye evidencia de impresion fisica.
- Mantener fuera de alcance Linux, Electron, updater remoto, rollout, corte
  automatico y cambios de reglas de venta.

## Capabilities

### New Capabilities

- `peripheral-physical-printing`: Descubrimiento, configuracion, despliegue QA
  y validacion fisica de impresoras termicas Windows mediante PeripheralAgent.

### Modified Capabilities

Ninguna.

## Impact

- `backend-perifericos`: version, runtime Windows, discovery, configuracion,
  health, CORS/PNA, perfiles y packaging.
- `web/domains/peripherals`: conexion loopback, seleccion, asociacion y test
  print desde produccion web.
- Windows QA: servicio `ManusPeripheralAgent`, spooler, cola XP-58 y archivos
  persistentes bajo `C:\ProgramData\Manus\PeripheralAgent`.
- Documentacion QA y artefactos OpenSpec. No hay migraciones ni cambios de API
  de ventas.
