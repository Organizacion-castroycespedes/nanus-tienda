# Evidencia FASE X3 - Contracts + Provider Abstractions

## Scope

Move pure, repository-free, provider-neutral billing contracts into `backend-facturacion-electronica/`.

## Source inventory

Current API source:

- `api/src/modules/electronic-billing/contracts/electronic-billing-commands.ts`
- `api/src/modules/electronic-billing/contracts/electronic-billing-provider.ts`
- `api/src/modules/electronic-billing/contracts/electronic-billing-errors.ts`
- `api/src/modules/electronic-billing/providers/electronic-billing-provider-registry.ts`
- `api/src/modules/electronic-billing/providers/fake-electronic-billing-provider.ts`
- `api/src/modules/electronic-billing/providers/index.ts`
- `api/src/modules/electronic-billing/types/electronic-billing-records.ts`
- `api/src/modules/electronic-billing/providers/electronic-billing-provider-resolver.ts`

## Decision

- Pure canonical commands: move/copy now.
- Pure provider abstraction: move/copy now.
- Fake provider: move/copy now.
- Provider registry: move/copy now.
- Provider resolver: deferred to X4 because it depends on repositories.
- Record-shaped persistence types: deferred to X4 because they are not pure and are coupled to repository shape.

## Target paths

- `backend-facturacion-electronica/src/modules/electronic-billing/domain/electronic-billing.types.ts`
- `backend-facturacion-electronica/src/modules/electronic-billing/contracts/electronic-billing-commands.ts`
- `backend-facturacion-electronica/src/modules/electronic-billing/contracts/electronic-billing-provider.ts`
- `backend-facturacion-electronica/src/modules/electronic-billing/contracts/electronic-billing-errors.ts`
- `backend-facturacion-electronica/src/modules/electronic-billing/providers/electronic-billing-provider-registry.ts`
- `backend-facturacion-electronica/src/modules/electronic-billing/providers/fake-electronic-billing-provider.ts`

## Overlap

Canonical billing provider abstraction is now owned by the billing backend target.

Legacy backend fiscal scaffolding remains separate:

- `backend-facturacion-electronica/src/modules/providers/provider-adapter.interface.ts`
- `backend-facturacion-electronica/src/modules/providers/*`

These are not merged in X3.

## API transition status

- API source retained temporarily.
- API still imports the current runtime contracts.
- No SaleService change in X3.
- No worker change in X3.

## Tests

Backend billing tests added and passing:

- canonical invoice command neutral
- canonical credit note original-document abstraction
- provider registry resolve/error behavior
- fake provider PROCESSING/ACCEPTED behavior
- provider capability assertion

## Validation

- `backend-facturacion-electronica` build: PASS
- `backend-facturacion-electronica` tests: PASS
- `api` build: PASS
- `api` electronic billing tests: PASS
- OpenSpec extraction change: PASS
- OpenSpec overall: PASS
- git diff check: PASS

