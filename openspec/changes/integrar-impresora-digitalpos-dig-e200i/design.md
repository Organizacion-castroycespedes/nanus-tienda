## Context

La Digital POS DIG-E200I es una impresora termica POS con interfaz USB + LAN. Para este cambio, la ruta prioritaria es LAN/TCP RAW porque el equipo de prueba recibe IP por DHCP y la IP observada puede cambiar. El frontend no debe abrir sockets directos al hardware.

## Arquitectura actual

El repo ya tiene un PeripheralAgent real en `backend-perifericos` con:

- HTTP local en NestJS.
- WebSocket local para eventos.
- Modelo `PeripheralDevice` con `connectionType` y `network`.
- `PrinterAdapter` y `NetworkEscposPrinterAdapter`.
- `DeviceProfile` para perfiles termicos.
- Renderizador ESC/POS compartido para tickets y comandos basicos.

El flujo actual para impresoras de red es:

```text
Web / Electron
  -> PeripheralAgent HTTP local
  -> PeripheralDevice.network.host + network.port
  -> NetworkEscposPrinterAdapter
  -> TCP socket
  -> impresora
```

## Decision

La integracion de DIG-E200I se hara reusando la ruta de red ya existente, no creando un driver nuevo por modelo.

Puntos clave:

- El modelo de impresora se registra como `PRINTER`.
- La conexion se resuelve como `NETWORK`.
- El host y el puerto quedan configurables.
- `9100` se usa como default tecnico de conveniencia para el MVP.
- La IP observada en la prueba fisica no se vuelve default ni valor fijo.
- Las capacidades ESC/POS especificas quedan en estado no confirmado hasta QA fisica.

## Alternatives considered

### Driver del sistema operativo

Rechazado para el MVP. Introduce dependencia del SO y no encaja con la ruta TCP RAW ya certificable.

### USB directo

No es prioridad. La impresora declara USB + LAN, pero la primera entrega debe cerrar la ruta de red.

### TCP RAW 9100

Elegido para el MVP. Ya existe transporte de red reusable y es portable entre Windows y Linux.

### Impresion directa desde navegador

Rechazada. El navegador no debe hablar directo con el hardware local.

### PeripheralAgent

Elegido. Mantiene el hardware encapsulado fuera del frontend.

## Recommended approach

Reusar `PeripheralAgent` + `NetworkEscposPrinterAdapter` + config de `PeripheralDevice.network`, y agregar solo el perfil/datos/documentacion que faltan para DIG-E200I.

Compatibilidad hacia atras:

- `manufacturer` y `model` siguen siendo opcionales para impresoras genericas.
- Un registro historico sin esos metadatos sigue cargando y guardando sin inventar `Digital POS / DIG-E200I`.
- XPrinter y otras impresoras existentes conservan su identidad y su flujo actual.

## Risks

- El dialecto ESC/POS real puede no coincidir con lo asumido por el renderer.
- El encoding puede necesitar ajuste para caracteres latinos.
- El corte total/parcial puede no comportarse igual en firmware distinto.
- El cajon monedero puede requerir validacion fisica.
- DHCP puede cambiar la IP y romper una configuracion fija.
- El puerto de consulta `4000` puede ser propietario o no documentado.
- Windows y Linux pueden exponer diferencias de spooler o red.
- Un timeout de red bajo puede producir falsos negativos en impresoras lentas.

## Rollback

El rollback debe ser simple:

- deshabilitar o retirar el perfil DIG-E200I;
- dejar intactos los demas perfiles y adaptadores de impresora;
- conservar la configuracion generica de NETWORK para otros modelos.
