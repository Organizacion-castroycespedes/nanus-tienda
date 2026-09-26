## Why

Manus ya guarda el modelo de venta `UNIT`, `WEIGHT` y `BOTH`. El flujo de `/pos` conserva controles históricos de balanza MOCK, pero debe ocultarlos cuando la terminal no tiene configuración efectiva y no puede usar una lectura como evidencia comercial REAL. El driver ROCHI Windows ya fue validado de forma independiente; este cambio define el contrato comercial seguro para solicitar peso bajo demanda.

## What Changes

- Reutilizar `saleType` y `measurementUnit` existentes para distinguir ventas por unidad, peso y elección unidad/peso.
- Definir el flujo POS para que `UNIT` no dependa de una balanza, `WEIGHT` solicite pesaje y `BOTH` permita elegir explícitamente el modo de venta.
- Ocultar por completo los elementos permanentes de balanza en `/pos` cuando la terminal no tenga balanza asignada y habilitada; mostrar avisos solo en el intento contextual de una operación que requiere peso.
- Definir estados visibles para balanza configurada, desconexión, error, unidad no verificada, lectura pendiente e invalidación, sin mostrar `Balanza lista` por causa del MOCK.
- Sustituir el uso comercial implícito del MOCK por una lectura REAL bajo demanda del Peripheral Agent cuando exista configuración autorizada.
- Mantener separadas las lecturas MOCK de las lecturas REAL y no interpretar `stable: true` como estabilidad metrológica ROCHI.
- Exigir unidad física KG verificada para el alcance inicial ROCHI; no inferir KG o LB desde la trama serial.
- Emitir una autorización backend de corta duración vinculada a tenant, sucursal, terminal, sesión POS, producto, operación y dispositivo; impedir reutilización.
- Transportar evidencia de captura de forma transitoria, con expiración, origen REAL, consumo único y validación backend atómica con la operación comercial, sin persistencia permanente inicial.
- Usar apertura, lectura nueva y cierre por operación; dejar la sesión temporal como evolución posterior condicionada a evidencia operativa.
- Definir frescura, invalidación, unicidad, concurrencia, terminal propietaria y trazabilidad de cada captura.
- Reutilizar el pricing, carrito, impuestos, descuentos, inventario y venta existentes sin duplicar el cálculo comercial.
- Especificar aceptación funcional para el producto `Contra Muslo`, reportado por el operador como `BOTH` con unidad `KG`, sin alterar ni afirmar la verificación de sus datos persistidos.
- Mantener fuera de alcance la homologación metrológica, Linux, empaquetado multiplataforma y la habilitación inmediata de ventas reales.

## Capabilities

### New Capabilities

- `pesaje-comercial-posagent`: Contrato comercial para capturar peso bajo demanda entre Manus POS y Peripheral Agent, incluyendo producto, terminal, unidad verificada, frescura, origen, estados, seguridad y QA.

### Modified Capabilities

- Ninguna. El modelo de producto existente no cambia; este change define cómo se consume en POS.

## Impact

- POS web/Electron: reutilización y adaptación de `PosScreen`, `CartSaleModal` y contratos de periféricos.
- Backend comercial: validación de terminal, producto, cantidad, sesión POS y evidencia de captura antes de confirmar ventas pesables.
- Peripheral Agent: adaptación futura de `ScaleService` MOCK al driver ROCHI ya validado, conservando `DevicesService`, eventos y transporte local existentes.
- Configuración: uso de `enableScale`, `scaleDeviceId`, modo y origen de configuración por tenant, sucursal y terminal.
- QA: simulador, pruebas de integración POS-Agent y QA físico posterior, sin declarar homologación metrológica.
- Dependencia: `integrar-balanza-rochi-a01e` permanece independiente y conserva pendiente su tarea 4.6.
