# Validation

- Backend tests cover registration idempotency, tenant isolation, lifecycle and active-binding cardinality.
- Backend authorization tests cover SUPER_ADMIN-only terminal, peripheral-configuration and TerminalDevice administration while preserving the broad operational current-terminal resolver.
- Web tests cover typed binding API and browser-safe operation.
- Web route and menu tests cover direct infrastructure-route denial and hidden terminal/peripheral administration navigation for non-SUPER_ADMIN roles.
- OpenSpec active strict validation is required; global validation is reported separately.
- Migration V075 is additive, applied only to Manus QA, and frozen after successful application.
- Physical hardware validation is deferred; TerminalDevice identity is distinct from printers, drawers, scanners and scales.
- Pairing credentials are not implemented. `installationId` is never proof of possession.

## QA application evidence

- Target: `manus_tienda_qa` / `public`.
- `V075__terminal_device_binding.sql` applied successfully through
  `scripts/database/migrate_prd.sh` single-incremental mode.
- `public.migrations_history`: `V075__terminal_device_binding.sql`,
  `success=true`, `applied_by=postgres`.
- Tables, primary keys, tenant FKs, composite terminal/device FKs, status
  checks, timestamps, lookup indexes and both conditional update triggers were
  verified. `terminal_devices_id_tenant_unique` supports the composite device
  FK.
- Transactional database smoke rejected duplicate ACTIVE rows for one
  terminal and for one device, then rolled back all synthetic rows.
- QA schema was not used for physical peripheral certification.

## Authenticated QA runtime

- QA API was started from the current branch build on port `4020`; Web was
  started on `http://localhost:3000/` and returned HTTP `200`.
- Operator-confirmed manual QA PASS using the normal authenticated QA flow.
- `SUPER_USER` was denied `/config/terminals` and `/admin/peripherals`; terminal
  and peripheral administration navigation was hidden for `SUPER_USER`.
- `SUPER_ADMIN` access to both administration surfaces passed.
- Binding used an explicit logical Terminal selected from its row. The
  application/session Terminal context did not override the selected target.
- Device registration and same-installation idempotency passed. First binding,
  double-binding rejection, unbind, replacement, logical Terminal identity
  preservation, revoke and revoked-device rebind rejection passed.
- The logical Terminal remained stable while the physical Device was replaced.
- Physical printer, drawer, scanner and scale certification was not performed.

## Final identity and security boundary

- `installationId`, cloud `deviceId`, logical `terminalId` and peripheral IDs
  remain distinct. `installationId` is an identifier only, never authentication.
- Cloud/backend remains authoritative for `deviceId`, `terminalId` and binding
  state.
- Only `SUPER_ADMIN` administers logical Terminals, TerminalDevices,
  Device-Terminal bindings and terminal peripheral configuration. `SUPER_USER`
  and business roles retain existing POS runtime permissions.
- Administration is separate from runtime operation. Physical peripheral use was
  not recertified here and was not made `SUPER_ADMIN`-only.


