# Evidencia QA - Network ESC/POS feature flag - Fase 5

Fecha: 2026-06-04

## Objetivo

Preparar la primera integracion de impresion real ESC/POS para impresoras de red TCP/IP, controlada por feature flag y desactivada por defecto.

## Alcance

Incluido:

- `backend-perifericos/`.
- Documentacion en `docs/`.
- Tareas OpenSpec en `openspec/changes/add-pos-peripherals-platform/tasks.md`.
- Adapter real inicial solo para `NETWORK + PRINTER`.

Fuera de alcance confirmado:

- No `api/`.
- No `database/`.
- No `backend-reporteria/`.
- No ventas, inventario, caja, compras ni facturacion.
- No Electron.
- No Capacitor.
- No USB.
- No serialport.
- No HID.
- No `node-escpos`.

## Arquitectura

El flujo queda asi:

```text
POST /printer/test-print o /printer/print-ticket
  -> PrinterService
  -> PeripheralAdapterResolver
  -> MockPrinterAdapter si connectionType=MOCK
  -> NetworkEscposPrinterAdapter si connectionType=NETWORK y flag real activo
  -> net.Socket TCP/IP hacia host:port de impresora
```

El Backend API principal sigue desacoplado del hardware.

## Feature flag

Default:

```text
PERIPHERALS_MODE=MOCK
PERIPHERALS_ENABLE_REAL_ADAPTERS=false
```

Regla validada:

```text
Real peripheral adapters are disabled. Enable PERIPHERALS_ENABLE_REAL_ADAPTERS=true to use them.
```

Si el flag no es exactamente `true`, los adapters reales quedan bloqueados antes de abrir socket.

## Adapter real creado

Archivo:

- `backend-perifericos/src/shared/adapters/network-escpos-printer.adapter.ts`

Responsabilidad:

- Generar preview con el formatter termico existente.
- Convertir comandos minimos a bytes ESC/POS.
- Enviar `Buffer` por TCP socket.
- Reportar `bytesSent`.
- Devolver error controlado ante error o timeout de socket.

Comandos cubiertos:

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
- `CASH_DRAWER_PULSE` como byte mapping disponible, sin usar caja real en esta fase.

Codificacion:

- `utf8` para el preview textual.
- Code pages especificas quedan para perfiles futuros certificados.

## Seguridad

Validaciones agregadas:

- `network.host` requerido para `NETWORK`.
- `network.port` requerido y entre `1` y `65535`.
- `network.timeoutMs` default `3000`, permitido entre `250` y `30000`.
- Loopback bloqueado como destino de impresora: `localhost`, `127.*`, `0.0.0.0`, `::1`.
- No se loguea preview ni contenido completo del ticket.
- Logs solo guardan metadata tecnica como `adapterName`, `profileId`, `bytesSent`, `networkHost` y `networkPort`.

## Pruebas sin hardware real

Suite:

```text
cd backend-perifericos
npm.cmd test
```

Resultado:

```text
tests 33
pass 33
fail 0
```

Casos cubiertos:

- Flag real apagado bloquea `NETWORK`.
- `NetworkEscposPrinterAdapter` no se usa sin flag.
- Device `NETWORK` requiere host.
- Device `NETWORK` requiere port valido.
- Resolver selecciona `NetworkEscposPrinterAdapter` con flag true.
- Adapter convierte comandos minimos a `Buffer`.
- Adapter reporta `bytesSent` con socket mock.
- Error de socket devuelve error controlado.
- MOCK sigue pasando igual.
- Endpoints runtime existentes siguen pasando.

## Smoke MOCK

Comandos ejecutados contra `npm.cmd run start` en `backend-perifericos`:

```text
curl http://localhost:4050/health
curl http://localhost:4050/devices
POST /printer/test-print con mock-printer-001
POST /devices con network-printer-001
POST /printer/test-print con network-printer-001 y flag real apagado
```

Resultado sanitizado:

```text
health=200 mode=MOCK
devices=200 count=4
mockTest=201 mode=MOCK adapterName=MockPrinterAdapter
registerNetwork=201 connectionType=NETWORK host=192.168.1.50 port=9100
realDisabled=400 Real peripheral adapters are disabled. Enable PERIPHERALS_ENABLE_REAL_ADAPTERS=true to use them.
```

## Resultado build/test

```text
cd backend-perifericos
npm.cmd run build
npm.cmd test
```

Resultado:

```text
build PASS
test PASS - 33/33
```

## OpenSpec validate

Comando:

```text
openspec validate add-pos-peripherals-platform --type change --strict
```

Resultado:

```text
Change 'add-pos-peripherals-platform' is valid
```

## git diff --check

Resultado:

```text
PASS - exit 0
Nota: Git emitio warnings CRLF sobre archivos existentes fuera del alcance de Fase 5.
```

## Riesgos

- Modelos ESC/POS pueden requerir code page distinta a `utf8`.
- Red local puede bloquear puerto `9100`.
- Algunos equipos usan puerto distinto o firmware con comandos de corte diferentes.
- Sin autenticacion local fuerte, estos endpoints deben mantenerse en `127.0.0.1` y protegidos por CORS local.
- Esta fase no certifica modelos de impresora.

## Como probar con impresora real cuando se autorice

1. Confirmar IP LAN de la impresora, por ejemplo `192.168.1.50`.
2. Confirmar puerto TCP, normalmente `9100`.
3. Ejecutar:

```text
set PERIPHERALS_MODE=MOCK
set PERIPHERALS_ENABLE_REAL_ADAPTERS=true
npm.cmd run start
```

4. Registrar device `NETWORK`:

```json
{
  "id": "network-printer-001",
  "type": "PRINTER",
  "name": "Impresora red ESC/POS",
  "status": "CONNECTED",
  "connectionType": "NETWORK",
  "terminalId": "local-terminal",
  "profileId": "THERMAL_80MM",
  "network": {
    "host": "192.168.1.50",
    "port": 9100,
    "timeoutMs": 3000
  }
}
```

5. Ejecutar `POST /printer/test-print` con `deviceId=network-printer-001`.

Para volver a MOCK:

```text
set PERIPHERALS_ENABLE_REAL_ADAPTERS=false
set PERIPHERALS_MODE=MOCK
npm.cmd run start
```

## Confirmacion MOCK default

Confirmado:

- `PERIPHERALS_MODE=MOCK` sigue siendo default.
- `PERIPHERALS_ENABLE_REAL_ADAPTERS=false` sigue siendo default.
- `mock-printer-001` imprime preview MOCK sin abrir socket.
- Un device `NETWORK` queda bloqueado si no existe feature flag explicito.
