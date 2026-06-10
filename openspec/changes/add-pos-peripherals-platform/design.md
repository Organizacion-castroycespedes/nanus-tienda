# Diseno: add-pos-peripherals-platform

## Arquitectura propuesta

Manus Peripheral Platform se disena como una capacidad local desacoplada del Backend API principal.

El componente tecnico inicial se nombra conceptualmente:

- `backend-perifericos`.
- `peripheral-agent`.

El agente debe ejecutarse localmente en la terminal POS y exponer contratos locales para el frontend Manus POS.

```text
Manus POS Web / Electron / Capacitor
        |
        | HTTP local / WebSocket local
        v
backend-perifericos / peripheral-agent
        |
        | USB / Serial / HID / ESC-POS / drivers locales
        v
Perifericos fisicos o simulados
```

El Backend API principal conserva el negocio:

```text
Manus POS Frontend
        |
        v
Backend API Manus POS
        |
        v
PostgreSQL
```

## Separacion entre Backend API principal y backend-perifericos

| Componente | Dueno de | No debe hacer |
| --- | --- | --- |
| Backend API principal | Ventas, inventario, compras, caja, clientes, proveedores, usuarios, roles, permisos, reportes y facturacion electronica. | Manejar USB, serial, HID, ESC/POS, drivers locales o estado tecnico de hardware. |
| `backend-perifericos` / `peripheral-agent` | Impresoras, cajas, balanzas, scanners, dispositivos USB/serial/HID, simuladores, logs tecnicos y eventos locales. | Crear ventas, modificar inventario, autorizar caja, emitir facturas o decidir reglas de negocio. |
| Manus POS Frontend | Orquestar UX y llamar API de negocio y agent local. | Hablar directamente con hardware fisico. |

Principio clave:

El frontend Manus POS SHALL NOT hablar directamente con hardware fisico. Debe comunicarse con `backend-perifericos` mediante HTTP local y WebSocket local.

## Diagrama textual de componentes

```text
web/
  app POS
  config perifericos
  adaptador frontend PeripheralClient
        |
        | http://127.0.0.1:<port>
        | ws://127.0.0.1:<port>
        v
backend-perifericos/
  HTTP local API
  WebSocket local events
  Device registry
  Terminal registry
  Assignment manager
  Simulator provider
  Printer provider
  Cash drawer provider
  Scale provider
  Scanner provider
  Technical log store
        |
        v
Hardware o simuladores
```

## Responsabilidades de cada componente

### Backend API principal

- Mantener tenant, sucursal, usuarios, roles y permisos.
- Mantener ventas, caja, inventario, compras, clientes y proveedores.
- Definir configuracion de negocio permitida para terminales y perifericos cuando aplique.
- Persistir configuracion central futura si se aprueba en otro cambio.
- No depender de que el agent este disponible para operar el core administrativo.

### `backend-perifericos` / `peripheral-agent`

- Ejecutarse en la terminal POS.
- Exponer `GET /health`.
- Exponer endpoints locales para discovery, registro, pruebas y comandos.
- Exponer WebSocket local con eventos tecnicos.
- Mantener estado tecnico de dispositivos locales.
- Soportar modo `MOCK/SIMULATOR`.
- Encapsular integraciones futuras con ESC/POS, `serialport`, USB/HID y teclado HID.
- Registrar logs tecnicos sanitizados.

### Manus POS Frontend

- Usar Backend API principal para negocio.
- Usar agent local para perifericos.
- Mostrar estado de dispositivos y errores tecnicos.
- Permitir pruebas de perifericos a usuarios autorizados.
- Manejar fallback visible cuando agent local no este disponible.

### Electron Desktop POS

- Contener la app Manus POS para operacion diaria.
- Facilitar arranque o deteccion del agent local en fases futuras.
- Permitir comunicacion local estable con `127.0.0.1`.
- No mezclar reglas de negocio dentro del proceso Electron.

