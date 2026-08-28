# Evidencia facturacion electronica fase 3A - repositories base

## Objetivo

Crear la capa de acceso a datos para el dominio neutral de facturacion electronica sin activar FactuCore, DIAN ni flujos de emision.

## Alcance implementado

Se agregaron artefactos de codigo en:

```text
api/src/modules/electronic-billing/
```

Componentes creados:

- `ElectronicBillingModule`
- `electronic-billing.repositories.ts`
- `electronic-billing-records.ts`

Repositories creados:

- `ElectronicBillingProviderRepository`
- `TenantElectronicBillingConfigRepository`
- `ElectronicDocumentRepository`
- `ElectronicDocumentLineRepository`
- `ElectronicDocumentTaxRepository`
- `ElectronicDocumentReferenceRepository`
- `ElectronicDocumentEventRepository`
- `ElectronicDocumentAttachmentRepository`
- `ElectronicDocumentDeliveryRepository`

## Reglas aplicadas

- SQL parameterized.
- Tenant safety in reads for root and child records.
- Compatibility with `PoolClient` for future transactions.
- `create()` for documents accepts `provider_document_id = NULL`.
- `findByExternalReference()` and `findBySource()` respect tenant and allow optional provider.
- `updateStatus()` and `updateError()` use explicit intent.
- `attachments` and `deliveries` persist metadata, not binary files.
- `lines` and `taxes` use bulk insert.

## Validaciones ejecutadas

- `openspec validate integrar-facturacion-electronica-multiproveedor --type change --strict` PASS
- `openspec validate --all --strict` PASS
- `git diff --check` PASS
- `npm run build` in `api/` PASS
- `npx tsx --test src/modules/electronic-billing/repositories/electronic-billing.repositories.spec.ts` PASS

## No alcance confirmado

- No se creo HTTP provider runtime.
- No se creo `FactuCoreClient`.
- No se creo `FactuCoreProvider`.
- No se modificaron `sales` ni `returns`.
- No se ejecuto migracion en QA o PROD.

## Riesgos vivos

- Falta validar el SQL contra una DB local segura si existe.
- Falta 3B para contratos provider.
