## ADDED Requirements

### Requirement: Venta express POS layout
El modulo POS SHALL priorizar la venta rapida con una jerarquia visual centrada en productos, stock, precio, agregar y carrito, siguiendo de forma cercana la referencia visual aprobada.

#### Scenario: POS opened
- **WHEN** the operator opens `/{tenant}/pos`
- **THEN** the main workspace SHALL present the catalog as the primary area
- **AND** the cart SHALL remain visible on desktop or immediately accessible on smaller viewports
- **AND** the layout SHALL feel like a sale-first POS rather than an administrative screen.

### Requirement: Default stock mode
El catalogo POS SHALL iniciar en `Con stock` as the operational base filter.

#### Scenario: Catalog first load
- **WHEN** the POS catalog finishes loading
- **THEN** the active stock filter SHALL be `Con stock`
- **AND** products without stock SHALL be hidden by default
- **AND** the operator SHALL still be able to select `Sin stock` or `Todos` explicitly.

#### Scenario: Clear filters
- **WHEN** the operator clears search, category and subcategory filters
- **THEN** the stock filter SHALL remain in `Con stock`
- **AND** the catalog SHALL not revert automatically to `Todos`.

### Requirement: Compact catalog filters
El modulo POS SHALL show stock, category and subcategory filters as compact chips with counters and clear active state.

#### Scenario: Filters visible
- **WHEN** the catalog is displayed
- **THEN** the operator SHALL see `Con stock`, `Stock bajo`, `Sin stock` and `Todos`
- **AND** each stock filter SHALL show a product counter
- **AND** active non-stock filters SHALL be reflected as compact chips.

#### Scenario: Filters combined
- **WHEN** the operator selects category or subcategory filters
- **THEN** the catalog SHALL respect the combined filter set
- **AND** the cart SHALL remain unchanged.

### Requirement: Product search and scanner behavior
El modulo POS SHALL preserve search, scanner wedge and keyboard behaviors while keeping search easy to reach from the main view.

#### Scenario: Search input available
- **WHEN** the POS screen loads
- **THEN** the operator SHALL be able to reach the product search quickly from the primary workspace
- **AND** existing focus and scanner behavior SHALL continue to work.

#### Scenario: Search interaction
- **WHEN** the operator types, scans or presses Enter or Escape in the search flow
- **THEN** the existing search and scanner rules SHALL continue to function
- **AND** the redesign SHALL NOT break barcode, SKU or name lookup behavior.

### Requirement: Prominent product imagery
El modulo POS SHALL present product images as a primary visual element in both grid and list modes.

#### Scenario: Product has image
- **WHEN** a product has an image or inherited category/subcategory image
- **THEN** the image SHALL be displayed prominently
- **AND** the image SHALL preserve aspect ratio
- **AND** the image SHALL NOT appear as a tiny thumbnail.

#### Scenario: Product has no image
- **WHEN** a product has no usable image
- **THEN** the existing fallback strategy SHALL remain in place
- **AND** the card SHALL remain readable.

### Requirement: Stock status visibility
El modulo POS SHALL show clear stock states using the existing business rules for available, low stock and out of stock.

#### Scenario: Available product
- **WHEN** a product has stock above the low-stock threshold
- **THEN** the UI SHALL show a positive stock state.

#### Scenario: Low stock product
- **WHEN** a product is low on stock
- **THEN** the UI SHALL show the low-stock state clearly.

#### Scenario: Out of stock product
- **WHEN** a product has no stock
- **THEN** the UI SHALL show `Sin stock`
- **AND** the quick add action SHALL remain disabled or guarded according to current business rules.

### Requirement: Product already in cart
El modulo POS SHALL clearly indicate when a product is already in the cart.

#### Scenario: Item already added
- **WHEN** a product is already present in the cart
- **THEN** the card or list row SHALL show an added state
- **AND** the quantity in cart SHALL remain visible in a compact form.

