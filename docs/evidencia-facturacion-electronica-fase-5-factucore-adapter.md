# Evidencia Fase 5 - FactuCore Client + Provider Adapter

Fecha: 2026-08-27

## Alcance

- `FactuCoreClient` HTTP.
- `FactuCoreProvider` adapter.
- Mapeo de invoice, credit note, status y attachments.
- Manejo de errores HTTP y timeout.
- Resolución de credenciales en runtime.

## Archivos clave

- `api/src/modules/electronic-billing/providers/factucore/factucore.client.ts`
- `api/src/modules/electronic-billing/providers/factucore/factucore.provider.ts`
- `api/src/modules/electronic-billing/providers/factucore/factucore.mapper.ts`
- `api/src/modules/electronic-billing/providers/factucore/factucore.types.ts`
- `api/src/modules/electronic-billing/providers/factucore/factucore.errors.ts`
- `api/src/modules/electronic-billing/providers/factucore/factucore.client.spec.ts`
- `api/src/modules/electronic-billing/providers/factucore/factucore.provider.spec.ts`

## Contrato FactuCore cubierto

- Base URL: `/api/v1/external/documents`
- Auth: `x-client-key`, `x-client-secret`
- Create: `POST /invoices`, `POST /credit-notes`
- Pipeline: `generate-xml`, `sign`, `transmit`
- Status: `GET /:id/status`, `GET /status/by-external-reference/:externalReference`
- Retry: `POST /:id/retry-transmission`
- Downloads: `GET /:id/download/xml`, `GET /:id/download/xml-signed`, `GET /:id/download/pdf`

## Seguridad

- Secretos solo en runtime.
- No persistencia de `clientKey` ni `clientSecret`.
- No logs de headers secretos.
- Resolver por tenant sin mutar singleton compartido.

## Validación

- Tests FactuCore: `PASS`
- API build: `PASS`
- OpenSpec change: pendiente de validar en cierre
- Real FactuCore HTTP: `NO`

