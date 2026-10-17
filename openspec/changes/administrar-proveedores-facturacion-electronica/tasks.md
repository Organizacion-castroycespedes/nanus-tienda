## 1. Contract and repository preparation

- [x] 1.1 Confirm the existing V072 provider/config/document schema, V088 default-integrity rule, QA snapshot parity, and no-migration decision.
- [x] 1.2 Add safe provider administration DTOs in the Billing Backend and MANUS API without adding handlers or writes.
- [x] 1.3 Preserve the existing GET provider catalog response and document the internal route mapping and `API_INTERNAL_TOKEN` validation.

## 2. Billing Backend implementation (HU-EB-ADM-002)

- [x] 2.1 Implement create metadata validation using normalized unique code and registered adapter availability.
- [x] 2.2 Implement metadata update with immutable identity fields and capability subset validation.
- [x] 2.3 Implement transactional status change with provider-row locking and enabled-configuration dependency recheck.
- [x] 2.4 Return safe DTOs and standardized sanitized conflicts, not-found responses, validation errors, and unavailable errors.
- [x] 2.5 Add focused repository/service tests for duplicate code, unknown adapter, capability mismatch, dependency conflict, concurrency, and secret redaction.

## 3. MANUS API and authorization (HU-EB-ADM-003)

- [x] 3.1 Add SUPER_ADMIN-protected proxy routes using `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, and existing internal client patterns.
- [x] 3.2 Add the reviewed provider-module menu and permission mapping without weakening backend enforcement.
- [x] 3.3 Add proxy tests for role denial, permission denial, safe DTO propagation, invalid input, and sanitized upstream errors. IDOR is not applicable to global provider catalog routes because no tenant identifier is accepted.

## 4. Frontend and QA (HU-EB-ADM-004/005)

- [x] 4.1 Add the Configuracion provider module only after API contracts and menu governance are implemented.
- [x] 4.2 Verify no credential, ciphertext, URL, header, or internal error appears in the UI.
- [x] 4.3 Run read-only QA dependency counts and validate provider lifecycle behavior with no tenant or document mutation.
- [x] 4.4 Run API/Billing tests, lint/build, OpenSpec strict validation, and `git diff --check`.
