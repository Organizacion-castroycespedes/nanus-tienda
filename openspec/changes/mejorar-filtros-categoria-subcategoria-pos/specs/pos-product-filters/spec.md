## ADDED Requirements

### Requirement: POS category filter by product classification ID
El POS SHALL filter products by the selected category using the product classification ID, after normalizing supported product payload shapes.

#### Scenario: Category selected
- **WHEN** the operator selects a category
- **THEN** the product list SHALL include only products whose category ID matches the selected category
- **AND** products from other categories SHALL NOT be shown.

#### Scenario: Product has no subcategory
- **WHEN** the operator selects a category
- **AND** a product belongs to that category but has no subcategory
- **THEN** the product SHALL remain visible unless a subcategory filter is selected.

### Requirement: POS subcategory filter within selected category
El POS SHALL filter products by selected subcategory within the currently selected category.

#### Scenario: Subcategory selected
- **WHEN** the operator selects a category and then selects one of its subcategories
- **THEN** the product list SHALL include only products whose category ID and subcategory ID match the selected filters.

#### Scenario: Subcategory does not belong to selected category
- **WHEN** the selected category changes
- **AND** the current subcategory does not belong to the new category
- **THEN** the POS SHALL clear the selected subcategory.

### Requirement: POS combined product filters
El POS SHALL combine text search, stock filter, category filter and subcategory filter using AND semantics.

#### Scenario: Search and category selected
- **WHEN** the operator enters text in the product search input
- **AND** selects a category
- **THEN** the product list SHALL include only products matching the search text and the selected category.

#### Scenario: Search and subcategory selected
- **WHEN** the operator enters text in the product search input
- **AND** selects a category and subcategory
- **THEN** the product list SHALL include only products matching the search text, selected category and selected subcategory.

#### Scenario: Clear filters
- **WHEN** the operator uses the clear filters action
- **THEN** the POS SHALL reset text search, selected category and selected subcategory.

### Requirement: POS compact filter controls
El POS SHALL keep product search visible and SHALL make category/subcategory filters available in a compact optional area.

#### Scenario: Filters collapsed
- **WHEN** the POS product catalog is visible
- **THEN** the search control SHALL remain visible near the top of the product workspace
- **AND** category and subcategory controls SHALL be hideable behind a `Filtros` action.

#### Scenario: Filters active summary
- **WHEN** category or subcategory filters are active
- **THEN** the POS SHALL show a compact visible summary of the active filters.

#### Scenario: Mobile viewport
- **WHEN** the POS runs in a mobile viewport
- **THEN** the filter controls SHALL remain usable without overlapping product cards or cart controls.

### Requirement: POS sale flow remains unchanged
El filtro y la UI compacta SHALL NOT alter sale flow, pricing, taxes, discounts, stock guards, payment, order creation or sale creation behavior.

#### Scenario: Product filters changed
- **WHEN** the operator changes search, category, subcategory or stock filters
- **THEN** the current cart SHALL remain unchanged
- **AND** sale calculations SHALL continue using the existing POS cart and pricing logic.
