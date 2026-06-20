## ADDED Requirements

### Requirement: POS product view mode selector
El POS SHALL show a visual selector that lets the operator choose product catalog view mode between grid and list.

#### Scenario: Default view mode
- **WHEN** the operator opens `/[tenant]/pos`
- **THEN** the product catalog SHALL use grid mode by default.

#### Scenario: Switch to list mode
- **WHEN** the operator selects `Lista`
- **THEN** the product catalog SHALL render products in one vertical column.

#### Scenario: Switch back to grid mode
- **WHEN** the operator selects `Cuadricula`
- **THEN** the product catalog SHALL render products with the existing card grid layout.

#### Scenario: Keyboard accessible selector
- **WHEN** the selector receives keyboard focus
- **THEN** each view mode option SHALL be reachable and activatable as a native button.

### Requirement: POS grid layout remains unchanged
El modo cuadrícula SHALL preserve the existing product card content and sale behavior.

#### Scenario: Product visible in grid mode
- **WHEN** a product is rendered in grid mode
- **THEN** the product card SHALL show image or initials, name, SKU, unit, final price, stock state and add action.

#### Scenario: Add product in grid mode
- **WHEN** the operator activates an enabled product in grid mode
- **THEN** the POS SHALL use the existing product add behavior.

### Requirement: POS list layout product rows
El modo lista SHALL show each product as one responsive horizontal row/card with the same operational information as grid mode.

#### Scenario: Product visible in list mode
- **WHEN** a product is rendered in list mode
- **THEN** the row SHALL show image or initials, product name, SKU, measurement unit, stock state, final price and add action.

#### Scenario: Add product in list mode
- **WHEN** the operator activates an enabled product in list mode
- **THEN** the POS SHALL use the existing product add behavior.

#### Scenario: Product without stock in list mode
- **WHEN** a product has no stock
- **THEN** list mode SHALL keep the existing disabled/no-stock behavior and visual state.

#### Scenario: Product already in cart in list mode
- **WHEN** a product is already in the cart
- **THEN** list mode SHALL show the existing in-cart indicator.

### Requirement: POS view mode preserves current sale context
Changing product view mode SHALL NOT alter active filters, search, category, subcategory, stock filter, cart contents or sale calculations.

#### Scenario: Filters preserved after view change
- **WHEN** the operator changes between grid and list view
- **THEN** the active search, category, subcategory and stock filters SHALL remain unchanged.

#### Scenario: Cart preserved after view change
- **WHEN** the operator changes between grid and list view
- **THEN** the current cart SHALL remain unchanged.

#### Scenario: Sale logic unchanged
- **WHEN** the operator changes product view mode
- **THEN** pricing, discounts, taxes, stock guards, scanner, scale, peripherals and checkout flow SHALL continue using existing logic.

### Requirement: POS product list responsive layout
The product catalog view modes SHALL remain usable without global horizontal overflow.

#### Scenario: Desktop list layout
- **WHEN** the POS runs on desktop width
- **THEN** list mode SHALL use one vertical column and keep the cart panel layout intact.

#### Scenario: Mobile list layout
- **WHEN** the POS runs on mobile or tablet width
- **THEN** list mode SHALL fit within the product panel width without global horizontal overflow.
