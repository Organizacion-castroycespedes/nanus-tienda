# Evidencia QA backend-perifericos hardening - Fase 2.1

## Objetivo

Fortalecer `backend-perifericos/` en modo `MOCK/SIMULATOR` antes de integrarlo con frontend Manus POS.

## Alcance

Incluido:

- Seguridad local basica por CORS.
- Requests sin `Origin` para curl/Postman.
- Validacion runtime de payloads.
- Errores controlados para dispositivo inexistente, tipo incorrecto y estado no operativo.
- Logs tecnicos en memoria con limite.
- WebSocket local defensivo.
- Tests automatizados ampliados.
- README actualizado.

Fuera de alcance:

- Hardware real.
- ESC/POS real.
- `serialport`.
- USB/HID real.
- Integracion frontend.
- Cambios en Backend API principal.
- Cambios en base de datos.

## Archivos modificados o creados

```text
backend-perifericos/.env.example
backend-perifericos/README.md
backend-perifericos/src/main.ts
backend-perifericos/src/modules/cash-drawer/cash-drawer.service.ts
backend-perifericos/src/modules/devices/devices.service.ts
backend-perifericos/src/modules/events/events.service.ts
backend-perifericos/src/modules/logs/logs.service.ts
backend-perifericos/src/modules/printer/printer.service.ts
backend-perifericos/src/modules/scale/scale.service.ts
backend-perifericos/src/modules/scanner/scanner.service.ts
backend-perifericos/src/shared/config/peripherals.config.ts
backend-perifericos/src/shared/filters/sanitized-http-exception.filter.ts
backend-perifericos/src/shared/utils/request-validation.util.ts
backend-perifericos/test/mock-simulator.spec.ts
docs/evidencia-qa-backend-perifericos-hardening-fase-2-1.md
openspec/changes/add-pos-peripherals-platform/tasks.md
```

## Comandos ejecutados

Desde `backend-perifericos/`:

```powershell
npm.cmd run build
npm.cmd test
```

Desde raiz:

```powershell
openspec.cmd validate add-pos-peripherals-platform --type change --strict
git diff --check
git status --short
```

Smoke local controlado:

```powershell
GET  http://localhost:4050/health
GET  http://localhost:4050/devices
POST http://localhost:4050/devices/discover
POST http://localhost:4050/printer/test-print
POST http://localhost:4050/printer/print-ticket
POST http://localhost:4050/cash-drawer/open
GET  http://localhost:4050/scale/current-weight
POST http://localhost:4050/scanner/simulate
GET  http://localhost:4050/logs
ws://localhost:4050/peripherals
```

## Resultado build

```text
npm.cmd run build
Resultado: PASS
tsc -p tsconfig.build.json sin errores.
```

## Resultado tests

```text
npm.cmd test
Resultado: PASS
tests 18
pass 18
fail 0
```

Cobertura funcional validada por tests:

- `GET /health`.
- `GET /devices`.
- `POST /devices/discover`.
- `POST /printer/test-print`.
- `POST /printer/print-ticket`.
- `POST /cash-drawer/open`.
- `GET /scale/current-weight`.
- `POST /scanner/simulate`.
- `GET /logs`.
- CORS con origen permitido.
- Requests sin `Origin`.
- `deviceId` inexistente.
- Tipo de dispositivo incorrecto.
- Dispositivo desconectado.
- Payload invalido.
- Limite de logs en memoria.

## Resultado smoke HTTP

### Health

```json
{
  "status": "ok",
  "agent": "manus-pos-peripheral-agent",
  "mode": "MOCK",
  "version": "0.1.0",
  "uptimeSeconds": 38
}
```

### Devices

```json
[
  {
    "id": "mock-printer-001",
    "type": "PRINTER",
    "name": "Impresora termica MOCK",
    "status": "CONNECTED",
    "connectionType": "MOCK",
    "terminalId": "local-terminal"
  }
]
```

Nota: respuesta real incluye tambien caja, balanza y scanner.

### Test print

```json
{
  "success": true,
  "jobId": "mock-print-job-...",
  "message": "Test print simulated successfully"
}
```

### Print ticket

```json
{
  "success": true,
  "jobId": "mock-ticket-job-...",
  "message": "Ticket print simulated successfully"
}
```

### Cash drawer

```json
{
  "success": true,
  "commandId": "mock-cashdrawer-open-...",
  "message": "Cash drawer open simulated successfully",
  "timestamp": "2026-06-04T01:55:18.453Z"
}
```

### Scale

```json
{
  "deviceId": "mock-scale-001",
  "weight": 1.25,
  "unit": "kg",
  "stable": true,
  "timestamp": "2026-06-04T01:55:18.470Z"
}
```

### Scanner

```json
{
  "success": true,
  "code": "7701234567890",
  "format": "EAN13",
  "timestamp": "2026-06-04T01:55:18.489Z"
}
```

### Payload invalido

`POST /scanner/simulate` con `code = ""`:

```text
HTTP 400
```

La respuesta esta sanitizada y no expone stack trace.

### Logs

`GET /logs` devuelve logs tecnicos en memoria con:

- `id`.
- `timestamp`.
- `level`.
- `source`.
- `event`.
- `message`.
- `metadata`.

## Resultado WebSocket

Conexion probada:

```text
ws://localhost:4050/peripherals
```

Evento recibido al ejecutar `POST /scanner/simulate`:

```json
{
  "event": "scanner.code.read",
  "data": {
    "terminalId": "local-terminal",
    "deviceId": "mock-scanner-001",
    "code": "ABC123",
    "format": "QR",
    "timestamp": "2026-06-04T01:56:01.076Z"
  }
}
```

## Validacion OpenSpec

```text
openspec.cmd validate add-pos-peripherals-platform --type change --strict
Resultado: PASS
Change 'add-pos-peripherals-platform' is valid
```

## Resultado git diff check

```text
git diff --check
Resultado: PASS
Sin salida.
```

## Riesgos pendientes

| Riesgo | Estado |
| --- | --- |
| No hay autenticacion local fuerte para comandos sensibles. | Pendiente fase futura. |
| Logs son memoria local y se pierden al reiniciar. | Aceptado para MOCK. |
| WebSocket raw cubre emision server-to-client, no protocolo completo cliente. | Aceptado para MOCK. |
| No hay discovery real de hardware. | Fuera de alcance. |
| No hay drivers reales. | Fuera de alcance. |

## Confirmaciones

- No se toco `api/`.
- No se toco `web/`.
- No se toco `backend-reporteria/`.
- No se toco `database/`.
- No se crearon migraciones.
- No se instalaron drivers reales.
- No se conecto hardware real.
- No se agrego ESC/POS real.
- No se agrego `serialport`.
- No se agrego USB/HID real.
- No se integro frontend.
- El proceso local usado para smoke fue detenido al finalizar.
