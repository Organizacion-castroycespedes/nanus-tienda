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

## Fase 2C.1 documental: confianza Agent--terminal--SCALE

Esta fase documenta la extension minima para detectar, probar, asociar, habilitar, revocar y consultar una ROCHI desde la instalacion de perifericos y la operacion POS. No implementa autenticacion, migraciones, canal nuevo, lectura comercial ni cambios de datos.

Hechos confirmados:

- `terminal_devices` registra una instalacion Agent por `installation_id` y `terminal_device_bindings` vincula esa instalacion con una terminal del mismo tenant.
- `pos_terminal_peripheral_settings.scale_device_id` referencia el ID local del `PeripheralDevice`; hoy no existe una relacion persistente entre ese ID y `terminal_devices`.
- `PeripheralDevice` y su registro JSON local exponen tipo, estado, `terminalId`, `connectionType` y descriptor opcional; esto no autentica mensajes ni demuestra posesion fisica.
- El Agent escucha por loopback/CORS permitido y `ScaleController` acepta `terminalId` y `deviceId` del cliente; esos campos no son prueba suficiente de autorizacion cloud.

Propuesta: reutilizar la identidad autenticada de la instalacion y el binding cloud existentes, pero agregar una relacion verificable y un mecanismo de desafio/respuesta o credencial revocable antes de aceptar una declaracion SCALE. La eleccion concreta de credencial requiere aprobacion de seguridad. Ningun `installationId`, `terminalId`, `deviceId`, COM, PnP, USB, SERIAL o VID/PID aislado prueba identidad o posesion.

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

Fase 2B implementa una extension aditiva minima en `resolve-current`: `scale.assignment`, `scale.classification` y `scale.deviceId`. El backend clasifica `mock-scale-001` como `MOCK` y cualquier otra asignacion como `UNKNOWN`; no inventa `REAL`. La vinculacion verificable tenant--sucursal--terminal--instalacion Agent--dispositivo SCALE, la autorizacion corta y la prueba de posesion del Agent siguen pendientes. No se acepta `UNKNOWN`, un `scaleDeviceId` no vacio ni `source=CONFIGURED` como prueba REAL.

## Fase 2A documental: identidad y vinculación REAL/MOCK

Esta fase solo precisa el diseño. No implementa API, Agent, persistencia, UI administrativa ni lectura física.

Hechos confirmados en el repositorio:

- `pos_terminal_peripheral_settings` guarda `scale_device_id` y `enable_scale` por terminal.
- `pos_terminals` relaciona la terminal comercial con tenant y sucursal y expone modo `MOCK|REAL|HYBRID`.
- `terminal_devices` y `terminal_device_bindings` identifican instalaciones cloud del Peripheral Agent y sus vínculos con terminales; `installationId` no es credencial ni prueba de posesión.
- El registro local del Agent distingue `DeviceType.SCALE`, `ConnectionType.MOCK`, `SERIAL` y `USB`, y documenta `mock-scale-001` como fixture MOCK.
- `resolve-current` devuelve configuración, IDs y flags, pero no origen físico confiable, identidad de instalación Agent, PnP/COM, unidad verificada ni estado conectado.
- `ScaleService` comercial aún devuelve una lectura simulada de `1.25 kg`; el driver ROCHI no está conectado a ese módulo.

Brecha y propuesta: antes de habilitar peso REAL, debe existir una vinculación verificable tenant--sucursal--terminal--instalación Agent--dispositivo SCALE. La extensión de `resolve-current`, la autorización corta y la prueba de posesión del Agent quedan como contratos propuestos y tareas futuras. No se acepta un `scaleDeviceId` no vacío ni `source=CONFIGURED` como prueba REAL.
