## 1. Prerrequisitos

- [x] 1.1 Discovery sobre `develop` 3426fc53: flujo de alta, guards, esquema reconstruido en LOCAL, seeds y migraciones de menú, clientes, unidades, impuestos y métodos de pago.
- [x] 1.2 Resolver la aparente incompatibilidad de `uq_tax_rates_scope` (las tarifas "duplicadas" se distinguen por `tax_product_category_id`).
- [x] 1.3 Registrar el ownership en `scripts/governance/openspec-scope.json`.
- [x] 1.4 Confirmado por el propietario (2026-11-11): restricción del alta al SUPER_ADMIN del tenant plataforma (D3).
- [x] 1.5 Decisión del propietario (2026-11-11): los grupos de impuestos ambiguos quedan manuales; no se modifica el catálogo de PRD en esta HU.

## 2. API

- [x] 2.1 `tenant-bootstrap.policy.ts` con la matriz de clonación.
- [x] 2.2 `TenantBootstrapService` con validaciones previas, copia por conjuntos, remapeo, verificación, marca de idempotencia y auditoría en la transacción.
- [x] 2.3 `TenantsService.createTenant` en transacción `REPEATABLE READ`, mapeo de errores y kill switch `TENANT_BOOTSTRAP_ENABLED`.
- [x] 2.4 `PlatformTenantGuard` en `POST /tenants` y actor en la auditoría.
- [x] 2.5 `api/.env.example` con `TENANT_BOOTSTRAP_ENABLED`.

## 3. Pruebas

- [x] 3.1 Unitarias (`tenant-bootstrap.service.spec.ts`): transacción, rollback, mapeo HTTP, colisión de slug, kill switch, guard, parámetros enlazados y matriz.
- [x] 3.2 Integración transaccional real (`tenant-bootstrap.integration.spec.ts`) sobre una base LOCAL desechable: creación completa, jerarquía, permisos, consumidor final, unidades, impuestos, tarifas, métodos de pago, catálogos globales, exclusiones, origen faltante/inactivo/incompleto, fallo intermedio, concurrencia, slug duplicado, reintento, destino parcial e impuestos ambiguos.
- [ ] 3.3 `openspec validate hu-tenant-bootstrap-001 --strict` y diagnóstico de gobernanza en un equipo con el CLI de OpenSpec.

## 4. QA

- [x] 4.0 QA manual en LOCAL: PASS (propietario, 2026-11-11).
- [ ] 4.1 Ejecutar la prueba de integración contra una base QA desechable restaurada desde un respaldo saneado de PRD y revisar `bootstrap.manual`.
- [ ] 4.2 QA manual con cuatro perfiles (SUPER_ADMIN plataforma, SUPER_ADMIN de otro tenant, ADMIN, USER) según `docs/evidencia-hu-tenant-bootstrap-001.md`.
- [ ] 4.3 Login del primer usuario de la empresa nueva (creado manualmente) y verificación de menú, POS con consumidor final, impuestos y métodos de pago.
