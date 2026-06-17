## ADDED Requirements

### Requirement: Tenant branding loads without stale colors
The system SHALL load the branding configuration for the active tenant when the configuration view opens or when a super admin selects another tenant. The system MUST NOT reuse colors from a previously selected tenant while the new tenant configuration is loading.

#### Scenario: Current tenant opens branding
- **WHEN** an authenticated user opens `/00000000-0000-0000-0000-000000000001/configuracion` and selects Branding
- **THEN** the color fields show the current tenant branding values or safe defaults

#### Scenario: Super admin changes tenant
- **WHEN** a super admin selects tenant A and then tenant B
- **THEN** the Branding tab shows tenant B colors and does not keep tenant A colors after tenant B loading starts

### Requirement: Color fields are visual and editable
The system SHALL render each branding color field with a clear label, required marker where applicable, visible swatch, color picker, editable hexadecimal value and field-level validation message.

#### Scenario: Saved color appears in field
- **WHEN** branding has primary color `#2563EB`
- **THEN** the Color primario field shows a blue swatch and the text value `#2563EB`

#### Scenario: Invalid color appears
- **WHEN** a color value is empty or invalid
- **THEN** the field shows a safe fallback swatch and a clear invalid-state message without breaking the page

### Requirement: Hex colors are validated and normalized
The system SHALL validate `#RGB` and `#RRGGBB` colors, normalize valid values to uppercase `#RRGGBB`, reject invalid values, and prevent saving invalid branding.

#### Scenario: Short hex is normalized
- **WHEN** the user enters `#abc`
- **THEN** the system treats it as valid and normalizes it to `#AABBCC`

#### Scenario: Invalid hex cannot be saved
- **WHEN** the user enters `blue` in a color field
- **THEN** the save action is disabled or blocked and a field error is shown

### Requirement: Branding preview updates in real time
The system SHALL update the preview immediately from local form state before saving. The preview MUST include company name, optional logo, background, readable text, primary action, secondary accent, and a mini menu with normal, active, submenu normal and submenu active states.

#### Scenario: Primary color changes
- **WHEN** the user changes Color primario
- **THEN** the preview primary button and active menu state update immediately before saving

#### Scenario: Company name missing
- **WHEN** the company name is unavailable
- **THEN** the preview shows `Manus Tienda Platform S.A.S.`

### Requirement: Menu uses accessible tenant theme tokens
The system SHALL derive sidebar, menu item, submenu, hover and focus colors from the active tenant branding and keep foreground/background contrast readable through helper-generated fallbacks.

#### Scenario: Active sidebar item is readable
- **WHEN** a tenant primary color is very light or saturated
- **THEN** the active sidebar option uses safe tokens so text remains readable

#### Scenario: Submenu active item is evident
- **WHEN** the current route matches a submenu
- **THEN** the submenu active state shows a clear indicator, contrast-safe text and tenant-derived accent

### Requirement: Branding save preserves existing behavior
The system SHALL save branding through the existing tenant configuration flow and apply persisted branding to the real layout only after save for the current tenant.

#### Scenario: Current tenant saves branding
- **WHEN** the current tenant saves valid branding
- **THEN** the system updates persisted configuration and applies the saved theme to the layout

#### Scenario: Other tenant edited by super admin
- **WHEN** a super admin edits a tenant that is not the current tenant
- **THEN** the form saves that tenant configuration without applying it globally to the current layout
