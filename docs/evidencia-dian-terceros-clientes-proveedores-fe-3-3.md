# Evidencia FE-3.3 Mock DIAN para terceros

## Alcance implementado

Se agrego lookup mock fiscal en `api/` para customers/adquirientes y suppliers/proveedores.

No usa SOAP real, certificados, WS-Security, DIAN habilitacion ni DIAN produccion.

## Configuracion

El lookup queda controlado por env:

```env
DIAN_THIRD_PARTY_LOOKUP_ENABLED=true
DIAN_THIRD_PARTY_LOOKUP_MODE=mock
```

Si `DIAN_THIRD_PARTY_LOOKUP_ENABLED=false` o `DIAN_THIRD_PARTY_LOOKUP_MODE=disabled`, el endpoint responde `lookupStatus=SKIPPED`, `statusCode=DISABLED` y no devuelve data mock.

## Endpoints

```http
POST /api/electronic-invoicing/customers/lookup
POST /api/electronic-invoicing/customers/:id/apply-lookup
POST /api/electronic-invoicing/suppliers/lookup
POST /api/electronic-invoicing/suppliers/:id/apply-lookup
```

`lookup` devuelve preview, `fieldDiffs` vacio cuando no hay target, `requestHash`, `correlationId`, `responseSummary` y data normalizada si el mock encuentra tercero.

`apply-lookup` vuelve a consultar el mock, compara contra el tercero existente, devuelve `fieldDiffs` y actualiza solo campos incluidos en `fieldsToApply`, `selectedFields` o `applyFields`.

## No overwrite

Sin campos seleccionados, `apply-lookup` no cambia datos fiscales como `legalName`, `fiscalEmail`, direccion o documento.

Siempre registra estado de consulta en campos existentes:

- Customers: `dianLastLookupAt`, `dianLastLookupStatus`, `fiscalDataSource`.
- Suppliers: `fiscalLastLookupAt`, `fiscalLastLookupStatus`, `fiscalProvider`, `fiscalDataSource`.

Cuando hay campos confirmados y `lookupStatus=FOUND`, tambien marca `fiscalStatus=VALIDATED` e `isDianValidated=true`.

## Logs seguros

No se guarda raw SOAP ni payload externo completo.

En `dianMetadata.thirdPartyLookup.lastLookup` se guarda solo resumen seguro:

- `lookupId`
- `correlationId`
- `partyType`
- `provider`
- `mode`
- `lookupStatus`
- `statusCode`
- `message`
- `lookupAt`
- `requestHash`
- `responseSummary`

## Suppliers provider-agnostic

Suppliers usan `MOCK_LOCAL` provider-agnostic.

No se usa `GetAcquirer`.

No se permite `DIAN_DIRECT` para suppliers en create/update existente.

## Validaciones ejecutadas

```powershell
cd api
npx.cmd tsx --test src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.service.spec.ts src/modules/electronic-invoicing/customers/electronic-invoicing-customers.service.spec.ts src/modules/electronic-invoicing/suppliers/electronic-invoicing-suppliers.service.spec.ts src/modules/electronic-invoicing/customers/electronic-invoicing-customers.controller.spec.ts src/modules/electronic-invoicing/suppliers/electronic-invoicing-suppliers.controller.spec.ts
npm.cmd run build
```

Resultado:

- Tests especificos: 41 pass, 0 fail.
- API build: pass.

## Fuera de alcance confirmado

- No SOAP real.
- No certificados.
- No WS-Security.
- No DIAN habilitacion/produccion.
- No POS quick form.
- No frontend.
- No pricing.
- No Orders.
- No PRD real.
- No remoto.
- No commit.

## Riesgos

- No hay tabla persistente comun de lookup logs en esta fase.
- El mock es deterministico para UX/tests, no valida existencia real ante DIAN.
- `fiscalStatus=VALIDATED` solo se marca al aplicar campos confirmados con mock encontrado.
