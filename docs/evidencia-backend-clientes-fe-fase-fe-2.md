# Evidencia backend clientes FE - Fase FE-2

## Alcance

Se implemento backend NestJS para clientes/adquirientes de facturacion electronica y consumidor final, manteniendo compatibilidad con el modulo actual `customers`.

No se implemento GetAcquirer real. No se consumio DIAN. No se guardo raw DIAN. No se tocaron frontend, `backend-reporteria`, POS, ventas, pedidos, reportes ni migraciones.

## Archivos modificados

Backend:

- `api/src/common/constants/menu-keys.ts`
- `api/src/modules/app.module.ts`
- `api/src/modules/electronic-invoicing/electronic-invoicing.module.ts`
- `api/src/modules/electronic-invoicing/customers/electronic-invoicing-customers.controller.ts`
- `api/src/modules/electronic-invoicing/customers/electronic-invoicing-customers.service.ts`
- `api/src/modules/electronic-invoicing/customers/electronic-invoicing-customers.repository.ts`
- `api/src/modules/electronic-invoicing/customers/electronic-invoicing-customer.types.ts`
- `api/src/modules/electronic-invoicing/customers/dto/*.ts`
- `api/src/modules/electronic-invoicing/document-types/dian-document-types.controller.ts`
- `api/src/modules/electronic-invoicing/document-types/dian-document-types.service.ts`
- `api/src/modules/electronic-invoicing/document-types/dian-document-types.repository.ts`
- `api/src/modules/electronic-invoicing/document-types/dian-document-type.types.ts`

Tests:

- `api/src/modules/electronic-invoicing/customers/electronic-invoicing-customers.service.spec.ts`
- `api/src/modules/electronic-invoicing/customers/electronic-invoicing-customers.controller.spec.ts`
- `api/src/modules/electronic-invoicing/document-types/dian-document-types.service.spec.ts`
- `api/src/modules/electronic-invoicing/document-types/dian-document-types.controller.spec.ts`

OpenSpec:

- `openspec/changes/add-electronic-invoicing-customer-backend/tasks.md`

## Endpoints creados

- `GET /api/electronic-invoicing/document-types`
- `GET /api/electronic-invoicing/customers`
- `POST /api/electronic-invoicing/customers`
- `PATCH /api/electronic-invoicing/customers/:id`
- `GET /api/electronic-invoicing/customers/default`
- `POST /api/electronic-invoicing/customers/default/ensure`

Todos usan `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard` y menu key `ELECTRONIC_INVOICING_CUSTOMERS`.

## Reglas implementadas

- `dian_document_types` se lista desde DB y puede devolver `[]` si no hay catalogo sembrado.
- Listado FE filtra por `search`, `documentTypeCode`, `documentNumber`, `isFinalConsumer`, `fiscalStatus` e `isActive`.
- `tenantId` se toma del contexto autenticado.
- `name` es requerido salvo consumidor final, donde se usa `Consumidor Final`.
- `fiscalEmail` es opcional; si viene, se valida formato basico y se normaliza a minusculas.
- `documentNumberNormalized` se deriva de `documentNumber`.
- Se evita duplicar `documentNumberNormalized` por tenant cuando viene informado.
- `POST /default/ensure` es idempotente.
- Consumidor final usa `is_final_consumer=true`, `is_default=true`, `fiscal_status='NOT_REQUIRED'`, sin exigir email ni documento.
- Se evita mas de un consumidor final activo por tenant desde servicio y por indice parcial de DB.

## Pruebas ejecutadas

Build:

```bash
cd api && npm.cmd run build
```

Resultado: pass.

Tests FE:

```bash
cd api && npx.cmd tsx --test "src/modules/electronic-invoicing/**/*.spec.ts"
```

Resultado:

```text
tests 14
pass 14
fail 0
```

Tests de customers existentes:

No existen `customer.service.spec.ts`, `customer.repository.spec.ts` ni `customer.controller.spec.ts` bajo `api/src/modules/inventory`. Se verifico el arbol de specs existente y no habia pruebas especificas del modulo legacy de customers para ejecutar.

## Compatibilidad `/api/customers`

El controller, service y repository legacy en `api/src/modules/inventory` no fueron modificados.

No se cambiaron ventas, pedidos, POS ni reportes. Los nuevos endpoints viven bajo `/api/electronic-invoicing/*`.

`/api/customers` deberia seguir funcionando con el contrato actual porque:

- No se removieron columnas existentes.
- No se cambio `InventoryModule`.
- No se cambio `CustomerController`.
- No se cambio `CustomerService`.
- No se cambio `CustomerRepository`.

## Riesgos vivos

- Falta seed oficial de `dian_document_types`.
- Falta permisos/menu seed para `ELECTRONIC_INVOICING_CUSTOMERS`.
- No hay validacion global con `ValidationPipe`; las validaciones criticas se hacen en servicio.
- No se levanto backend para prueba HTTP real.
- GetAcquirer queda fuera de alcance para FE-3.
- `is_default` se mantiene para compatibilidad con consumidor final legacy.

## Proximos pasos

1. Definir y sembrar catalogo DIAN desde fuente vigente.
2. Crear seed de menu/permisos para `ELECTRONIC_INVOICING_CUSTOMERS`.
3. Levantar backend local y probar endpoints con token real.
4. Implementar auditoria de cambios fiscales si se exige en FE-2.x.
5. Disenar FE-3 para `MOCK_LOCAL`/GetAcquirer sin DIAN real.
