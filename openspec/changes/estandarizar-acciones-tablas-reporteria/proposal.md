## Why

Las tablas de reporterÃ­a usan botones de acciÃ³n expansivos y `operations/sales`
usa un bloque de filtros distinto al patrÃ³n compacto de reporterÃ­a POS. Esto
reduce el espacio Ãºtil en terminales POS pequeÃ±as y produce una experiencia
visual inconsistente.

## What Changes

- Reutilizar el patrÃ³n visual de menÃº de tres puntos de Productos mediante un
  componente de Design System visual y agnÃ³stico al negocio.
- Aplicar el menÃº a las acciones existentes de POS, Caja (Cierres y Arqueos),
  Compras, Pedidos y Clientes.
- Homologar la presentaciÃ³n de filtros de `operations/sales` con
  `ReportLayout`, `ReportFilters` y `DateRangePicker`.

## Non-Goals

- No unificar catÃ¡logos de acciones ni cambiar callbacks, permisos, contratos,
  consultas, estados, reglas de disponibilidad o funcionalidades.
- No agregar columna Acciones a `operations/sales`, porque la ruta no la tiene.
- No modificar backend, base de datos, impresiÃ³n, Electron ni Peripheral Agent.

## Impact

Solo frontend visual: `web/components/design-system`, Productos y componentes
de tablas de reporterÃ­a/ventas operativas. Cada mÃ³dulo conserva sus acciones
particulares y su lÃ³gica existente.

