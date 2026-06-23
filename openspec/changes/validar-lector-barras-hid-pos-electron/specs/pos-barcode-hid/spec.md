## ADDED Requirements

### Requirement: POS HID barcode input support

The POS interface SHALL support barcode scanners that operate as keyboard HID input.

#### Scenario: Scanned code is processed as keyboard input

- **WHEN** a scanned code is entered into the POS search field
- **THEN** the POS SHALL process the code as keyboard input

#### Scenario: No native scanner integration is required

- **WHEN** barcode support is reviewed
- **THEN** no Electron native USB or serial integration SHALL be required

#### Scenario: No scanner SDK is installed

- **WHEN** barcode support is reviewed
- **THEN** no scanner SDK SHALL be installed

#### Scenario: Same behavior works in Web and Electron

- **WHEN** the search field has focus in Web or Electron
- **THEN** the same HID barcode behavior SHALL be available

### Requirement: Exact barcode match handling

The POS interface SHALL only auto-add a product from scanner Enter input when the scanned value resolves to a safe exact match.

#### Scenario: Exact single match can be added

- **WHEN** the scanned value resolves to one exact product match
- **THEN** the product SHALL be added using the existing cart rules

#### Scenario: Multiple matches do not auto-add

- **WHEN** the scanned value resolves to multiple matches
- **THEN** the POS SHALL NOT auto-add a product

#### Scenario: No match does not auto-add

- **WHEN** the scanned value does not resolve to any product
- **THEN** the POS SHALL NOT auto-add a product

#### Scenario: Out-of-stock products respect existing stock restrictions

- **WHEN** the exact match is out of stock and the current POS rules block it
- **THEN** the POS SHALL respect the existing stock restriction

#### Scenario: Weighable products respect existing flow

- **WHEN** the exact match is a weighable product
- **THEN** the POS SHALL respect the existing weight or quantity flow

### Requirement: Consecutive scan workflow

The POS interface SHALL preserve an efficient workflow for consecutive HID scans.

#### Scenario: Focus returns to search field after success

- **WHEN** a product is added successfully from a scan
- **THEN** focus SHALL return to or remain on the search field

#### Scenario: Manual search remains usable

- **WHEN** the user searches manually
- **THEN** manual search SHALL continue to work

#### Scenario: Grid and list selection remain usable

- **WHEN** the user selects products from the grid or list
- **THEN** the existing product selection workflow SHALL continue to work

#### Scenario: Cart increment behavior is preserved

- **WHEN** a scanned product already exists in the cart
- **THEN** the cart SHALL follow the existing increment rules

### Requirement: No native hardware integration

The barcode HID phase SHALL NOT introduce native hardware access.

#### Scenario: No USB implementation is added

- **WHEN** barcode support is reviewed
- **THEN** no USB implementation SHALL be added

#### Scenario: No serial implementation is added

- **WHEN** barcode support is reviewed
- **THEN** no serial implementation SHALL be added

#### Scenario: No Electron scanner API is added

- **WHEN** barcode support is reviewed
- **THEN** no Electron preload or main scanner API SHALL be added

#### Scenario: No hardware SDK is added

- **WHEN** barcode support is reviewed
- **THEN** no hardware SDK SHALL be added
