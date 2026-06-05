# Delta spec: peripherals

## ADDED Requirements

### Requirement: Terminal POS registration

El sistema SHALL permitir registrar una terminal POS por tenant y sucursal para asociar perifericos locales.

#### Scenario: HU-01 Registrar terminal POS

- GIVEN un administrador autenticado con permiso de configuracion
- WHEN registra una terminal POS con tenant, sucursal, codigo y nombre
- THEN el sistema SHALL crear una terminal POS tenant-aware
- AND SHALL permitir asociar perifericos fisicos o simulados a esa terminal.

#### Scenario: Terminal belongs to branch

- GIVEN una terminal POS registrada
- WHEN se consulta su configuracion
- THEN el sistema SHALL mostrar tenant, sucursal, codigo, nombre, estado y fecha de ultimo contacto.

### Requirement: Peripheral device registration

El sistema SHALL permitir registrar perifericos POS fisicos o simulados.

#### Scenario: HU-02 Configurar impresora termica

- GIVEN un administrador autenticado
- WHEN registra una impresora termica para una terminal
- THEN el sistema SHALL guardar el dispositivo como `PRINTER`
- AND SHALL permitir definir perfil, tipo de conexion y modo simulado o fisico.

#### Scenario: Register supported device types

- GIVEN un administrador configura perifericos
- WHEN registra impresora, caja, balanza o scanner
- THEN el sistema SHALL soportar tipos `PRINTER`, `CASH_DRAWER`, `SCALE` y `SCANNER`
- AND SHALL permitir tipos futuros como visor o dispositivo generico.

### Requirement: Peripheral assignment to POS terminal

El sistema SHALL permitir asignar perifericos a una terminal POS.

#### Scenario: Assign default printer

- GIVEN una terminal POS y una impresora registradas en el mismo tenant
- WHEN el administrador asigna la impresora como predeterminada
- THEN el sistema SHALL crear una asignacion activa
- AND SHALL usar esa impresora para pruebas y tickets futuros de la terminal.

#### Scenario: Prevent cross-tenant assignment

- GIVEN un dispositivo de tenant A
- WHEN un usuario de tenant B intenta asignarlo a una terminal
- THEN el sistema SHALL rechazar la asignacion
- AND SHALL NOT filtrar informacion de tenant A.

### Requirement: Local peripheral agent

El sistema SHALL definir un `backend-perifericos` o `peripheral-agent` local como dueno de hardware.

#### Scenario: Agent exposes local health

- GIVEN el agent esta ejecutandose en la terminal POS
- WHEN el frontend llama `GET /health`
- THEN el agent SHALL responder estado, version conceptual, modo y fecha de revision de salud.

#### Scenario: Agent operates without Backend API for hardware

- GIVEN el Backend API principal no esta involucrado en un comando de hardware local
- WHEN el frontend solicita una prueba de impresora al agent
- THEN el agent SHALL ejecutar o simular el comando local
- AND SHALL NOT delegar el manejo de hardware al Backend API principal.

#### Scenario: Agent owns hardware state

- GIVEN un periferico cambia de conectado a desconectado
- WHEN el agent detecta el cambio
- THEN el agent SHALL actualizar estado tecnico local
- AND SHALL emitir un evento WebSocket local.

### Requirement: MOCK/SIMULATOR mode

El sistema SHALL soportar modo `MOCK/SIMULATOR` para probar perifericos sin hardware real.

#### Scenario: HU-07 Simular perifericos sin hardware real

- GIVEN un desarrollador o QA ejecuta el agent en modo simulador
- WHEN solicita dispositivos disponibles
- THEN el agent SHALL devolver perifericos simulados de impresora, caja, balanza y scanner
- AND SHALL permitir probar flujos POS sin dispositivos fisicos.

#### Scenario: Simulator emits events

- GIVEN el agent esta en modo `MOCK/SIMULATOR`
- WHEN se simula una lectura de scanner o cambio de peso
- THEN el agent SHALL emitir eventos `scanner.code.read` o `scale.weight.changed`
- AND SHALL registrar logs tecnicos simulados.

### Requirement: Printer test print

El sistema SHALL permitir impresion de prueba desde una impresora asignada a la terminal POS.

#### Scenario: HU-03 Imprimir ticket de prueba

