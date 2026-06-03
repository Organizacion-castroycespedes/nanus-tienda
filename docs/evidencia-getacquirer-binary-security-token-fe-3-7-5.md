# Evidencia FE-3.7.5 - BinarySecurityToken y SOAP firmado completo con fixture

## Objetivo

Completar estructura WS-Security local del SOAP GetAcquirer firmado con `wsse:BinarySecurityToken`, `ds:Signature` y `wsse:SecurityTokenReference`, usando solo certificado fixture TEST ONLY y sin DIAN real.

## Archivos modificados

- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-xml-signer.ts`
- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-xml-signer.spec.ts`
- `docs/evidencia-getacquirer-binary-security-token-fe-3-7-5.md`
- `openspec/changes/dian-terceros-clientes-proveedores-fe-3/tasks.md`

## Cambios

`signGetAcquirerSoapRequest` ahora:

- Inserta `wsse:BinarySecurityToken`.
- Usa ID estable `BinarySecurityToken-1`.
- Usa `EncodingType` Base64Binary.
- Usa `ValueType` X509v3.
- Inserta el certificado publico fixture en formato PEM stripped.
- Firma `soap:Body` con URI `#Body-1`.
- Firma `wsu:Timestamp` con URI `#Timestamp-1`.
- Inserta `ds:Signature` dentro de `wsse:Security`.
- Inserta `ds:KeyInfo`.
- Inserta `wsse:SecurityTokenReference`.
- Inserta `wsse:Reference URI="#BinarySecurityToken-1"`.

No guarda private key en repo. No guarda password. No hace llamada externa.

## Certificado fixture

El certificado sigue generado en runtime dentro del test con `node-forge`:

- self-signed.
- `commonName=TEST ONLY GetAcquirer Fixture`.
- no DIAN.
- no productivo.
- sin password real.
- private key solo vive en memoria del test.

No se agrega fixture firmado estatico porque la llave/certificado se generan en runtime y la firma cambia. Se cubre con validacion estructural y validacion criptografica local.

## Tests

Comando:

```powershell
cd api
npx.cmd tsx --test src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-xml-signer.spec.ts src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-request.builder.spec.ts src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.dependencies.spec.ts src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.service.spec.ts
```

Resultado:

```text
tests 27
pass 26
fail 0
skipped 1
```

El `skipped` es el P12/PFX fixture pendiente de FE-3.7.2.

Casos FE-3.7.5:

| Validacion | Estado |
| --- | --- |
| XML contiene `wsse:BinarySecurityToken` | PASS |
| `BinarySecurityToken` usa ID `BinarySecurityToken-1` | PASS |
| `BinarySecurityToken` contiene certificado publico fixture stripped | PASS |
| `ds:Signature` existe dentro de `wsse:Security` | PASS |
| `ds:KeyInfo` contiene `wsse:SecurityTokenReference` | PASS |
| `SecurityTokenReference` apunta a `#BinarySecurityToken-1` | PASS |
| `ds:Reference` contiene `#Body-1` y `#Timestamp-1` | PASS |
| Firma valida localmente con certificado fixture | PASS |
| No expone private key ni password real | PASS |

## Validaciones

- `cd api && npm.cmd run build`: PASS.
- `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`: PASS.
- `git diff --check`: PASS con warnings CRLF.

## Riesgos

- Firma local valida, pero no prueba interoperabilidad DIAN.
- Nodos firmados finales y algoritmos deben confirmarse contra guia/WSDL vigente.
- No hay P12/PFX real.
- No hay certificado de habilitacion.
- No hay llamada real ni prueba contra endpoint DIAN.

## Fuera de alcance confirmado

- No certificado real.
- No password real.
- No P12 real.
- No llamada DIAN.
- No habilitacion.
- No PRD.
- No remoto.
- No frontend.
- No POS.
- No commit.
