## ADDED Requirements

### Requirement: Sale-first POS layout
El modulo POS SHALL priorizar el flujo de venta activa colocando busqueda, seleccion de productos y acciones del carrito dentro del viewport principal.

#### Scenario: Operator opens POS
- **WHEN** the operator enters the POS module and the page finishes loading
- **THEN** the product search input SHALL be visible without scrolling
- **AND** the cart summary SHALL be visible or accessible through a floating control
- **AND** disconnected peripherals SHALL NOT occupy the primary workspace.

### Requirement: Product search autofocus
El modulo POS SHALL enfocar automaticamente el buscador de productos al cargar la vista y SHALL restore focus after successful product additions when no blocking modal is open.

#### Scenario: POS page loaded
- **WHEN** the POS UI is ready
- **THEN** the product search input SHALL receive focus automatically.

#### Scenario: Product added
- **WHEN** the operator adds a product to the cart successfully
- **THEN** focus SHALL return to the product search input.

#### Scenario: Search matching
- **WHEN** the operator types in the product search input
- **THEN** the POS SHALL search by product name, SKU, description, barcode candidates and internal code candidates already exposed by the product payload.

### Requirement: Persistent cart
El modulo POS SHALL mantener el carrito visible o accesible durante toda la venta.

#### Scenario: Desktop viewport
- **WHEN** the viewport is desktop-sized and the cart has at least one item
- **THEN** the cart SHALL be displayed as a sticky side panel
- **AND** the final total SHALL be visible
- **AND** the charge action SHALL be visible.

#### Scenario: Empty cart desktop viewport
- **WHEN** the viewport is desktop-sized and the cart has no items
- **THEN** the cart panel SHALL display an empty state
- **AND** the operator SHALL still be able to search or scan products.

#### Scenario: Mobile viewport
- **WHEN** the viewport is mobile-sized and the cart has at least one item
- **THEN** the cart SHALL be represented as a bottom floating summary
- **AND** tapping the summary SHALL open a bottom sheet with the full cart.

#### Scenario: Header access
- **WHEN** the viewport is tablet or mobile sized and the cart has items
- **THEN** the global header cart control and the POS floating cart control SHALL open the same cart sheet state
- **AND** closing one control SHALL update the same shared state
- **AND** the cart SHALL remain closed when empty.

### Requirement: Compact sale context
El modulo POS SHALL compactar la informacion de usuario actual, estado de venta y cliente.

#### Scenario: Sale context visible
- **WHEN** the operator opens the POS module
- **THEN** the current user SHALL be visible
- **AND** the sale state SHALL be visible
- **AND** the selected customer SHALL be visible
- **AND** these elements SHALL NOT consume excessive vertical space.

### Requirement: Global POS context bootstrap
La aplicacion SHALL resolver el contexto POS activo a nivel de provider o layout, without depending on visiting `/pos` first.

#### Scenario: Authenticated session with active POS
- **WHEN** the user authenticates successfully and has an active POS session for the current tenant
- **THEN** the header SHALL show the resolved role or user identity, terminal, branch, and live date or time
- **AND** the values SHALL come from the resolved POS session state, not from fake placeholders.

#### Scenario: No active POS session
- **WHEN** the user authenticates successfully but no valid POS session exists
- **THEN** the application SHALL keep navigation available
- **AND** the header SHALL use a safe state instead of inventing terminal or branch values.

### Requirement: Compact product filters
El modulo POS SHALL mostrar filtros de productos como chips compactos con contador.

#### Scenario: Product filters displayed
- **WHEN** the POS product list is loaded
- **THEN** the operator SHALL see product filter chips for all products, in-stock, low-stock and out-of-stock
- **AND** each filter SHALL display its product count
- **AND** the active filter SHALL have a clear selected state.

#### Scenario: Filter changed
- **WHEN** the operator changes the product filter
- **THEN** the current cart SHALL remain unchanged.

### Requirement: Modernized product cards
El modulo POS SHALL mostrar tarjetas de producto con jerarquia visual clara para nombre, codigo/SKU, unidad, precio, stock y accion principal.

#### Scenario: Product available
- **WHEN** a product is available
- **THEN** its card SHALL display product name, SKU or code, unit, final price, stock and quick add action.

#### Scenario: Product out of stock
- **WHEN** a product has no stock
- **THEN** its card SHALL communicate the out-of-stock state
- **AND** the quick add action SHALL be disabled or guarded according to current business rules.

#### Scenario: Product already added
- **WHEN** a product has been added to the cart
- **THEN** its card SHALL be allowed to show a selected or added state
- **AND** the cart SHALL reflect the added quantity.

### Requirement: Compact peripheral visibility
El modulo POS SHALL mostrar scanner y balanza en un area contextual compacta.

#### Scenario: Scanner disconnected
- **WHEN** the scanner is disconnected and the operator opens the POS
- **THEN** the scanner simulator panel SHALL be collapsed or hidden
- **AND** a compact status indicator SHALL be allowed.

