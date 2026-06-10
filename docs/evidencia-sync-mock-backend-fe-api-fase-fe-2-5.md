# Evidencia sync mock backend FE -> api - Fase FE-2.5

## Objetivo

Implementar sincronizacion mock desde `backend-facturacion-electronica` hacia `api/` para customers y suppliers, usando `MOCK_LOCAL` y endpoints fiscales existentes.

## Archivos modificados

- `backend-facturacion-electronica/.env.example`
- `backend-facturacion-electronica/README.md`
- `backend-facturacion-electronica/src/modules/fiscal-lookup/fiscal-lookup.controller.ts`
- `backend-facturacion-electronica/src/modules/fiscal-lookup/fiscal-lookup.module.ts`
- `backend-facturacion-electronica/src/modules/sync/sync.module.ts`
- `backend-facturacion-electronica/src/modules/sync/sync.service.ts`
- `backend-facturacion-electronica/src/modules/sync/sync.types.ts`
- `backend-facturacion-electronica/test/sync.spec.ts`
- `openspec/changes/add-electronic-invoicing-customer-backend/tasks.md`

## Endpoint creado

```http
POST /fiscal-lookup/sync
```

Body:

```json
{
  "partyType": "CUSTOMER",
  "documentTypeCode": "31",
  "documentNumber": "900123456"
}
```

Respuesta esperada:

```json
{
  "provider": "MOCK_LOCAL",
  "partyType": "CUSTOMER",
  "documentTypeCode": "31",
  "documentNumberNormalized": "900123456",
  "lookupStatus": "FOUND",
  "syncAction": "CREATE",
  "targetId": "uuid",
  "targetType": "CUSTOMER",
  "message": "customer created from mock lookup"
}
```

## Configuracion usada

Variables:

```env
FISCAL_PROVIDER=MOCK_LOCAL
API_BASE_URL=http://localhost:4022
API_INTERNAL_TOKEN=<local-token>
```

Reglas:

- `API_BASE_URL` no esta hardcodeado.
- `API_INTERNAL_TOKEN` no esta hardcodeado.
- Si falta `API_INTERNAL_TOKEN`, sync falla con error claro.
- Preview sigue funcionando sin `API_BASE_URL` ni `API_INTERNAL_TOKEN`.
- El token no se loggea.

## Reglas implementadas

- Usa `FiscalProviderAdapter` actual.
- Usa `MOCK_LOCAL`.
- Normaliza `documentNumber` quitando espacios, puntos y guiones.
- Soporta `CUSTOMER` y `SUPPLIER`.
- Para `CUSTOMER` llama:
  - `GET /api/electronic-invoicing/customers?documentNumber=...&documentTypeCode=...`
  - `POST /api/electronic-invoicing/customers`
  - `PATCH /api/electronic-invoicing/customers/:id`
- Para `SUPPLIER` llama:
  - `GET /api/electronic-invoicing/suppliers?documentNumber=...&documentTypeCode=...`
  - `POST /api/electronic-invoicing/suppliers`
  - `PATCH /api/electronic-invoicing/suppliers/:id`
- No guarda raw response.
- No implementa retries persistentes.
- Si `api/` responde `409`, consulta de nuevo y trata el resultado como conflicto idempotente.
- Si `api/` no esta disponible, responde error claro.

## Pruebas unitarias

Comando:

```bash
cd backend-facturacion-electronica && npm.cmd test
```

Resultado:

- 15 tests.
- 15 pass.
- 0 fail.

Casos cubiertos:

- sync `CUSTOMER` crea si no existe.
- sync `CUSTOMER` actualiza si existe.
- sync `SUPPLIER` crea si no existe.
- sync `SUPPLIER` actualiza si existe.
- `partyType` invalido falla.
- `api/` unavailable falla claro.
- no loggea token.
- preview sigue funcionando.
- idempotencia: segunda llamada no duplica.
- `409` de `api/` se maneja como conflicto idempotente.

## Build

Comando:

```bash
cd backend-facturacion-electronica && npm.cmd run build
```

Resultado: PASS.

## Validaciones OpenSpec y diff

```bash
openspec.cmd validate add-electronic-invoicing-customer-backend --type change --strict --json
```

Resultado: PASS.

```bash
git diff --check
```

Resultado: PASS.

Nota: `git diff --check` reporto solo warnings de normalizacion futura LF/CRLF en archivos ya tocados. No reporto errores de whitespace.

## Prueba local real

No se ejecuto prueba local real contra `api/` en esta fase.

Motivo:

- La fase pidio prueba local como opcional.
- Para prueba real se necesita un `API_INTERNAL_TOKEN` local valido contra `JwtAuthGuard` de `api/`.
- No se deben exponer tokens ni secretos.

## Confirmaciones

- No se consumio DIAN real.
- No se configuro certificado real.
- No se guardo raw response.
- No se toco PRD real.
- No se toco servidor remoto.
- No se modifico `web/`.
- No se modifico `backend-reporteria/`.
- No se modifico SQL ni migraciones.
- No se modifico `api/`.

## Riesgos vivos

- Falta contrato formal de token interno servicio-a-servicio para `backend-facturacion-electronica -> api`.
- La idempotencia es operativa contra consulta previa a `api/`; no hay tabla persistente de idempotency keys todavia.
- Falta prueba API real local con token valido y cleanup de fixtures.
- Falta definir si `PATCH` debe ser `SKIP` cuando no cambia ningun campo en `api/`.

## Proximos pasos

1. Definir mecanismo seguro de autenticacion interna entre servicios.
2. Ejecutar prueba local real con `api/` levantado, token valido y cleanup.
3. Agregar correlation id e idempotency key persistente.
4. Preparar hardening de errores y timeouts HTTP.
