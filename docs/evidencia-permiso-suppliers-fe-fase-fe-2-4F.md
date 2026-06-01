# Evidencia permiso suppliers FE - Fase FE-2.4F

## Objetivo

Separar el permiso RBAC de proveedores fiscales para que los endpoints suppliers FE usen `ELECTRONIC_INVOICING_SUPPLIERS`, mientras clientes fiscales conserva `ELECTRONIC_INVOICING_CUSTOMERS`.

## Archivos modificados

- `api/src/common/constants/menu-keys.ts`
- `api/src/modules/electronic-invoicing/suppliers/electronic-invoicing-suppliers.controller.ts`
- `api/src/modules/electronic-invoicing/suppliers/electronic-invoicing-suppliers.controller.spec.ts`
- `api/src/modules/electronic-invoicing/customers/electronic-invoicing-customers.controller.spec.ts`
- `scripts/database/012_seed_electronic_invoicing_suppliers_menu_permissions.sql`
- `openspec/changes/add-electronic-invoicing-customer-backend/tasks.md`

## Key creada

```ts
ELECTRONIC_INVOICING_SUPPLIERS: "ELECTRONIC_INVOICING_SUPPLIERS"
```

La key vive en `MENU_KEYS` junto a `ELECTRONIC_INVOICING_CUSTOMERS`.

## Controllers afectados

### Suppliers FE

`ElectronicInvoicingSuppliersController` ahora usa:

- `GET /api/electronic-invoicing/suppliers`: `ELECTRONIC_INVOICING_SUPPLIERS` con `READ`.
- `POST /api/electronic-invoicing/suppliers`: `ELECTRONIC_INVOICING_SUPPLIERS` con `WRITE`.
- `PATCH /api/electronic-invoicing/suppliers/:id`: `ELECTRONIC_INVOICING_SUPPLIERS` con `WRITE`.

### Customers FE

`ElectronicInvoicingCustomersController` no cambio y sigue usando:

- `ELECTRONIC_INVOICING_CUSTOMERS`.

Tambien se agrego test para congelar esa expectativa.

## Seeds

Se creo seed idempotente:

```text
scripts/database/012_seed_electronic_invoicing_suppliers_menu_permissions.sql
```

Alcance del seed:

- Crea `menu_items.key = ELECTRONIC_INVOICING_SUPPLIERS` para todos los tenants.
- Usa `visible = FALSE` porque en esta fase no se toca frontend.
- Asigna permisos:
  - `SUPER_ADMIN`, `SUPER_USER`, `ADMIN`: `WRITE`.
  - `USER`: `READ`.
- No se ejecuto el seed.
- No se creo migracion estructural.

## Pruebas ejecutadas

```bash
cd api && npx.cmd tsx --test src/modules/electronic-invoicing/suppliers/*.spec.ts src/modules/electronic-invoicing/customers/*.spec.ts
```

Resultado:

- 24 tests.
- 24 pass.
- 0 fail.

```bash
cd api && npm.cmd run build
```

Resultado: PASS.

## Validaciones OpenSpec y diff

- `openspec.cmd validate add-electronic-invoicing-customer-backend --type change --strict --json`: PASS.
- `git diff --check`: PASS.

Nota: `git diff --check` reporto solo warnings de normalizacion futura LF/CRLF en archivos ya tocados. No reporto errores de whitespace.

## Compatibilidad

- `/api/electronic-invoicing/customers` conserva `ELECTRONIC_INVOICING_CUSTOMERS`.
- `/api/electronic-invoicing/document-types` conserva `ELECTRONIC_INVOICING_CUSTOMERS`.
- `/api/suppliers` legacy no se modifico.
- `PurchaseService`, `PurchaseController` y `purchases.supplier_id` no se tocaron.
- No se toco frontend.
- No se toco `backend-reporteria`.
- No se ejecuto SQL contra PRD.

## Riesgos vivos

- El seed nuevo debe ejecutarse en ambientes controlados antes de probar suppliers FE con usuarios no `SUPER_ADMIN`.
- `ELECTRONIC_INVOICING_CUSTOMERS` aun no tiene en esta fase un seed nuevo equivalente dentro de este archivo; se conserva el contrato existente.
- Falta prueba API real con usuario no `SUPER_ADMIN` para confirmar acceso READ/WRITE por rol luego de ejecutar seed en QA.

## Proximos pasos

1. Ejecutar seed en QA local/controlado cuando se habilite prueba RBAC por roles.
2. Probar suppliers FE con `ADMIN`, `USER` y usuario sin permiso.
3. Integrar backend-facturacion-electronica con upsert suppliers usando la key dedicada.
