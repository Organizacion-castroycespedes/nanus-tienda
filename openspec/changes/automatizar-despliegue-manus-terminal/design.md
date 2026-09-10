## Context

`backend-perifericos` es el PeripheralAgent local. La app actual es un servicio
NestJS con estos bloques reales:

- `src/main.ts` arranca HTTP, CORS, logs y shutdown limpio.
- `src/app.module.ts` registra `health`, `devices`, `printer`, `cash-drawer`,
  `scale`, `scanner`, `logs` y `events`.
- `src/shared/config/peripherals.config.ts` resuelve `PERIPHERALS_*` y la
  allow-list de CORS.
- `src/platform/agent-local-config.ts` carga `PERIPHERALS_CONFIG_PATH` desde un
  JSON local sin secretos.
- `src/platform/platform-paths.ts` separa `configDir`, `stateDir` y `logDir`
  por plataforma.
- `src/platform/device-registry-state.store.ts` persiste el registry local de
  dispositivos.
- `src/modules/health/health.controller.ts` expone el health local.
- `src/modules/devices/devices.service.ts` maneja mock, discovery y estado
  persistido.
- `src/platform/windows/*` y `src/platform/unix/*` cubren discovery real de
  impresoras por plataforma.

El estado actual de despliegue es mixto:

- Desarrollo: `npm run start:dev`.
- Produccion local: `npm run build` y `npm run start`.
- Windows x64: existe un paquete portable reproducible con Node embebido,
  `start-agent.cmd` y scripts de autostart por Scheduled Task.
- Linux x64: existe soporte de runtime y discovery, pero no un instalador ni un
  servicio del sistema operativo.

Discovery manual reconstruido desde el codigo:

1. `npm install`.
2. `npm run build`.
3. Windows opcional: `npm run package:windows-x64`.
4. Windows opcional: `npm run validate:package:windows-x64`.
5. Copiar artefactos al equipo destino.
6. Crear o editar `config/agent.config.local.json` o `PERIPHERALS_CONFIG_PATH`.
7. Arrancar con `start-agent.cmd` o `npm run start`.
8. En Windows, instalar autostart con los scripts del paquete portable.
9. Verificar `GET /health` y luego `POST /devices/discover`.

## Goals / Non-Goals

**Goals:**

- Instalar PeripheralAgent en Windows x64 y Linux x64 con minima intervencion
  manual.
- Registrar arranque automatico como servicio del SO, no como proceso suelto.
- Mantener configuracion, estado y logs en ubicaciones seguras y estables.
- Hacer el flujo idempotente.
- Entregar health check y salida clara `SUCCESS / FAILED`.
- Dejar el layout listo para un futuro `Manus Updater`.

**Non-Goals:**

- No implementar auto-update remoto.
- No implementar rollout progresivo.
- No implementar panel de administracion de versiones.
- No implementar Electron updater.
- No descargar releases desde produccion.
- No cambiar el comportamiento funcional de impresora, balanza, scanner o caja.
- No cambiar reglas de negocio POS.
- No modificar APIs existentes salvo lo minimo para instalacion y health si
  luego hace falta.

## Decisions

### 1. Usar bundle autocontenido + bootstrapper por plataforma

Decision: el despliegue debe partir de un bundle autocontenido del Agent y un
bootstrapper/instalador por SO.

Rationale: el repo ya tiene `pkg` y ya produce un artefacto portable Windows.
La estacion POS no debe depender de Node, npm ni Git globales. Un bundle
autocontenido reduce drift y simplifica QA.

Alternatives considered:

- `npm install` en la terminal. Rechazado porque deja dependencias globales y
  no es reproducible.
- Instalar desde un package manager del SO desde el inicio. Rechazado por
  complejidad de distribucion y porque todavia no se definio canal estable.

### 2. Layout inmutable por version + puntero estable

Decision: instalar en una raiz estable con carpetas por version y un puntero
activo estable.

Propuesta de layout:

- Windows:
  - `C:\\Program Files\\Manus\\PeripheralAgent\\versions\\<version>`
  - `C:\\Program Files\\Manus\\PeripheralAgent\\current`
  - `C:\\ProgramData\\Manus\\PeripheralAgent\\config`
  - `C:\\ProgramData\\Manus\\PeripheralAgent\\state`
  - `C:\\ProgramData\\Manus\\PeripheralAgent\\logs`
- Linux:
  - `/opt/manus/peripheral-agent/versions/<version>`
  - `/opt/manus/peripheral-agent/current`
  - `/etc/manus/peripheral-agent`
  - `/var/lib/manus/peripheral-agent`
  - `/var/log/manus/peripheral-agent`

Rationale: un layout inmutable permite upgrade atomicos, rollback y futura
actualizacion sin sobrescribir la instalacion activa. En Windows, `current`
funciona como un junction estable que apunta a la version activa.

Alternatives considered:

- Sobrescribir en sitio. Rechazado por riesgo de instalaciones parciales y por
  bloquear rollback.
- Instalar solo en perfil de usuario. Rechazado para el target de servicio del
  SO y por permisos inconsistentes.

### 3. Servicio nativo del SO

Decision: Windows debe registrar un servicio nativo con inicio automatico y
Linux debe registrar una unidad `systemd`.

Rationale: el objetivo final es un artefacto instalable, no un proceso manual.
El servicio del SO da arranque automatico, reinicio tras fallo, status
consistente y soporte operativo real.

Windows target:

- Service name conceptual: `ManusPeripheralAgent`.
- Display name: `Manus Peripheral Agent`.
- Startup: automatic.
- Account target: `NT AUTHORITY\LocalService` for the MVP.
- Host technology: custom Go service host using `golang.org/x/sys/windows/svc`
  and `golang.org/x/sys/windows/svc/mgr`.
