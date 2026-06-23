## Why

Domicilios already supports creation, state management, sale links, and driver administration, but dispatch work is still incomplete. Staff need to assign a driver during delivery creation, change the driver afterward, and print an operational delivery ticket using the existing reporting backend.

## What Changes

- Add optional active-driver selection to `/{tenant}/deliveries/new`.
- Allow assignment, change, and clear driver actions from delivery list/detail with clearer labels.
- Ensure `driver_id` can be saved during delivery creation and validated against the same tenant/active-driver rules used by `assign-driver`.
- Add a delivery ticket PDF endpoint in `backend-reporteria` under the existing `/reports/...` pattern.
- Add frontend ticket preview/print/download using the existing reporting PDF modal and blob flow.
- Document how the delivery ticket is printed alongside existing order or sale tickets without merging fiscal documents.
- Keep cash, payments, POS, fiscal/electronic invoicing, inventory, ESC/POS, and state transitions unchanged.

## Capabilities

### New Capabilities
- `deliveries-dispatch-operation`: Driver selection during delivery creation, post-creation driver assignment, and operational delivery ticket generation.

### Modified Capabilities
- Delivery creation accepts optional `driver_id`.
- Delivery list/detail actions expose driver and ticket operations.

## Impact

- API delivery DTO/service changes for optional `driver_id` on create.
- Frontend deliveries form, list/detail actions, service, and tests.
- Backend-reporteria reports controller/service/adapter/template/types for delivery tickets.
- OpenSpec and QA evidence documentation.
- No destructive SQL.
- No caja/recaudo, payments, POS, fiscal/electronic invoicing, inventory, or ESC/POS changes.
