## ADDED Requirements

### Requirement: Compact shared Finance shell
The five specialized Finance views SHALL use a compact visual header and navigation consistent with the certified `/finance` landing while preserving their existing actions, routes, active state and permission checks.

#### Scenario: Specialized page header
- **WHEN** an authorized user opens any of the five specialized Finance routes
- **THEN** the page shows a compact eyebrow/title/description header and the same existing action buttons with the same handlers and conditions.

#### Scenario: Finance navigation permissions
- **WHEN** the current actor cannot view payment methods
- **THEN** the shared Finance navigation hides only the existing payment-method destination and does not add a replacement item.

#### Scenario: Finance navigation visual parity
- **WHEN** the compact navigation renders its authorized destinations
- **THEN** each destination uses the landing's horizontal quick-access structure with a compact icon, label, description and arrow, while the active destination keeps a subtle accessible selection state and the grid uses the actual visible item count.

### Requirement: Dense operational summaries
The five pages SHALL render their existing KPI values and labels in compact cards, with visible columns adapting to the actual metric collection and without recalculating or requesting new data.

#### Scenario: Session summary
- **WHEN** the cash-sessions page loads its existing session and history data
- **THEN** the existing session metrics remain visible with the same values and semantics in a denser layout.

#### Scenario: Movement, register and payment summaries
- **WHEN** cash movements, cash registers or payment methods return their existing summaries
- **THEN** the same metrics render in compact cards that use available width without changing permissions or source data.

### Requirement: Visual consistency of filters and records
The five pages SHALL use compact, consistent surfaces for existing filters, tabs, tables, lists, badges and empty/loading/error states while preserving every current control and displayed field.

#### Scenario: Movement query is explicit
- **WHEN** an authorized user opens `/finance/cash-movements`
- **THEN** no historical movement request runs automatically; the page shows a compact initial state until the user enters a valid `Fecha desde`/`Fecha hasta` range and activates `Buscar`.

#### Scenario: Server-side movement filters
- **WHEN** the user executes a movement query with dates and applicable branch, cash register, direction or type filters
- **THEN** the backend validates the range (maximum 31 calendar days), applies the filters server-side using the existing tenant and actor scope, and returns only the matching page.

#### Scenario: Query-scoped movement KPI
- **WHEN** a movement query has not been executed or is cleared
- **THEN** Entradas, Salidas, Pagos compras, Balance rápido and Movimientos show a neutral state; after execution they correspond only to the returned query universe.

#### Scenario: Movement and payment tabs
- **WHEN** an authorized user switches between `Movimientos` and `Métodos de pago`
- **THEN** the initial tab is `Movimientos`, movement-only filters are not forced onto payments, and the payment tab shows one server-side aggregate from completed `payments` related by real `cash_session_id` and the selected historical scope.

#### Scenario: Existing filter interaction
- **WHEN** a user changes an existing Finance filter without activating `Buscar`
- **THEN** the current result and KPI remain unchanged until the explicit query is executed.

#### Scenario: Existing row or modal action
- **WHEN** a user activates an existing action such as close/audit, create movement, edit/register assignment or payment-method configuration
- **THEN** the same modal, validation, handler and permission behavior remains in force.

#### Scenario: Current shift operational priority
- **WHEN** an authorized user opens `/finance/current-shift`
- **THEN** the compact context and financial summary preserve all existing values while placing the existing Ventas, Pedidos, Compras, Movimientos, Arqueo and Tickets tabs, counters and search immediately after them, without repeating Caja, Sucursal, Terminal or Estado in a second visual block.

#### Scenario: Cash sessions operational surfaces
- **WHEN** an authorized user opens `/finance/cash-sessions` with current-session data available
- **THEN** `Tu caja en este momento`, `Entregas por cajero` and `Gestión del turno` use compact operational surfaces that preserve their existing values, states, actions, tables, badges, handlers and permission checks without changing financial meaning.

#### Scenario: Collapsed recent movements
- **WHEN** `Gestión del turno` renders its already-loaded recent movements
- **THEN** `Últimos movimientos` is collapsed by default, exposes an accessible toggle with the available in-memory count, and reveals the same existing records on demand without a new query; `Ver movimientos` remains unchanged.

### Requirement: POS-first responsive layout
The specialized pages SHALL remain readable at POS-sized, mobile and desktop widths without global horizontal overflow, clipped primary actions or artificial empty columns.

#### Scenario: POS viewport
- **WHEN** a page is rendered around 1024x768
- **THEN** header, navigation, KPI/summary and the beginning of the operational content use the available width with reduced vertical waste.

#### Scenario: Mobile viewport
- **WHEN** a page is rendered in a narrow mobile container
- **THEN** grids reflow to readable columns, controls remain usable, and wide tables use controlled internal scrolling where already supported.

### Requirement: Operational cash-session history
The cash-session history SHALL query only open sessions initially and SHALL apply explicit history filters server-side without weakening actor scope.

#### Scenario: Initial open sessions
- **WHEN** an authorized user opens `/finance/cash-sessions`
- **THEN** the history request includes `status=OPEN`, and the response contains only sessions authorized for that actor whose real domain status is `OPEN`.

#### Scenario: Historical search
- **WHEN** the user selects a non-OPEN state and executes `Buscar` with a valid date range
- **THEN** the backend applies state, date, branch, cash-register and authorized-user filters before pagination; date limits use `opened_at` day boundaries and do not require client-side history filtering.

#### Scenario: Clear history filters
- **WHEN** the user activates `Limpiar`
- **THEN** controls reset to `Estado=OPEN` with no historical dates and the page requests the operational open-session view again.

