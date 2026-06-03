# Evidencia FE-3.7.4 - Firma XML local GetAcquirer con certificado fixture

## Objetivo

Probar firma XML local del SOAP request GetAcquirer con `xml-crypto` y certificado fixture seguro/no productivo, sin DIAN real.

## Archivos creados

- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-xml-signer.ts`
- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-xml-signer.spec.ts`
- `docs/evidencia-getacquirer-xml-signature-fixture-fe-3-7-4.md`

## Signer

`signGetAcquirerSoapRequest`:

- recibe SOAP XML generado por el builder FE-3.7.3.
- recibe `privateKeyPem` y `publicCertPem`.
- usa `xml-crypto`.
- usa `idMode="wssecurity"`.
- firma `soap:Body` con URI `#Body-1`.
- firma `wsu:Timestamp` con URI `#Timestamp-1`.
- inserta `ds:Signature` dentro de `wsse:Security`.
- usa RSA-SHA256, SHA256 y exclusive c14n.

`verifyGetAcquirerSoapSignature`:

- carga `ds:Signature`.
- valida localmente con el certificado fixture.
- no llama red.

## Certificado fixture

El certificado se genera en runtime dentro del test con `node-forge`:

- self-signed.
- `commonName=TEST ONLY GetAcquirer Fixture`.
- valido solo para prueba local.
- no es certificado DIAN.
- no se persiste private key en repo.
- no usa password real.

No se loguea ni se escribe private key.

## Tests

Comando:

```powershell
cd api
npx.cmd tsx --test src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-xml-signer.spec.ts src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-request.builder.spec.ts src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.dependencies.spec.ts src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.service.spec.ts
```

Resultado:

```text
tests 25
pass 24
fail 0
skipped 1
```

El `skipped` sigue siendo el P12/PFX de FE-3.7.2.

Casos FE-3.7.4:

| Validacion | Estado |
| --- | --- |
| Genera SOAP XML firmado | PASS |
| Incluye `ds:Signature` dentro de `wsse:Security` | PASS |
| Incluye referencias `#Body-1` y `#Timestamp-1` | PASS |
| Valida firma localmente con certificado fixture | PASS |
| Conserva IDs `Body-1` y `Timestamp-1` | PASS |
| No expone private key ni password real en XML firmado | PASS |

## Validaciones

- `cd api && npm.cmd run build`: PASS.
- `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`: PASS.
- `git diff --check`: PASS con warning CRLF de `tasks.md`.

## Riesgos

- Firma local valida, pero no confirma interoperabilidad DIAN.
- No se implementa `BinarySecurityToken`.
- No se confirma lista final de nodos firmados exigida por DIAN.
- No se confirma SOAP 1.1/1.2 contra WSDL real.
- No se usa P12/PFX real ni certificado de habilitacion.

## Fuera de alcance confirmado

- No certificado real.
- No password real.
- No llamada DIAN.
- No ambiente habilitacion.
- No PRD.
- No remoto.
- No frontend.
- No POS.
- No commit.
