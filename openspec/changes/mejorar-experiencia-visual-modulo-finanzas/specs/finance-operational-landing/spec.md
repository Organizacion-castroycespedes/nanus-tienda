## ADDED Requirements

### Requirement: Compact financial landing
The finance parent page SHALL present a compact POS-first header, preserve the existing permission gate, and show the existing open/close cash-session action only under its current condition.

#### Scenario: Authorized user with open session
- **WHEN** an authorized Finance user opens `/{tenant}/finance` with `currentSession` available
- **THEN** the page shows a compact header and the existing `Cerrar caja / arqueo` link to `/finance/cash-sessions`.

#### Scenario: Authorized user without open session
- **WHEN** an authorized Finance user opens the page without `currentSession`
- **THEN** the page shows the existing `Abrir caja` link to `/finance/cash-sessions` without changing session behavior.

#### Scenario: Unauthorized user
- **WHEN** a user lacks `canViewFinance`
- **THEN** the existing `FinanceAccessNotice` is rendered and no financial data or new navigation is exposed.

### Requirement: Role-aware quick access
The landing page SHALL place compact quick links immediately below the header for Caja/Sesiones, Movimientos, Cajas and Métodos de pago, using the existing tenant route and hiding Métodos de pago when `canViewPaymentMethods` is false.

#### Scenario: User sees authorized destinations
- **WHEN** an authorized user loads the landing page
- **THEN** quick links navigate to `/finance/cash-sessions`, `/finance/cash-movements`, `/finance/cash-registers` and, when authorized, `/finance/payment-methods`.

#### Scenario: User lacks payment-method permission
- **WHEN** `canViewPaymentMethods` is false
- **THEN** the payment-method quick link is absent while the other authorized destinations remain available.

#### Scenario: Three authorized quick links fill the row
- **WHEN** exactly three quick links are visible for the current permissions
- **THEN** the desktop layout distributes those three links across the available row without reserving a fourth empty column.

### Requirement: Source-preserving operational summary
The landing page SHALL render compact KPI cards from the existing `paymentMethods`, `cashRegisters`, `currentSession` and `history` data without new queries or financial recalculation.

#### Scenario: Existing data is loaded
- **WHEN** the existing Finance hooks return methods, registers, current session and history
- **THEN** the page shows the same active-method count, active-register count, current-session opening amount and absolute recent differences with their existing semantics.

#### Scenario: No recent differences
- **WHEN** recent closed sessions have no difference
- **THEN** the difference KPI shows the existing zero currency value and neutral semantic styling.

### Requirement: Compact recent sessions
The landing page SHALL present recent sessions as a compact operational list using only fields already available in `CashSession`, with accessible status semantics and a path to the specialized sessions module.

#### Scenario: Recent sessions exist
- **WHEN** `history` contains sessions
- **THEN** the page shows bounded recent rows with caja, código, status and opening amount, using `FinanceStatusBadge` or equivalent accessible text.

#### Scenario: No recent sessions
- **WHEN** `history` is empty
- **THEN** the page shows an explicit empty message and does not request additional data.

### Requirement: Responsive finance composition
The landing page SHALL avoid global horizontal overflow and adapt its header, quick links, KPI cards and recent-session list to POS, mobile and desktop widths.

#### Scenario: POS-sized viewport
- **WHEN** the usable viewport is approximately 1024x768
- **THEN** the compact header, quick links and a useful portion of KPI cards fit early in the page using multiple columns where readable.

#### Scenario: Mobile viewport
- **WHEN** the page is rendered in a narrow mobile container
- **THEN** cards and links reflow into readable columns, touch targets remain usable, and no page-level horizontal scrolling is introduced.

#### Scenario: Visible-count metric layout
- **WHEN** three or four KPI cards are visible after permission filtering
- **THEN** the KPI grid uses the visible count to distribute the cards uniformly and does not branch on a hardcoded role name.

### Requirement: Functional compatibility
The visual change SHALL preserve existing Finance routes, deep links, authorization, loading/error behavior from hooks, and the behavior of specialized submodules.

#### Scenario: Specialized routes remain available
- **WHEN** a user follows a Finance quick link or an existing deep link
- **THEN** `/finance/cash-sessions`, `/finance/cash-movements`, `/finance/cash-registers`, `/finance/payment-methods` and `/finance/current-shift` continue resolving without contract changes.

#### Scenario: Existing hook error
- **WHEN** an existing Finance hook reports an error
- **THEN** the parent keeps the current data/error behavior and does not replace it with fabricated values or a new request path.
