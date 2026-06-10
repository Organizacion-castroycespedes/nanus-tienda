# Evidencia FE-3.7.3 - GetAcquirer request builder con fixtures

## Objetivo

Construir un request builder local para GetAcquirer con SOAP Envelope, WS-Addressing, WS-Security Timestamp placeholder, body `GetAcquirer`, IDs estables para firma futura y sin llamada externa.

## Archivos creados

- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-request.builder.ts`
- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-request.builder.spec.ts`
- `api/src/modules/electronic-invoicing/third-party-lookup/fixtures/get-acquirer-basic-request.xml`
- `docs/evidencia-getacquirer-request-builder-fe-3-7-3.md`

## Builder

`buildGetAcquirerSoapRequest` genera:

- `soap:Envelope`.
- Namespaces `soap`, `wsa`, `wsse`, `wsu`, `dian`.
- `wsa:Action` con action GetAcquirer.
- `wsa:To`.
- `wsa:MessageID`.
- `wsse:Security`.
- `wsu:Timestamp`.
- `wsu:Created`.
- `wsu:Expires`.
- `soap:Body`.
- `dian:GetAcquirer`.
- `dian:identificationType`.
- `dian:identificationNumber`.

Action:

```text
http://wcf.dian.colombia/IWcfDianCustomerServices/GetAcquirer
```

IDs estables para firma futura:

| Nodo | ID |
| --- | --- |
| `wsa:Action` | `Action-1` |
| `wsa:To` | `To-1` |
| `wsa:MessageID` | `MessageID-1` |
| `wsse:Security` | `Security-1` |
| `wsu:Timestamp` | `Timestamp-1` |
| `soap:Body` | `Body-1` |

## Fixture

`get-acquirer-basic-request.xml` usa:

- endpoint local sintetico: `https://example.test/GetAcquirer`.
- `identificationType=31`.
- `identificationNumber=900123456`.
- `Created=2026-06-03T15:00:00.000Z`.
- `Expires=2026-06-03T15:05:00.000Z`.

No contiene firma real, certificado, password, token ni llamada DIAN.

## Tests

Comando:

```powershell
cd api
npx.cmd tsx --test src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-request.builder.spec.ts src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.dependencies.spec.ts src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.service.spec.ts
```

Resultado:

```text
tests 20
pass 19
fail 0
skipped 1
```

El `skipped` es el caso P12/PFX de FE-3.7.2, pendiente porque no hay fixture sintetico aprobado y no se permite certificado real.

Casos FE-3.7.3:

| Validacion | Estado |
| --- | --- |
| Builder genera fixture XML esperado | PASS |
| XML parsea con `@xmldom/xmldom` | PASS |
| Incluye `wsa:Action`, `wsa:To`, `wsa:MessageID` | PASS |
| Incluye IDs estables para firma futura | PASS |
| Incluye `wsse:Security` y `wsu:Timestamp` | PASS |
| Incluye `identificationType` e `identificationNumber` | PASS |
| No incluye `ds:Signature`, `BinarySecurityToken`, password, private key ni certificate | PASS |

## Validaciones

- `cd api && npm.cmd run build`: PASS.
- `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`: PASS.
- `git diff --check`: PASS con warning CRLF de `tasks.md`.

## Riesgos

- El builder todavia no firma XML.
- El builder todavia no valida WSDL real.
- SOAP 1.2 se mantiene como base conceptual; version final debe confirmarse contra WSDL DIAN vigente.
- El Timestamp es placeholder controlado; TTL real queda para fase futura.
- No se loguea XML completo en runtime, pero tests y fixtures contienen documentos sinteticos.

## Fuera de alcance confirmado

- No firma real.
- No certificado real.
- No password real.
- No llamada DIAN.
- No WS-Security completo.
- No frontend.
- No POS.
- No PRD.
- No remoto.
- No commit.
