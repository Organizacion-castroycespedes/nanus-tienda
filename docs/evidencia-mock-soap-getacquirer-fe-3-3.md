# Evidencia mock SOAP GetAcquirer - FE-3.3

## Objetivo

Crear un mock SOAP HTTP local para simular DIAN GetAcquirer y probar `DIAN_DIRECT` contra un endpoint controlado, sin consumir DIAN real.

## Archivos creados

- `backend-facturacion-electronica/test/mocks/dian-get-acquirer-soap.mock-server.ts`
- `backend-facturacion-electronica/src/modules/providers/dian/dian-http-client.guard.ts`
- `docs/evidencia-mock-soap-getacquirer-fe-3-3.md`

## Archivos modificados

- `backend-facturacion-electronica/src/modules/providers/dian/dian-direct-fiscal-provider.service.ts`
- `backend-facturacion-electronica/src/modules/providers/dian/dian-config.validator.ts`
- `backend-facturacion-electronica/src/modules/providers/dian/dian-get-acquirer.request-builder.ts`
- `backend-facturacion-electronica/src/modules/providers/dian/dian-wsa.builder.ts`
- `backend-facturacion-electronica/test/dian-direct-provider.spec.ts`
- `backend-facturacion-electronica/.env.example`
- `backend-facturacion-electronica/README.md`
- `openspec/changes/add-electronic-invoicing-customer-backend/tasks.md`

## Mock SOAP server

Mock creado en:

```text
backend-facturacion-electronica/test/mocks/dian-get-acquirer-soap.mock-server.ts
```

Comportamiento:

- Levanta servidor HTTP en puerto dinamico `127.0.0.1`.
- Responde solo a `POST`.
- Valida que llegue action GetAcquirer por `Content-Type` o body SOAP.
- Devuelve fixture success para documento valido.
- Devuelve not found para `identificationNumber=0000000`.
- Devuelve SOAP fault para `identificationNumber=FAULT`.
- Simula timeout para `identificationNumber=TIMEOUT`.
- Guarda el ultimo request para validar `identificationType` e `identificationNumber`.

## Cliente HTTP local DIAN_DIRECT

`DianDirectFiscalProviderService` ahora puede:

- Seguir leyendo fixture local si `DIAN_GET_ACQUIRER_FIXTURE_PATH` existe.
- Hacer `POST` HTTP solo contra endpoint permitido.
- Usar `DIAN_ENDPOINT_URL` si existe; si no, usa `DIAN_WSDL_URL`.
- Enviar `Content-Type: application/soap+xml; charset=utf-8; action="..."`.
- Respetar timeout con `AbortController`.
- Parsear la respuesta SOAP con el parser existente.

No hay cliente SOAP real. Es HTTP controlado para prueba local.

## Bloqueo de llamadas externas

Se agrego guard:

```text
backend-facturacion-electronica/src/modules/providers/dian/dian-http-client.guard.ts
```

Regla:

- Si `DIAN_ALLOW_EXTERNAL_CALLS !== true` y endpoint no es `localhost`, `127.0.0.1` o `::1`, se bloquea la llamada.
- `.env.example` deja `DIAN_ALLOW_EXTERNAL_CALLS=false`.
- Tests validan bloqueo de endpoint externo.

## Variables

Agregadas/confirmadas en `.env.example`:

```env
DIAN_ENDPOINT_URL=
DIAN_ALLOW_EXTERNAL_CALLS=false
```

`FISCAL_PROVIDER=MOCK_LOCAL` sigue siendo default.

## Pruebas ejecutadas

Desde `backend-facturacion-electronica`:

```bash
npm.cmd test
npm.cmd run build
```

Resultado:

- `npm test`: 42 tests pasan.
- `npm run build`: pasa.

Pruebas FE-3.3:

- `DIAN_DIRECT` llama mock server success.
- `DIAN_DIRECT` envia `identificationType`.
- `DIAN_DIRECT` envia `identificationNumber`.
- `DIAN_DIRECT` maneja not found.
- `DIAN_DIRECT` maneja SOAP fault.
- `DIAN_DIRECT` maneja timeout.
- `DIAN_DIRECT` bloquea endpoint externo con `DIAN_ALLOW_EXTERNAL_CALLS=false`.
- `MOCK_LOCAL` sigue default.
- No se loggean secretos.

## Confirmaciones

- No se consumio DIAN real.
- No se usaron certificados reales.
- No se hicieron llamadas externas.
- No se tocaron secretos.
- No se modifico `api/`.
- No se modifico `web/`.
- No se modifico `backend-reporteria/`.
- No se modifico SQL ni migraciones.
- No se toco PRD.
- No se toco servidor remoto.
- No se hizo commit.

## Riesgos vivos

- El mock usa HTTP local, no valida transporte TLS real.
- No hay firma criptografica real WS-Security.
- No hay certificado real ni validacion de expiracion real.
- Falta evaluar libreria SOAP/WS-Security para consumo real controlado.
- Falta smoke manual en ambiente de habilitacion con certificado de prueba aprobado, fuera de CI.

## Proximos pasos

- Evaluar cliente SOAP real controlado sin activar red externa en CI.
- Implementar firma WS-Security real con certificado de prueba seguro.
- Agregar fixtures de request firmado sanitizado.
- Mantener `DIAN_ALLOW_EXTERNAL_CALLS=false` por defecto.
