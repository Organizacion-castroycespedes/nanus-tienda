# backend-perifericos

Servicio local para perifericos de Manus POS.

El comportamiento por defecto sigue siendo `MOCK`. La impresion real `NETWORK` ESC/POS y la impresion `USB` por cola del sistema quedan apagadas si `PERIPHERALS_ENABLE_REAL_ADAPTERS` no es exactamente `true`.

## Proposito

`backend-perifericos` funciona como `peripheral-agent` local. Expone HTTP local y WebSocket local para simular perifericos POS sin conectar hardware real. En Fase 5 tambien puede enviar bytes ESC/POS basicos a una impresora de red TCP/IP, solo con feature flag explicito.

El Backend API principal sigue siendo dueno del negocio. Este servicio solo maneja perifericos, eventos locales y logs tecnicos en memoria.

## Hardening Fase 2.1

Esta fase agrega:

- Validacion runtime de payloads.
- Errores controlados para deviceId inexistente, tipo incorrecto y dispositivo no operativo.
- Filtro global de errores HTTP sin stack traces en responses.
- Logs WARN/ERROR para errores operativos relevantes.
- Limite de logs en memoria configurable.
- CORS local restringido por `PERIPHERALS_ALLOWED_ORIGINS`.
- WebSocket raw local con manejo defensivo de errores de socket.

## ESC/POS MOCK avanzado - Fase 4

Esta fase agrega una capa interna de formato termico para simular tickets tipo ESC/POS sin enviar bytes reales.

Incluye:

- Preview textual monoespaciado para tickets 80mm.
- Ancho configurable por `PERIPHERALS_PRINTER_WIDTH_CHARS`.
- Comandos ESC/POS conceptuales en responses.
- Simulacion de `CUT` para impresora.
- Simulacion de `CASH_DRAWER_PULSE` para caja registradora.
- Logs tecnicos con `jobId`, `terminalId`, `deviceId`, `ticketType`, `commandCount` y `previewLength`.

No incluye drivers, USB, serial, HID, `node-escpos` ni hardware real.

## Device Profiles y Print Adapters - Fase 4.2

Esta fase separa el formateo de tickets, comandos conceptuales y ejecucion MOCK mediante contratos internos.

Contratos internos:

- `PrinterAdapter`: imprime test print y tickets.
- `CashDrawerAdapter`: abre caja registradora.
- `PeripheralAdapter`: expone `type`, `connectionType`, `mode` y capacidades.

Implementaciones actuales:

- `MockPrinterAdapter`: genera preview textual y comandos ESC/POS conceptuales.
- `MockCashDrawerAdapter`: genera `INIT` y `CASH_DRAWER_PULSE` conceptual.
- `PeripheralAdapterResolver`: selecciona adapter por `device.type`, `device.connectionType` y `PERIPHERALS_MODE`.

Profiles disponibles:

| Profile | Papel | Ancho | Corte | Pulse caja |
| --- | ---: | ---: | --- | --- |
| `THERMAL_80MM` | `80mm` | `48` chars | Si | Si |
| `THERMAL_58MM` | `58mm` | `32` chars | Si | Si |
| `GENERIC_TEXT` | N/A | `40` chars | No | No |

Seleccion actual:

- `MOCK + PRINTER + MOCK` usa `MockPrinterAdapter`.
- `MOCK + CASH_DRAWER + MOCK` usa `MockCashDrawerAdapter`.
- `NETWORK + PRINTER` usa `NetworkEscposPrinterAdapter` solo si `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
- `USB + PRINTER` usa `UsbSystemPrinterAdapter` y una cola local descubierta del SO solo si `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
- `NETWORK`, `USB`, `SERIAL`, `HID` y cualquier adapter real quedan bloqueados si `PERIPHERALS_ENABLE_REAL_ADAPTERS` no es `true`.
- `SERIAL`, `HID` y `BLUETOOTH` siguen fuera de alcance y responden `Adapter for connection type ... is not implemented yet.` cuando el flag real esta activo.

