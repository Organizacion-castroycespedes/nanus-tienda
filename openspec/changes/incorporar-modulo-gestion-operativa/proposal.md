## Why

La gestion operativa diaria queda dispersa entre POS, ventas, caja y reporteria. El nuevo modulo necesita una vista comun de ventas con alcance seguro por tenant, sucursal, usuario y turno, sin duplicar autorizacion ni facturacion electronica.

## What Changes

- Definir e implementar progresivamente un modulo de Gestion Operativa para ventas.
- Reutilizar JWT, auth sessions, roles, permisos, guards, branches y cash sessions existentes.
- Exponer lista y detalle de ventas con scope backend, paginacion y filtros server-side.
- Referenciar el estado seguro del dominio de facturacion electronica.
- Mantener fuera de este change la UI completa, acciones destructivas y retransmision fiscal.

## Capabilities

### New Capabilities
- `operational-management`: consulta operativa de ventas con aislamiento tenant/branch/turno y referencia FE segura.

### Modified Capabilities

## Impact

- `api`: politica central de scope y futuro endpoint de ventas operativas.
- `web` y Electron: futura navegacion y presentacion, sin reglas de seguridad duplicadas.
- `database`: reutilizar columnas e indices actuales; migraciones solo con evidencia.
- Seguridad: tenant, branch, turno actual, permisos y acceso directo deben validarse en backend.
- Facturacion electronica: permanece como fuente de verdad; Gestion Operativa solo consume read models.
