# Evidencia FE-3.7.6 - Adapter GetAcquirer con SOAP firmado sin llamada externa

## Objetivo

Integrar request builder y signer en `ThirdPartyLookupGetAcquirerAdapter` para preparar SOAP GetAcquirer firmado en modo real, sin ejecutar llamada externa.

## Archivos modificados

- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-adapter.ts`
- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-adapter.spec.ts`
- `docs/evidencia-getacquirer-adapter-signed-soap-no-external-fe-3-7-6.md`
- `openspec/changes/dian-terceros-clientes-proveedores-fe-3/tasks.md`

## Cambios

`ThirdPartyLookupGetAcquirerAdapter` ahora puede:

- construir skeleton seguro existente.
- construir SOAP request con `buildGetAcquirerSoapRequest`.
- firmar SOAP con `signGetAcquirerSoapRequest`.
- crear `messageId` desde `context.correlationId`.
- usar `endpointUrl` y `timeoutMs` desde `DIAN_GET_ACQUIRER_*`.
- calcular `signedXmlSha256`.
- calcular `signedXmlSize`.
- entregar XML firmado a transporte fake/injectable.
- mantener `externalCallEnabled=false`.
- devolver preview seguro `REAL_LOOKUP_NOT_IMPLEMENTED`.

Se agrego runtime configurable:

- `signingMaterialProvider`.
- `transport`.

Default:

- sin signing material.
- transporte deshabilitado.
- cero llamada externa.

Tests usan certificado TEST ONLY generado en runtime. No hay certificado real ni password real.

## Seguridad

No se retorna ni guarda:

- SOAP firmado completo en respuesta API.
- private key.
- password.
- certificado real.
- raw DIAN.

El fake transport recibe el XML firmado solo dentro del test para validar estructura/firma local.

## Tests

Comando:

```powershell
cd api
npx.cmd tsx --test src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-adapter.spec.ts src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-xml-signer.spec.ts src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-request.builder.spec.ts src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.dependencies.spec.ts src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.service.spec.ts
```

Resultado:

```text
tests 32
pass 31
fail 0
skipped 1
```

El `skipped` es P12/PFX pendiente de FE-3.7.2.

Casos FE-3.7.6:

| Validacion | Estado |
| --- | --- |
| Adapter construye SOAP firmado con config + signer | PASS |
| SOAP firmado valida localmente con cert TEST ONLY | PASS |
| Fake transport recibe request firmado | PASS |
| Fake transport no llama red externa | PASS |
| Preview no expone `soap` ni `raw` | PASS |
| Sin signing material, no invoca transport | PASS |
| Supplier queda fuera antes de preparar SOAP firmado | PASS |
| Config faltante falla con error claro | PASS |

## Validaciones

- `cd api && npm.cmd run build`: PASS.
- `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`: PASS.
- `git diff --check`: PASS con warnings CRLF.

## Riesgos

- No hay lectura de P12/PFX real.
- No hay transporte HTTP real.
- No hay prueba DIAN habilitacion.
- XML firmado queda validado localmente, no contra WSDL DIAN.
- Runtime real de certificado debe implementarse en fase posterior con secret handling seguro.

## Fuera de alcance confirmado

- No llamada DIAN real.
- No certificado real.
- No P12 real.
- No password real.
- No habilitacion.
- No PRD.
- No remoto.
- No frontend.
- No POS.
- No commit.