Los dispositivos MOCK incluyen `profileId`. Las respuestas de impresion y apertura de caja agregan `profile` y `capabilities` sin remover campos existentes.

## Impresion real NETWORK ESC/POS - Fase 5

Esta fase agrega `NetworkEscposPrinterAdapter` para impresoras ESC/POS de red por TCP/IP.

Reglas:

- `PERIPHERALS_ENABLE_REAL_ADAPTERS=false` por defecto.
- Si el flag no es exactamente `true`, un dispositivo `NETWORK`, `USB`, `SERIAL` o `HID` responde:

```text
Real peripheral adapters are disabled. Enable PERIPHERALS_ENABLE_REAL_ADAPTERS=true to use them.
```

- Se implementan `NETWORK + PRINTER` y `USB + PRINTER`.
- USB usa la cola de impresion del sistema; no usa WebUSB, `serialport`, HID, Electron ni Capacitor.
- No se conecta hardware automaticamente.
- No se usa `node-escpos`.
- No se imprime si falta `network.host` o `network.port`.

El adapter convierte el preview textual generado por el formatter a bytes ESC/POS basicos:

- `INIT`: `ESC @`.
- `ALIGN_LEFT`, `ALIGN_CENTER`, `ALIGN_RIGHT`.
- `BOLD_ON`, `BOLD_OFF`.
- `FEED`.
- `CUT`.
- `CASH_DRAWER_PULSE` existe como comando conceptual, pero no se usa para caja real en esta fase.

La codificacion actual para el preview es `utf8`. Algunos modelos ESC/POS pueden requerir code page distinta; eso queda para perfiles certificados futuros.

Seguridad:

- El servicio sigue escuchando en `127.0.0.1`.
- El destino `network.host` acepta hostname o IPv4 sin protocolo.
- `localhost`, `127.*`, `0.0.0.0` y loopback quedan bloqueados como destino de impresora de red.
- `network.port` debe estar entre `1` y `65535`.
- `network.timeoutMs` usa default `3000` y acepta `250` a `30000`.
- Los logs no guardan preview ni contenido completo del ticket.
- Los logs tecnicos pueden guardar `networkHost` y `networkPort`.

## Que hace en esta fase