- GIVEN un administrador o cajero autorizado tiene una impresora asignada
- WHEN llama `POST /printer/test-print`
- THEN el agent SHALL generar una impresion de prueba o resultado simulado
- AND SHALL emitir `printer.job.started`
- AND SHALL emitir `printer.job.completed` si termina correctamente.

#### Scenario: Printer test fails

- GIVEN la impresora esta desconectada o en error
- WHEN se solicita `POST /printer/test-print`
- THEN el agent SHALL devolver error tecnico claro
- AND SHALL emitir `printer.job.failed`
- AND SHALL registrar log tecnico.

### Requirement: Cash drawer open command

El sistema SHALL permitir comando local de apertura de caja registradora.

#### Scenario: HU-04 Abrir caja registradora

- GIVEN un cajero autorizado opera una terminal con caja asignada
- WHEN llama `POST /cash-drawer/open`
- THEN el agent SHALL ejecutar o simular apertura de caja
- AND SHALL emitir `cashdrawer.opened`
- AND SHALL registrar log tecnico.

#### Scenario: Cash drawer uses ESC/POS pulse in future

- GIVEN la caja esta conectada por impresora compatible ESC/POS
- WHEN se implemente integracion fisica futura
- THEN el agent SHALL permitir apertura via comando ESC/POS pulse
- AND SHALL mantener el Backend API principal desacoplado del comando fisico.

### Requirement: Scale current weight reading

El sistema SHALL permitir leer el peso actual desde una balanza local o simulada.

#### Scenario: HU-05 Leer peso desde balanza electronica

- GIVEN una terminal tiene balanza asignada
- WHEN el cajero solicita `GET /scale/current-weight`
- THEN el agent SHALL devolver peso actual, unidad, estabilidad y timestamp
- AND SHALL permitir usar el valor en venta de productos pesables.

#### Scenario: Scale weight changes

- GIVEN la balanza reporta nuevo peso
- WHEN el peso cambia
- THEN el agent SHALL emitir `scale.weight.changed`
- AND SHALL incluir `deviceId`, peso, unidad, estabilidad y timestamp.

### Requirement: Scanner code reading

El sistema SHALL permitir lectura de QR o codigo de barras desde scanner local o simulado.

#### Scenario: HU-06 Escanear QR o codigo de barras

- GIVEN una terminal tiene scanner asignado
- WHEN el cajero escanea un QR o codigo de barras
- THEN el agent SHALL emitir `scanner.code.read`
- AND SHALL incluir codigo, tipo detectado si aplica, `deviceId` y timestamp.

#### Scenario: Simulate scanner input

- GIVEN el agent esta en modo `MOCK/SIMULATOR`
- WHEN se llama `POST /scanner/simulate` con un codigo
- THEN el agent SHALL aceptar el codigo
- AND SHALL emitir `scanner.code.read`
- AND SHALL registrar log tecnico.

### Requirement: Device health status

El sistema SHALL permitir consultar estado de salud de dispositivos.

#### Scenario: HU-08 Consultar estado de perifericos

- GIVEN un administrador consulta `GET /devices`
- WHEN existen dispositivos registrados
- THEN el agent SHALL devolver estado `CONNECTED`, `DISCONNECTED`, `ERROR` o `SIMULATED`
- AND SHALL incluir tipo, nombre, terminal asociada y ultimo evento conocido.

#### Scenario: Device error is reported

- GIVEN un dispositivo entra en error
- WHEN el agent detecta el error
- THEN el agent SHALL emitir `device.error`
- AND SHALL registrar log tecnico con severidad.

### Requirement: Device technical logs

El sistema SHALL exponer logs tecnicos de perifericos.

#### Scenario: HU-09 Ver logs tecnicos de perifericos

- GIVEN soporte tecnico consulta `GET /logs`
- WHEN existen eventos de perifericos
- THEN el agent SHALL devolver logs filtrables por terminal, dispositivo, severidad y fecha
- AND SHALL sanitizar datos sensibles.

#### Scenario: Logs are technical only

- GIVEN se imprime un ticket o se lee un scanner
- WHEN el agent registra log
- THEN el log SHALL guardar resumen tecnico
- AND SHALL NOT guardar tickets completos ni secretos por defecto.

### Requirement: Local WebSocket events

El sistema SHALL exponer eventos WebSocket locales para cambios de dispositivos y lecturas.

#### Scenario: Subscribe to local events

- GIVEN el frontend abre WebSocket local con el agent
- WHEN un dispositivo se conecta, desconecta o falla
- THEN el agent SHALL emitir `device.connected`, `device.disconnected` o `device.error`.

