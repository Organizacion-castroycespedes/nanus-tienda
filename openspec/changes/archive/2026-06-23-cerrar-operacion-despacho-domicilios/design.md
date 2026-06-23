## Context

The delivery module already has `delivery_drivers`, `deliveries.driver_id`, and `POST /api/deliveries/:id/assign-driver`. The remaining operational gap is creation-time assignment and printable dispatch documentation.

Current reporting tickets use:

- Controllers under `backend-reporteria/src/modules/reports`.
- Routes under `/reports/...`.
- `JwtAuthGuard` and `ReportAuthzGuard`.
- Services that resolve actor context from JWT.
- SQL adapters that read data.
- `PdfmakeEngine`.
- Thermal ticket templates in `backend-reporteria/src/modules/pdf/templates/tickets`.
- Frontend blob helpers from `web/modules/reporteria/services/reporting.service.ts`.
- `PdfPreviewModal` for preview, download, and browser print.

## Decisions

### Driver assignment on create

`driver_id` remains optional. When present, the API validates that:

- V066 driver schema exists.
- Driver exists in the same tenant.
- Driver is active.

The delivery status remains the normal create status (`CREATED` stored, `CREADO` exposed). Assignment during create does not call state transition APIs and does not write delivery status history beyond the existing create history.

### Driver action after create

The existing `assign-driver` endpoint remains the source of truth. The frontend makes the list/detail action explicit:

- `Asignar repartidor` when empty.
- `Cambiar repartidor` when assigned.
- `Quitar repartidor` from the modal by selecting no driver.

### Delivery ticket

The ticket is operational and non-fiscal. The reporting backend adds:

`GET /reports/deliveries/:deliveryId/ticket`

The adapter reads only delivery-related logistics data with tenant and optional branch scope. It does not call payment mutation, cash, fiscal, inventory, or POS services.

The PDF uses the existing thermal layout and `PdfmakeEngine`; no new PDF engine is introduced.

### Ticket alongside order/sale

Minimum accepted flow:

1. Print or preview existing order/sale ticket using its current flow.
2. Print or preview the new delivery ticket from delivery list/detail.

The documents stay separate. No fiscal/electronic PDF is modified.

## Risks

- Environments without V066 need a clear message when users try to select a driver. Driver listing already returns empty when the table is missing, and create with `driver_id` rejects with a migration message.
- Direct reporting SQL must remain tenant-scoped and read-only.

## Non-Goals

- Cash/recaudo.
- Contraentrega payments.
- Driver liquidation.
- Geolocation/routes.
- Fiscal/electronic invoice changes.
- Inventory changes.
- POS changes.
- ESC/POS direct printing.
