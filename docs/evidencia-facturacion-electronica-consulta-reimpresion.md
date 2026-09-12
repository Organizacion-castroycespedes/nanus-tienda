# Evidencia: consulta y reimpresión de factura electrónica

## Implementado

- `SalesReportAdapter.getElectronicInvoice` reads one document by `tenant_id`, sale, and branch scope.
- Ambiguous documents fail closed instead of choosing one silently.
- `GET /reports/pos-sales/:saleId/electronic-invoice-data` exposes a safe read model.
- `GET /reports/pos-sales/:saleId/electronic-invoice` renders the persisted fiscal representation.
- POS reporteria exposes `Ver factura electrónica`; the same read-only endpoint supports reprint.
- Only `ACCEPTED` documents produce an accepted fiscal representation.
- Missing, pending, processing, rejected, technical-error, and cancelled documents cannot claim acceptance.

## Safety

The lookup and renderer use Manus database data only. They do not refresh status, call FactuCore, call DIAN, create outbox events, or mutate fiscal documents. The current authorization guards remain active on the report controller.

## Data policy

CUFE, fiscal number, accepted timestamp, response code/message, and tracking ID are used when persisted. QR and validation timestamp remain unavailable and are not fabricated. Physical printer QA, automatic processing, on-demand issuance, and global worker certification remain open.