#### Scenario: Emit supported event names

- GIVEN ocurren operaciones de perifericos
- WHEN el agent publica eventos
- THEN SHALL soportar `device.connected`, `device.disconnected`, `device.error`, `printer.job.started`, `printer.job.completed`, `printer.job.failed`, `cashdrawer.opened`, `scale.weight.changed`, `scanner.code.read` y `agent.health.changed`.

### Requirement: Web POS compatibility

El sistema SHALL ser compatible con ejecucion Web POS.

#### Scenario: Web POS uses local agent when available

- GIVEN Manus POS corre en navegador web
- WHEN el agent local esta disponible
- THEN el frontend SHALL comunicarse con el agent por HTTP local y WebSocket local
- AND SHALL mostrar estado de perifericos.

#### Scenario: Web POS works without agent for administration

- GIVEN el agent local no esta disponible
- WHEN el usuario realiza administracion, inventario, compras, reportes o configuracion no dependiente de hardware
- THEN Web POS SHALL continuar operando contra Backend API principal
- AND SHALL mostrar que perifericos locales no estan disponibles.

### Requirement: Electron Desktop POS compatibility

El sistema SHALL ser compatible con Desktop POS usando Electron.

#### Scenario: HU-10 Ejecutar Manus POS como aplicacion Desktop con Electron

- GIVEN un operador usa Manus POS en Electron
- WHEN opera caja, ventas, impresion, balanza, scanner o apertura de caja
- THEN Electron SHALL comunicarse con el agent local por HTTP/WebSocket local
- AND SHALL mantener reglas de negocio en Backend API principal.

#### Scenario: Electron does not own business logic

- GIVEN Electron contiene la UI POS
- WHEN se registra una venta o movimiento de caja
- THEN la operacion de negocio SHALL seguir usando Backend API principal
- AND Electron SHALL NOT convertirse en backend de ventas o inventario.

### Requirement: Capacitor Android POS evaluation

El sistema SHALL documentar Capacitor Android POS como evaluacion futura.

#### Scenario: HU-11 Evaluar ejecucion Android POS con Capacitor

- GIVEN el producto evalua tablets, meseros, preventistas y terminales Android POS
- WHEN se analice Capacitor
- THEN el sistema SHALL documentar viabilidad de USB, serial, HID, Bluetooth, camara, plugins nativos y permisos Android
- AND SHALL producir recomendacion go/no-go antes de implementacion real.

#### Scenario: Android native is out of initial scope

- GIVEN esta fase es OpenSpec inicial
- WHEN se revisa el alcance
- THEN Android nativo SHALL quedar fuera de alcance
- AND Capacitor SHALL quedar como evaluacion futura.

### Requirement: Backend API separation

El sistema SHALL mantener separado el Backend API principal del manejo de perifericos.

#### Scenario: HU-000 Plataforma de Perifericos Manus POS

- GIVEN Manus POS requiere perifericos fisicos y simulados
- WHEN se disena Manus Peripheral Platform
- THEN el Backend API principal SHALL conservar ventas, inventario, compras, caja, clientes, proveedores, usuarios, roles, permisos, reportes y facturacion
- AND `backend-perifericos` SHALL conservar impresoras, balanzas, scanners, cajas, USB, serial, HID y simuladores.

#### Scenario: Frontend does not talk directly to hardware

- GIVEN el frontend Manus POS necesita imprimir o leer peso
- WHEN ejecuta una operacion de periferico
- THEN SHALL llamar al agent local por HTTP/WebSocket
- AND SHALL NOT acceder directamente a USB, serial, HID o drivers fisicos.

### Requirement: Security and local access boundaries

El sistema SHALL definir limites de seguridad local para el agent de perifericos.

#### Scenario: Local access only

- GIVEN el agent inicia en una terminal POS
- WHEN expone HTTP y WebSocket
- THEN SHALL usar bind local por defecto `127.0.0.1`
- AND SHALL NOT exponerse a red externa por defecto.

#### Scenario: Local command authorization

- GIVEN un comando sensible como abrir caja
- WHEN el frontend llama `POST /cash-drawer/open`
- THEN el agent SHALL validar autorizacion local
- AND SHALL registrar log tecnico sanitizado.

#### Scenario: Browser origin boundaries

