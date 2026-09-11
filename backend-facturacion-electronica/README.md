# backend-facturacion-electronica

Servicio NestJS especializado para facturacion electronica de Manus Tienda.

## Proposito

Este backend nace como bounded context de facturacion electronica. En esta fase prepara la estructura para:

- lookup fiscal de customers y suppliers.
- normalizacion fiscal.
- adapters provider-agnostic.
- sync futuro hacia `api/`.
- XML/UBL futuro.
- CUFE/CUDE futuro.
- DIAN o proveedor tecnologico futuro.
- certificados, documentos, webhooks y reintentos futuros.

`api/` sigue siendo el owner operativo de `customers`, `suppliers`, POS, ventas, pedidos, compras, pagos e inventario.

## Que hace en esta fase

- Expone `GET /health`.
- Expone `POST /fiscal-lookup/preview`.
- Expone `POST /fiscal-lookup/sync` para sincronizacion mock hacia `api/`.
- Usa `MOCK_LOCAL` por defecto.
- Incluye adapter `DIAN_DIRECT` preparado con fixtures SOAP/XML locales, sin red DIAN.
- Normaliza `documentNumber` quitando espacios, puntos y guiones.
- Acepta `partyType` `CUSTOMER` y `SUPPLIER`.
- Incluye estructura futura de modulos.

## Que NO hace todavia

- No consulta DIAN real.
- No consulta proveedor tecnologico real.
- No llama DIAN/proveedor externo.
- No firma WS-Security real todavia.
- No genera XML/UBL.
- No calcula CUFE/CUDE.
- No usa certificados reales.
- No guarda secretos.
- No toca PRD.

## Instalacion

```bash
npm install
```

## Ejecucion local

```bash
npm run start:dev
```

Por defecto escucha en `PORT=4030`.

## Build

```bash
npm run build
```

## Tests

```bash
npm test
```

## Endpoints

### `GET /health`

Respuesta:

```json
{
  "status": "ok",
  "service": "backend-facturacion-electronica",
  "timestamp": "2026-05-31T00:00:00.000Z",
  "environment": "development"
}
```

### `POST /fiscal-lookup/preview`

Request:

```json
{
  "partyType": "CUSTOMER",
  "documentTypeCode": "31",
  "documentNumber": "900123456"
}
```

### `POST /fiscal-lookup/sync`

Consulta `MOCK_LOCAL`, normaliza documento y llama `api/` usando los endpoints fiscales de customers o suppliers. Requiere `API_BASE_URL` y `API_INTERNAL_TOKEN`.

Request:

```json
{
  "partyType": "SUPPLIER",
  "documentTypeCode": "31",
  "documentNumber": "900123456"
}
```

Respuesta:

```json
{
  "provider": "MOCK_LOCAL",
  "partyType": "SUPPLIER",
  "documentTypeCode": "31",
  "documentNumberNormalized": "900123456",
  "lookupStatus": "FOUND",
  "syncAction": "CREATE",
  "targetId": "uuid",
  "targetType": "SUPPLIER",
  "message": "supplier created from mock lookup"
}
```

Respuesta mock:

```json
{
  "provider": "MOCK_LOCAL",
  "partyType": "CUSTOMER",
  "documentTypeCode": "31",
  "documentNumberNormalized": "900123456",
  "legalName": "Cliente Mock 900123456",
  "fiscalEmail": "cliente.mock@example.com",
  "lookupStatus": "FOUND",
  "message": "Mock fiscal lookup result"
}
```

## Variables de entorno

Ver `.env.example`.

