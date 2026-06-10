# Evidencia backend suppliers FE - fase FE-2.4D

## Objetivo

Implementar endpoints backend en `api/` para proveedores fiscales bajo `/api/electronic-invoicing/suppliers`, manteniendo compatibilidad con `/api/suppliers` y compras actuales.

## Archivos modificados

Nuevos:

- `api/src/modules/electronic-invoicing/suppliers/electronic-invoicing-supplier.types.ts`
- `api/src/modules/electronic-invoicing/suppliers/dto/create-electronic-invoicing-supplier.dto.ts`
- `api/src/modules/electronic-invoicing/suppliers/dto/update-electronic-invoicing-supplier.dto.ts`
- `api/src/modules/electronic-invoicing/suppliers/dto/list-electronic-invoicing-suppliers.dto.ts`
- `api/src/modules/electronic-invoicing/suppliers/electronic-invoicing-suppliers.repository.ts`
- `api/src/modules/electronic-invoicing/suppliers/electronic-invoicing-suppliers.service.ts`
- `api/src/modules/electronic-invoicing/suppliers/electronic-invoicing-suppliers.controller.ts`
- `api/src/modules/electronic-invoicing/suppliers/electronic-invoicing-suppliers.service.spec.ts`
- `api/src/modules/electronic-invoicing/suppliers/electronic-invoicing-suppliers.controller.spec.ts`

Actualizados:

- `api/src/modules/electronic-invoicing/electronic-invoicing.module.ts`
- `openspec/changes/add-electronic-invoicing-customer-backend/tasks.md`

## Endpoints creados

### `GET /api/electronic-invoicing/suppliers`

Filtros:

- `search`
- `documentTypeCode`
- `documentNumber`
- `fiscalStatus`
- `isActive`

Respuesta incluye:

- `id`
- `tenantId`
- `name`
- `documentNumber`
- `documentTypeCode`
- `documentNumberNormalized`
- `verificationDigit`
- `legalName`
- `fiscalEmail`
- `fiscalStatus`
- `fiscalProvider`
- `fiscalLastLookupAt`
- `fiscalLastLookupStatus`
- `isActive`
- `createdAt`
- `updatedAt`

### `POST /api/electronic-invoicing/suppliers`

Crea proveedor compatible con `suppliers`.

Reglas:

- `tenantId` sale del contexto autenticado.
- `name` requerido.
- `documentNumber` opcional.
- `documentTypeCode` opcional.
- `fiscalEmail` opcional.
- `fiscalStatus` default `PENDING`.
- `documentNumberNormalized` se deriva de `documentNumber`.
- No exige NIT.
- No duplica documento normalizado dentro del tenant.

### `PATCH /api/electronic-invoicing/suppliers/:id`

Actualiza:

- `name`
- `documentTypeCode`
- `documentNumber`
- `verificationDigit`
- `legalName`
- `fiscalEmail`
- `fiscalStatus`
- `fiscalProvider`
- `fiscalLastLookupStatus`
- `isActive`

Reglas:

- supplier debe pertenecer al tenant.
- no cambia `id`.
- no borra proveedor.
- no toca compras.
- no duplica documento normalizado dentro del tenant.

## Reglas implementadas

- `fiscalStatus`: `PENDING`, `VALIDATED`, `FAILED`, `NOT_REQUIRED`.
- `fiscalLastLookupStatus`: `PENDING`, `FOUND`, `NOT_FOUND`, `ERROR`, `SKIPPED`.
- `fiscalEmail` con formato basico cuando viene.
- normalizacion de documento con trim, mayusculas y remocion de espacios, puntos, guiones y otros simbolos no alfanumericos.
- queries parametrizadas.
- filtros tenant-aware.
- permisos con `ELECTRONIC_INVOICING_CUSTOMERS` temporalmente, hasta decidir menu key especifica de suppliers.

## Pruebas ejecutadas

Desde `api/`:

```powershell
npx.cmd tsx --test "src/modules/electronic-invoicing/suppliers/**/*.spec.ts"
npx.cmd tsx --test "src/modules/inventory/services/purchase.service.spec.ts"
npm.cmd run build
```

Resultados:

- suppliers FE: 11 tests pasaron.
- purchase service: 35 tests pasaron.
- build API: paso.

## Compatibilidad con `/api/suppliers`

No se modificaron:

- `api/src/modules/inventory/controllers/supplier.controller.ts`
- `api/src/modules/inventory/services/supplier.service.ts`
- `api/src/modules/inventory/repositories/supplier.repository.ts`
- ruta legacy `/api/suppliers`

La implementacion nueva vive bajo `api/src/modules/electronic-invoicing/suppliers`.

## Compatibilidad con purchases

No se modificaron:

- `PurchaseService`
- `PurchaseController`
- `purchase.entity`
- `purchases.supplier_id`

Se ejecuto `purchase.service.spec.ts` y paso completo: 35 tests.

## Riesgos vivos

- Falta menu key dedicada para suppliers fiscales si producto la requiere.
- No hay auditoria before/after todavia.
- No hay integracion real con `backend-facturacion-electronica`.
- No hay GetAcquirer ni proveedor fiscal real.
- No hay unique fiscal fuerte en DB por duplicados historicos potenciales.
- Falta prueba API local con backend levantado.

## Proximos pasos

1. Probar endpoints suppliers FE en API local contra DB local migrada.
2. Definir menu key dedicada o confirmar uso compartido de `ELECTRONIC_INVOICING_CUSTOMERS`.
3. Agregar auditoria fiscal before/after.
4. Disenar contrato backend FE -> `api` para upsert supplier.
5. Implementar adapter mock de sync antes de fuente fiscal real.