- GIVEN un navegador intenta comunicarse con el agent
- WHEN envia requests HTTP locales
- THEN el agent SHALL restringir CORS a origenes permitidos de Manus POS
- AND SHALL rechazar origenes no autorizados.

#### Scenario: Sensitive data protection

- GIVEN el agent registra logs o eventos
- WHEN procesa tickets, codigos o estados
- THEN SHALL evitar guardar secretos, tokens, tickets completos o datos sensibles innecesarios.

## Historias de usuario documentadas

- HU-000 Plataforma de Perifericos Manus POS.
- HU-01 Registrar terminal POS.
- HU-02 Configurar impresora termica.
- HU-03 Imprimir ticket de prueba.
- HU-04 Abrir caja registradora.
- HU-05 Leer peso desde balanza electronica.
- HU-06 Escanear QR o codigo de barras.
- HU-07 Simular perifericos sin hardware real.
- HU-08 Consultar estado de perifericos.
- HU-09 Ver logs tecnicos de perifericos.
- HU-10 Ejecutar Manus POS como aplicacion Desktop con Electron.
- HU-11 Evaluar ejecucion Android POS con Capacitor.

## Contratos HTTP documentados

```http
GET    /health
GET    /devices
POST   /devices/discover
POST   /devices
PATCH  /devices/:id
POST   /printer/test-print
POST   /printer/print-ticket
POST   /cash-drawer/open
GET    /scale/current-weight
POST   /scanner/simulate
GET    /logs
```

## Eventos WebSocket documentados

```text
device.connected
device.disconnected
device.error
printer.job.started
printer.job.completed
printer.job.failed
cashdrawer.opened
scale.weight.changed
scanner.code.read
agent.health.changed
```

## Modelo conceptual documentado

```text
Tenant
  Branch
    POSTerminal
      PeripheralDevice
        PeripheralAssignment
        PeripheralLog
        PeripheralEvent
```

Entidades conceptuales:

- `pos_terminals`.
- `pos_devices`.
- `pos_device_assignments`.
- `pos_device_logs`.
- `pos_device_events`.
- `pos_peripheral_profiles`.

## Restricciones tecnicas

1. `backend-perifericos` SHALL poder ejecutarse localmente en la terminal POS.
2. `backend-perifericos` SHALL exponer HTTP local.
3. `backend-perifericos` SHALL exponer WebSocket local.
4. `backend-perifericos` SHALL soportar `MOCK/SIMULATOR`.
5. `backend-perifericos` SHALL no depender del Backend API para operar hardware local.
6. `backend-perifericos` SHALL reportar eventos al frontend POS.
7. `backend-perifericos` SHALL permitir futura integracion con ESC/POS.
8. `backend-perifericos` SHALL permitir futura integracion con `serialport`.
9. `backend-perifericos` SHALL permitir futura integracion con HID keyboard.
10. `backend-perifericos` SHALL permitir apertura de caja via comando ESC/POS pulse.
11. El diseno SHALL documentar uso de Electron como contenedor Desktop.
12. El diseno SHALL documentar limites de Capacitor para Android.
13. El diseno SHALL mantener desacoplado el Backend API principal.

## Riesgos

RIESGO: Exponer comandos locales sin autorizacion podria permitir apertura de caja o comandos de impresion no autorizados.

RIESGO: Diferencias entre modelos de impresoras, balanzas y scanners pueden requerir perfiles especificos.

RIESGO: Capacitor Android puede no tener acceso suficiente a USB, serial o HID sin plugins nativos o SDKs propietarios.

RIESGO: Logs tecnicos mal disenados pueden exponer datos de ventas o secretos.

RIESGO: Si Electron asume reglas de negocio, la arquitectura se fragmenta.

## Preguntas abiertas

PREGUNTA ABIERTA: Cual sera el framework final de `backend-perifericos`?

PREGUNTA ABIERTA: Cual sera el puerto local default del agent?

PREGUNTA ABIERTA: Como se generara y rotara el token local del agent?

PREGUNTA ABIERTA: Que persistencia local se usara para logs y configuracion?

PREGUNTA ABIERTA: Electron arrancara el agent como proceso hijo o consumira un servicio local instalado?

PREGUNTA ABIERTA: Cual sera la primera familia de impresoras ESC/POS certificada?

PREGUNTA ABIERTA: Que balanzas seriales/USB deben certificarse primero?

PREGUNTA ABIERTA: Se soportara scanner como HID keyboard desde frontend, desde agent, o ambos con reglas claras?
