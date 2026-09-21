## Why

Las operaciones POS, inventario, compras y reportes tienen contratos funcionales existentes, pero sus pantallas no presentan la información con una experiencia operativa consistente. Esta mejora alinea cinco flujos aprobados con un patrón POS-first, preservando multi-tenant, permisos y contratos salvo extensiones explícitas demostradas por el backend.

## What Changes

- Ordenar alfabéticamente los clientes del modal Cobrar venta sin alterar búsqueda ni selección.
- Rediseñar el dashboard de inventario con datos reales del contrato existente y añadir costo total de inventario desde backend usando la fuente de costo vigente.
- Formalizar navegación responsive global: hamburguesa y drawer en resoluciones de hasta 1280 px; sidebar persistente por encima de 1280 px.
- Capturar y persistir el número de factura del proveedor durante la recepción atómica de compras, incluyendo fecha de factura si el modelo la soporta sin duplicar datos existentes.
- Rediseñar el reporte POS para ventas del día, filtros compactos, resumen, paginación existente y habilitación de documento electrónico solo con aceptación DIAN.
- Crear un patrón reusable de reportes para futuras migraciones graduales.

## Capabilities

### New Capabilities

- `operational-pos-improvements`: Clientes POS, dashboard de inventario, recepción de compras y reporte POS bajo la experiencia operativa aprobada.
- `responsive-operational-navigation`: Regla global de navegación responsive compartida por Web y Electron.
- `standard-report-layout`: Composición reusable para nuevos reportes y reportes que se migren posteriormente.

### Modified Capabilities

- Ninguna identificada todavía. Se confirmará contra `openspec/specs/` durante la inspección de contratos.

## Impact

- `web/modules/pos`, `web/modules/inventory`, `web/modules/reporteria`, layout compartido y design system.
- `api/src/modules/inventory` y migración SQL solo si la recepción o costo requieren una columna realmente ausente.
- Contratos de dashboard de inventario y recepción de compras, manteniendo compatibilidad hacia atrás.
- Tests focalizados de frontend/backend y validación de OpenSpec, lint y builds relevantes.
