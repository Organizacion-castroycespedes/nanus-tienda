# Evidencia QA - Despliegue Manus Terminal

## Estado

`DISCOVERY / DESIGN / PACKAGING`

## Objetivo

Dejar lista la base de empaquetado reproducible de `PeripheralAgent` para
Windows x64 y Linux x64. Aun no se implementa instalacion nativa de servicio.

## Rama

- `feat/develop/despliegue-manus-terminal`

## HEAD

- `39fe25bab70361fcea82250cb9459a6fcbb4fae9`

## Git status before

```text
?? openspec/changes/automatizar-despliegue-manus-terminal/
```

## Git status actual

```text
M backend-perifericos/package.json
M backend-perifericos/scripts/package-windows-x64.mjs
M backend-perifericos/scripts/validate-windows-x64-package.mjs
M backend-perifericos/src/shared/config/peripherals.config.ts
M backend-perifericos/test/health.spec.ts
M backend-perifericos/test/mock-simulator.spec.ts
M backend-perifericos/test/windows-autostart.spec.ts
?? backend-perifericos/dist-terminal/
?? backend-perifericos/scripts/package-linux-x64.mjs
?? backend-perifericos/scripts/validate-linux-x64-package.mjs
?? backend-perifericos/src/shared/runtime/
?? backend-perifericos/test/linux-package.spec.ts
?? backend-perifericos/test/runtime-version.spec.ts
?? docs/evidencia-qa-despliegue-manus-terminal.md
?? openspec/changes/automatizar-despliegue-manus-terminal/
```

## Discovery resumido

### Arquitectura actual encontrada

- `backend-perifericos` es un NestJS local con `health`, `devices`,
  `printer`, `cash-drawer`, `scale`, `scanner`, `logs` y `events`.
- `GET /health` expone version, plataforma, arquitectura, uptime y estado de
  persistencia.
- La configuracion usa `PERIPHERALS_*` y JSON local opcional via
  `PERIPHERALS_CONFIG_PATH`.
- `platform-paths.ts` ya separa `configDir`, `stateDir` y `logDir` por
  plataforma.
- Windows ya tenia bundle portable y autostart por Scheduled Task.
- Linux tenia runtime y discovery CUPS, pero no instalador ni `systemd`.

### Flujo manual actual reconstruido

1. Instalar dependencias con `npm install`.
2. Compilar con `npm run build`.
3. Arrancar en dev con `npm run start:dev` o en prod con `npm run start`.
4. En Windows, generar bundle con `npm run package:windows-x64`.
5. En Windows, validar bundle con `npm run validate:package:windows-x64`.
6. Copiar artefacto al equipo destino.
7. Ajustar `config/agent.config.local.json` o `PERIPHERALS_CONFIG_PATH`.
8. Arrancar agente.
9. Verificar `GET /health` y luego `POST /devices/discover`.

### Runtime y dependencias

- Node >= 18.
- NestJS `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`.
- `dotenv`, `reflect-metadata`, `rxjs`.
- Dev tools: `pkg`, `tsx`, `typescript`.
- No se detectaron dependencias nativas de hardware en el runtime base.

### Puertos y endpoints

- Puerto por defecto: `4050`.
- Bind por defecto: `127.0.0.1`.
- `GET /health`
- `GET /devices`
- `POST /devices/discover`
- `POST /devices`
- `PATCH /devices/:id`
- `POST /printer/test-print`
- `POST /printer/print-ticket`
- `POST /cash-drawer/open`
- `GET /scale/current-weight`
- `POST /scanner/simulate`
- `GET /logs`
- WebSocket: `/peripherals`

### Diferencias Windows/Linux

- Windows ya tiene paquete portable y autostart por Scheduled Task.
- Linux tiene soporte de runtime y discovery CUPS, pero no installer ni
  `systemd`.
- Windows usa `Program Files` / `ProgramData` como objetivo natural.
- Linux usa `/opt`, `/etc`, `/var/lib` y `/var/log`.

### Alternativas de empaquetado evaluadas

- Bundle autocontenido + bootstrapper por SO.
- MSI/NSIS o instalador Windows mas pesado.
- `deb` / `rpm` para Linux.
- `tar.gz` + install script para Linux.
- `npm install` en la estacion destino.

### Recomendacion tecnica

- Usar bundle autocontenido como base.
- Mantener un layout versionado e inmutable.
- Windows: bootstrapper o instalador que registre `ManusPeripheralAgent` como
  servicio nativo.
- Linux: `tar.gz` + install script + `systemd`.
- No activar auto-update remoto todavia.
- Reservar manifiesto, checksums y metadatos para el futuro `Manus Updater`.

## Packaging resumido

### Windows x64

- Bundle generado en
  `backend-perifericos/dist-terminal/windows-x64/ManusPeripheralAgent-win-x64-0.1.0`.
