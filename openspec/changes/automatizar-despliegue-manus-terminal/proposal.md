## Why

`backend-perifericos` ya funciona como PeripheralAgent local, pero hoy la
instalacion sigue dependiendo de copiar carpetas, editar config y arrancar
scripts a mano. Sin un instalador reproducible, cada terminal termina distinta,
la reinstalacion es fragil y no hay una base solida para servicio, health e
idempotencia en Windows y Linux.

## What Changes

- Definir un mecanismo de despliegue instalable para Windows x64 y Linux x64.
- Separar artefacto inmutable, configuracion local, estado, logs y servicio del
  sistema operativo.
- Registrar `PeripheralAgent` como servicio de Windows y
  `manus-peripheral-agent.service` en Linux.
- Automatizar arranque, health check y resultado final `SUCCESS / FAILED`.
- Definir comportamiento idempotente para instalacion nueva, reinstalacion de
  la misma version, upgrade y recuperacion tras fallo.
- Dejar listo el layout para un futuro `Manus Updater`, pero sin auto-update
  remoto ni rollout en este change.
- Documentar seguridad, observabilidad, QA y evidencia del cambio.

## Capabilities

### New Capabilities
- `manus-terminal-deployment`: instalacion reproducible, servicio del SO,
  config local, health, idempotencia, seguridad y base para futuras
  actualizaciones del PeripheralAgent.

### Modified Capabilities
- Ninguna.

## Impact

- `backend-perifericos/` para packaging, scripts, config y servicio.
- `docs/` para runbook y evidencia QA.
- `openspec/changes/automatizar-despliegue-manus-terminal/` para proposal,
  design, spec, tasks y riesgos.
- No cambia logica funcional de perifericos, POS, ventas, caja ni APIs
  existentes salvo lo minimo necesario para health o instalacion futura.
