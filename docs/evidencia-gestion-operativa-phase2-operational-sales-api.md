# Evidencia — Gestión Operativa Phase 2: Operational Sales API

## Alcance

Implementado backend para lista y detalle operativo. No se implementó sales
UI, acciones destructivas, retry fiscal ni mutaciones FactuCore.

## Rutas

- `GET /api/operations/sales`
- `GET /api/operations/sales/:saleId`

Ambas rutas usan `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard` y permiso
existente `POS` en nivel `READ`.

## Scope y seguridad

`OperationalSaleScopeService` resuelve el scope antes de consultar datos:

- `USER`: tenant, branch y única sesión de caja `OPEN` actual.
- `ADMIN`: tenant y branch autorizada, sin requerir turno abierto.
- `SUPER_USER`: tenant y branches activas autorizadas.
- `SUPER_ADMIN`: política global existente.

El detalle valida el UUID directamente contra el scope. Los filtros de
tenant, branch, caja y usuario no pueden ampliar acceso.

## Contrato

`OperationalSalesRepository` recibe scope resuelto. Lista usa paginación,
sorting allowlist (`createdAt`, `total`, `status`) y máximo `100` por página.
El detalle devuelve resumen de venta, cliente, branch, operador, caja,
items, pagos y proyección FE segura.

La proyección FE usa `electronic_documents` y no llama proveedor. Documentos
duplicados se muestran como `AMBIGUOUS` en lista y el detalle falla cerrado.

## Performance y DB

Lista usa joins/lateral y una sola consulta de datos más una cuenta total;
no hace consulta por fila. Detalle hace consultas acotadas para items y pagos.
No se agregaron migraciones. Se reutilizan columnas e índices existentes;
Phase 3 debe confirmar planes con `EXPLAIN` si amplía filtros.

## Validación

- Phase 1 y seguridad/auth/sales: `83/83 PASS`.
- Phase 2 service: `3/3 PASS`.
- API build: `PASS`.
- OpenSpec change strict: `PASS`.
- OpenSpec all: `90 PASS`, 1 heredado en
  `corregir-handoff-agent-local-perifericos-electron`.
- `git diff --check`: `PASS`.
- Secret scan de archivos trackeados: sin patrones sensibles.

## Pendiente

Phase 3: shell frontend, navegación protegida, lista visual, filtros,
badges y detalle. FE sigue siendo propiedad del módulo electrónico.
