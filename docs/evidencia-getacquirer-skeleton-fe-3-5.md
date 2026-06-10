# Evidencia FE-3.5 - Skeleton GetAcquirer real SOAP/WS-Security

## Objetivo

Preparar estructura tecnica para `GetAcquirer` real en modo seguro, sin consumir DIAN real.

## Alcance ejecutado

- Se agrego interface backend para adapters de lookup fiscal.
- Se agrego modo `real` junto a `disabled` y `mock`.
- Se agrego adapter skeleton `DIAN_GET_ACQUIRER` solo para `CUSTOMER`.
- Se agrego validacion de configuracion para modo real de customers.
- Se agrego placeholder seguro para request SOAP/WS-Security.
- Se actualizaron tests especificos de lookup, customers y suppliers.
- Se actualizo `api/.env.example`.

## Config nueva

```env
DIAN_THIRD_PARTY_LOOKUP_ENABLED=true|false
DIAN_THIRD_PARTY_LOOKUP_MODE=disabled|mock|real
DIAN_GET_ACQUIRER_WSDL_URL=
DIAN_GET_ACQUIRER_ENDPOINT_URL=
DIAN_CERTIFICATE_PATH=
DIAN_CERTIFICATE_PASSWORD=
DIAN_GET_ACQUIRER_TIMEOUT_MS=15000
```

## Comportamiento validado

- `disabled`: devuelve preview `SKIPPED/DISABLED`.
- `mock`: mantiene adapter local `MOCK_LOCAL`.
- `real` + `CUSTOMER` + config faltante: falla con error claro que lista variables faltantes.
- `real` + `CUSTOMER` + config completa: devuelve preview seguro `ERROR/REAL_LOOKUP_NOT_IMPLEMENTED`; no llama red.
- `real` + `SUPPLIER`: devuelve `ERROR/UNSUPPORTED_PARTY_TYPE`; no usa GetAcquirer real.
- Skeleton mapea `documentTypeCode` a `identificationType`.
- Skeleton mapea `documentNumberNormalized` a `identificationNumber`.
- Skeleton no incluye password, certificado crudo, raw SOAP ni tokens.

## Tests especificos

Comando:

```powershell
cd api
npx.cmd tsx --test src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.service.spec.ts src/modules/electronic-invoicing/customers/electronic-invoicing-customers.service.spec.ts src/modules/electronic-invoicing/suppliers/electronic-invoicing-suppliers.service.spec.ts
```

Resultado: `39/39` tests pass.

## Validaciones

- `cd api && npm.cmd run build`: pass.
- `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`: pass.
- `git diff --check`: pass.

## Fuera de alcance confirmado

- No llamada real a DIAN.
- No certificado real.
- No WS-Security completo funcional.
- No guardar secretos.
- No frontend.
- No POS.
- No suppliers usando GetAcquirer real.
- No PRD.
- No remoto.
- No commit.

## Riesgos

- Falta elegir libreria SOAP/XML signature aprobada.
- Falta prueba DIAN habilitacion con certificado real en fase futura.
- Modo `real` esta estructuralmente listo, pero bloqueado sin consumo externo.
