# Arquitectura terminal Manus: roadmap

## CURRENT CERTIFIED STATE

Baseline certificado develop: `5a393b475c5e96716f7d196cb0dd913b58c0e9f4`.
P7/P8: CLOSED / PASS / FROZEN. Este documento no reabre certificacion ni lifecycle del Installer.

Estado observado: Web remota online, bridge seguro Electron, main Electron, Peripheral Agent local y perifericos fisicos. Electron declara version de paquete `0.1.0`; Agent `0.1.1-qa.9`. Antes de P9.1, `getShellInfo` expone shellVersion y `/health` expone version del Agent, pero ninguno identifica generacion de contrato. Web asume metodos completos al encontrar un objeto `manusTerminal`.

Hay operaciones fijas de impresora/cajon, administracion de perifericos, health/logs, simulacion scanner y lectura de peso. Existencia de API no certifica hardware. Scanner HID es captura de teclado enfocada en Web; no hay API nativa scanner.input en el bridge.

## TARGET ARCHITECTURE

```text
Remote Manus Web
  -> secure Electron bridge (typed contract)
  -> Electron main
  -> local Peripheral Agent (fixed loopback API)
  -> physical peripherals
```

Web debe evolucionar y desplegarse independientemente de los binarios instalados. Cada despliegue remoto debe considerar las generaciones y capacidades presentes. Cloud conserva autoridad de negocio.

### Invariantes para todas las fases

1. Cloud es autoritativo para estado de negocio salvo cambio explicito por arquitectura offline dedicada.
2. Terminal POS logica y Device fisico son entidades distintas.
3. Agent posee preocupaciones de hardware/perifericos, no estado general de negocio.
4. Renderer nunca recibe privilegios nativos irrestrictos.
5. Web remota no obtiene acceso arbitrario a la maquina local.
6. API loopback del Agent no puede convertirse en proxy arbitrario.
7. Artefactos/updates del runtime deberan ser confiables y verificables.
8. Frontend remoto debe considerar compatibilidad del runtime instalado.
9. Reasignacion de terminal debe ser explicita y auditable.
10. Una terminal logica no debe tener silenciosamente multiples dispositivos fisicos ACTIVE.

Mantener contextIsolation=true, nodeIntegration=false y sandbox=true. Sin IPC generico, proxy localhost arbitrario, URL Agent controlada por renderer, acceso arbitrario a filesystem/comandos, bypass de certificados o webSecurity=false.

## CURRENT IMPLEMENTATION PHASE

### P9.1 Runtime contracts

Status: IMPLEMENTED / PENDING MERGE. Unico change activo creado por esta iniciativa: `versionar-contratos-runtime-manus-terminal`.

`manusTerminal.getRuntimeInfo()` devuelve:

```ts
{
  electronRuntimeVersion: string; // app.getVersion(): paquete Manus Electron
  bridgeContractVersion: number; // generacion actual: 1
  agentApiVersion: number | null; // observada en /health; actual: 1
  capabilities: RuntimeCapability[];
}
```

Versiones de paquete y generaciones son conceptos separados. Sin motor semver. Agent agrega `agentApiVersion: 1` a `/health`; Electron conserva enteros positivos observados. null significa Agent desconocido/no disponible/legacy. No se deduce generacion del numero de paquete.

Capacidades actuales, verificadas contra metodos existentes:

| Capacidad | Bridge | Agent |
| --- | --- | --- |
| agent.health | getAgentHealth | GET /health |
| devices.list | listDevices | GET /devices |
| devices.discover | discoverDevices | POST /devices/discover |
| devices.create | createDevice | POST /devices |
| devices.update | updateDevice | PATCH /devices/:id |
| printer.testPrint | testPrint | POST /printer/test-print |
| printer.printTicket | printTicket | POST /printer/print-ticket |
| drawer.open | openCashDrawer | POST /cash-drawer/open |
| scanner.simulate | simulateScanner | POST /scanner/simulate |
| scale.currentWeight | currentWeight | GET /scale/current-weight |
| logs.list | listLogs | GET /logs |

Lista describe soporte API, no conexion fisica, permiso de negocio ni certificacion de cada dispositivo. Sin scanner.input: HID sigue siendo teclado Web. Con Agent generacion 1 disponible, Electron anuncia lista completa; de lo contrario solo agent.health.