- Expone `GET /health`.
- Expone `GET /devices`.
- Expone `POST /devices/discover`.
- Expone `POST /devices`.
- Expone `PATCH /devices/:id`.
- Expone `POST /printer/test-print`.
- Expone `POST /printer/print-ticket`.
- Expone `POST /cash-drawer/open`.
- Expone `GET /scale/current-weight`.
- Expone `POST /scanner/simulate`.
- Expone `GET /logs`.
- Expone WebSocket local en `/peripherals`.
- Usa modo `MOCK` por defecto.
- Guarda logs tecnicos solo en memoria.
- Genera preview textual para `POST /printer/test-print`.
- Genera preview textual para `POST /printer/print-ticket`.
- Retorna comandos ESC/POS conceptuales sin bytes reales.
- Retorna `profile` y `capabilities` en acciones de impresora y caja.
- Selecciona adapters MOCK mediante resolver interno.
- Permite registrar temporalmente dispositivos `NETWORK` y `USB` en memoria.
- Bloquea adapters reales por defecto con `PERIPHERALS_ENABLE_REAL_ADAPTERS=false`.
- Envia bytes ESC/POS basicos para `NETWORK + PRINTER` y envía documento a la cola del SO para `USB + PRINTER` cuando `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.

## Que NO hace todavia

- No conecta impresoras reales por defecto.
- No conecta balanzas reales.
- No conecta cajas reales.
- No usa ESC/POS real salvo `NETWORK + PRINTER` con feature flag explicito.
- No usa `serialport`.
- No usa HID real. USB requiere una cola de impresora/driver instalado en el SO.
- No envia bytes ESC/POS reales si el feature flag esta apagado.
- No descubre hardware automaticamente.
- No implementa Electron.
- No implementa Capacitor.
- No modifica ventas, inventario, caja ni facturacion.
- No usa base de datos.
- No depende del frontend ni del Backend API principal para simular hardware local.

## Instalacion de desarrollo

```bash
npm install
```

## Ejecucion local

```bash
npm run start:dev
```

Base URL:

```text
http://localhost:4050
```

WebSocket:

```text
ws://localhost:4050/peripherals
```

## Build

```bash
npm run build
```

## Windows x64 portable P0

El artefacto P0 es una carpeta portable para Windows x64. Lleva `node.exe`,
dependencias de runtime, Agent compilado, launcher y configuraciÃ³n local sin
secretos. El runtime Node va embebido; no requiere npm ni Git global en la
estaciÃ³n POS.

Crear y validar el artefacto desde un host Windows x64 de build:

```bash
npm run package:windows-x64
npm run validate:package:windows-x64
```

Salida:

```text
dist-package/windows-x64/ManusPeripheralAgent-win-x64-<version>/
```

El launcher `start-agent.cmd` usa `config/agent.config.local.json`. Por
defecto del artefacto QA:

- bind `127.0.0.1`;
- port `4050`;
- CORS por allow-list local configurable en `config/agent.config.local.json` o `PERIPHERALS_ALLOWED_ORIGINS`;
- adapters reales habilitados;
- USB RAW y corte certificado habilitados.

No contiene secrets. Logs y estado, incluido `agentInstallationId`, viven en:

```text
%LOCALAPPDATA%\\Manus\\PeripheralAgent\\logs
%LOCALAPPDATA%\\Manus\\PeripheralAgent\\state
```

Para este P0, abrir `start-agent.cmd` con doble clic. Tray, autostart y MSI
quedan fuera de alcance hasta el siguiente spike de lifecycle/packaging.

## Tests

```bash
npm test
```

## Probar impresora de red real

Solo hacerlo en ambiente autorizado y con una impresora ESC/POS de red conocida.

1. Confirmar IP de la impresora, por ejemplo `192.168.1.50`.
2. Confirmar puerto TCP, normalmente `9100`.
3. Activar flag:

```bash
set PERIPHERALS_ENABLE_REAL_ADAPTERS=true
set PERIPHERALS_MODE=MOCK
npm run start
```

4. Registrar el device `NETWORK` con `POST /devices`.
5. Ejecutar `POST /printer/test-print` con ese `deviceId`.

Para volver a MOCK:

```bash
set PERIPHERALS_ENABLE_REAL_ADAPTERS=false
set PERIPHERALS_MODE=MOCK
npm run start
```

Si el flag queda apagado, cualquier intento de usar el device `NETWORK` devuelve error controlado y no abre socket.

## Variables de entorno

| Variable | Default | Uso |
| --- | --- | --- |
| `PERIPHERALS_PORT` | `4050` | Puerto HTTP local. |
| `PERIPHERALS_BIND` | `127.0.0.1` | Bind HTTP local. No usar `0.0.0.0` salvo una entrega separada con hardening. |
| `PERIPHERALS_MODE` | `MOCK` | Modo del agent. En esta fase debe ser `MOCK`. |
| `PERIPHERALS_ENABLE_REAL_ADAPTERS` | `false` | Habilita adapters reales. Debe ser exactamente `true` para usar `NETWORK + PRINTER` o `USB + PRINTER`. |
| `PERIPHERALS_AGENT_NAME` | `manus-pos-peripheral-agent` | Nombre reportado por health. |
| `PERIPHERALS_ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:3029,http://localhost:5173` | Origenes permitidos para CORS y WebSocket. |
| `PERIPHERALS_LOG_LEVEL` | `INFO` | Nivel minimo conservado en logs tecnicos en memoria: `INFO`, `WARN`, `ERROR`. |
| `PERIPHERALS_LOG_LIMIT` | `500` | Maximo de logs en memoria. |
| `PERIPHERALS_PRINTER_WIDTH_CHARS` | `48` | Valor historico de ancho 80mm. En Fase 4.2 el ancho efectivo sale del `profileId` del dispositivo. |

Para produccion publica, `PERIPHERALS_ALLOWED_ORIGINS` debe incluir el origen HTTPS de la web:

