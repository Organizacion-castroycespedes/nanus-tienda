# Documentacion del proyecto

Esta carpeta resume el estado real del sistema segun el codigo fuente actual de `api/` y `web/`. Cuando una capacidad no esta implementada o no aparece versionada en SQL/infraestructura, se indica explicitamente.

## Navegacion

### Arquitectura

- [Arquitectura general](architecture/general.md)
- [Multi-tenancy](architecture/multi-tenancy.md)
- [Autenticacion](architecture/authentication.md)
- [RBAC y menu](architecture/rbac.md)
- [Flujo POS](architecture/pos-flow.md)
- [Flujo de inventario](architecture/inventory-flow.md)
- [Estrategia SaaS](architecture/saas-strategy.md)

### Modulos

- [Auth](modules/auth.md)
- [Users](modules/users.md)
- [Roles](modules/roles.md)
- [Menu](modules/menu.md)
- [Tenants](modules/tenants.md)
- [Branches](modules/branches.md)
- [Terminals](modules/terminals.md)
- [Products](modules/products.md)
- [Inventory](modules/inventory.md)
- [Purchases](modules/purchases.md)
- [Orders](modules/orders.md)
- [Sales](modules/sales.md)
- [POS](modules/pos.md)
- [Customers](modules/customers.md)
- [Suppliers](modules/suppliers.md)
- [Taxes](modules/taxes.md)
- [Units](modules/units.md)

### API

- [Vision general](api/overview.md)
- [Endpoints](api/endpoints.md)

### Base de datos

- [Vision general](database/overview.md)
- [Modelo logico](database/logical-model.md)
- [Flujo inventario](database/inventory-data-flow.md)
- [Ciclo de ventas](database/sales-lifecycle.md)
- [Ciclo de compras](database/purchases-lifecycle.md)

### Frontend

- [Vision general](frontend/overview.md)
- [Rutas y layouts](frontend/routes-and-layouts.md)
- [Estado y permisos UI](frontend/state-and-permissions.md)
- [POS frontend](frontend/pos.md)

### Backend

- [Vision general](backend/overview.md)
- [Modulos y dependencias](backend/modules.md)
- [Seguridad y errores](backend/security-and-errors.md)

### Seguridad

- [RBAC](security/rbac.md)

### POS

- [Vision general](pos/overview.md)
- [Flujo de venta](pos/sales-flow.md)

### Despliegue

- [Despliegue actual](deployment/overview.md)

### Desarrollo

- [Guia para desarrolladores](development/overview.md)

### Roadmap

- [Roadmap tecnico](roadmap/technical-roadmap.md)
