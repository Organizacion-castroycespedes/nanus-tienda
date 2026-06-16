## Why

La gestion operativa diaria queda dispersa entre POS, pedidos, compras, caja y reporteria historica. USER y ADMIN necesitan una vista de turno actual para revisar solo lo asociado a su caja abierta, sin mezclar datos historicos ni cajas ajenas.

## What Changes

- Agregar un modulo operativo "Gestion del turno" para la caja abierta actual.
- Exponer desde `backend-reporteria` un endpoint consolidado de turno actual, filtrado por tenant, sucursal, terminal, usuario y caja abierta autorizada.
- Mostrar en web una vista con resumen del turno y pestanas para ventas POS, pedidos, compras, movimientos, arqueo y tickets.
- Reutilizar endpoints de ticket existentes para ver, descargar e imprimir cuando el documento exista.
- Mostrar estado controlado y CTA a `/pos/select-context` cuando no exista caja abierta.
- Mantener validaciones multi-tenant y de alcance por rol en backend.

## Capabilities

### New Capabilities
- `current-shift-operations`: Consulta operativa de caja abierta actual con resumen, pestanas de movimientos/documentos y acciones de tickets.

### Modified Capabilities

## Impact

- `backend-reporteria`: nuevo endpoint de reportes operativos de turno actual y tests de autorizacion/scope.
- `web`: nueva ruta operativa de finanzas y acceso desde navegacion/caja.
- `api`: sin cambios esperados salvo que el diagnostico confirme que falta contrato de datos indispensable.
- Seguridad: alcance por tenant, sucursal, terminal, usuario y caja abierta actual; no cross-tenant.
- QA: nueva evidencia manual en `docs/evidencia-qa-gestion-operativa-turno-caja-actual.md`.