### Capacitor Android POS

- Queda como evaluacion futura.
- Debe estudiar limites de USB, serial, HID, permisos Android, plugins nativos y compatibilidad de terminales POS Android.
- No se asume soporte Android nativo en esta fase.

## Compatibilidad Web POS

Web POS debe poder operar en modo administrativo y en modo caja con perifericos simulados o locales.

Reglas:

- Web POS SHALL poder consultar `GET /health` del agent si esta disponible.
- Web POS SHALL soportar ausencia del agent con mensajes de estado.
- Web POS SHALL usar `MOCK/SIMULATOR` para QA y desarrollo.
- Web POS SHALL NOT requerir drivers locales para flujos administrativos.

## Compatibilidad Electron Desktop POS

Electron Desktop POS es la modalidad principal para caja fisica.

Reglas:

- Electron SHALL permitir comunicacion local HTTP/WebSocket con el agent.
- Electron SHOULD facilitar arranque, monitoreo o configuracion del agent en fases futuras.
- Electron SHALL mantener separado el negocio en Backend API y hardware en agent.
- Electron packaging real queda fuera de alcance inicial.

## Compatibilidad Capacitor Android POS

Capacitor Android POS se documenta como evaluacion futura.

Aspectos a evaluar:

- Acceso a USB/serial/HID en Android.
- Plugins nativos necesarios.
- Permisos de sistema.
- Compatibilidad con terminales Android POS.
- Impresion Bluetooth, USB u OTG.
- Lectura QR por camara o scanner integrado.
- Riesgo de depender de SDKs propietarios.

## Comunicacion HTTP local

Contratos HTTP sugeridos:

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

Reglas:

- El agent SHALL exponer HTTP local.
- El host recomendado inicial es `127.0.0.1`.
- El puerto debe ser configurable.
- Los endpoints de comando SHALL validar autorizacion local.
- Los endpoints SHALL devolver errores tecnicos claros y no ambiguos.
- Los contratos de negocio como ventas y caja siguen en Backend API principal.

## Comunicacion WebSocket local

Eventos WebSocket sugeridos:

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

Reglas:

- El agent SHALL exponer WebSocket local.
- El frontend SHALL poder suscribirse a eventos de salud y lectura.
- Eventos de scanner y balanza SHALL permitir actualizacion reactiva del POS.
- Eventos SHALL incluir `deviceId`, `terminalId`, `timestamp`, `eventType` y payload tecnico minimo.
- Eventos SHALL evitar datos sensibles innecesarios.

## Modo MOCK/SIMULATOR

El modo `MOCK/SIMULATOR` es obligatorio para la primera implementacion futura.

Debe simular:

- Impresora termica.
- Caja registradora.
- Balanza.
- Scanner QR/codigo de barras.
- Estados conectado, desconectado y error.
- Logs tecnicos.
- Eventos WebSocket.

Reglas:

- El simulador SHALL operar sin hardware real.
- El simulador SHALL permitir QA reproducible.
- El simulador SHALL permitir `POST /scanner/simulate`.
- El simulador SHALL permitir peso configurable o lectura mock de `GET /scale/current-weight`.
- El simulador SHALL simular impresion de prueba sin enviar ESC/POS real.

## Seguridad local

Riesgos:

- Otro proceso local podria invocar comandos.
- Un sitio malicioso podria intentar llamar `localhost`.
- WebSocket local podria filtrar eventos.
- Logs podrian exponer datos de venta o documentos.

Controles propuestos:

- Bind por defecto a `127.0.0.1`, no `0.0.0.0`.
- Token local o secreto efimero para comandos.
- CORS limitado a origenes permitidos de Manus POS.
- Validacion de tenant/terminal cuando el frontend envie contexto.
- No exponer endpoints de negocio en agent.
- Sanitizar logs y payloads.
- No guardar ticket completo por defecto en logs tecnicos.
- Rate limit local para comandos sensibles como `cash-drawer/open`.
- Permitir rotacion de token local.

