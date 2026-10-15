# Electronic billing secret handling

## ADDED Requirements

### Requirement: Write-once secret input
The administration API SHALL accept provider secret material only on create or explicit replace and SHALL never return it after persistence.

#### Scenario: Secret is read after save
- **WHEN** an administrator reads the configuration
- **THEN** the response reports only configured/present state and safe reference metadata
- **AND** raw secret fields are absent

### Requirement: Encrypted storage and reference compatibility
The implementation SHALL use authenticated encryption for new administrative credential writes when `encrypted_credentials` is selected, and SHALL preserve the existing neutral `credential_reference` contract as a compatibility fallback.

#### Scenario: Credential is stored for administration
- **WHEN** the billing backend receives a valid create or explicit replace operation
- **THEN** it stores only the versioned AES-256-GCM ciphertext in `encrypted_credentials`
- **AND** it obtains the 32-byte master key from external runtime secret management
- **AND** it fails closed when key material is missing or invalid
- **AND** Manus API, browser, database logs, audit records, and responses never receive plaintext credentials

#### Scenario: Reference resolves from environment
- **WHEN** a provider config contains a valid neutral reference
- **THEN** the billing backend resolves it at operation time
- **AND** it does not place secret values in database rows, events, audit records, or logs

#### Scenario: Legacy reference remains available
- **WHEN** an existing configuration has only `credential_reference`
- **THEN** the dedicated billing backend resolves it at operation time
- **AND** no automatic plaintext import or silent replacement is performed

### Requirement: Redacted diagnostics
FactuCore request, response, exception, and audit logging SHALL redact credentials and sensitive provider payload fields.

#### Scenario: Provider call fails
- **WHEN** FactuCore returns an error or the request fails
- **THEN** diagnostics contain operation, safe status, and correlation data
- **AND** they do not contain `clientSecret`, credential JSON, auth headers, or raw sensitive payloads