#### Scenario: Scale disconnected
- **WHEN** the scale is disconnected and the operator opens the POS
- **THEN** the scale simulator panel SHALL be collapsed or hidden
- **AND** a compact status indicator SHALL be allowed.

#### Scenario: Diagnostic mode enabled
- **WHEN** diagnostic or mock-device mode is enabled
- **THEN** the operator with applicable access SHALL be able to expand scanner and scale mock controls.

### Requirement: Mock peripheral controls visibility
Los controles MOCK/SIMULATOR SHALL mostrarse solo cuando aplique una condicion de desarrollo, diagnostico, flag activo o permiso tecnico.

#### Scenario: Production operation
- **WHEN** the POS is running in normal production mode and scanner or scale is disconnected
- **THEN** MOCK/SIMULATOR controls SHALL NOT occupy the main POS workspace.

#### Scenario: Mock devices flag enabled
- **WHEN** the mock devices feature flag is enabled
- **THEN** scanner and scale mock controls SHALL be available through a collapsible diagnostic panel.

### Requirement: Weighable product operation
El modulo POS SHALL permitir acciones contextuales para productos pesables.

#### Scenario: Product is weighable and scale is connected
- **WHEN** a product uses a weight unit and the scale is connected
- **THEN** the product card or cart action SHALL expose a read-scale action.

#### Scenario: Product is weighable and scale is disconnected
- **WHEN** a product uses a weight unit and the scale is disconnected
- **THEN** the UI SHALL communicate that the scale is unavailable
- **AND** it SHALL NOT block unrelated product sales.

### Requirement: Cart financial summary
El carrito SHALL mostrar resumen financiero claro.

#### Scenario: Cart has items
- **WHEN** the cart has one or more items
- **THEN** the cart SHALL display subtotal, taxes, applied discounts and final total
- **AND** the final total SHALL be visually prominent
- **AND** the charge action SHALL be visible.

#### Scenario: Item taxes
- **WHEN** a cart item has taxes
- **THEN** item taxes SHALL be available through an expandable area
- **AND** item tax detail SHOULD be collapsed by default.

### Requirement: Keyboard-first operation
El modulo POS SHALL soportar operacion rapida por teclado cuando sea viable and when it does not conflict with active text input.

#### Scenario: Search shortcut
- **WHEN** the operator presses the configured search shortcut while POS is open
- **THEN** focus SHALL move to the product search input.

#### Scenario: Charge shortcut
- **WHEN** the operator presses the configured charge shortcut and the cart can be charged
- **THEN** the charge flow SHALL be initiated or focused according to current payment behavior.

#### Scenario: Escape shortcut
- **WHEN** the operator presses Escape
- **THEN** the POS SHALL clear search or close the cart drawer according to the active UI state.

### Requirement: Responsive POS behavior
El modulo POS SHALL adaptarse a desktop Web/Electron, tablet and mobile/Capacitor without losing access to search, cart total or charge action.

#### Scenario: Desktop or Electron viewport
- **WHEN** the viewport is desktop-sized
- **THEN** the POS SHALL show product search, compact filters, product grid and sticky cart in one operational workspace.

#### Scenario: Tablet viewport
- **WHEN** the viewport is tablet-sized
- **THEN** the POS SHALL show a two-column product grid where space allows
- **AND** the cart SHALL remain accessible through a floating summary or drawer.

#### Scenario: Mobile or Capacitor viewport
- **WHEN** the viewport is mobile-sized
- **THEN** the POS SHALL show search near the top
- **AND** the cart SHALL use a bottom summary and bottom sheet
- **AND** bottom controls SHALL respect `env(safe-area-inset-bottom)`.

### Requirement: Responsive sidebar labels from POS
La navegacion global SHALL mostrar las mismas etiquetas y jerarquia desde `/pos` que desde cualquier otra ruta when the drawer is expanded on small viewports.

#### Scenario: Mobile drawer opened from /pos
- **WHEN** the user opens the hamburger menu from `/pos` on a small viewport
- **THEN** the drawer SHALL show icons and labels
- **AND** the drawer width SHALL remain consistent with other routes
- **AND** the POS entry SHALL remain highlighted
- **AND** the content underneath SHALL stay behind the overlay.

### Requirement: Use existing design system
La implementacion SHALL reutilizar componentes y tokens existentes de `web/components/design-system`.

#### Scenario: New visual element required
- **WHEN** a new visual element is needed
- **THEN** the implementation SHALL first check whether an equivalent design-system component exists
- **AND** SHALL reuse it when possible
- **AND** SHALL avoid hardcoded color values when design tokens, variants or established classes exist.

### Requirement: Business logic remains unchanged
El rediseño visual del POS SHALL NOT alter fiscal calculation, discount calculation, inventory rules, payment rules, sale payload contracts or cart persistence boundaries.

#### Scenario: Visual redesign applied
- **WHEN** the POS layout and components are refactored
- **THEN** existing tax totals SHALL continue using current values
- **AND** existing discount display SHALL continue using current values
- **AND** stock guards SHALL continue using current rules
- **AND** charge and sale creation SHALL continue using current payment behavior.
