## ADDED Requirements

### Requirement: Controlled issuer VAT responsibility
The system MUST persist issuer VAT responsibility as `RESPONSIBLE`, `NOT_RESPONSIBLE`, or `UNKNOWN`.

#### Scenario: Legacy issuer
- **WHEN** V079 is applied to an existing issuer row
- **THEN** its value is `UNKNOWN` unless an explicit value already exists
- **AND** it MUST NOT be inferred from `R-99-PN`.

#### Scenario: Invalid API value
- **WHEN** tenant details receives another value
- **THEN** the API MUST reject it.

### Requirement: IVA billing gate
The system MUST require issuer VAT responsibility `RESPONSIBLE` before an IVA-bearing billing intent.

#### Scenario: Responsible issuer
- **WHEN** a sale has positive persisted tax lines and issuer responsibility is `RESPONSIBLE`
- **THEN** existing outbox flow MAY continue.

#### Scenario: Unknown or non-responsible issuer
- **WHEN** a sale has positive tax lines and issuer responsibility is `UNKNOWN` or `NOT_RESPONSIBLE`
- **THEN** it MUST fail closed before an outbox/provider effect.

#### Scenario: No-tax sale
- **WHEN** a sale has no positive tax lines
- **THEN** the explicit issuer gate MUST NOT alter no-tax behavior.

### Requirement: Contract separation
VAT responsibility MUST remain separate from DIAN fiscal responsibility codes and MUST not fabricate FactuCore values.

#### Scenario: R-99-PN remains a separate code
- **WHEN** a fiscal profile contains `R-99-PN`
- **THEN** Manus MUST preserve it as a DIAN fiscal responsibility code
- **AND** it MUST not derive `vat_responsibility` from that code.
