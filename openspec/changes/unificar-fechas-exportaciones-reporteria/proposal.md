## Why

Los reportes de POS, caja, compras, pedidos y ventas operativas interpretan fechas de calendario como medianoche UTC. Para el negocio en `America/Bogota`, esto desplaza el período a `19:00–19:00` y causa diferencias entre la pantalla y los documentos exportados. El alcance también carece de un límite uniforme de consulta y de una respuesta clara sobre el período efectivo.

Hallazgo QA confirmado el 26/09/2026: el PDF POS mostró correctamente la hora Bogotá, mientras Excel desplazó cinco horas los límites y las fechas de venta. La causa es la serialización de instantes UTC como objetos `Date` de ExcelJS sin zona de presentación.

## What Changes

- Definir un contrato común de período calendario para los seis reportes incluidos.
- Convertir fechas locales del negocio a intervalos `timestamptz` semiabiertos, preservando precisión subsegundo.
- Aplicar por defecto el día actual hasta el instante de consulta cuando no haya fechas explícitas.
- Aplicar dinámicamente el límite de los últimos tres meses calendario, sin fechas futuras, con validación en frontend y backend.
- Mantener aislamiento por tenant y sucursal, filtros de estado y semántica de caja existentes.
- Asegurar que pantalla, PDF y Excel compartan filtros efectivos, registros, agregaciones y snapshot de exportación.
- Mostrar período efectivo, zona horaria e instante de generación en reportes y exportaciones.
- Agregar pruebas para calendarios, límites, validación, precisión, aislamiento, paginación y paridad de exportación.
- Representar timestamps en Excel como texto formateado en la zona efectiva, con zona horaria explícita, para evitar que Excel aplique una conversión implícita.

## Capabilities

### New Capabilities

- `reporting-date-contract`: Contrato común para períodos calendario, zona horaria, límite móvil y metadatos efectivos.
- `reporting-export-parity`: Paridad de pantalla y exportaciones para reportes completos con snapshot estable.

### Modified Capabilities

<!-- No existing capability has a runtime requirement changed by this scope. -->

## Impact

- Frontend `web/modules/reporteria`, `web/modules/operational-sales`, `DateRangePicker` y servicios/hooks de reportes.
- Backend `backend-reporteria` en servicios, controladores, adaptadores SQL, tipos y plantillas PDF/Excel.
- Pruebas unitarias y de integración existentes de frontend y backend.
- No se prevén migraciones de base de datos ni cambios a operaciones transaccionales, cierres históricos, facturación electrónica, Electron o Peripheral Agent.
