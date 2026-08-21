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

El perfil QA de artefacto autoriza solo `http://192.168.1.14:3000` para que un
Browser local pueda llamar el Agent loopback mientras Manus remoto sirve Web.
Ese origin vive en config local generada, no en el core portable.

No se adopta MSI/setup.exe, tray, servicio Windows ni autostart en este P0.
La ejecución es manual con doble clic y el lifecycle futuro conserva su spike
separado.

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

### Soporte, packaging y lifecycle futuros

P0: Windows x64. P1: Windows ARM64, Linux x64/ARM64. P2: macOS ARM64/x64.
P0 usa runtime Node embebido solo para Windows x64. No selecciona Node SEA,
pkg, MSI ni otro empaquetador final. Cada artefacto futuro se construye en
runner nativo y registra versión, checksum, firma y target.

Windows inicia con Agent usuario/tray/autostart. Linux usa systemd user/system
según kiosk; macOS LaunchAgent. Servicio global requiere validar permisos y
colas de usuario.

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