```text
PERIPHERALS_ALLOWED_ORIGINS=https://www.apptiendamanus.space
```

Si se publican ambientes QA/staging, agregarlos separados por coma. No usar `*`.

## Comandos ESC/POS

En `MOCK`, estos comandos son representacion conceptual. No se convierten en bytes y no se envian a hardware.

En `NETWORK + PRINTER` con `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`, `NetworkEscposPrinterAdapter` convierte los comandos basicos y el preview textual a `Buffer` ESC/POS y lo envia por `net.Socket`.

- `INIT`
- `ALIGN_LEFT`
- `ALIGN_CENTER`
- `ALIGN_RIGHT`
- `BOLD_ON`
- `BOLD_OFF`
- `DOUBLE_HEIGHT_ON`
- `DOUBLE_HEIGHT_OFF`
- `FEED`
- `CUT`
- `CASH_DRAWER_PULSE`

## CORS local

El servicio permite:

- Requests con `Origin` incluido solo si el origen esta en `PERIPHERALS_ALLOWED_ORIGINS`.
- Requests sin `Origin`, para uso local con curl, Postman o pruebas tecnicas.
- Preflight `OPTIONS` para metodos `GET`, `POST`, `PATCH` y `OPTIONS`.

El servicio escucha por defecto en `127.0.0.1`; no se expone a red externa salvo que infraestructura/reverse proxy lo publique de forma explicita con HTTPS.

Smoke de preflight permitido:

```bash
curl -i -X OPTIONS http://localhost:4050/devices \
  -H "Origin: https://www.apptiendamanus.space" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

La respuesta esperada es `204` con `Access-Control-Allow-Origin: https://www.apptiendamanus.space`.

## Endpoints

### `GET /health`

```bash
curl http://localhost:4050/health
```

Respuesta:

```json
{
  "status": "ok",
  "agent": "manus-pos-peripheral-agent",
  "mode": "MOCK",
  "version": "0.1.0",
  "uptimeSeconds": 10
}
```

### `GET /devices`

```bash
curl http://localhost:4050/devices
```

Devuelve impresora, caja, balanza y scanner mock. Impresora y caja incluyen `profileId`.

### `POST /devices/discover`

```bash
curl -X POST http://localhost:4050/devices/discover
```

Redetecta dispositivos simulados y colas USB locales. En Windows consulta `Get-Printer` con puertos USB/DOT4USB; en Linux/macOS consulta CUPS con `lpstat -v`. Registra log tecnico y emite eventos `device.connected`.

### `POST /devices`

```bash
curl -X POST http://localhost:4050/devices \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"PRINTER\",\"name\":\"Impresora auxiliar MOCK\",\"terminalId\":\"local-terminal\"}"
```

Reglas:

- `type` debe ser `PRINTER`, `CASH_DRAWER`, `SCALE`, `SCANNER`, `DISPLAY` u `OTHER`.
- `terminalId` e `id` deben ser identificadores simples.
- `connectionType` usa `MOCK` si no se envia.
- Para `NETWORK`, `network.host` y `network.port` son obligatorios.

Registro temporal de impresora de red:

```bash
curl -X POST http://localhost:4050/devices \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"network-printer-001\",\"type\":\"PRINTER\",\"name\":\"Impresora red ESC/POS\",\"status\":\"CONNECTED\",\"connectionType\":\"NETWORK\",\"terminalId\":\"local-terminal\",\"profileId\":\"THERMAL_80MM\",\"network\":{\"host\":\"192.168.1.50\",\"port\":9100,\"timeoutMs\":3000}}"
```

El puerto tipico de impresoras ESC/POS de red es `9100`.

### `PATCH /devices/:id`

```bash
curl -X PATCH http://localhost:4050/devices/mock-printer-001 \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"DISCONNECTED\"}"
```

Reglas:

- `status` debe ser `CONNECTED`, `DISCONNECTED`, `ERROR` o `SIMULATED`.
- Si el dispositivo queda `DISCONNECTED` o `ERROR`, no se permiten acciones operativas.

