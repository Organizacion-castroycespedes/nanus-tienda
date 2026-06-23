# order-delivery-create-flow Specification

## ADDED Requirements

### Requirement: Order delivery creation captures operational fields

The order delivery creation flow SHALL capture the same operational delivery fields needed by the main delivery creation flow.

#### Scenario: User creates delivery from order with operational fields

- **GIVEN** an order has no delivery
- **WHEN** the user opens the delivery action from the order
- **THEN** the form captures contact, phone, address, reference, fee, and notes

#### Scenario: User selects active driver during order delivery creation

- **GIVEN** active delivery drivers exist for the tenant
- **WHEN** the user creates a delivery from an order
- **THEN** the user can select a driver by name and phone

#### Scenario: User selects payment method when applicable

- **GIVEN** active payment methods exist
- **WHEN** the user creates a delivery from an order
- **THEN** the user can select a payment method without typing technical IDs

#### Scenario: Totals are calculated from order subtotal and delivery fee

- **GIVEN** the order has a total
- **WHEN** the user enters a delivery fee
- **THEN** subtotal is the order total and total equals subtotal plus delivery fee

### Requirement: Order delivery modal responsive behavior

The order delivery modal SHALL keep content and actions accessible within the viewport.

#### Scenario: Modal content scrolls vertically

- **GIVEN** the modal content is taller than the viewport
- **WHEN** the user opens the order delivery modal
- **THEN** the modal provides vertical scrolling

#### Scenario: Footer actions remain reachable

- **GIVEN** the user is on a small screen
- **WHEN** the user fills the order delivery form
- **THEN** create and cancel actions remain reachable by scrolling

#### Scenario: No horizontal overflow occurs

- **GIVEN** the user opens the modal on mobile or narrow desktop
- **WHEN** the modal renders
- **THEN** content wraps without global horizontal overflow

### Requirement: Order delivery duplicate handling

The order delivery flow SHALL not create duplicate deliveries for the same order.

#### Scenario: Existing delivery is shown instead of duplicate create form

- **GIVEN** the order already has a delivery
- **WHEN** the user opens the order delivery modal
- **THEN** the existing delivery summary is shown

#### Scenario: User can open existing delivery management

- **GIVEN** the existing delivery is shown
- **WHEN** the user selects the management action
- **THEN** the user is navigated to Domicilios filtered by the order

#### Scenario: Existing delivery can be inspected

- **GIVEN** the existing delivery is shown
- **WHEN** the user selects view delivery
- **THEN** the delivery detail is shown without creating a duplicate

### Requirement: Order delivery cash context alignment

Delivery created from order SHALL align with current cash session rules.

#### Scenario: Delivery created from order appears in current delivery scope

- **GIVEN** the user has an open cash session
- **WHEN** the user creates a delivery from an order
- **THEN** the delivery is associated with current cash context and appears in current scope

#### Scenario: Zero delivery fee can still be logistics in current scope

- **GIVEN** the delivery fee is zero
- **WHEN** the delivery is created from an order during the current cash session
- **THEN** it appears in current delivery scope with zero cash impact

#### Scenario: Order total is not duplicated through delivery

- **GIVEN** a delivery is created from an order
- **WHEN** cash closing summarizes deliveries
- **THEN** only delivery fee contributes as delivery cash impact
