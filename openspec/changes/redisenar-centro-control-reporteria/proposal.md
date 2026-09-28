## Why

`/{tenant}/reporteria` hoy funciona como una portada amplia con pocos datos y dos llamadas de reporte, mientras la operación diaria necesita ver primero terminales POS, caja y excepciones. Se necesita una vista compacta y responsive que consolide señales mínimas sin duplicar ni romper los cinco reportes especializados.

## What Changes

- Add an operational-control snapshot for the reporteria landing page.
- Present compact quick links for POS, Caja, Compras, Pedidos and Clientes.
- Add period presets Hoy, últimos 7 días and últimos 30 días plus role-appropriate secondary scope filters.
- Add permission-aware KPIs and charts for sales, payment methods, cash movements and order status.
- Preserve existing specialized routes and contracts.
- Enforce effective tenant/branch/user scope in backend and PostgreSQL; client filters are never authorization.
- Add versioned, read-only SQL functions and focused automated tests.

## Capabilities

### New Capabilities

- `reporteria-operational-control`: Contract for the secure, consolidated reporteria control center.

### Modified Capabilities

No existing OpenSpec capability requirement is replaced. Existing reporteria, operational-management and reporting capabilities remain in force; this change adds a landing-page read model.

## Impact

- `web/modules/reporteria` and `web/app/[tenant]/reporteria/page.tsx`.
- Additive backend-reporteria controller, service, DTO/types and SQL adapter.
- Versioned SQL migration under `scripts/database/migrations/` with no historical data mutation.
- Tests in backend-reporteria, web and SQL-oriented service tests.
- Existing specialized report routes, menu permissions, auth and tenant isolation remain compatible.
