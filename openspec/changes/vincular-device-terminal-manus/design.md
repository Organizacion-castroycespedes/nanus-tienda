## Context

`public.terminals` is the existing logical terminal entity (`tenant_id`, `branch_id`, name/code, active status). `public.pos_terminals` is a peripheral profile and remains separate. Peripheral Agent persists a random UUID installation identity locally and exposes it in health; its peripheral IDs are printer/scanner/scale/drawer IDs. The API authenticates JWTs, derives tenant from the verified claim, and protects terminal administration with `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard` and `CONFIG_TERMINALS`.

## Goals / Non-Goals

Goals: add a cloud identity record and auditable binding history; enforce tenant boundaries and cardinality in service and database; provide explicit lifecycle operations and minimal operator visibility.

Non-goals: treating installationId as a credential, automatic replacement, pairing code simulation, Agent/Electron identity mutation, startup/readiness, recovery shell, updater, cache, offline sales or Linux changes.

## Decisions

- Reuse `terminals` as the logical Terminal. Add `terminal_devices` for cloud Device records and `terminal_device_bindings` for history. `pos_terminals` and its peripheral settings remain unrelated.
- Make `terminal_devices.installation_id` globally unique. A repeated registration is idempotent only for the same authenticated tenant; a different tenant receives a conflict and cannot claim the identity. Registration status is `REGISTERED`, `BOUND`, `UNBOUND` or `REVOKED`; a new record starts REGISTERED.
- Store runtime/platform metadata already available from Agent health as optional fields. Device credentials are intentionally absent. Registration is authenticated identification, not proof of possession.
- Bind and unbind are explicit transactional commands. A bind checks the terminal and device tenant, active status and current active bindings, then inserts history; unique partial indexes enforce one ACTIVE row per terminal and device under concurrency. Existing active bindings cause a conflict instead of silent replacement.
- Unbind marks the active row UNBOUND with `unbound_at`; revoke marks the device REVOKED and its active binding REVOKED. Historical rows remain. Rebinding requires a separate explicit bind after unbind/revoke.
- Controller uses authenticated actor tenant and existing terminal permission. Payloads do not accept a renderer-authoritative tenant. Terminal, TerminalDevice, binding and peripheral administration controllers require the canonical `SUPER_ADMIN` role; operational POS resolver routes retain their existing business-role policy.
- Platform administration boundary: only the canonical `SUPER_ADMIN` role may administer logical Terminals, cloud physical TerminalDevices, Device-Terminal bindings, and terminal peripheral configuration. `SUPER_USER` is not sufficient. Administrative peripheral configuration is separate from operational peripheral execution, so business users retain only their existing POS runtime permissions.
- APIs are command-shaped: `POST /terminal-devices/register`, `GET /terminal-devices`, `GET /terminal-devices/:deviceId`, `GET /terminal-device-bindings`, `POST /terminal-device-bindings`, `POST /terminal-device-bindings/unbind`, `POST /terminal-device-bindings/revoke`. No generic CRUD.
- Web may use health's existing Agent installationId for an explicit registration action in Electron; browser-only Web can display state and handle unavailable local identity without inventing one.

## Risks / Trade-offs

- Global installation uniqueness prevents silent cross-tenant claiming but requires an explicit future transfer workflow.
- Existing rows have no bindings, so migration is additive and starts empty; current POS/peripheral flows continue using their existing IDs.
- Without credentials, a copied installationId is not trusted as possession. Credential issuance and activation are deferred to the next security step.

## Migration Plan

Add `V075__terminal_device_binding.sql` after V071. It creates new tables, constraints and partial unique indexes without dropping or rewriting existing data. Rollback is forward-only operational rollback: disable new endpoints and remove only newly added rows/tables through a separately reviewed rollback script; do not drop objects in the forward migration. Do not run against QA/production in this change.

