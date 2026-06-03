# Evidencia FE-3.7.2 - Dependency spike GetAcquirer

## Objetivo

Agregar dependencias base para pruebas locales de SOAP/XML Signature GetAcquirer sin DIAN real, sin certificados reales y sin llamadas externas.

## Dependencias agregadas en `api`

```json
{
  "@xmldom/xmldom": "^0.9.10",
  "fast-xml-parser": "^5.8.0",
  "node-forge": "^1.4.0",
  "xml-crypto": "^6.1.2"
}
```

Archivos de dependencias:

- `api/package.json`
- `api/package-lock.json`

Nota de install:

- `npm.cmd install xml-crypto @xmldom/xmldom node-forge fast-xml-parser` completo.
- `npm install` reporto `10 vulnerabilities (7 moderate, 3 high)`.
- No se ejecuto `npm audit fix` porque puede cambiar dependencias fuera del alcance.

## Fixture local

Se agrego fixture SOAP seguro:

- `api/src/modules/electronic-invoicing/third-party-lookup/fixtures/get-acquirer-basic-response.xml`

Contenido funcional del fixture:

- SOAP envelope local.
- WS-A `Action` GetAcquirer.
- `soap:Body` con `wsu:Id="Body-1"`.
- `GetAcquirerResponse` sintetico.
- `IdentificationType=31`.
- `IdentificationNumber=900123456`.
- `LegalName=Fixture Acquirer SAS`.
- `FiscalEmail=facturacion.fixture@example.test`.

No contiene:

- certificado real.
- password.
- token.
- raw DIAN real.
- datos productivos.

## Tests agregados

Archivo:

- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.dependencies.spec.ts`

Casos:

| Validacion | Estado |
| --- | --- |
| Imports de `@xmldom/xmldom`, `xml-crypto`, `node-forge`, `fast-xml-parser` | PASS |
| Parseo XML fixture con `@xmldom/xmldom` | PASS |
| Construccion basica de `SignedXml` sin firmar DIAN real | PASS |
| Parseo SOAP fixture con `fast-xml-parser` | PASS |
| P12/PFX fixture | SKIPPED: sin fixture aprobado y sin certificado real permitido |

Resultado:

```text
tests 5
pass 4
fail 0
skipped 1
```

## Validaciones ejecutadas

- `cd api && npm.cmd install xml-crypto @xmldom/xmldom node-forge fast-xml-parser`: PASS.
- `cd api && npx.cmd tsx --test src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.dependencies.spec.ts`: PASS, `4 pass`, `1 skipped`.
- `cd api && npm.cmd run build`: PASS.
- `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`: PASS.
- `git diff --check`: PASS con warning CRLF de `tasks.md`.

## Riesgos

- `npm install` reporto vulnerabilidades existentes o transitivas: `7 moderate`, `3 high`. Requiere revision separada antes de habilitar DIAN real.
- `xml-crypto` instala una version transitive de `@xmldom/xmldom`; debe revisarse en SCA antes de avanzar a firma real.
- El test P12/PFX queda pendiente hasta aprobar un fixture sintetico o generador local en test.
- No se valida firma real todavia.
- No se valida WSDL DIAN real todavia.

## Fuera de alcance confirmado

- No DIAN real.
- No certificado real.
- No password real.
- No WS-Security completo.
- No llamada externa.
- No frontend.
- No POS.
- No PRD.
- No remoto.
- No commit.
