# Evidencia scaffolding backend facturacion electronica - FE-2.3

## Objetivo

Crear `backend-facturacion-electronica/` como servicio NestJS independiente para facturacion electronica futura, lookup fiscal mock y estructura base de microservicio.

## Estructura creada

```text
backend-facturacion-electronica/
  package.json
  package-lock.json
  tsconfig.json
  tsconfig.build.json
  nest-cli.json
  .env.example
  README.md
  src/
    main.ts
    app.module.ts
    common/
      errors/
      logging/
      types/
    config/
      electronic-invoicing.config.ts
      provider.config.ts
    modules/
      health/
      fiscal-lookup/
      providers/
      sync/
      invoices/
      dian/
      certificates/
      documents/
      retries/
      webhooks/
  test/
    health.spec.ts
    fiscal-lookup.spec.ts
```

## Endpoints creados

### `GET /health`

Devuelve estado del servicio:

```json
{
  "status": "ok",
  "service": "backend-facturacion-electronica",
  "timestamp": "iso-date",
  "environment": "development"
}
```

### `POST /fiscal-lookup/preview`

Preview mock para `CUSTOMER` y `SUPPLIER`.

Reglas implementadas:

- `provider = MOCK_LOCAL`.
- No llama DIAN.
- No llama `api/`.
- No crea customers.
- No crea suppliers.
- Normaliza `documentNumber` quitando espacios, puntos y guiones.
- Rechaza `partyType` distinto de `CUSTOMER` o `SUPPLIER`.

## Modulos creados

| Modulo | Estado |
| --- | --- |
| `health` | Funcional. |
| `fiscal-lookup` | Funcional con mock preview. |
| `providers` | Funcional con `FiscalProviderAdapter` y `MockFiscalProviderService`. |
| `sync` | Preparatorio, sin llamadas a `api/`. |
| `invoices` | Placeholder. |
| `dian` | Placeholder, sin DIAN real. |
| `certificates` | Placeholder, sin certificados reales. |
| `documents` | Placeholder. |
| `retries` | Placeholder. |
| `webhooks` | Placeholder. |

## Configuracion

`.env.example` creado sin secretos reales:

- `NODE_ENV`
- `PORT`
- `SERVICE_NAME`
- `FISCAL_PROVIDER`
- `API_BASE_URL`
- `API_INTERNAL_TOKEN`
- `DIAN_WSDL_URL`
- `DIAN_CERT_PATH`
- `DIAN_CERT_PASSWORD`
- `LOG_LEVEL`

Los campos sensibles quedan vacios.

## Comandos ejecutados

Desde `backend-facturacion-electronica/`:

```powershell
npm.cmd install
npm.cmd run build
npm.cmd test
$env:NODE_ENV='test'; $env:PORT='4030'; npm.cmd run start
```

Desde raiz:

```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:4030/health
Invoke-RestMethod -Method Post -Uri http://localhost:4030/fiscal-lookup/preview -ContentType 'application/json' -Body '{"partyType":"CUSTOMER","documentTypeCode":"31","documentNumber":"900.123-456"}'
openspec.cmd validate add-electronic-invoicing-customer-backend --type change --strict --json
git diff --check
```

## Resultado build/tests

`npm.cmd install`:

- Instalacion completada.
- NPM reporto 8 vulnerabilidades en arbol de dependencias: 6 moderate y 2 high.
- No se ejecuto `npm audit fix` porque podria cambiar versiones fuera del alcance.

`npm.cmd run build`:

- Paso.

`npm.cmd test`:

- Paso.
- 6 tests ejecutados.
- 6 tests pasaron.

Tests cubiertos:

- health responde ok.
- fiscal lookup preview `CUSTOMER` responde mock.
- fiscal lookup preview `SUPPLIER` responde mock.
- `documentNumber` se normaliza.
- `partyType` invalido falla.
- provider actual es `MOCK_LOCAL`.

Smoke HTTP local:

- `GET http://localhost:4030/health` respondio `status = ok`.
- `POST http://localhost:4030/fiscal-lookup/preview` respondio `provider = MOCK_LOCAL` y `documentNumberNormalized = 900123456`.
- El proceso local de smoke test fue detenido despues de validar.

## Confirmacion de no alcance

No se modifico:

- `api/`
- `web/`
- `backend-reporteria/`
- `scripts/database/`
- migraciones
- POS
- compras
- ventas
- pedidos
- reportes

No se ejecuto:

- DIAN real.
- GetAcquirer real.
- proveedor tecnologico real.
- certificados reales.
- conexion a PRD.
- servidor remoto.

## Riesgos vivos

- NPM reporta vulnerabilidades en dependencias; requiere revision dedicada antes de usar en ambiente expuesto.
- No hay auth servicio-a-servicio todavia.
- No hay integracion real con `api/`.
- No hay persistencia de logs de lookup.
- No hay idempotencia persistente todavia.
- `sync` aun es preparatorio.
- Modulos DIAN/certificados/documentos son placeholders.

## Proximos pasos

1. Definir contratos internos backend FE -> `api` para upsert customer/supplier.
2. Disenar persistencia de logs seguros de lookup/sync.
3. Agregar idempotencia persistente por `tenantId + partyType + documentTypeCode + documentNumberNormalized`.
4. Crear adapter mock con escenarios `FOUND`, `NOT_FOUND`, `ERROR` y `SKIPPED`.
5. Disenar auth servicio-a-servicio.
6. Integrar `api/` solo en fase FE-2.6 autorizada.
