## ADDED Requirements

### Requirement: total electronic invoice void uses discrepancy code 2
The electronic total-void flow SHALL display and transmit only `discrepancyResponseCode = "2"`, meaning total cancellation of the electronic invoice.

#### Scenario: accepted electronic invoice opens void modal
- **WHEN** the user opens the void modal for a sale with an accepted electronic invoice
- **THEN** the selector contains only code `2`, code `2` is preselected, and the request payload contains code `2` and its description

#### Scenario: unsupported discrepancy code is submitted
- **WHEN** the electronic total-void API receives a discrepancy response code other than `2`
- **THEN** the API rejects the request before issuing a credit note

### Requirement: other credit-note flows keep their reason contract
The code-2 restriction SHALL apply only to the operational total-void flow and SHALL NOT change valid discrepancy codes for other legitimate credit-note flows.

#### Scenario: debit note or another credit-note flow uses its own reason
- **WHEN** another note flow sends its own DTO and reason code
- **THEN** that flow keeps its existing validation and provider payload behavior

### Requirement: fiscal outcome gates sale reversal
The system SHALL transmit the credit note through the existing integration and SHALL reverse the sale only after the provider outcome is `ACCEPTED`.

#### Scenario: provider rejects credit note
- **WHEN** FactuCore/DIAN rejects the credit note
- **THEN** the sale remains not voided and no inventory or payment reversal is applied
