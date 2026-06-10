# Evidencia DIAN_DIRECT con fixtures - FE-3.1

## Objetivo

Implementar adapter `DIAN_DIRECT` en `backend-facturacion-electronica` usando fixtures SOAP/XML locales, sin consumir DIAN real y sin configurar certificados reales.

## Archivos creados

- `backend-facturacion-electronica/src/modules/providers/dian/dian-direct-fiscal-provider.service.ts`
- `backend-facturacion-electronica/src/modules/providers/dian/dian-get-acquirer.parser.ts`
- `backend-facturacion-electronica/src/modules/providers/dian/dian-get-acquirer.request-builder.ts`
- `backend-facturacion-electronica/test/dian-direct-provider.spec.ts`
- `backend-facturacion-electronica/test/fixtures/dian/get-acquirer-success.xml`
- `backend-facturacion-electronica/test/fixtures/dian/get-acquirer-not-found.xml`
- `backend-facturacion-electronica/test/fixtures/dian/get-acquirer-soap-fault.xml`

## Archivos modificados

- `backend-facturacion-electronica/src/modules/fiscal-lookup/fiscal-lookup.types.ts`
- `backend-facturacion-electronica/src/modules/providers/providers.module.ts`
- `backend-facturacion-electronica/.env.example`
- `backend-facturacion-electronica/README.md`
- `openspec/changes/add-electronic-invoicing-customer-backend/tasks.md`

## Adapter DIAN_DIRECT

`DianDirectFiscalProviderService` implementa `FiscalProviderAdapter`.

Reglas implementadas:

- `lookupParty(input)` soporta `CUSTOMER`.
- `SUPPLIER` retorna `SKIPPED` con `UNSUPPORTED_PARTY_TYPE`, porque GetAcquirer aplica a adquirientes/clientes.
- No llama red.
- No carga WSDL real.
- No usa certificado real.
- Puede leer fixture local desde `DIAN_GET_ACQUIRER_FIXTURE_PATH`.
- Si no hay fixture path, usa XML sintetico embebido.
- Calcula `requestHash` sobre request conceptual.

## Fixtures creados

- Success: `identificationType=31`, `identificationNumber=3199991`, `legalName=Nombre NIT 1`, `fiscalEmail=Mail_NIT_1@mail.com`.
- Not found: respuesta sintetica `NOT_FOUND`.
- SOAP fault: respuesta sintetica con `soap:Fault`.

Los fixtures son sinteticos. No contienen datos reales sensibles.

## Parser implementado

`parseGetAcquirerResponse(xml, input)` extrae:

- `documentTypeCode`.
- `documentNumberNormalized`.
- `legalName`.
- `fiscalEmail`.
- `lookupStatus`.
- `statusCode`.
- `responseSummary` seguro.

Maneja:

- success.
- not found.
- SOAP fault.
- XML invalido.
- mapping incompleto.

No devuelve raw SOAP en salida normal.

## Request builder conceptual

`buildGetAcquirerRequest(input)` genera XML conceptual con:

- `identificationType`.
- `identificationNumber`.
- `wsa:Action`.

Deja TODO explicitos para FE-3.2:

- aplicar WS-Security Signature.
- aplicar Timestamp en milisegundos.
- aplicar WS-A addressing completo con `wsa:To`.

## Config

`.env.example` conserva:

```env
FISCAL_PROVIDER=MOCK_LOCAL
```

Se agrego o confirmo:

```env
DIAN_WSDL_URL=
DIAN_CERT_PATH=
DIAN_CERT_PASSWORD=
DIAN_ENVIRONMENT=HABILITACION
DIAN_TIMEOUT_MS=15000
DIAN_GET_ACQUIRER_ACTION=http://wcf.dian.colombia/IWcfDianCustomerServices/GetAcquirer
```

No hay secretos reales.

## Provider selection

- Default sin `FISCAL_PROVIDER`: `MOCK_LOCAL`.
- `FISCAL_PROVIDER=DIAN_DIRECT`: selecciona `DianDirectFiscalProviderService`.
- Tests validan seleccion sin llamadas externas.
- Tests existentes de `MOCK_LOCAL` siguen pasando.

## Pruebas ejecutadas

Desde `backend-facturacion-electronica`:

```bash
npm.cmd test
npm.cmd run build
```

Resultado:

- `npm test`: 24 tests pasan.
- `npm run build`: pasa.

Cobertura FE-3.1 agregada:

- parse success fixture.
- parse not found fixture.
- parse SOAP fault fixture.
- XML invalido falla claro.
- request builder incluye `identificationType`.
- request builder incluye `identificationNumber`.
- default provider sigue `MOCK_LOCAL`.
- `FISCAL_PROVIDER=DIAN_DIRECT` selecciona adapter DIAN sin red.
- `MOCK_LOCAL` sigue pasando tests existentes.

## Confirmaciones de seguridad

- No se consumio DIAN real.
- No se hicieron llamadas externas de red.
- No se configuro certificado real.
- No se guardaron secretos.
- No se loggea `DIAN_CERT_PASSWORD`.
- No se guarda raw response completo por defecto.
- `responseSummary` usa datos resumidos y documento enmascarado.

## Guardrails respetados

- No se modifico `api/`.
- No se modifico `web/`.
- No se modifico `backend-reporteria/`.
- No se modifico SQL ni migraciones.
- No se toco PRD.
- No se toco servidor remoto.
- No se hizo commit.

## Riesgos vivos

- Parser XML esta limitado a fixtures/control local; FE-3.2 debe validar contra SOAP real de habilitacion con mock seguro.
- WS-Security Signature real queda pendiente.
- Timestamp real en milisegundos queda pendiente.
- WS-A addressing completo queda pendiente.
- WSDL real desde catalogo DIAN queda pendiente.
- Algoritmos de firma/digest/canonicalization quedan pendientes de confirmacion visual contra guia.

## Proximos pasos

- FE-3.2: implementar WS-Security mockeado/firmador aislado con fixtures.
- Definir libreria final SOAP/XML Signature.
- Agregar fixtures de request firmado sin certificado real.
- Mantener CI sin DIAN real y sin certificados reales.
