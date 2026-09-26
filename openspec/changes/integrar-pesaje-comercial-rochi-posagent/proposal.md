## Why

Manus ya guarda el modelo de venta `UNIT`, `WEIGHT` y `BOTH`, pero el flujo de `/pos` todavía consume una balanza MOCK y no vincula una lectura física fresca con la terminal, el producto ni la venta. El driver ROCHI Windows ya fue validado de forma independiente; ahora hace falta definir, sin implementarlo todavía, el contrato comercial seguro para solicitar peso bajo demanda.

## What Changes

- Reutilizar `saleType` y `measurementUnit` existentes para distinguir ventas por unidad, peso y elección unidad/peso.
- Definir el flujo POS para que `UNIT` no dependa de una balanza, `WEIGHT` solicite pesaje y `BOTH` permita elegir explícitamente el modo de venta.
- Definir estados visibles para terminal sin balanza, balanza deshabilitada, dispositivo disponible, desconexión, error, unidad no verificada, lectura pendiente e invalidación.
- Sustituir el uso comercial implícito del MOCK por una lectura REAL bajo demanda del Peripheral Agent cuando exista configuración autorizada.
- Mantener separadas las lecturas MOCK de las lecturas REAL y no interpretar `stable: true` como estabilidad metrológica ROCHI.
- Exigir unidad física KG verificada para el alcance inicial ROCHI; no inferir KG o LB desde la trama serial.
- Definir frescura, invalidación, unicidad, concurrencia, terminal propietaria y trazabilidad de cada captura.
- Reutilizar el pricing, carrito, impuestos, descuentos, inventario y venta existentes sin duplicar el cálculo comercial.
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
