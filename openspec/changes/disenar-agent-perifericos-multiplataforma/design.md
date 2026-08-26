## Context

La XP-80 USB RAW está certificada en Windows x64. El Agent tiene renderer
ESC/POS común y TCP RAW portable, pero `UsbSystemPrinterAdapter` combina
descubrimiento, CUPS, PowerShell y Winspool. El `deviceId` actual deriva del
nombre de cola y solo es compatible como identidad de transición.

## Goals / Non-Goals

**Goals:**

- Separar core portable de adapter Windows sin cambiar bytes certificados,
  `deviceId` legado, perfil `THERMAL_80MM`, TERM-001 ni corte XP-80.
- Definir puertos de impresión/discovery, paths locales e identidad portable.
- Dejar fronteras listas para Linux, macOS, serial, BBG Market 30 y cajón.

**Non-Goals:**

- No implementar CUPS RAW, Linux/macOS, Windows ARM64, serial, scanner,
  balanza, BBG Market 30, cajón, MSI, tray ni lifecycle instalable.
- No cambiar Browser/Electron, APIs públicas, V071, ventas, caja o terminales.
- No certificar hardware fuera de Windows x64.

## Decisions

### Core portable con puertos explícitos

El core conserva HTTP/WS, jobs, errores, logs, perfiles,
`ThermalEscPosRenderer` y `TcpRawPrinterTransport`. Depende de:

```text
PrinterTransport
DeviceDiscoveryProvider
PlatformPaths
```

Los adapters Windows viven en `platform/windows`; solo ellos importan
PowerShell/Winspool o preguntan `process.platform`.

### Transporte de impresora

`ThermalEscPosRenderer` produce bytes una vez. TCP RAW usa socket sin conocer
SO. `WindowsRawSpoolerTransport` recibe bytes y cola descubierta, usa RAW
spooler y conserva BODY -> FOOTER -> FEED -> CUT.

El futuro `CupsRawPrinterTransport` recibe `Buffer` ESC/POS. No reutiliza el
fallback actual que imprime preview de texto. CUPS/driver/cola requiere QA por
SO, arquitectura y modelo.

### Discovery e identidad

`WindowsPrinterDiscoveryProvider` obtiene cola y metadatos Windows. Descriptor:

```text
agentInstallationId
deviceId
nativeIdentifier
fingerprint
platform
architecture
```

`deviceId` existente se conserva cuando solo existe nombre de cola. El futuro
Agent persiste `agentInstallationId`; un fingerprint fuerte usa serial USB,
URI u otro dato disponible. Cambiar workstation, SO, driver, cola o puerto
nunca reasigna hardware silenciosamente.

### Paths locales

`PlatformPaths` centraliza config/state/logs. Core no contiene rutas Windows.
Windows usa ProgramData/LocalAppData; Linux /etc, /var/lib, /var/log; macOS
Library/Application Support y Library/Logs.

### Registro local de dispositivos

El Agent persiste solo la configuracion local de dispositivos en
`stateDir`, con un store JSON versionado y escritura atomica. El archivo no
guarda secretos ni estados de conexion duraderos.

Decision: separar `configuration state` de `runtime connectivity state`. El
registro persistido conserva identidad, tipo, conexion, terminal, perfil y
parametros de red o USB. El runtime calcula si el dispositivo esta
`CONNECTED`, `DISCONNECTED` o `NOT_REACHABLE` en cada arranque y discovery.

Rationale: un dispositivo configurado no puede desaparecer por reinicio de
Agent, Windows o workstation. El estado fisico cambia, la configuracion no.

Decision: discovery USB solo actualiza el overlay runtime. Si un USB
configurado vuelve a aparecer, se reconcilia contra el registro local y no se
crea un duplicado logico.

Decision: archivo faltante = registro vacio valido. JSON corrupto = error
controlado y arranque continuo con defaults seguros.

### Packaging P0 Windows x64

P0 entrega una carpeta portable reproducible para Windows x64. Contiene el
Agent TypeScript compilado, un `node.exe` embebido, solo dependencias de
runtime, `start-agent.cmd`, configuración JSON local sin secretos y metadata
de versión. La estación POS no requiere Node, npm ni Git global.

El launcher configura `PERIPHERALS_CONFIG_PATH`, mantiene bind por defecto en
`127.0.0.1`, y crea logs/state en `%LOCALAPPDATA%\\Manus\\PeripheralAgent`.
La configuración admite exclusivamente puerto, bind, allow-list de origins,
nivel de logs y feature flags de transporte. Variables de entorno del wrapper
siempre prevalecen sobre el archivo local. No existe CORS global.
En PowerShell 5.1, el autostart fija `PERIPHERALS_CONFIG_PATH` en el ambiente
del launcher antes de iniciar `runtime\\node.exe`, para que el hijo herede esa
variable sin depender de `-Environment` ni `-UseNewEnvironment`.
El entrypoint se pasa entrecomillado para que rutas como
`C:\\Program Files\\Manus\\PeripheralAgent\\app\\main.js` no rompan el launch.

