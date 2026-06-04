# Evidencia QA release mock fiscal FE-3.12

Fecha: 2026-06-03  
Rama: `feat/qa-release-mock-fiscal-fe-3-12`

## Alcance

QA release local del flujo fiscal mock para customers, suppliers, POS quick fiscal customer y GetAcquirer pausado.

No se ejecuto DIAN real. No se usaron certificados P12/PFX. No se guardaron tokens, passwords, certificados ni raw SOAP en esta evidencia.

## DB/API/Web usados

- DB local/copia QA: `localhost:5432/manus_tienda_prd`.
- API mock usada para el QA final: `http://localhost:4028/api`.
- API mock temporal arrancada con:
  - `DIAN_THIRD_PARTY_LOOKUP_ENABLED=true`
  - `DIAN_THIRD_PARTY_LOOKUP_MODE=mock`
  - `DIAN_GET_ACQUIRER_HTTP_ENABLED=false`
- API base existente `http://localhost:4020/api` respondia version, pero lookup estaba `DISABLED`; no se uso para el resultado final mock.
- Web local:
  - `http://localhost:3029/default/customers`: HTTP 200.
  - `http://localhost:3029/default/suppliers`: HTTP 200.
  - `http://localhost:3029/default/pos`: HTTP 200.
  - `http://localhost:3000/default/pos`: HTTP 200 en reintento final.

Credenciales y tokens se usaron solo en memoria durante el smoke y no se imprimieron.

## Resultado sanitizado

```json
{
  "environment": {
    "apiBase": "http://localhost:4028/api",
    "webPos": "http://localhost:3029/default/pos",
    "dbHost": "localhost",
    "dbPort": "5432",
    "dbDatabase": "manus_tienda_prd",
    "dianLookupEnabled": "true",
    "dianLookupMode": "mock",
    "dianGetAcquirerHttpEnabled": "false",
    "apiVersion": "0.0.1",
    "webPosStatusCode": 200
  },
  "customers": {
    "lookupStatus": "FOUND",
    "lookupProvider": "MOCK_LOCAL",
    "lookupStatusCode": "MOCK_FOUND",
    "appliedFields": [
      "legalName",
      "fiscalEmail",
      "phone",
      "address",
      "taxResponsibilities"
    ],
    "taxResponsibilitiesValue": ["R-99-PN"],
    "isDianValidated": true,
    "fiscalStatus": "VALIDATED",
    "legacyListHasCustomer": true,
    "finalConsumerAvailable": true
  },
  "suppliers": {
    "lookupStatus": "FOUND",
    "lookupProvider": "MOCK_LOCAL",
    "lookupStatusCode": "MOCK_FOUND",
    "appliedFields": [
      "legalName",
      "fiscalEmail",
      "phone",
      "address",
      "taxResponsibilities"
    ],
    "taxResponsibilitiesValue": ["R-99-PN"],
    "isDianValidated": true,
    "fiscalStatus": "VALIDATED",
    "providerAgnostic": true
  },
  "pos": {
    "sessionCreated": true,
    "posSessionAvailable": true,
    "productsCount": 6,
    "saleCreated": true,
    "saleCustomerIdUsed": true,
    "saleCleanup": "CANCELLED"
  },
  "getAcquirer": {
    "mockProviderUsed": true,
    "dianRealCalled": false,
    "httpEnabledExpected": "false",
    "suppliersDianDirectAvailable": false
  },
  "cleanup": {
    "customerSoftDeleted": true,
    "supplierSoftDeleted": true,
    "logout": true
  },
  "errors": []
}
```

## Customers fiscal-ready

| Validacion | Resultado |
| --- | --- |
| Listar customers fiscales | PASS: listado respondio antes del fixture. |
| Ver badges fiscales | PASS por contrato UI/API: Web customers HTTP 200 y fixture quedo con `isDianValidated=true`, `fiscalStatus=VALIDATED`, campos que renderizan badge fiscal. |
| Crear customer fiscal | PASS por `POST /electronic-invoicing/customers`. |
| Consultar mock | PASS: `provider=MOCK_LOCAL`, `lookupStatus=FOUND`, `statusCode=MOCK_FOUND`. |
| apply-lookup con campos seleccionados | PASS: aplico `legalName`, `fiscalEmail`, `phone`, `address`, `taxResponsibilities`. |
| `taxResponsibilities` persistido como array fiscal | PASS: API persistida devolvio `["R-99-PN"]` desde registro guardado en DB JSONB. No se ejecuto SQL manual por alcance `No SQL`. |
| Editar campos fiscales | PASS: `tradeName` y estado fiscal editados por PATCH. |
| Soft-delete cleanup | PASS: fixture eliminado por `DELETE /customers/:id`. |

