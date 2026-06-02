# Evidencia WS-Security conceptual GetAcquirer - FE-3.2

## Objetivo

Implementar capa preparatoria de configuracion DIAN, WS-Security conceptual y WS-A addressing para GetAcquirer, sin consumir DIAN real y sin certificados reales.

## Archivos creados

- `backend-facturacion-electronica/src/modules/providers/dian/dian-config.validator.ts`
- `backend-facturacion-electronica/src/modules/providers/dian/dian-ws-security.builder.ts`
- `backend-facturacion-electronica/src/modules/providers/dian/dian-wsa.builder.ts`
- `backend-facturacion-electronica/src/modules/providers/dian/dian.constants.ts`
- `docs/evidencia-ws-security-dian-getacquirer-fe-3-2.md`

## Archivos modificados

- `backend-facturacion-electronica/src/modules/providers/dian/dian-get-acquirer.request-builder.ts`
- `backend-facturacion-electronica/src/modules/providers/dian/dian-direct-fiscal-provider.service.ts`
- `backend-facturacion-electronica/test/dian-direct-provider.spec.ts`
- `backend-facturacion-electronica/.env.example`
- `backend-facturacion-electronica/README.md`
- `openspec/changes/add-electronic-invoicing-customer-backend/tasks.md`

## Configuracion validada

`validateDianDirectConfig` valida solo para `DIAN_DIRECT`:

- `DIAN_WSDL_URL` requerido.
- `DIAN_CERT_PATH` requerido.
- `DIAN_CERT_PASSWORD` requerido.
- `DIAN_GET_ACQUIRER_ACTION` requerido o default documentado.
- `DIAN_TIMEOUT_MS` numerico positivo.
- `DIAN_ENVIRONMENT` en `HABILITACION | PRODUCCION`.

Seguridad:

- Los errores muestran nombre de variable faltante, no valor.
- `DIAN_CERT_PASSWORD` no se retorna en config; solo `certPasswordConfigured=true`.
- `MOCK_LOCAL` no requiere configuracion DIAN.

## Builders creados

### WS-Security conceptual

`buildWsSecurityHeader` genera:

- `wsse:Security`.
- `wsu:Timestamp`.
- `wsu:Created`.
- `wsu:Expires`.
- placeholder `BinarySecurityToken`.
- placeholder `ds:Signature`.

No implementa firma criptografica real.

Incluye TODO:

- FE-3.3 implementara firma real o integracion con libreria WS-Security.

### WS-A addressing conceptual

`buildWsaHeaders` genera:

- `wsa:Action`.
- `wsa:To`.
- `wsa:MessageID`.

Action usado:

```text
http://wcf.dian.colombia/IWcfDianCustomerServices/GetAcquirer
```

### Request builder integrado

`buildGetAcquirerRequest` ahora incluye:

- body `GetAcquirer`.
- `identificationType`.
- `identificationNumber`.
- headers WS-A conceptuales.
- security headers conceptuales.

No envia red.

## Variables

`.env.example` conserva:

```env
FISCAL_PROVIDER=MOCK_LOCAL
```

Se agrego:

```env
DIAN_WS_SECURITY_TIMESTAMP_TTL_MS=300000
```

Variables DIAN ya documentadas siguen sin secretos reales.

## Pruebas ejecutadas

Desde `backend-facturacion-electronica`:

```bash
npm.cmd test
npm.cmd run build
```

Resultado:

- `npm test`: 35 tests pasan.
- `npm run build`: pasa.

Pruebas FE-3.2 cubren:

- config valida para `DIAN_DIRECT`.
- falta `DIAN_WSDL_URL`.
- falta `DIAN_CERT_PATH`.
- falta `DIAN_CERT_PASSWORD` sin exponer valor.
- timeout invalido.
- environment invalido.
- `MOCK_LOCAL` sin config DIAN.
- WS-Security incluye Timestamp.
- `Expires > Created`.
- WS-A incluye action GetAcquirer.
- request builder incluye `identificationType`.
- request builder incluye `identificationNumber`.
- request builder incluye WS-A conceptual.
- request builder incluye Security conceptual.
- `DIAN_DIRECT` no es default.
- `MOCK_LOCAL` sigue pasando.

## Confirmaciones

- No se consumio DIAN real.
- No se hicieron llamadas externas.
- No se usaron certificados reales.
- No se guardaron secretos.
- No se modifico `api/`.
- No se modifico `web/`.
- No se modifico `backend-reporteria/`.
- No se modifico SQL ni migraciones.
- No se toco PRD.
- No se toco servidor remoto.
- No se hizo commit.

## Riesgos vivos

- WS-Security aun no firma criptograficamente.
- `BinarySecurityToken` es placeholder.
- `Signature` es placeholder.
- Falta seleccionar libreria WS-Security/XML Signature.
- Falta validar algoritmos exactos contra guia DIAN y WSDL vigente.
- Falta cliente SOAP controlado sin red externa en CI.

## Proximos pasos

- FE-3.3: implementar firma real o integracion con libreria WS-Security usando certificados de prueba controlados.
- Agregar fixtures de request firmado sanitizado.
- Definir validacion de expiracion de certificado sin exponer secretos.
- Mantener DIAN real fuera de CI.
