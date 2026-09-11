# Evidencia facturacion electronica fase 3B - provider contracts

## Objetivo

Definir el contrato neutral entre Manus y proveedores de facturacion electronica sin exponer FactuCore ni acoplar el dominio a un solo runtime.

## Alcance implementado

Se agregaron artefactos de codigo en:

```text
api/src/modules/electronic-billing/contracts/
api/src/modules/electronic-billing/providers/
```

Componentes creados:

- `ElectronicBillingProvider`
- `ElectronicBillingProviderRegistry`
- `ElectronicBillingProviderResolver`
- `FakeElectronicBillingProvider`
- canonical commands, results, context, and controlled errors

## Contratos creados

- `ElectronicBillingProviderContext`
- `IssueElectronicInvoiceCommand`
- `IssueElectronicCreditNoteCommand`
- `ElectronicOriginalDocumentReference`
- `ElectronicCustomer`
- `ElectronicDocumentLineInput`
- `ElectronicTaxInput`
- `ElectronicPayment`
- `ElectronicBillingProviderDocumentResult`
- `ElectronicBillingProviderStatusResult`
- `ElectronicBillingProviderAttachmentResult`
- `ElectronicBillingProviderCapabilities`

## Reglas aplicadas

- Provider context is immutable and per-request.
- No plaintext secret fields were added.
- Resolver reads tenant config and never reuses config across tenants.
- Provider registry resolves by stable provider code.
- Fake provider records received commands for tests.
- Provider contract stays neutral and does not expose vendor choreography.

## Validaciones ejecutadas

- `npx tsx --test src/modules/electronic-billing/**/*.spec.ts` PASS
- `npm run build` in `api/` PASS
- `git diff --check` PASS
- `openspec validate integrar-facturacion-electronica-multiproveedor --type change --strict` PASS
- `openspec validate --all --strict` PASS

## FactuCore leakage check

- Production code search in `api/src/modules/electronic-billing/` found no FactuCore-specific tokens.
- Test files still mention `FACTUCORE` only in repository coverage, not in provider runtime code.

## No alcance confirmado

- No se crearon controllers.
- No se hizo HTTP FactuCore.
- No se modificaron sales ni returns.
- No se crearon migraciones.
- No se ejecuto base de datos.

## Riesgo vivo

- Falta Fase 4 para application service y aggregate transaction boundary.
