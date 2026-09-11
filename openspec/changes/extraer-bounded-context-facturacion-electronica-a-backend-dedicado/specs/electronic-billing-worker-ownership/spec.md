# Electronic Billing Worker Ownership

## ADDED Requirements

### Requirement: Single worker owner

Exactly one runtime SHALL own the electronic billing worker in a given environment.

After cutover, the billing backend SHALL own the worker.

The API SHALL NOT keep an active billing worker after cutover.

#### Scenario: Cutover disables API worker
- **WHEN** the billing backend worker is enabled
- **THEN** the API worker SHALL be disabled in the same environment
- **AND** duplicate processing SHALL be avoided
