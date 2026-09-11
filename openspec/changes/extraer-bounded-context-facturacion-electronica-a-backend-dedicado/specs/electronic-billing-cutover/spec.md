# Electronic Billing Cutover

## ADDED Requirements

### Requirement: Controlled cutover

Cutover SHALL be controlled and reversible.

The system SHALL NOT enable the billing backend worker while the API worker is still active in the same environment.

The cutover plan SHALL include:

- enable consumer
- verify event delivery
- disable API worker
- enable billing worker

The API outbox dispatcher SHALL remain disabled by default until X8 switches the sale paths to emit outbox events.

#### Scenario: No dual worker state
- **WHEN** cutover is in progress
- **THEN** the system SHALL keep only one active worker owner
