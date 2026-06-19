## Why

El reporte de turno actual resuelve una sola caja abierta y la UI no permite elegir entre varias sesiones abiertas del mismo tenant. Para `SUPER_USER`, esto oculta el contexto operativo real cuando hay varias sucursales, terminales o cajas registradoras trabajando al mismo tiempo.

## What Changes

- Ampliar `GET /api/reports/current-shift` para exponer sesiones abiertas seleccionables sin romper la respuesta existente.
- Aceptar filtros explicitos de sesion abierta: `branchId`, `terminalId`, `cashRegisterId`, `cashSessionId`, `page`, `pageSize` y `search`.
- Mantener scope seguro por tenant, rol, sucursal y usuario operativo.
- Mostrar en `/{tenant}/finance/current-shift` un selector de caja abierta cuando haya multiples sesiones disponibles.
- Mostrar contexto visible de sucursal, terminal, caja, usuario de apertura, fecha/hora y estado `OPEN`.
- Mantener comportamiento actual para `USER` y roles limitados.
- Agregar tests y evidencia QA enfocada en multiples cajas abiertas.

## Capabilities

### New Capabilities
- `current-shift-multisession-selection`: Seleccion segura de sesion de caja abierta en el reporte de turno actual para roles con alcance multi-sucursal/multi-terminal.

### Modified Capabilities

## Impact

- `backend-reporteria`: contrato de `GET /api/reports/current-shift`, filtros adicionales, listado `availableCashSessions`, tests de scope y seleccion.
- `web`: cliente de reporteria, tipos y UI de `finance/current-shift`.
- `docs`: evidencia QA del cambio.
- `api`: sin cambios esperados.
- Base de datos: sin SQL esperado.
- Seguridad: no ampliar permisos, no relajar guards, no fuga cross-tenant.