El perfil QA de artefacto autoriza solo origins explícitos en la config local
generada, por ejemplo `http://localhost:3000` para compatibilidad local y el
origin remoto de QA `http://192.168.1.9:3000`. Esos origins viven en la
config local generada o en `PERIPHERALS_ALLOWED_ORIGINS`, nunca en el core
portable. No existe wildcard CORS.

No se adopta MSI/setup.exe ni servicio Windows en este P0. El autostart
portable de Windows usa Scheduled Task por usuario, porque conserva el
workspace portable, no requiere credenciales embebidas y mantiene logs/state
en `%LOCALAPPDATA%`. La tarea arranca el helper desde la carpeta instalada,
aplica un delay corto y no crea un segundo Agent si ya hay uno vivo en 4050.

### Certificación física P0 Windows x64

La certificación física P0 se ejecutó con Manus Web/API/Reports en
`192.168.1.14` y Browser, Agent portable local y XP-80 USB en
`192.168.1.18`. El Browser llamó exclusivamente
`http://127.0.0.1:4050/printer/print-ticket`; no usó
`192.168.1.14:4050` ni el diálogo de impresión del navegador.

El trabajo resolvió `TERM-001` por su perfil periférico canónico, conservó el
`deviceId` configurado `usb-printer-1f0028d1fa5243c2`, utilizó
`UsbRawPrinterAdapter`, reportó `bytesSent=1245` y
`supportsPhysicalCut=true`. Ticket, layout `THERMAL_80MM`, feed y corte físico
pasaron. `local-terminal` solo permaneció como `agentTerminalCode` de
transición; no se usó fallback legacy para elegir impresora.

### CertificaciÃ³n final de resiliencia y autostart Windows x64

La fase de resiliencia/autostart quedÃ³ cerrada con evidencia fÃ­sica y técnica
en `192.168.1.18`. El Scheduled Task se registrÃ³ y arrancÃ³ por logon sin
intervenciÃ³n manual, el launcher usÃ³ `runtime\\node.exe` directo con
`app\\main.js` entrecomillado, el ambiente propagÃ³ `PERIPHERALS_CONFIG_PATH`
correctamente, `GET /health` respondiÃ³ despuÃ©s de cold start y reboot, y el
registro local sobreviviÃ³ reinicios del Agent y de Windows sin perder
`network-xp80-qa-001`.

La evidencia certificada cubre:

- persistencia de dispositivos configurados;
- recuperaciÃ³n tras reinicio del Agent;
- recuperaciÃ³n tras reinicio de Windows;
- autostart por Scheduled Task;
- health gate del launcher;
- logs operativos del startup;
- re-discovery USB;
- impresiÃ³n LAN XP-80 despuÃ©s de reboot y autostart;
- corte fÃ­sico despuÃ©s de reboot y autostart;

### CORS configurable y preflight local

El Agent permanece escuchando solo en `127.0.0.1`. El browser puede venir de
un origin remoto permitido de forma explÃ­cita. El preflight `OPTIONS` para
`/printer/print-ticket` responde `204` para origins autorizados y rechaza
origins no autorizados sin usar `Access-Control-Allow-Origin: *`.
La allow-list es configurable y deduplicada desde config local o
`PERIPHERALS_ALLOWED_ORIGINS`.

### Soporte, packaging y lifecycle futuros

P0: Windows x64. P1: Windows ARM64, Linux x64/ARM64. P2: macOS ARM64/x64.
P0 usa runtime Node embebido solo para Windows x64. No selecciona Node SEA,
pkg, MSI ni otro empaquetador final. Cada artefacto futuro se construye en
runner nativo y registra versión, checksum, firma y target.

Windows portable usa Scheduled Task por usuario. Linux usa systemd
user/system según kiosk; macOS LaunchAgent. Servicio global requiere validar
permisos y colas de usuario.

### Serial, BBG Market 30 y cajón futuros

Serial divide `SerialTransport` portable y parser. BBG Market 30 usa ese
puerto, nunca COM o `/dev/tty*` directamente. Cajón RJ11 usa
`PRINTER_ESC_POS` con `viaPrinterDeviceId` y `DRAWER_KICK` por printer RAW.

## Risks / Trade-offs

- [Refactor altera bytes XP-80] → Snapshot RAW y prueba CUT antes/después.
- [Driver Windows ARM64 no existe] → No certificar hasta driver ARM64 y QA.
- [CUPS transforma bytes] → Adapter RAW dedicado y QA física.
- [Fingerprint cambia] → Identidad Agent-local y re-asociación explícita.
- [Módulo serial nativo] → Build/test nativo antes de adoptar dependencia.
- [Agent remoto expuesto] → Loopback por defecto y auth local futura.

## Migration Plan

1. Extraer adapters Windows y puertos sin cambiar contratos ni `deviceId`.
2. Validar bytes/cut XP-80 y TCP RAW.
3. Emitir descriptor portable con campos aditivos y compatibilidad legacy.
4. Crear spikes separados para CUPS RAW, ARM64, serial, lifecycle y packaging.
5. Rollback: restaurar adapter monolítico previo; no hay DB.

## Open Questions

- Qué fuente de serial USB expone cada driver Windows/CUPS.
- Qué autenticación local protege Agent cuando Browser viene de cloud.
- Qué persistencia/rotación usa `agentInstallationId`.
- Qué firma/certificado usa cada plataforma.
