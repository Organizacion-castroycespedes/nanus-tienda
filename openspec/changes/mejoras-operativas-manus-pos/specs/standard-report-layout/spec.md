## ADDED Requirements

### Requirement: Reusable report composition
The design system or equivalent shared report module SHALL provide a reusable composition for Report Header, Report Toolbar with filters/actions, Report Summary, Report Data/Table, Loading/Empty/Error states and existing Pagination.

For POS-oriented viewports, the standard composition SHALL keep the toolbar compact, render the summary as one compact horizontal band when the width permits, and give the data table visual priority immediately after the summary. Summary helper copy SHALL remain available through accessible labels or equivalent non-invasive help, not as tall permanent cards.

Report filters SHALL be defined by report metadata rather than inferred from table columns. The metadata SHALL identify each filter key, label, type or renderer, priority, active value and clear behavior. Primary filters SHALL stay in the compact toolbar; secondary filters SHALL be collapsed behind a responsive control and active values SHALL be exposed as removable chips.

#### Scenario: New report is created
- **WHEN** a new report is implemented
- **THEN** its design SHALL evaluate and reuse the standard composition when compatible

#### Scenario: POS report is viewed at operational desktop width
- **WHEN** the report is viewed between 1024px and 1280px wide
- **THEN** filters and actions SHALL share a compact toolbar, the four summary metrics SHALL use one compact band, and the table SHALL be the dominant content with reusable pagination

#### Scenario: Secondary report filters are collapsed
- **WHEN** a report has secondary filters such as tenant, branch, terminal or cash register
- **THEN** those filters SHALL stay hidden by default behind a `Filtros` control, preserve the report's existing filter semantics, and expose active selections as compact removable chips

#### Scenario: Existing report is redesigned later
- **WHEN** an existing report is migrated or redesigned
- **THEN** its implementation SHALL evaluate and reuse the standard composition without requiring a mass migration in this change
