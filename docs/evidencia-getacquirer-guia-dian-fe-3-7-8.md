# Evidencia FE-3.7.8 - Alineacion GetAcquirer con guia DIAN

Fecha: 2026-06-03

## Objetivo

Alinear el request builder, transporte y parser minimo de GetAcquirer con la guia DIAN revisada, sin consumir DIAN real y sin guardar datos sensibles.

## Cambios

- Se mantuvo `GetAcquirer` con body `identificationType` e `identificationNumber`.
- Se agrego lista cerrada de `identificationType` permitidos: `11`, `12`, `13`, `21`, `22`, `31`, `41`, `42`, `47`, `48`, `50`, `91`.
- Se agrego validacion del builder para rechazar codigos fuera de la guia.
- Se agrego `buildGetAcquirerSoapContentType()` con valor exacto:

```text
application/soap+xml; charset=utf-8; action="http://wcf.dian.colombia/IWcfDianCustomerServices/GetAcquirer"
```

- Se mantuvo WS-A addressing habilitado con `wsa:Action`, `wsa:To` y `wsa:MessageID`.
- Se agrego constante documental para fuente WSDL/endpoint: catalogo de participante DIAN.
- Se ajusto el transporte para usar el `Content-Type` construido por el builder.
- Se ajusto el parser minimo para leer respuesta tipo guia:
  - `AccountingCustomerParty / PartyIdentification / ID @schemeName`
  - `TaxRepresentativeParty / PartyIdentification / ID`
  - `AccountingCustomerParty / Contact / Name`
  - `AccountingCustomerParty / Contact / ElectronicMail`

## Archivos tocados

- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-request.builder.ts`
- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-http-transport.ts`
- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-adapter.ts`
- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-response.parser.ts`
- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-request.builder.spec.ts`
- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-http-transport.spec.ts`
- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-adapter.spec.ts`
- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-response.parser.spec.ts`
- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.dependencies.spec.ts`
- `api/src/modules/electronic-invoicing/third-party-lookup/fixtures/get-acquirer-basic-response.xml`
- `openspec/changes/dian-terceros-clientes-proveedores-fe-3/tasks.md`

## Evidencia de pruebas

- `cd api && npx.cmd tsx --test src/modules/electronic-invoicing/third-party-lookup/*.spec.ts`
  - Resultado: PASS.
  - Tests: 55.
  - Pass: 54.
  - Skipped: 1 fixture P12/PFX no aprobado para certificado real.
- `cd api && npm.cmd run build`
  - Resultado: PASS.
- `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`
  - Resultado: PASS.
- `git diff --check`
  - Resultado: PASS.

## Riesgos

- La firma puede requerir ajustes finos contra WSDL DIAN vigente.
- El WSDL/endpoint real no se valida aqui; debe salir del catalogo de participante DIAN.
- El parser es minimo y seguro. Puede requerir ampliacion si DIAN entrega estructura distinta.
- No hay prueba contra habilitacion DIAN en esta fase.

## Fuera de alcance confirmado

- No llamada DIAN real.
- No certificado real.
- No password real.
- No PRD.
- No remoto.
- No frontend.
- No POS.
- No commit.
- No raw SOAP sensible guardado.