| Variable | Uso |
| --- | --- |
| `NODE_ENV` | Ambiente de ejecucion. |
| `PORT` | Puerto local. |
| `SERVICE_NAME` | Nombre reportado por health. |
| `FISCAL_PROVIDER` | Provider fiscal actual. En esta fase debe ser `MOCK_LOCAL`. |
| `API_BASE_URL` | URL local/controlada de `api/`, por ejemplo `http://localhost:4022`. |
| `API_INTERNAL_TOKEN` | Bearer token interno para llamar `api/`. No incluir secretos reales. |
| `credential_reference` | Referencia neutral al secreto del provider. En 8C se resuelve desde `env:<NOMBRE_ENV>`. |
| `DIAN_WSDL_URL` | URL futura DIAN. No se usa todavia. |
| `DIAN_ENDPOINT_URL` | Endpoint SOAP controlado. En pruebas debe ser localhost. |
| `DIAN_ALLOW_EXTERNAL_CALLS` | Bloquea llamadas externas por defecto. Mantener `false` en local/CI. |
| `DIAN_CERT_PATH` | Ruta futura de certificado. No se usa todavia. |
| `DIAN_CERT_PASSWORD` | Password futura por secreto. No se usa todavia. |
| `DIAN_ENVIRONMENT` | Ambiente futuro DIAN. Default documental: `HABILITACION`. |
| `DIAN_TIMEOUT_MS` | Timeout futuro para DIAN. No se usa para red en FE-3.1. |
| `DIAN_GET_ACQUIRER_ACTION` | Action GetAcquirer documentado por DIAN. |
| `DIAN_WS_SECURITY_TIMESTAMP_TTL_MS` | Vigencia conceptual de Timestamp WS-Security en milisegundos. |
| `DIAN_GET_ACQUIRER_FIXTURE_PATH` | Ruta local opcional de fixture SOAP/XML sintetico para `DIAN_DIRECT`. Solo pruebas/local. |
| `LOG_LEVEL` | Nivel de logs. |

## Secretos de provider

La fase 8C usa resolucion por entorno.

- La base de datos guarda solo `credential_reference`.
- El valor secreto vive en la variable de entorno nombrada por la referencia.
- La variable de entorno debe contener JSON con campos string.
- Ejemplo: `env:FACTUCORE_TENANT_A` lee `FACTUCORE_TENANT_A`.
- No guardar valores reales en el repo, docs, OpenSpec ni logs.

## DIAN_DIRECT fixture mode

`DIAN_DIRECT` existe para preparar GetAcquirer sin consumir DIAN real.

Reglas FE-3.1:

- `FISCAL_PROVIDER=MOCK_LOCAL` sigue siendo el default.
- `FISCAL_PROVIDER=DIAN_DIRECT` usa fixture local o XML sintetico embebido.
- No carga WSDL real.
- No usa certificado real.
- No llama red.
- No guarda raw response en salida normal.
- El request builder solo arma XML conceptual con `identificationType` e `identificationNumber`.
- FE-3.2 agrega validacion de configuracion y headers conceptuales WS-Security/WS-A.
- FE-3.3 permite probar `DIAN_DIRECT` contra un mock SOAP HTTP local.
- WS-Security sigue siendo conceptual: no hay firma criptografica real todavia.
- Los TODO de firma real o integracion con libreria WS-Security quedan para fase posterior.
- No guardar certificados en repo.
- No imprimir `DIAN_CERT_PASSWORD` en errores ni logs.
- Las llamadas HTTP se bloquean si `DIAN_ALLOW_EXTERNAL_CALLS` no es `true` y el endpoint no es `localhost`, `127.0.0.1` o `::1`.

## Roadmap

| Fase | Alcance |
| --- | --- |
| FE-2.3 | Scaffolding inicial, health y lookup mock. |
| FE-2.4 | Contratos de sync fiscal y hardening de config. |
| FE-2.5 | Sync mock backend FE -> `api` para customers/suppliers. |
| FE-2.6 | Hardening de contrato interno e idempotencia persistente. |
| FE-2.7 | GetAcquirer real para customers. |
| FE-2.8 | Estrategia fiscal provider-agnostic para suppliers. |

## Guardrails

- No guardar raw response DIAN completo.
- No guardar certificados o passwords en repo.
- No escribir directo en tablas operativas saltando `api/`.
- No bloquear POS con latencia DIAN/proveedor.
- Mantener idempotencia por `tenantId + partyType + documentType + documentNumberNormalized`.
