# Design: cajon monedero via impresora XP-80 LAN

## Contexto real

Discovery hecho sobre el codigo actual:

- `POST /cash-drawer/open` existe.
- `CashDrawerService` hoy solo usa `MockCashDrawerAdapter`.
- `PeripheralAdapterResolver.resolveCashDrawer()` no tiene ruta real para `NETWORK`.
- `renderThermalEscPos()` ya conoce el comando `CASH_DRAWER_PULSE`.
- `NetworkEscposPrinterAdapter` ya puede enviar buffers arbitrarios por socket TCP.
- `PrinterService` ya expone `mode`, `adapterName`, `network`, `bytesSent` y control de errores operativos.
- La UI admin ya persiste `printerDeviceId` y `cashDrawerDeviceId` por separado, pero el drawer sigue tratado como device propio.

## Gap arquitectonico

El gap no es el byte ESC/POS. El gap es la ruta funcional.

```text
Hoy:
cash drawer request
  -> drawer device
  -> mock adapter

Deseado:
cash drawer request
  -> cash drawer logico
  -> printerDeviceId canonical de la terminal
  -> printer adapter real
  -> drawer pulse por el mismo transport
```

## Decisiones

### 1. El cajon no sera un transport independiente

El cajon queda modelado como recurso logico ligado a una impresora fisica.

La configuracion canonical debe resolver algo como:

```text
terminal -> printerDeviceId -> network printer -> drawer pulse
```

No se duplica `host` ni `port` si ya pertenecen a la impresora.

### 2. El endpoint mantiene compatibilidad

`POST /cash-drawer/open` sigue vivo.

Para compatibilidad:

- si llega `printerDeviceId`, se usa ese device.
- si no llega, la terminal resuelta debe proveer el `printerDeviceId` canonical.
- `deviceId` viejo solo debe existir como compatibilidad temporal si la infra lo necesita.

### 3. El comando de cajon debe ser configurable

Se debe introducir un perfil de pulso con parametros claros:

- `pin` / `connector`
- `pulseOnMs`
- `pulseOffMs`

Defaults seguros para XP-80 / THERMAL_80MM.

### 4. Un request = un pulso

No reintentos repetitivos dentro de la operacion normal.
Si el request llega una vez, el transport manda un solo pulso.

### 5. Respuesta operativa

La respuesta debe dejar QA claro que ocurrio en hardware:

- `success`
- `mode`
- `adapterName`
- `terminalId`
- `printerDeviceId`
- `connectionType`
- `network.host`
- `network.port`
- `pulse`
- `bytesSent`

## Flujo propuesto

```text
Browser / POS
  -> POST /cash-drawer/open
  -> CashDrawerService
  -> resolve terminal config
  -> resolve printerDeviceId
  -> DevicesService.findRequired(PRINTER)
  -> PeripheralAdapterResolver.resolvePrinter()
  -> NetworkEscposPrinterAdapter
  -> ESC/POS drawer pulse
  -> TCP 192.168.123.100:9100
  -> XP-80 LAN
  -> RJ11/RJ12 cajon
```

## Estados y errores

- `printer device not found`
- `printer does not support cash drawer pulse`
- `network not reachable`
- `transport failure`

No se debe responder `success` si solo se construyeron bytes.

## UI minima

La pantalla admin puede mostrar:

- cajon conectado via impresora;
- impresora asociada;
- boton `Probar apertura`;
- ultimo resultado.

No se mete rediseño grande.
