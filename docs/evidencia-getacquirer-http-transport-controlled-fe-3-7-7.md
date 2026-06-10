# Evidencia FE-3.7.7 - Transporte HTTP real GetAcquirer controlado

Fecha: 2026-06-03

## Alcance ejecutado

- Se agrego `DIAN_GET_ACQUIRER_HTTP_ENABLED` para activar explicitamente el transporte HTTP.
- Se agrego `GetAcquirerHttpTransport` con `fetch` inyectable, `POST`, `Content-Type` SOAP, `Accept` SOAP y timeout via `AbortController`.
- El adapter GetAcquirer propaga `externalCallEnabled` desde config y espera el transporte.
- Por defecto no hay llamada externa si `DIAN_GET_ACQUIRER_HTTP_ENABLED` no es `true`.
- Respuestas HTTP/SOAP se reducen a estado tecnico, `httpStatus`, hash y tamano. No se retorna raw SOAP.
- Errores `timeout` y `network` se mapean a estados seguros.
- Tests usan `fetchImpl` mock. No se llamo DIAN real.

## Config nueva

```env
DIAN_GET_ACQUIRER_HTTP_ENABLED=false
```

Regla:

- `false` o vacio: el transporte no hace red.
- `true`: permite red solo si tambien existe SOAP firmado y transporte HTTP activo.
- Cualquier otro valor falla con `DIAN_GET_ACQUIRER_HTTP_ENABLED must be true or false`.

## Evidencia de pruebas

- `npx.cmd tsx --test src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-http-transport.spec.ts src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.get-acquirer-adapter.spec.ts src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.service.spec.ts src/modules/electronic-invoicing/customers/electronic-invoicing-customers.service.spec.ts src/modules/electronic-invoicing/suppliers/electronic-invoicing-suppliers.service.spec.ts`
  - Resultado: PASS, 51 tests.
- `cd api && npm.cmd run build`
  - Resultado: PASS.
- `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`
  - Resultado: PASS.
- `git diff --check`
  - Resultado: PASS. Git mostro warnings CRLF, sin errores de whitespace.

## Seguridad

- No se imprime XML firmado completo.
- No se retorna raw SOAP.
- No se guarda certificado, password, token ni secretos.
- Tests generan o usan solo datos TEST ONLY.
- Suppliers siguen fuera de GetAcquirer real.

## Pendiente fuera de esta fase

- Carga real de P12/PFX.
- Certificado real.
- Llamada DIAN habilitacion/produccion.
- Parseo funcional de respuesta DIAN a datos fiscales reales.
- WS-Security productivo completo.

## Fuera de alcance confirmado

- No DIAN real.
- No certificado real.
- No P12 real.
- No password real.
- No habilitacion.
- No PRD.
- No remoto.
- No frontend/POS.
- No commit.
