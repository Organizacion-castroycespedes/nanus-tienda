# deliveries-sales-link Specification

## Purpose

Ensure deliveries remain linked across the Pedido -> Venta -> Domicilio flow without duplicating logistics records or changing fiscal/payment behavior.

## ADDED Requirements

### Requirement: Delivery sale association
The system SHALL associate deliveries with sales when a related order is converted into a sale.

#### Scenario: Delivery keeps order reference
- **WHEN** a delivery is created from an order
- **THEN** the delivery keeps its `order_id`

#### Scenario: Generated sale is linked to existing delivery
- **WHEN** an order with an existing delivery generates a sale
- **THEN** the existing delivery records the generated sale `sale_id`
- **AND** the delivery still keeps its `order_id`

#### Scenario: Delivery detail shows both references
- **WHEN** a delivery has both order and sale references
- **THEN** the delivery detail shows both Pedido and Venta references when available

#### Scenario: Delivery list filters by sale
- **WHEN** an authorized user opens the delivery list with a `sale_id` filter
- **THEN** the system lists deliveries associated with that sale

### Requirement: No duplicate delivery for same commercial flow
The system SHALL avoid duplicate deliveries for the same order or sale flow.

#### Scenario: Order already has delivery
- **WHEN** an order already has a delivery
- **THEN** the order UI exposes Ver/Gestionar domicilio instead of creating another one

#### Scenario: Sale already has delivery
- **WHEN** a sale already has a delivery
- **THEN** the sale UI exposes Ver/Gestionar domicilio instead of creating another one

#### Scenario: Sale linked to order with delivery
- **WHEN** a sale belongs to an order that already has a delivery
- **THEN** creating another delivery for the sale is blocked
- **AND** the existing order delivery is the one associated to the sale

#### Scenario: Manual creation remains available
- **WHEN** no order or sale association exists
- **THEN** manual delivery creation remains available using the required operational fields

### Requirement: Sale association does not mutate fiscal/payment state
Associating a delivery with a sale SHALL NOT mutate payment, cash, inventory, tax, or fiscal invoice behavior.

#### Scenario: Payment state is untouched
- **WHEN** a delivery receives a `sale_id`
- **THEN** the system does not create payments or payment events

#### Scenario: Sale totals are untouched
- **WHEN** a delivery receives a `sale_id`
- **THEN** the system does not alter sale totals, discounts, taxes or invoice amounts

#### Scenario: Inventory is untouched
- **WHEN** a delivery receives a `sale_id`
- **THEN** the system does not alter stock or inventory movements

#### Scenario: Cash session is untouched
- **WHEN** a delivery receives a `sale_id`
- **THEN** the system does not open, close or mutate cash sessions

#### Scenario: Electronic invoicing is untouched
- **WHEN** a delivery receives a `sale_id`
- **THEN** the system does not alter electronic invoicing status or fiscal document behavior