### Requirement: Quick add and weighable actions
El modulo POS SHALL keep quick add and weighable product actions evident and touch-friendly.

#### Scenario: Unit product
- **WHEN** a product is sellable by unit
- **THEN** the UI SHALL expose an obvious add action with a comfortable touch target.

#### Scenario: Weighable product
- **WHEN** a product is sellable by weight or both unit and weight
- **THEN** the UI SHALL preserve the current scale action behavior
- **AND** the redesign SHALL NOT remove weighable-product support.

### Requirement: Grid and list presentation
El modulo POS SHALL support both grid and list views with clear selected state and comparable product hierarchy.

#### Scenario: Grid mode
- **WHEN** grid mode is active
- **THEN** the catalog SHALL prefer larger cards and a readable image-first hierarchy.

#### Scenario: List mode
- **WHEN** list mode is active
- **THEN** the same product information SHALL remain readable in a denser horizontal layout.

### Requirement: Desktop cart presentation
El carrito POS SHALL remain visible on desktop in a compact right column with clear totals and charge access.

#### Scenario: Cart has items
- **WHEN** the cart contains items on desktop
- **THEN** the cart SHALL show item rows, quantity controls, subtotal, discounts and total
- **AND** the charge action SHALL be visually prominent.

#### Scenario: Cart empty
- **WHEN** the cart is empty on desktop
- **THEN** the cart SHALL show an empty state with no fake content
- **AND** the charge action SHALL be disabled.

### Requirement: Mobile cart accessibility
El carrito POS SHALL remain accessible on tablet and mobile through the approved shared cart behavior.

#### Scenario: Mobile with items
- **WHEN** the viewport is smaller than the desktop cart breakpoint and the cart has items
- **THEN** the operator SHALL be able to open the same cart state from the approved controls
- **AND** the cart SHALL allow review, quantity changes and charge initiation.

#### Scenario: Mobile empty cart
- **WHEN** the cart is empty on smaller viewports
- **THEN** the floating cart control SHALL stay hidden or inactive according to the approved fix
- **AND** an empty cart experience, if opened intentionally, SHALL remain coherent.

### Requirement: Responsive parity
El modulo POS SHALL adapt across desktop, tablet and mobile without horizontal overflow or loss of operational access.

#### Scenario: Tablet viewport
- **WHEN** the viewport is tablet-sized
- **THEN** the catalog SHALL remain legible
- **AND** the cart SHALL remain operable
- **AND** the layout SHALL not depend on a full page reload after resize.

#### Scenario: Mobile viewport
- **WHEN** the viewport is mobile-sized
- **THEN** the layout SHALL preserve fast product identification and cart access
- **AND** CTA targets SHALL remain usable by touch.

### Requirement: Touch and accessibility
El modulo POS SHALL preserve keyboard navigation, focus visibility, ARIA state and comfortable touch targets.

#### Scenario: Interactive controls
- **WHEN** the operator uses filters, grid/list, add, cart or charge controls
- **THEN** the controls SHALL expose accessible labels or state where applicable
- **AND** focus-visible behavior SHALL remain available.

### Requirement: Dark mode support
El modulo POS SHALL remain legible in dark mode while preserving the same operational hierarchy.

#### Scenario: Theme switches to dark
- **WHEN** the application is rendered in dark mode
- **THEN** the POS catalog, cards, filters and cart SHALL preserve contrast and readability
- **AND** the layout SHALL still match the same relative hierarchy as light mode.

### Requirement: Business logic unchanged
El rediseno visual del POS SHALL NOT alter pricing, taxes, discounts, inventory rules, payment rules, weight handling, cart persistence or the approved global POS context behavior.

#### Scenario: Visual redesign applied
- **WHEN** the new visual layout is rendered
- **THEN** the existing sale flow SHALL keep using current pricing and cart logic
- **AND** the approved responsive cart fix and global POS context behavior SHALL remain intact.