- `start-agent.cmd` usa `PERIPHERALS_CONFIG_PATH` externo si ya existe.
- `start-agent.cmd` y `start-agent-autostart.ps1` fijan `PERIPHERALS_VERSION`
  por defecto sin depender de Node global.
- Validacion del paquete: `PASS`.
- Smoke runtime: `PASS` para arranque local y `GET /health`.

### Linux x64

- Bundle generado en
  `backend-perifericos/dist-terminal/linux-x64/ManusPeripheralAgent-linux-x64-0.1.0`.
- Se genero `tar.gz` para conservar permisos de ejecucion.
- `start-agent.sh` usa `PERIPHERALS_CONFIG_PATH` externo si ya existe.
- Validacion del paquete: `PASS`.
- Smoke runtime: `NOT EXECUTED` en este host Windows.

## Archivos OpenSpec creados

- `openspec/changes/automatizar-despliegue-manus-terminal/.openspec.yaml`
- `openspec/changes/automatizar-despliegue-manus-terminal/proposal.md`
- `openspec/changes/automatizar-despliegue-manus-terminal/design.md`
- `openspec/changes/automatizar-despliegue-manus-terminal/tasks.md`
- `openspec/changes/automatizar-despliegue-manus-terminal/risks.md`
- `openspec/changes/automatizar-despliegue-manus-terminal/specs/manus-terminal-deployment/spec.md`

## QA FISICO WINDOWS - PENDING

Estado: `PENDING`

### Equipo Windows #1 - instalacion limpia

- Copiar instalador.
- Ejecutar instalador.
- Verificar Installed Apps.
- Verificar servicio.
- Verificar auto-start.
- Verificar `GET /health`.
- Verificar `POST /devices/discover`.
- Reiniciar equipo.
- Verificar health despues del reboot.

### Equipo Windows #2 - reinstalacion / repair

- Instalar version actual.
- Guardar o configurar datos locales permitidos.
- Ejecutar el mismo instalador otra vez.
- Verificar que no aparezcan servicios duplicados.
- Verificar que la configuracion se preserve.
- Verificar que el servicio siga operativo.

### Equipo Windows #3 - upgrade / recovery

- Instalar una version anterior.
- Instalar una version nueva.
- Verificar switch controlado.
- Verificar `GET /health`.
- Validar recuperacion si se autoriza un fallo controlado.

### Resultado esperado

- `BUILD PASS`
- `INSTALLER STRUCTURE PASS`
- `STATIC VALIDATION PASS`
- `LOCAL INSTALL PASS / NOT EXECUTED`
- `WINDOWS SERVICE PASS / NOT EXECUTED`
- `HEALTH PASS / NOT EXECUTED`

### Remanente previo identificado

- Antes de la instalacion limpia se encontro solo
  `C:\\ProgramData\\Manus\\PeripheralAgent\\state\\agent-installation-id`.
- El contenido fue un identificador de instalacion local.
- No se encontraron config, logs ni secretos dentro de ese remanente.
- Se trato como residuo previo de QA y quedo autorizado para limpieza
  puntual.

## Validacion

- OpenSpec strict discovery/design: `PASS`
- OpenSpec strict packaging: `PASS`
- OpenSpec strict installer phase: `PENDING` until final phase strict is run after validation.
- `git diff --check`: `PASS`

## QA FISICO WINDOWS #1

### Identificacion

- Installer version: `0.1.0`
- Installer SHA-256: `618CAB3DACBDC4EF26EEA37B56B1CFB31F84947387F244A1EE955731DB69889D`
- Installer path:
  `D:\Profe\manus-tienda\backend-perifericos\dist-installer\windows-x64\ManusTerminalSetup-0.1.0-win-x64.exe`

### Estado del equipo

- Windows edition: `Windows 10 Pro`
- Windows version: `2009`
- Architecture: `64 bits`
- Node present: `YES`
- npm present: `YES`
- Git present: `YES`

### Clean state

