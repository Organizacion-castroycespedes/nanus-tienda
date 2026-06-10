# Evidencia FE-3.6 - QA local DIAN mock desde POS

## Objetivo

Validar localmente el flujo end-to-end con mock:

POS cliente fiscal -> lookup mock -> aplicar campos -> guardar customer -> seleccionar en POS -> venta usa `customerId`.

## Entorno local

- Web local: `http://localhost:3000/default/pos`
- API base existente: `http://localhost:4020/api`
- API mock temporal: `http://localhost:4028/api`
- Config mock usada en API temporal:
  - `DIAN_THIRD_PARTY_LOOKUP_ENABLED=true`
  - `DIAN_THIRD_PARTY_LOOKUP_MODE=mock`

## Resultado

El E2E completo quedo bloqueado por entorno local QA, no por SOAP real.

| Validacion | Estado | Evidencia |
| --- | --- | --- |
| Web POS abre | PASS | `GET http://localhost:3000/default/pos` -> `200` |
| API local disponible | PASS | `GET http://localhost:4028/api/system/version` -> `{"version":"0.0.1"}` |
| API lookup customer mock responde | PASS | `lookupStatus=FOUND`, `provider=MOCK_LOCAL`, `statusCode=MOCK_FOUND` |
| No raw sensible en lookup | PASS | Respuesta sin propiedades `raw` ni `soap` |
| API 4020 precondicion mock | FAIL local | Lookup en API existente retorno `SKIPPED/NONE/DISABLED` |
| Guardar customer fiscal fixture | BLOQUEADO | `POST /electronic-invoicing/customers` retorno `500` |
| apply-lookup con campos seleccionados | NO EJECUTADO | Bloqueado porque customer fixture no pudo crearse |
| POS quick fiscal customer crea/selecciona | NO EJECUTADO | Browser automation bloqueado y API customer create bloqueado |
| Consumidor Final fallback | NO EJECUTADO | Listado `/customers` no se alcanzo despues del bloqueo |
| Venta POS usa `customerId` seleccionado | NO EJECUTADO | Bloqueado por customer create y flujo POS no navegable |
| Cleanup de fixture | PASS | No se creo fixture persistente; API temporal 4028 fue detenida |
| No guardar tokens/secretos | PASS | Evidencia no registra access token, refresh token, password, certificado, raw SOAP ni tokens |

## Bloqueadores confirmados

### API existente no cumple precondicion mock

En `http://localhost:4020/api`, el lookup respondio:

```json
{
  "lookupStatus": "SKIPPED",
  "provider": "NONE",
  "statusCode": "DISABLED"
}
```

Para no tocar configuracion funcional existente, se levanto API temporal en `4028` con modo mock.

### DB local no tiene columnas FE-3.2 aplicadas

`POST /api/electronic-invoicing/customers` fallo con:

```text
no existe la columna «dian_identification_type»
```

Stack local apunta a:

```text
ElectronicInvoicingCustomersRepository.findByFiscalIdentity
ElectronicInvoicingCustomersService.ensureNoDuplicateIdentity
ElectronicInvoicingCustomersService.createCustomer
```

No se ejecuto SQL porque esta fase no permite SQL nuevo y la precondicion exige DB local/copia QA lista.

### Browser POS no disponible

Browser automation fallo con:

```text
windows sandbox failed: spawn setup refresh
```

Por eso no se pudo hacer click-smoke del modal POS.

## API smoke ejecutado

Pasos completados contra API mock temporal `4028`:

1. Login local con salida sanitizada.
2. `GET /api/system/version`.
3. `POST /api/electronic-invoicing/customers/lookup`.
4. Validacion de respuesta mock segura.
5. Intento de `POST /api/electronic-invoicing/customers`.
6. Detencion de API temporal.

Resultado principal:

```json
{
  "lookupStatus": "FOUND",
  "lookupProvider": "MOCK_LOCAL",
  "lookupStatusCode": "MOCK_FOUND",
  "lookupHasRaw": false,
  "lookupHasSoap": false
}
```

## Validaciones

- `cd api && npm.cmd run build`: pass.
- `cd web && npm run build`: pass, con warnings existentes de hooks e imagenes.
- `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`: pass.
- `git diff --check`: pass.

## Bugs / riesgos

- Riesgo QA: DB local no esta alineada con FE-3.2, falta aplicar migracion existente antes del E2E.
- Riesgo QA: API local principal no estaba en `DIAN_THIRD_PARTY_LOOKUP_MODE=mock`.
- Riesgo tooling: Browser local no puede automatizar POS por sandbox.

## Fuera de alcance confirmado

- No SOAP real.
- No certificados.
- No SQL nuevo.
- No pricing.
- No Orders.
- No PRD.
- No remoto.
- No commit.
- No codigo funcional modificado.