### `POST /printer/test-print`

```bash
curl -X POST http://localhost:4050/printer/test-print \
  -H "Content-Type: application/json" \
  -d "{\"terminalId\":\"local-terminal\",\"deviceId\":\"mock-printer-001\"}"
```

Simula impresion de prueba y emite:

- `printer.job.started`
- `printer.job.completed`

Respuesta parcial:

```json
{
  "success": true,
  "jobId": "mock-print-job-...",
  "mode": "MOCK",
  "adapterName": "MockPrinterAdapter",
  "deviceId": "mock-printer-001",
  "terminalId": "local-terminal",
  "preview": "MANUS POS...",
  "commands": [
    {
      "name": "INIT",
      "description": "Initialize printer"
    },
    {
      "name": "CUT",
      "description": "Paper cut"
    }
  ],
  "profile": {
    "id": "THERMAL_80MM",
    "widthChars": 48,
    "paperWidthMm": 80,
    "supportsCut": true,
    "supportsCashDrawerPulse": true
  },
  "capabilities": {
    "adapterName": "MockPrinterAdapter",
    "mode": "MOCK",
    "connectionType": "MOCK",
    "supportsCut": true,
    "supportsCashDrawerPulse": true
  },
  "message": "Test print simulated successfully"
}
```

Si se usa `deviceId` de impresora `NETWORK` y el flag real esta apagado:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Real peripheral adapters are disabled. Enable PERIPHERALS_ENABLE_REAL_ADAPTERS=true to use them."
}
```

Si `PERIPHERALS_ENABLE_REAL_ADAPTERS=true` y la impresora de red responde correctamente:

```json
{
  "success": true,
  "jobId": "real-print-job-...",
  "mode": "REAL",
  "adapterName": "NetworkEscposPrinterAdapter",
  "deviceId": "network-printer-001",
  "terminalId": "local-terminal",
  "bytesSent": 1234,
  "message": "Print job sent to network ESC/POS printer"
}
```

### `POST /printer/print-ticket`

```bash
curl -X POST http://localhost:4050/printer/print-ticket \
  -H "Content-Type: application/json" \
  -d "{\"terminalId\":\"local-terminal\",\"deviceId\":\"mock-printer-001\",\"ticketType\":\"SALE\",\"content\":{\"businessName\":\"Castro & Cespedes\",\"documentNumber\":\"FV-MOCK-001\",\"cashier\":\"Caja 1\",\"items\":[{\"name\":\"Producto demo\",\"quantity\":2,\"unitPrice\":5000,\"total\":10000}],\"subtotal\":10000,\"taxes\":1900,\"discounts\":0,\"total\":11900,\"payments\":[{\"method\":\"EFECTIVO\",\"amount\":11900}],\"footer\":\"Gracias por su compra\"}}"
```

Soporta:

- `header`
- `businessName`
- `nit`
- `address`
- `cashier`
- `documentNumber`
- `saleNumber`
- `date`
- `items`
- `subtotal`
- `taxes`
- `discounts`
- `total`
- `payments`
- `footer`
- `title` y `lines` para compatibilidad con payloads simples.

No guarda el preview ni contenido completo del ticket en logs. Solo registra resumen tecnico, `commandCount` y `previewLength`.

### `POST /cash-drawer/open`

```bash
curl -X POST http://localhost:4050/cash-drawer/open \
  -H "Content-Type: application/json" \
  -d "{\"terminalId\":\"local-terminal\",\"deviceId\":\"mock-cashdrawer-001\",\"reason\":\"SALE_CASH_PAYMENT\"}"
