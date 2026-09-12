# Evidencia — dashboard de Gestión Operativa

## Alcance

`GET /api/operations/dashboard` es una lectura agregada. Reusa
`OperationalSaleScopeService`: USER queda limitado a su turno OPEN actual;
ADMIN a sucursales autorizadas; SUPER_USER a sucursales activas del tenant;
SUPER_ADMIN conserva la política global existente. `branchId` solo reduce el
alcance ya resuelto.

## Fórmulas

- `totalSalesCount`, `totalSalesAmount` y `averageTicket` salen de `sales`.
- Los estados FE usan un único `electronic_documents` actual por venta, para
  no contar duplicados de reintentos.
- `electronicAcceptanceRate` = documentos actuales ACCEPTED / documentos
  electrónicos actuales. Denominador cero devuelve `0`.
- `documentsRequiringAttention` cuenta REJECTED, TECHNICAL_ERROR y
  MANUAL_REVIEW.
- La tendencia agrupa por día y mantiene separados ventas y documentos FE.

## UI y QA manual pendiente

`/{tenant}/operations` es el dashboard. `/{tenant}/operations/sales` es la
lista dedicada. Hay selector de periodo, selector de sucursal solo cuando
corresponde, estados de carga/error/sin datos y enlaces a ventas filtradas.

Pendiente: captura y validación visual en desktop POS, tablet y Electron con
datos QA autorizados. Este cambio no ejecuta migraciones, seeds, FactuCore,
DIAN ni workers.