| Estado | Comportamiento Web |
| --- | --- |
| COMPATIBLE | Generaciones 1/1 y capacidades requeridas anunciadas con metodos invocables. |
| DEGRADED | Bridge legacy, Agent desconocido, capacidad/metodo faltante, metadata fallida/timeout, browser o SSR sin bridge. |
| INCOMPATIBLE | Metadata invalida o generacion explicita no soportada; bloquea operaciones perifericas. |

Helper permite consultar capacidades requeridas por funcionalidad. Capacidad ausente produce OPERATION_DISABLED manejado por contratos POS existentes. No bloquea negocio cloud. Legacy sin getRuntimeInfo conserva solo metodos existentes como fallback acotado; no demuestra negociacion. Error/timeout de metodo moderno no habilita fallback legacy. Browser/SSR sin bridge devuelve inspeccion segura sin alterar transporte browser. Electron nunca cae a HTTP browser por falta de capacidad.

Metadata se consulta antes de operacion, con timeout Web de 3 segundos y probe Agent existente de 2.5 segundos. No cache permanente: permite recuperar Agent sin reiniciar Web. Unknown capabilities se ignoran para permitir adiciones futuras compatibles. Cambios incompatibles requieren nueva generacion y soporte Web explicito. Health es diagnostico, no una maquina de readiness P9.3.

## PLANNED PHASES

Orden: P9.1 -> P9.2 -> P9.3 -> P9.4 -> P9.5 -> P9.6. Referencias de change son nombres de planificacion: no crear directorios todavia.

### P9.2 Physical Device - Logical Terminal binding

Status: PLANNED. Referencia: `vincular-dispositivo-fisico-terminal-pos`.

Alcance esperado: installationId, deviceId, terminalId; pairing/activation; device credential; revocation; replacement; audit history. Separar instalacion, maquina fisica y terminal logica. Reusar contratos P9.1 para negociar soporte. Revisar identidad local existente antes de definir registros cloud; P9.1 no agrega registry ni credenciales.

### P9.3 Startup and readiness

Status: PLANNED. Referencia: `automatizar-arranque-readiness-manus-terminal`.

Alcance esperado: Agent autostart, Electron autostart y readiness state machine con WAITING_FOR_AGENT, CLOUD_UNAVAILABLE, DEVICE_UNLINKED, DEVICE_REVOKED, RUNTIME_INCOMPATIBLE, READY. Consume compatibilidad P9.1 e identidad P9.2. Definir transiciones y recuperacion antes de implementar.

### P9.4 Recovery / diagnostics shell

Status: PLANNED. Referencia: `implementar-shell-recuperacion-manus-terminal`.

Alcance esperado: local packaged recovery UI, connectivity diagnostics, Agent health, runtime versions, terminal/device identity, retry/recovery. Consume diagnosticos P9.1 y estados P9.3. Explicitamente NO offline POS sales.

### P9.5 Managed terminal updates

Status: PLANNED. Referencia: `implementar-actualizacion-controlada-manus-terminal`.

Alcance esperado: release manifests, trusted artifacts, compatibility enforcement, Electron update, Agent update orchestration, QA / Pilot / Stable, controlled restart, rollback/recovery. Debe usar generaciones P9.1, identidad P9.2 y recuperacion P9.4; definir validacion criptografica y fallos parciales. Sin updater implementado ahora.

### P9.6 Linux portability

Status: PLANNED. Referencia: `adaptar-manus-terminal-linux`.

Alcance esperado: common contracts, systemd, startup/session, USB/HID/serial permissions, udev, secure credential persistence, installer/update lifecycle. Mantener contrato comun y adaptar integraciones OS tras definir lifecycle P9.3/P9.5. No cambios Linux en P9.1.

## DEFERRED/FUTURE WORK

Selective local business cache: DEFERRED. Requiere definir datos, caducidad, invalidacion, permisos y autoridad cloud. No se deriva automaticamente de recovery UI ni de salud local.

Offline POS sales: FUTURE EPIC. Proyecto arquitectonico separado. Debe resolver transaction durability, idempotency, synchronization, stock consistency, payments, fiscal/electronic invoicing, numbering/consecutives y conflict resolution. No incluido en P9.1-P9.6 y no habilitado por cache selectivo.
