## Why

Manus POS ya tiene un PeripheralAgent con soporte genérico para impresoras de red, pero la impresora Digital POS DIG-E200I no esta modelada ni documentada como capacidad propia. En la prueba fisica actual la impresora usa DHCP, por eso no se debe fijar la IP observada como si fuera permanente.

## What Changes

- Reusar el `PeripheralAgent` existente para integrar la impresora Digital POS DIG-E200I por LAN/TCP RAW como MVP.
- Modelar la impresora con configuracion configurable de `host` y `port`, sin hardcodear `192.168.89.22` ni ninguna IP de laboratorio.
- Mantener `9100` como puerto por defecto valido solo como conveniencia de configuracion, no como valor obligado.
- Documentar el puerto de consulta `4000` como dato fisico observado, pero sin implementar protocolo de consulta todavia.
- Definir una ruta de prueba de conexion e impresion para validar transporte TCP antes de cerrar capacidades ESC/POS avanzadas.
- Agregar checklist QA fisica para networking, impresion, recovery, performance y validacion de DHCP.

## Capabilities

### New Capabilities

- `digital-pos-dig-e200i-network-printer`: configuracion e impresion LAN/TCP RAW para Digital POS DIG-E200I dentro de `backend-perifericos`.

### Modified Capabilities

- None.

## Impact

- Afecta `backend-perifericos` en configuracion de impresora, resolucion de adapter, logging y pruebas.
- Afecta `web/domains/peripherals` en la configuracion y registro de impresoras de red si se expone esta marca/modelo en UI.
- Afecta contratos de pruebas de impresora y documentacion tecnica.
- No requiere migraciones ni cambios de base de datos para el MVP.