- Service `ManusPeripheralAgent`: no existia antes de la instalacion.
- `C:\Program Files\Manus\PeripheralAgent\`: no existia antes de la instalacion.
- `C:\ProgramData\Manus\PeripheralAgent\config`: no existia antes de la instalacion.
- `C:\ProgramData\Manus\PeripheralAgent\logs`: no existia antes de la instalacion.
- `C:\ProgramData\Manus\PeripheralAgent\state`: se elimino manualmente con autorizacion previa porque era remanente de QA.
- Puerto `4050`: libre antes de la instalacion.

### Resultados

- Install result: `FAIL`
- UAC result: `Prompted via elevated launch path`
- SmartScreen result: `Unsigned QA binary; no bypass documentado`
- Filesystem layout: created under `C:\Program Files\Manus\PeripheralAgent\` and `C:\ProgramData\Manus\PeripheralAgent\`
- Config location: `C:\ProgramData\Manus\PeripheralAgent\config\agent.config.local.json`
- Service exists: `YES`
- Service status: `Stopped`
- Service startup type: `Automatic`
- Service account: `NT AUTHORITY\LocalService`
- Service command: `"C:\Program Files\Manus\PeripheralAgent\versions\0.1.0\ManusTerminalSetup.exe" service`
- Health before reboot: `FAIL`
- Device discovery before reboot: `NOT REACHED`
- Local Service printer access: `NOT TESTABLE`
- Log validation: `installer.log` existed; `service.log`, `service.stdout.log`, `service.stderr.log` remained empty
- Installed Apps registration: `YES`
- Reboot executed: `NO`
- Service autostart after reboot: `NOT TESTED`
- Health after reboot: `NOT TESTED`
- Device discovery after reboot: `NOT TESTED`
- Global Node required: `NO`
- Global npm required: `NO`
- Git required: `NO`

### Defects found

- Windows service installed but did not stay running.
- Health gate failed.
- Service remained `Stopped` after install.
- Event log showed service install events and a timeout error for service connection.
- Manual service start from the current non-elevated shell was not possible.

### Root cause analysis

- The installed runtime bundle was missing
  `node_modules/readable-stream/lib/_stream_readable.js`.
- That file is required when `@nestjs/platform-express` loads `multer`
  transitively.
- The Windows service host then surfaced a generic Nest bootstrap failure:
  `No driver (HTTP) has been selected`.
- The evidence points to the installer embed step, not to `LocalService`
  privileges or the SCM dispatcher itself.

### Classification

- `WINDOWS PHYSICAL QA #1: FAIL`

### Follow-up fix

- Change `//go:embed assets/**` to `//go:embed all:assets/**` in
  `backend-perifericos/windows-installer/main_windows.go`.
- Add a regression test that checks the embedded bundle contains
  `_stream_readable.js`.
- Rebuild the installer before any new physical Windows QA.
- New root cause after service retest planning:
  the Windows service `ImagePath` was registered with escaped executable
  quotes, producing `\"C:\Program Files\Manus\PeripheralAgent\versions\0.1.0\ManusTerminalSetup.exe\" service`
  in SCM instead of `"C:\Program Files\Manus\PeripheralAgent\versions\0.1.0\ManusTerminalSetup.exe" service`.
- Fix applied:
  `backend-perifericos/windows-installer/main_windows.go` now quotes only the
  executable path for SCM and leaves the service arguments unescaped.
- Regression test added:
  `TestBuildServiceBinaryPathDoesNotEscapeExecutableQuotes`.

## QA FISICO WINDOWS #1 RETEST

### Estado actual

- Nuevo candidato validado:
  `240D3A95354C4B76C85A421F1C83E234CEE831E3D813B0E8834801A05B854DA1`
- El retest no pudo arrancar porque la limpieza previa del candidato fallido
  requiere privilegios de administrador en el equipo Windows y el intento de
  `uninstall --remove-data` devolvio `administrator privileges required`.
- No se ejecuto instalacion nueva todavia.
- No se sobreescribio el resultado `FAIL` anterior.

### Cleanup pendiente

- `ManusPeripheralAgent` service: sigue presente y detenido.
- `C:\Program Files\Manus\PeripheralAgent\`: sigue presente.
- `C:\ProgramData\Manus\PeripheralAgent\config`: sigue presente.
- `C:\ProgramData\Manus\PeripheralAgent\logs`: sigue presente.
- `C:\ProgramData\Manus\PeripheralAgent\state`: sigue presente.

### Result

- `QA FISICO WINDOWS #1 RETEST: BLOCKED`

### Rebuilt installer

- Version: `0.1.0`
- SHA-256: `97075FBFF84D58A9F9236D04957662640BA1D14B1A6A8D759DC0D8C3BF84BC2D`
- Package validation: `PASS`
- Installer validation: `PASS`
- OpenSpec strict: `PASS`
- git diff --check: `PASS`

## Diagnostico actual

- Se demostro que el bug no era solo de quoting local.
- La raiz real estaba en `mgr.CreateService`: el wrapper de `x/sys/windows/svc/mgr`
  ya aplica `syscall.EscapeArg` al parametro `exepath` y a `args...`.
- El codigo anterior le pasaba una command line ya compuesta como si fuera el
  ejecutable.
- Eso producia el `ImagePath` doblemente escapado que Windows guardaba en SCM.
- La correccion aplicada ahora pasa `layout.ServiceExe` como `exepath` y
  `serviceArgs...` por separado.

### Nuevo candidate reconstruido

- Installer SHA-256: `123BF4A5B714EDC0103F6A3BAD4C65B4522CE218CF8FDCC485021DA202015D2B`
- Este artefacto fue reconstruido despues de corregir el uso de
  `mgr.CreateService`.
- Aun no fue validado en un clean install fisico.

## Producto productivo modificado

- `YES`

## Commit creado

- `NO`

## Siguiente fase recomendada

- Fase 4: instalador y servicio Windows.