#### Scenario: Historical range validation
- **WHEN** a non-OPEN query omits dates, reverses the range or exceeds 31 calendar days
- **THEN** the query is rejected with a validation error and no broadened history is returned.

### Requirement: Functional and authorization preservation
The change SHALL preserve financial calculations and business handlers. Session and movement queries SHALL derive effective tenant/branch/user scope server-side and intersect every client filter with that scope; database schema and migrations remain unchanged.

#### Scenario: Role-specific visibility
- **WHEN** USER, ADMIN, SUPER_USER or SUPER_ADMIN opens a specialized page
- **THEN** the actor sees exactly the same capabilities and role-specific controls as before, with only visual arrangement changed.

#### Scenario: Specialized routes remain stable
- **WHEN** a user navigates to any of the five specialized routes
- **THEN** the existing route and deep-link behavior remain available; only the cash-movements list contract gains optional date filters and additive payment aggregates.

### Requirement: Effective operational session scope
The operational views SHALL use the existing authorization source of truth before querying open sessions or session-derived data. Client-supplied tenant, branch, user, cash-register and cash-session IDs SHALL only narrow the actor scope.

#### Scenario: USER session isolation
- **WHEN** USER requests current-shift or Turno actual with its own or assigned open session
- **THEN** the request succeeds only for that authorized session and a manipulated session from another user, branch or tenant is denied.

#### Scenario: ADMIN assigned branches
- **WHEN** ADMIN requests current-shift or Turno actual without a branch filter
- **THEN** only open sessions in the ADMIN's real assigned branches in the authenticated tenant are available; a branch outside those assignments is denied even when its UUID is valid.

#### Scenario: SUPER_USER and SUPER_ADMIN hierarchy
- **WHEN** SUPER_USER or SUPER_ADMIN selects tenant, branch, user and open session
- **THEN** each dependent selection is validated against the effective role scope, and changing a parent dimension cannot retain an incompatible child selection.

#### Scenario: Shared Turno actual session
- **WHEN** cash-movements runs in Turno actual
- **THEN** Movimientos and Metodos de pago use the same authorized `cashSessionId`; payments are aggregated only for that session, without substituting dates for session identity.

#### Scenario: Historical mode preserved
- **WHEN** cash-movements runs in Historico
- **THEN** the existing mandatory date range, maximum range, server-side filters and query-scoped KPIs remain active without loading historical movements automatically on mount.

### Requirement: Scoped and collapsible cash-session history
The cash-session history SHALL expose only role-appropriate filter dimensions and SHALL keep every client filter subordinate to the effective server-side actor scope. The complete history section SHALL be collapsed by default without side-effect requests.

#### Scenario: Role-scoped history controls
- **WHEN** USER, ADMIN, SUPER_USER or SUPER_ADMIN opens cash-session history
- **THEN** USER sees no control for another user; ADMIN sees only assigned branches; SUPER_USER sees branches in the authenticated tenant without a tenant switcher; SUPER_ADMIN may select tenant and then dependent branches, users and cash registers within scope.

#### Scenario: Dependent filter reset
- **WHEN** SUPER_ADMIN changes tenant or an elevated actor changes branch
- **THEN** incompatible branch, user and cash-register selections are cleared before the next explicit `Buscar` request.

#### Scenario: History scope is enforced server-side
- **WHEN** a client sends a valid UUID for a branch, cash register or opened-by user outside the actor scope
- **THEN** the history query returns no out-of-scope session or rejects the filter according to the existing Finance contract; the client list cannot grant access.

#### Scenario: Collapsed history section
- **WHEN** an authorized actor opens `/finance/cash-sessions`
- **THEN** `Historial de caja / Cierres y sesiones registradas` starts collapsed and its accessible trigger exposes `aria-expanded=false`.

#### Scenario: Expand without query side effects
- **WHEN** the actor expands, collapses and expands the history section again
- **THEN** only local visibility changes; filters, results and errors remain unchanged and no history request is caused by the toggle.

### Requirement: Contextual open-session selection
The cash-session operational panel SHALL use one selected authorized `OPEN` session for its displayed current box, summary and operational details. Supervisory selectors SHALL narrow server-scoped open sessions and SHALL NOT create mutation permissions.

#### Scenario: USER keeps own session context
- **WHEN** USER opens `/finance/cash-sessions`
- **THEN** the page keeps the existing single-session behavior, shows no selector for other users or sessions, and only renders the authorized own session.

#### Scenario: Supervisor selects an open session
- **WHEN** ADMIN, SUPER_USER or SUPER_ADMIN has more than one authorized open session
- **THEN** the page exposes only the applicable compact hierarchy (tenant for SUPER_ADMIN, then branch, user and session as available) and every option comes from the server-scoped `OPEN` result.

#### Scenario: Parent selection resets dependents
- **WHEN** a supervisor changes tenant, branch or user
- **THEN** incompatible child selections are cleared and the page does not keep showing data from the previous session while the new selection resolves.

#### Scenario: Selected session is the operational source
- **WHEN** an authorized supervisor selects an open session
- **THEN** Caja, apertura, expected amount, income, expenses, sales, deliveries, audit, deliveries and turn-management data all correspond to that same `cashSessionId`.

#### Scenario: Mutative actions preserve policy
- **WHEN** a supervisor inspects another user's open session
- **THEN** Arqueo, `Entregar mi cierre`, close and other actions keep their existing backend and frontend authorization conditions; selection alone does not grant a new mutation capability.
