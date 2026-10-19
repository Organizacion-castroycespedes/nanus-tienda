## ADDED Requirements

### Requirement: definitive stock rejection is a business response

The sale API SHALL translate a proven PostgreSQL `P0001` rejection for
insufficient aggregate stock or insufficient FEFO lot stock into a structured
HTTP `409` business response after the transaction has rolled back.

#### Scenario: aggregate stock is insufficient

- **WHEN** `inventory_create_sale_v2` rejects an item because scoped aggregate
  stock is lower than the requested quantity
- **THEN** the response contains code `INSUFFICIENT_STOCK`, product id,
  requested quantity, authoritative available quantity, and no SQL text or
  stack trace

#### Scenario: FEFO stock is insufficient

- **WHEN** the product has lot control and eligible FEFO quantity cannot satisfy
  the requested quantity
- **THEN** the response contains code `INSUFFICIENT_FEFO_STOCK`, product id,
  requested quantity, aggregate quantity, and eligible lot quantity

#### Scenario: rollback cannot be proven or the error is unrelated

- **WHEN** the error is not one of the recognized stock rejections or rollback
  fails
- **THEN** the request keeps its existing conservative error path and the POS
  does not treat it as a definitive rejection

### Requirement: definitive stock rejection restores safe cart editing

The POS SHALL preserve the rejected account's items, refresh the displayed
availability, return that account to `DRAFT`, and allow quantity reduction,
item removal, cart cancellation, and a later deliberate retry.

#### Scenario: stale cart quantity is rejected

- **WHEN** a sale is rejected definitively because current availability is lower
  than the cart quantity
- **THEN** the POS shows product, requested quantity, and current availability,
  does not change quantity automatically, and keeps totals consistent with the
  unchanged cart

#### Scenario: user edits after definitive rejection

- **WHEN** the operator reduces quantity, removes the unavailable item, empties
  the cart, or cancels the account after the definitive rejection
- **THEN** the requested action succeeds without verification of an UNKNOWN sale
  and no duplicate sale or payment is created

### Requirement: current availability is checked before payment

The POS SHALL refresh the active branch catalog before opening the payment
dialog and SHALL prevent payment when a unit quantity exceeds the refreshed
aggregate stock. FEFO remains authoritative at the backend boundary.

#### Scenario: refreshed aggregate stock is enough

- **WHEN** the refreshed stock covers all unit quantities in the cart
- **THEN** the payment dialog opens and the existing totals, taxes, and payment
  behavior remain unchanged

#### Scenario: refreshed aggregate stock is insufficient

- **WHEN** a refreshed product stock is below its cart quantity
- **THEN** the payment dialog does not open and the operator receives a clear
  correction message without any sale or payment request

### Requirement: ambiguous recovery remains protected

The POS SHALL retain the existing `UNKNOWN` behavior for timeout, network,
server, idempotency, and unclassified failures.

#### Scenario: ambiguous create response

- **WHEN** the sale response is timeout, network failure, `5xx`, idempotency
  conflict, or otherwise not proven pre-commit
- **THEN** the account keeps `UNKNOWN` and the original `attemptId`; editing,
  cancellation, deletion, and a new idempotency key remain blocked

### Requirement: account and context isolation is preserved

The definitive rejection and any delayed availability or sale callback SHALL
apply only to the originating account, attempt, and POS context.

#### Scenario: delayed rejection after account switch

- **WHEN** account A rejects after the operator switches to account B
- **THEN** only account A receives the stock update and draft transition; B's
  items, totals, payments, and status remain unchanged

#### Scenario: context changes before callback

- **WHEN** the tenant, branch, terminal, POS session, or attempt changes before
  an availability or sale callback returns
- **THEN** the stale callback is ignored and cannot unlock or mutate the new
  context
