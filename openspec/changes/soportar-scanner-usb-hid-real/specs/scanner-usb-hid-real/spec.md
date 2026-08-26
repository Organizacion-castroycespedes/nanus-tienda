## ADDED Requirements

### Requirement: POS USB HID scanner support
The POS SHALL support barcode scanners that behave like a keyboard HID input
device.

#### Scenario: Fast HID scan
- **WHEN** the cashier scans a barcode into the POS search input
- **AND** the input arrives as a fast key sequence
- **AND** the sequence ends with `Enter`
- **THEN** the POS SHALL treat it as a scan and not as manual typing

#### Scenario: Slow typing is not a scan
- **WHEN** the cashier types the same characters slowly
- **AND** the sequence ends with `Enter`
- **THEN** the POS SHALL keep normal manual search behavior

#### Scenario: Multiple scans
- **WHEN** the cashier scans one product after another
- **THEN** the POS SHALL reset the scanner state between scans and keep working

### Requirement: Scan handling
The POS SHALL search the product catalog by the scanned code and add the
product to the cart when there is exactly one safe match.

#### Scenario: Product exists
- **WHEN** the scanned code resolves to one exact product
- **THEN** the POS SHALL add that product to the cart

#### Scenario: Product does not exist
- **WHEN** the scanned code does not resolve to any product
- **THEN** the POS SHALL show a controlled warning and keep the POS usable

#### Scenario: Invalid code
- **WHEN** the scanned code is invalid
- **THEN** the POS SHALL reject the scan and keep manual input working

### Requirement: No input interference
The scanner wedge SHALL not break normal typing or editing in POS inputs.

#### Scenario: Manual typing in inputs
- **WHEN** the cashier types into a normal POS input
- **THEN** the scanner wedge SHALL not steal focus or submit a fake scan

### Requirement: Scanner disabled
The scanner feature flag SHALL disable scanner behavior without breaking the
rest of the POS.

#### Scenario: Scanner off
- **WHEN** scanner is disabled by config or feature flag
- **THEN** the POS SHALL continue to work normally and only manual search SHALL
  remain active
