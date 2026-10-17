# Transition policy for historical electronic billing credentials

## Why

The feature branch correctly fails closed when `encrypted_credentials` is present but the AES-256-GCM v2 keyring is unavailable. Historical QA configurations may contain legacy ciphertext and a working `credential_reference`, so an explicit transition policy is needed without enabling legacy access now.

## Scope

- Add a server-owned, disabled-by-default policy boundary in the dedicated Billing Backend.
- Keep v2 precedence and fail-closed behavior.
- Permit a future, explicitly allowlisted legacy reference only for classified historical `v1` ciphertext and approved tenant/provider/configuration/environment tuples.
- Apply the same resolver path to document issuance and FactuCore client-context validation.
- Add synthetic tests and operational documentation.

## Out of scope

- No real allowlist entries.
- No environment changes, key provisioning, database changes, migrations, FactuCore changes, credential writes, or live issuance.
- No frontend or MANUS public API changes.
