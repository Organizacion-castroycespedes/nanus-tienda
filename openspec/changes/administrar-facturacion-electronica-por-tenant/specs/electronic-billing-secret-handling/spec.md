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

#### Scenario: Explicit activation removes legacy reference

- **WHEN** an authorized activation confirms a valid V2 configuration
- **THEN** the operation may clear only `credential_reference` in the same transaction as enable/default selection
- **AND** it never rewrites or decrypts the V2 ciphertext
- **AND** the runtime resolver continues to prefer V2 and fails closed on invalid V2 data

#### Scenario: Credential is stored for administration
- **WHEN** the billing backend receives a valid create or explicit replace operation
- **THEN** it stores only the versioned AES-256-GCM `v2` ciphertext in `encrypted_credentials`
- **AND** the envelope contains a key identifier, random nonce, and authenticated tag
- **AND** authenticated additional data binds tenant, provider configuration, and provider identity
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

#### Scenario: Ciphertext is present but unsupported or corrupted
- **WHEN** `encrypted_credentials` is non-empty but has an unsupported version, unavailable key, invalid tag, or wrong tenant/config/provider binding
- **THEN** resolution fails closed
- **AND** the resolver does not attempt `credential_reference` environment fallback

### Requirement: Administrative reads are metadata-only
Administrative read responses SHALL expose credential presence state only.

#### Scenario: Configuration is inspected
- **WHEN** the billing backend returns tenant configuration metadata
- **THEN** it returns only `encryptedConfigured` and `legacyReferenceConfigured` booleans
- **AND** it does not return ciphertext, environment variable names, key identifiers, or decrypted values

### Requirement: Redacted diagnostics
FactuCore request, response, exception, and audit logging SHALL redact credentials and sensitive provider payload fields.

#### Scenario: Provider call fails
- **WHEN** FactuCore returns an error or the request fails
- **THEN** diagnostics contain operation, safe status, and correlation data
- **AND** they do not contain `clientSecret`, credential JSON, auth headers, or raw sensitive payloads

### Requirement: Protected runtime crypto readiness
The Billing Backend SHALL expose crypto runtime readiness only through its authenticated internal
administration transport.

#### Scenario: Runtime readiness is inspected
- **WHEN** a caller presents the valid `API_INTERNAL_TOKEN` to
  `GET /internal/electronic-billing/admin/runtime/crypto-readiness`
- **THEN** the response contains only allowlisted keyring status, synthetic self-test status,
  historical decrypt readiness, and credential-write gate state
- **AND** historical decrypt readiness is `UNKNOWN` unless an approved controlled historical
  decryption diagnostic has independently demonstrated it
- **AND** the response is marked `Cache-Control: no-store`
- **AND** key values, key identifiers, hashes, ciphertext, credential references, environment
  values, headers, and stack traces are absent

#### Scenario: Runtime readiness is unauthorized
- **WHEN** the internal token is missing or invalid
- **THEN** the endpoint rejects the request
- **AND** it does not reveal crypto configuration or secret material