## Suppliers fiscal-ready

| Validacion | Resultado |
| --- | --- |
| Listar suppliers fiscales | PASS: listado respondio antes del fixture. |
| Ver badges fiscales | PASS por contrato UI/API: Web suppliers HTTP 200 y fixture quedo con `isDianValidated=true`, `fiscalStatus=VALIDATED`, campos que renderizan badge fiscal. |
| Crear supplier fiscal | PASS por `POST /electronic-invoicing/suppliers`. |
| Consultar mock provider-agnostic | PASS: `provider=MOCK_LOCAL`, `lookupStatus=FOUND`, `statusCode=MOCK_FOUND`. |
| apply-lookup con campos seleccionados | PASS: aplico `legalName`, `fiscalEmail`, `phone`, `address`, `taxResponsibilities`. |
| DIAN_DIRECT/GetAcquirer no disponible para suppliers | PASS: QA mock uso `MOCK_LOCAL`; tests controlados confirman `UNSUPPORTED_PARTY_TYPE` para suppliers en GetAcquirer real y sin transporte. |
| Soft-delete cleanup | PASS: fixture eliminado por `DELETE /suppliers/:id`. |

## POS customer fiscal

| Validacion | Resultado |
| --- | --- |
| POS abre por HTTP | PASS: `http://localhost:3029/default/pos` retorno 200. |
| Customer fiscal aparece en `/customers` | PASS: listado legacy tuvo el fixture antes de cleanup. |
| POS puede usar `customerId` en venta | PASS: venta QA creada usando el `customerId` fiscal. |
| Consumidor Final sigue disponible | PASS: listado legacy mantuvo Consumidor Final activo. |
| Venta QA creada y cancelada | PASS: venta creada y luego `CANCELLED`. |

## GetAcquirer pausado

Prueba controlada ejecutada:

```text
npx.cmd tsx --test src/modules/electronic-invoicing/third-party-lookup/*.spec.ts
```

Resultado:

- 47 tests detectados.
- 46 pass.
- 1 skip esperado: P12/PFX fixture pendiente porque no hay certificado aprobado.
- `GetAcquirerHttpTransport` confirma que no llama `fetch` cuando HTTP esta desactivado.
- `ThirdPartyLookupGetAcquirerAdapter` confirma transporte fake con `externalCallMade=false`.
- Suppliers quedan fuera antes de preparar SOAP firmado: `UNSUPPORTED_PARTY_TYPE`.
- No se expone raw SOAP, XML firmado completo, certificado, password ni token.

## Cleanup

- Venta QA cancelada.
- Customer fiscal QA soft-deleted.
- Supplier fiscal QA soft-deleted.
- Logout local ejecutado.
- API mock temporal `4028` detenida por `taskkill`.

## Validaciones

| Comando | Resultado |
| --- | --- |
| `cd api && npm.cmd run build` | PASS |
| `cd web && npm.cmd run build` | PASS con warnings existentes de hooks y `<img>` |
| `npx.cmd tsx --test src/modules/electronic-invoicing/third-party-lookup/*.spec.ts` | PASS, 46 pass, 1 skip esperado |
| `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict` | PASS |
| `git diff --check` | PASS con warning CRLF de `tasks.md` |

## Bugs y riesgos

1. API local existente `4020` tenia lookup `DISABLED`; para QA mock se necesito API temporal `4028` con env mock explicito.
2. `Invoke-WebRequest` de PowerShell fallo con `Referencia a objeto no establecida como instancia de un objeto` al leer una respuesta de `apply-lookup`; `Invoke-RestMethod` funciono y el API no fallo.
3. La validacion de badges fue por contrato UI/API y HTTP 200, no screenshot interactivo autenticado.
4. `web` build mantiene warnings existentes de hooks e imagenes fuera del alcance.

## Fuera de alcance confirmado

- No codigo funcional.
- No SQL.
- No DIAN real.
- No certificados P12/PFX.
- No passwords ni tokens en evidencia.
- No raw SOAP.
- No PRD.
- No remoto.
- No commit.
