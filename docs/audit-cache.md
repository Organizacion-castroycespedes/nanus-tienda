# Auditoría Global & Cache por Tenant

## Auditoría de cambios (auditoria_eventos)

### Tabla
La auditoría global vive en `auditoria_eventos` y registra acciones relevantes por tenant, módulo y entidad. Está diseñada para reportes futuros y análisis transversal.

### Servicio global
`AuditService` se encuentra en `api/src/common/services/audit.service.ts` y permite:
- Registrar eventos sin bloquear la transacción principal (fire-and-forget).
- Activar/desactivar auditoría por módulo usando `AUDIT_DISABLED_MODULES`.
- Desactivar toda la auditoría con `AUDIT_ENABLED=false`.

### Uso típico
```ts
this.auditService.logEvent({
  tenantId,
  userId,
  module: "branches",
  entity: "tenant_branches",
  entityId,
  action: "BRANCH_UPDATED",
  before,
  after,
  ip,
  userAgent,
});
```

### Ejemplos ya integrados
- `MenuAdminService`: acciones sobre `menu_items` y permisos.
- `BranchesService`: altas, cambios y cambios de estado.

---

## Cache por tenant (catálogos)

### Servicio global
`CacheService` vive en `api/src/common/services/cache.service.ts` y maneja cache por tenant + namespace:
- TTL configurable (`CACHE_TTL_SECONDS`, `MENU_CACHE_TTL_SECONDS`, `CATALOG_CACHE_TTL_SECONDS`).
- Claves con prefijos por tenant: `namespace:tenantId:key`.
- Invalidación selectiva por tenant y tipo.

### Uso típico
```ts
const catalog = await this.cacheService.getOrSet(
  tenantId,
  "catalog",
  "menu-items",
  () => this.fetchMenuCatalog(tenantId),
  ttlMs
);
```

### Invalidación automática
Cuando se crean/actualizan/desactivan catálogos, se debe invalidar:
```ts
this.cacheService.invalidateTenantNamespace(tenantId, "catalog", "menu-items");
```

### Ejemplos ya integrados
- `MenuService` cachea el catálogo `menu-items` por tenant.
- `MenuAdminService` invalida cache al crear/editar/desactivar menú y al actualizar permisos.

---

## Extensión recomendada
- Reutilizar `AuditService` y `CacheService` en nuevos módulos (clasificaciones, catálogos, inventarios).
- Mantener consistencia de nombres (`module`, `entity`, `action`).
- Evitar auditar lecturas masivas por defecto.
