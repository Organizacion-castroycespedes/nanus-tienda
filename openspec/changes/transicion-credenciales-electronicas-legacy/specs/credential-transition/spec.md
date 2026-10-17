# Credential transition policy

## ADDED Requirements

### Requirement: v2 remains authoritative

The Billing Backend SHALL resolve non-empty `v2` ciphertext through AES-256-GCM v2 with the existing tenant/provider/configuration AAD binding.

#### Scenario: v2 ciphertext exists

- **WHEN** a configuration contains a `v2` envelope
- **THEN** the resolver SHALL use v2 decryption
- **AND** it SHALL reject any legacy override policy

#### Scenario: v2 keyring is unavailable

- **WHEN** v2 decryption cannot run because the keyring is missing, invalid, or the key is unavailable
- **THEN** resolution SHALL fail closed
- **AND** the resolver SHALL not read `credential_reference`

### Requirement: legacy mode is explicit and disabled by default

Legacy reference resolution SHALL require the deployment gate and an exact server-owned allowlist match.

#### Scenario: default runtime

- **WHEN** the deployment gate is absent or false
- **THEN** the legacy transition policy SHALL deny every ciphertext override

#### Scenario: approved historical v1 tuple

- **WHEN** the gate is true, ciphertext is classified as historical `v1`, and tenant, provider, configuration, provider code, and environment exactly match an allowlist entry
- **THEN** the resolver MAY use the existing legacy reference resolver
- **AND** it SHALL not expose the policy or credential value to the caller

#### Scenario: tuple mismatch

- **WHEN** any allowlist identity or environment field differs
- **THEN** resolution SHALL fail closed

### Requirement: unknown data never downgrades

Unknown, malformed, corrupt, or unsupported ciphertext SHALL never be treated as historical `v1` and SHALL never trigger legacy resolution.

#### Scenario: unknown envelope

- **WHEN** non-empty ciphertext has no recognized version
- **THEN** the resolver SHALL fail closed
- **AND** it SHALL not use `credential_reference`

### Requirement: shared resolver behavior

Document issuance and FactuCore client-context validation SHALL use the same credential resolution policy.

#### Scenario: identity validation

- **WHEN** client-context validation resolves a tenant configuration
- **THEN** it SHALL apply the same v2, legacy-policy, and fail-closed decisions as invoice issuance

### Requirement: safe diagnostics

Diagnostics SHALL contain only sanitized operation, identity correlation, envelope category, and allow/deny category. They SHALL never contain secret material, ciphertext, key material, credential references, headers, or raw upstream bodies.

#### Scenario: policy denial diagnostic

- **WHEN** a legacy transition request is denied
- **THEN** any diagnostic SHALL contain only the sanitized decision category
- **AND** it SHALL omit the credential reference and encrypted value