```

Simula apertura de caja y emite `cashdrawer.opened`.

Respuesta parcial:

```json
{
  "success": true,
  "commandId": "mock-cashdrawer-open-...",
  "mode": "MOCK",
  "deviceId": "mock-cashdrawer-001",
  "terminalId": "local-terminal",
  "commands": [
    {
      "name": "INIT",
      "description": "Initialize printer"
    },
    {
      "name": "CASH_DRAWER_PULSE",
      "description": "Cash drawer pulse"
    }
  ],
  "profile": {
    "id": "THERMAL_80MM",
    "widthChars": 48,
    "paperWidthMm": 80,
    "supportsCut": true,
    "supportsCashDrawerPulse": true
  },
  "capabilities": {
    "adapterName": "MockCashDrawerAdapter",
    "mode": "MOCK",
    "connectionType": "MOCK",
    "supportsCut": true,
    "supportsCashDrawerPulse": true
  },
  "message": "Cash drawer pulse simulated successfully"
}
```

### `GET /scale/current-weight`

```bash
curl http://localhost:4050/scale/current-weight
```

Respuesta:

```json
{
  "deviceId": "mock-scale-001",
  "weight": 1.25,
  "unit": "kg",
  "stable": true,
  "timestamp": "ISO_DATE"
}
```

Emite `scale.weight.changed`.

### `POST /scanner/simulate`

```bash
curl -X POST http://localhost:4050/scanner/simulate \
  -H "Content-Type: application/json" \
  -d "{\"terminalId\":\"local-terminal\",\"deviceId\":\"mock-scanner-001\",\"code\":\"7701234567890\",\"format\":\"EAN13\"}"
```

Simula lectura de scanner y emite `scanner.code.read`.

### `GET /logs`

```bash
curl http://localhost:4050/logs
```

Devuelve logs tecnicos en memoria:

```json
[
  {
    "id": "log-...",
    "timestamp": "ISO_DATE",
    "level": "INFO",
    "source": "scanner",
    "event": "scanner.code_read.simulated",
    "message": "Scanner code read simulated successfully",
    "metadata": {}
  }
]
```

## Eventos WebSocket

Conexion:

```text
ws://localhost:4050/peripherals
```

Mensaje:

```json
{
  "event": "scanner.code.read",
  "data": {
    "terminalId": "local-terminal",
    "deviceId": "mock-scanner-001",
    "timestamp": "2026-06-04T00:00:00.000Z"
  }
}
```

Eventos soportados:

- `device.connected`
- `device.disconnected`
- `device.error`
- `printer.job.started`
- `printer.job.completed`
- `printer.job.failed`
- `cashdrawer.opened`
- `scale.weight.changed`
- `scanner.code.read`
- `agent.health.changed`

## Errores controlados

Casos rechazados:

- `deviceId` inexistente: `404`.
- Tipo incorrecto para endpoint: `400`.
- Dispositivo `DISCONNECTED`, `ERROR` o `SIMULATED`: `400`.
- Payload invalido: `400`.
- Adapter real con `PERIPHERALS_ENABLE_REAL_ADAPTERS` apagado: `400`.
- Device `NETWORK` sin `host`, sin `port` valido o con loopback: `400`.
- Error de socket TCP hacia impresora de red: `400`.

Las respuestas no incluyen stack trace.

## Limites actuales

- Logs en memoria: default `500`, configurable por `PERIPHERALS_LOG_LIMIT`.
- Eventos recientes en memoria: `100`.
- Preview termico: `48`, `32` o `40` caracteres segun `profileId`.
- No hay persistencia.
- No hay autenticacion local fuerte todavia.
- Hay descubrimiento de colas USB locales. No hay escaneo automatico de red ni identificacion garantizada de modelo/fabricante.
- No hay drivers nativos.
- `NETWORK + PRINTER` y `USB + PRINTER` son adapters reales implementados y estan apagados por defecto.
- Adapters reales `SERIAL`, `HID` y `BLUETOOTH` no estan implementados.

## Guardrails

- Mantener bind local en `127.0.0.1`.
- Mantener logs tecnicos en memoria.
- Mantener `PERIPHERALS_MODE=MOCK` como default.
- Mantener `PERIPHERALS_ENABLE_REAL_ADAPTERS=false` como default.
- No introducir drivers nativos.
- No importar codigo de `api/`, `web/` ni `backend-reporteria/`.
- No usar WebUSB, serialport, HID, Electron ni Capacitor; USB se limita a colas de impresion del SO.
