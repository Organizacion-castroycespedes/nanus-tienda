# Modulos y dependencias

## Grafo simplificado

```mermaid
flowchart TD
  App["AppModule"] --> Auth
  App --> Users
  App --> Tenants
  App --> Branches
  App --> Roles
  App --> Menu
  App --> Inventory
  App --> Terminals
  App --> PosSessions["pos-user-sessions"]
  Inventory --> Stock["StockMovementService"]
  Inventory --> Sales["SaleService"]
  Inventory --> Orders["OrderService"]
  Inventory --> Purchases["PurchaseService"]
  Orders --> Sales
```

## Dependencias relevantes

- `MenuService` depende de `CacheService` y BD.
- `PermissionsGuard` depende de `AccessControlService`.
- `JwtAuthGuard` depende de `auth_sessions`.
- `SaleService`, `OrderService` y `PurchaseService` dependen de `AuditService`.
- `PosUserSessionsService` enlaza `auth_sessions`, `terminals` y `pos_user_sessions`.