- Installer technology: custom Go bootstrapper that installs the versioned
  payload, writes uninstall metadata, starts the service, and runs the health
  gate.

Linux target:

- Unit name conceptual: `manus-peripheral-agent.service`.
- Startup: `systemctl enable --now`.
- Account target: usuario de sistema dedicado con permisos acotados.

Alternatives considered:

- Scheduled Task en Windows como solucion final. Rechazado; eso queda solo
  como puente de la etapa portable actual.
- `nohup`, `cron` o rc.local en Linux. Rechazado; `systemd` da mejor control de
  restart, logs y estado.
- WinSW / NSSM. Vidas como wrappers validos, pero se prefirio un host Go propio
  para evitar otra dependencia externa y mantener el flujo reproducible con el
  toolchain ya presente en el repo.

### 4. Configuracion local con override de entorno

Decision: el instalador debe materializar una configuracion local no secreta y
el runtime debe seguir respetando overrides por entorno.

Rationale: el codigo ya soporta `PERIPHERALS_CONFIG_PATH` y `PERIPHERALS_*`.
Eso permite instalar sin secretos y aun asi ajustar puertos, origenes y flags
locales.

Reglas:

- La configuracion local no debe contener secretos.
- Los valores de entorno siempre deben ganar a los del archivo local.
- La configuracion sensible futura no debe imprimirse en logs.

Alternatives considered:

- Solo variables de entorno. Rechazado por fragilidad operativa y por la
  dificultad de reparar una terminal sin editar el servicio.
- Config central remota desde el inicio. Rechazado porque este change no
  incluye backend de versionado ni rollout.

### 5. Health-gated success

Decision: el instalador solo puede devolver `SUCCESS` cuando el servicio
arranca y `GET /health` responde `200`.

Rationale: copiar archivos y registrar un servicio no basta. El cambio debe
probar que el proceso realmente quedo operativo.

La verificacion minima de health debe confirmar:

- `status = ok`
- `agentInstallationId`
- `platform`
- `architecture`
- `version`
- `persistenceState`

Alternatives considered:

- Considerar exitoso el simple registro del servicio. Rechazado porque no
  prueba que el agente responda.
- Usar `POST /devices/discover` como gate principal. Rechazado porque puede
  depender de hardware o del entorno de discovery.

### 6. Idempotencia y recuperacion

Decision: el instalador debe detectar instalacion existente, mismo version,
upgrade y estado incompleto.

Rationale: una segunda ejecucion no debe duplicar servicios ni corromper
archivos.

Comportamiento esperado:

- Instalacion nueva: copia bundle, escribe config, registra servicio, inicia y
  valida health.
- Reinstalacion misma version: no duplica servicio; reusa configuracion; puede
  reparar archivos faltantes.
- Upgrade sobre version anterior: stage -> swap -> restart -> health -> mark
  active.
- Instalacion incompleta o fallida: limpiar stage, dejar la version previa
  activa si existia y reportar la causa.

Alternatives considered:

- "Best effort" sin estado de instalacion. Rechazado porque no permite repair ni
  rollback confiables.

### 7. Future updater ready, but offline today

Decision: el layout debe reservar manifiestos, checksums y metadatos de version,
pero el instalador no debe descargar nada desde red.

Rationale: el futuro `Manus Updater` necesita una base estable. Este change no
debe acoplarse aun a un backend de versiones o a rollout centralizado.

Alternatives considered:

- Hacer auto-update ahora. Rechazado por alcance.
- No dejar metadatos de version. Rechazado porque luego obliga a rehacer el
  layout.

## Risks / Trade-offs

- [Windows service account cannot read printers or write state] -> Mitigation:
  usar cuenta de minimo privilegio con ACL explicitas sobre ProgramData y
  permisos solo de lectura sobre el bundle.
- [Linux distro variance] -> Mitigation: exigir `systemd`, validar `x86_64`,
  detectar `os-release` y fallar rapido en entornos no soportados.
- [Partial upgrade leaves mixed files] -> Mitigation: stage temporal, swap
  atomico y rollback al version previa.
- [Health passes before peripherals are ready] -> Mitigation: usar `/health`
  como gate de instalacion y dejar descubrimiento hardware para QA/operacion.
- [Future updater trust chain still undefined] -> Mitigation: reservar
  manifest, checksum y firma desde ahora, sin activar descarga remota.
- [Windows service vs current portable task model] -> Mitigation: tratar el
  Scheduled Task actual como puente, no como contrato final.

## Migration Plan

1. Definir el layout estable y el manifiesto de instalacion.
2. Crear el empaquetado reproducible para Windows x64 y Linux x64.
3. Implementar el bootstrapper de Windows con registro de servicio.
4. Implementar el instalador Linux con unidad `systemd`.
5. Agregar health gate, status y rollback.
6. Agregar tests para idempotencia, upgrade y fallo parcial.
7. Ejecutar QA tecnico Windows/Linux y consolidar evidencia.

Rollback:

- Detener el servicio.
- Revertir el puntero `current` a la version anterior.
- Restaurar la configuracion respaldada si el upgrade fallo.
- Conservar el bundle previo hasta que el nuevo pase health.

## Open Questions

- La cuenta del servicio Windows debe ser `LocalService`, otra cuenta dedicada
  o un wrapper propio.
- Linux debe quedarse en `tar.gz + install.sh` o evolucionar mas adelante a
  `deb`/`rpm`.
- El archivo de manifiesto de version debe vivir junto al bundle o en la raiz
  estable.
- Que politica final de firma y checksum se usara cuando llegue el canal de
  distribucion real.