## Observabilidad y logs

El agent debe registrar logs tecnicos de perifericos.

Tipos de log:

- Discovery.
- Conexion.
- Desconexion.
- Error.
- Comando enviado.
- Resultado de comando.
- Job de impresion.
- Lectura de balanza.
- Lectura de scanner.
- Cambio de salud del agent.

Campos conceptuales:

- `id`.
- `tenantId`.
- `branchId`.
- `terminalId`.
- `deviceId`.
- `deviceType`.
- `eventType`.
- `severity`.
- `message`.
- `metadata`.
- `createdAt`.

Reglas:

- Logs SHALL ser tecnicos, no fuente de verdad de negocio.
- Logs SHALL poder consultarse con `GET /logs`.
- Logs SHALL tener retencion configurable en fases futuras.
- Logs SHALL sanitizar datos sensibles.

## Modelo conceptual de datos

Modelo conceptual:

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

### `pos_terminals`

- `id`.
- `tenant_id`.
- `branch_id`.
- `code`.
- `name`.
- `mode`.
- `status`.
- `last_seen_at`.
- `created_at`.
- `updated_at`.

### `pos_devices`

- `id`.
- `tenant_id`.
- `device_type`.
- `name`.
- `connection_type`.
- `profile_id`.
- `status`.
- `is_simulated`.
- `metadata`.
- `created_at`.
- `updated_at`.

### `pos_device_assignments`

- `id`.
- `tenant_id`.
- `branch_id`.
- `terminal_id`.
- `device_id`.
- `role`.
- `is_default`.
- `created_at`.
- `updated_at`.

### `pos_device_logs`

- `id`.
- `tenant_id`.
- `terminal_id`.
- `device_id`.
- `severity`.
- `event_type`.
- `message`.
- `metadata`.
- `created_at`.

### `pos_device_events`

- `id`.
- `tenant_id`.
- `terminal_id`.
- `device_id`.
- `event_type`.
- `payload`.
- `created_at`.

### `pos_peripheral_profiles`

- `id`.
- `tenant_id`.
- `device_type`.
- `name`.
- `driver_type`.
- `capabilities`.
- `settings_schema`.
- `created_at`.
- `updated_at`.

Nota: Esta fase no crea migraciones. Los nombres son conceptuales para alinear implementacion futura.

## Riesgos tecnicos

| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| Drivers por marca varian mucho | Alta complejidad de soporte | Crear perfiles y providers por tipo. |
| ESC/POS no cubre todos los modelos | Impresion inconsistente | Modo test-print y profiles por impresora. |
| Serial/USB/HID requiere permisos OS | Fallos por terminal | Documentar prerequisitos por SO. |
| Navegador bloquea acceso local por CORS | Web POS no conecta | CORS local controlado y Electron para caja. |
| Android no expone hardware igual que desktop | Riesgo de viabilidad | Tratar Capacitor como evaluacion futura. |
| Agent caido durante venta | Cajero sin impresora/caja | Estados claros, retry y fallback operativo. |
| Logs crecen sin control | Disco local lleno | Retencion configurable futura. |

## Decisiones tecnicas pendientes

1. Lenguaje/framework final de `backend-perifericos`: NestJS, Node standalone u otra opcion.
2. Puerto local default y estrategia de discovery del agent.
3. Mecanismo exacto de token local y rotacion.
4. Persistencia local de configuracion y logs: memoria, archivo, SQLite u otra.
5. Libreria ESC/POS futura.
6. Libreria serial futura, posiblemente `serialport`.
7. Estrategia para HID keyboard/scanner.
8. Contrato exacto entre configuracion central del Backend API y configuracion local del agent.
9. Retencion de logs tecnicos.
10. Politica de actualizacion del agent.
11. Si Electron arrancara el agent como proceso hijo o lo detectara externo.
12. Viabilidad de plugins Capacitor para Android POS.
