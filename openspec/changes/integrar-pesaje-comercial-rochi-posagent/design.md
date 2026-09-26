## Context

The repository already contains the product sale model (`UNIT`, `WEIGHT`, `BOTH`), terminal peripheral settings (`scaleDeviceId`, `enableScale`), POS scale controls, a MOCK `ScaleService`, generic device registration, and a separately validated ROCHI serial driver. The current scale HTTP contract returns a simulated value and does not expose commercial freshness, source, unit verification, or capture ownership. The previous ROCHI change remains the driver and Windows QA boundary; this change defines the commercial integration only.

Relevant existing areas:

- `web/modules/inventory/components/ProductForm.tsx` and `api/src/modules/inventory/*` own the sale model and its validation.
- `web/modules/pos/components/PosScreen.tsx` and `CartSaleModal.tsx` own the current POS/cart MOCK interaction.
- `web/domains/peripherals/*` resolves terminal configuration and calls the local Agent.
- `api/src/modules/pos-terminals/*` owns tenant/branch/terminal peripheral settings.
- `backend-perifericos/src/modules/scale/*` owns the current MOCK contract and the separate ROCHI driver.
- Existing pricing and sale services remain the source of truth for commercial totals and inventory effects.

## Goals / Non-Goals

**Goals:**

- Define one commercial contract for explicit, on-demand weight capture.
- Reuse the existing product model, POS components, terminal settings, pricing, sale and inventory flows.
- Make REAL, MOCK, unavailable, stale, invalid and unverified-unit states visible and non-ambiguous.
- Bind a capture to tenant, branch, terminal, device, product and operation.
- Preserve normal unit sales when no scale is configured.
- Keep ROCHI unit handling explicit: KG must be verified; no automatic KG/LB inference.

**Non-Goals:**

- No code, migrations, endpoints, DTOs or UI implementation in this change.
- No modification to the ROCHI parser or physical serial driver.
- No metrological certification, calibration, legal-for-trade claim or commercial production enablement.
- No Linux validation or multiplatform packaging completion.
- No automatic reconnect, permanent port ownership or silent MOCK fallback.
- No replacement of `saleType`, `measurementUnit`, pricing, inventory or invoicing models.

## Decisions

### 1. Use an explicit capture operation, not a permanent connection

The first commercial lifecycle is one bounded request: resolve authorized configuration, open the device, synchronize, obtain one fresh reading, normalize to kilograms, return attribution, then close and invalidate safely. A temporary session is deferred until measured operator latency justifies it and a separate owner, TTL, cancellation and invalidation contract is approved.

Permanent connection was rejected because it increases port contention, startup coupling, stale-reading risk and accidental activation of peripherals.

### 2. Keep product semantics in the existing model

`UNIT` remains scale-independent. `WEIGHT` requires the weighing path. `BOTH` must present an explicit unit-versus-weight choice before quantity is committed. Legacy flags may help compatibility during migration, but SHALL NOT override an explicit valid `saleType`.

No product table or second commercial model is proposed.

### 3. Treat unit verification as configuration and procedure

ROCHI frames do not carry unit or stability metadata. The Agent must use explicit device configuration and an operator verification procedure. The initial commercial scope uses KG verification. LB conversion remains a model-specific driver policy and is not inferred from a frame.

`stable=true` is not part of the REAL acceptance proof. A repeated value is not metrological stability.

### 4. Separate simulation from REAL operation

The existing MOCK service and fallback configuration remain useful for development and QA. They must be labeled and must not satisfy a REAL commercial capture. An unavailable configuration or Agent error must not silently resolve to `FALLBACK_MOCK` in a weighted sale.

### 5. Use short-lived backend authorization

Before a weighted capture, the authenticated backend creates a short-lived authorization bound to the current tenant, branch when applicable, terminal, POS session, product, operation and configured device. The exact cryptographic or lookup mechanism remains an implementation gate: inspection found JWT/session validation in the API and a typed Electron bridge, but no existing Agent credential or capture token.

The Agent must corroborate the authorization with its local device registry and terminal binding. A frontend-supplied `terminalId` or `deviceId` alone is never proof. The authorization is single-use and expires on timeout, configuration revocation, terminal change, product change or connection loss.

### 6. Use transient capture evidence

Capture evidence travels with the pending commercial operation and contains source `REAL`, verified source unit `KG`, normalized kilograms, capture time, expiry, device, terminal, product, operation and a unique capture identity. Backend consumes it atomically with the existing sale transaction. No permanent scale-capture table is required for the first phase unless later audit or regulatory requirements demonstrate that need.

The existing POS context and sale idempotency flow are reusable, but `Idempotency-Key` alone is not proof of physical origin. It prevents duplicate sale creation, not replay of a scale reading.

### 7. Reuse pricing and sale pipelines

The captured quantity enters the existing cart and `/pricing/preview-line` path. Backend sale validation remains authoritative and recalculates or verifies commercial totals using the existing sale service. Capture evidence is an additional gate, not a second pricing engine.

### 8. Bind capture ownership at the trusted boundary

Frontend identifiers are hints, not proof. The backend and local Agent must corroborate tenant, branch, active terminal, configured device and operation using existing authorization/configuration mechanisms. The final contract must include a unique capture identity, expiry, source, device, terminal, product/operation association and one-use semantics, without accepting a frontend-only token as authenticity.

### 9. Prefer the existing local transport seam

The implementation should extend the existing local Agent/Electron capability rather than create a remote endpoint or a parallel service. The exact HTTP/IPC shape remains an implementation detail to be selected after confirming the current runtime trust boundary and compatibility with other peripherals.

## AS-IS and gap

- Product sale model is persisted and validated, but POS handling of `BOTH` is not an explicit mode-selection flow.
- POS now resolves the effective terminal configuration before rendering scale UI; the Fase 1 guard does not read `mock-scale-001` or treat MOCK `stable` as commercial evidence.
- `ScaleService` returns a simulated `1.25 kg`; ROCHI is not wired into the commercial ScaleModule.
- Terminal settings already expose `scaleDeviceId`, `enableScale`, modes and configuration sources.
- Device registration/bindings are generic and do not yet prove ROCHI COM/PnP ownership.
- Current sale payloads carry quantity and price, but no trusted capture evidence.
- Before Fase 1, `/pos` derived visibility from public feature flags and could render a green `Balanza Lista/Listo` state without proving terminal assignment or REAL availability. Fase 1 removes that path and shows only neutral configured state until the REAL Agent contract exists.
- Fase 1 also rejects the documented `mock-scale-001` assignment for commercial visibility, even when the API reports `source=CONFIGURED` and `features.scale=true`. This is a bounded compatibility guard, not a definitive REAL-device classification; the resolve contract still needs origin/connection metadata for the final solution.
- The current cart quantity input does not expose a separate manual-weight permission or audit origin.
- `Contra Muslo` was reported by the operator as `BOTH` with `KG`, but no matching record was found in accessible repository data; it is a fixture for acceptance, not verified database evidence.

## Terminal visibility rule

When the active terminal has no assigned and enabled scale, `/pos` must render no permanent scale indicator, connection badge, live weight, scale panel or scale-only control. Unit sales remain available. If the operator selects a product or mode that requires weight, POS may show a contextual explanation and stop the capture; that explanation must not become a permanent dashboard state.

When configuration lookup fails, the commercial state is fail-closed: no operational scale controls and no `FALLBACK_MOCK` for a weighted sale. When a scale is configured, the UI may show only a state backed by resolved terminal configuration and Agent status: available REAL, disconnected, error, unit unverified, pending or invalid. `stable=true` from the MOCK service cannot produce `Balanza Lista` for REAL operation.

## Contra Muslo acceptance fixture

The operator-reported fixture is:

- product: `Contra Muslo`;
- sale model: `BOTH` / Unidad y peso;
- measurement unit: `KG`.

The fixture must be resolved from the real catalog during implementation if available. If it is absent, tests may use an explicit fixture with these values and must report that the database record was not verified. No price, stock or quantity is assumed.

Required observable behavior:

- unit mode preserves the existing unit/cart/pricing flow without a scale;
- weight mode requires REAL ROCHI capture and KG verification;
- a terminal without a configured scale hides permanent scale UI and keeps unit mode usable;
- a weight attempt without a scale shows only a contextual warning and blocks REAL capture;
- stale, disconnected, ambiguous-unit, duplicate or expired evidence blocks confirmation.

## Risks / Trade-offs

- [Risk] A configuration lookup failure falls back to MOCK. → Commercial weighted flows must fail closed when REAL is required.
- [Risk] ROCHI does not identify unit or stability. → Require explicit KG verification and reject unit ambiguity; do not infer stability.
- [Risk] A stale reading can be reused after disconnect or product change. → Central invalidation, TTL, operation binding and one-use capture identity.
- [Risk] `BOTH` can be sold through a generic quantity path. → Require an explicit mode before pricing and sale confirmation.
- [Risk] Agent local transport may trust caller-supplied IDs. → Revalidate against terminal configuration and the existing local trust boundary.
- [Risk] New capture evidence can break legacy unit sales. → Apply the additional gate only to weighted branches; preserve `UNIT` behavior.
- [Risk] Physical QA does not prove legal metrology. → Keep homologation and commercial authorization outside this change.

## Migration Plan

1. Implement the contract behind existing MOCK behavior and keep normal unit sales unchanged.
2. Add simulator tests for each state before enabling REAL selection.
3. Wire the already validated ROCHI adapter only for explicitly configured REAL terminals.
4. Enable a controlled QA flag or terminal setting for non-production validation.
5. Run POS-Agent integration tests and physical Windows QA with KG verification.
6. Roll back by disabling the scale feature or REAL terminal assignment; do not delete product sale fields or alter historical sales.

## Approved decisions and remaining implementation gates

Approved for the first phase:

1. Short-lived backend authorization bound to tenant, branch when applicable, terminal, POS session, product, operation and device.
2. No manual weight substitute for `WEIGHT` or the weight mode of `BOTH`; unit sales remain manual as today.
3. Transient, expiring, single-use REAL evidence consumed atomically with the sale; no permanent capture persistence initially.
4. One open-read-close request per weighing operation; temporary sessions are later evolution only.
5. Physical KG configuration and verification required; no automatic KG/LB or stability inference.

Still requiring technical inspection during implementation:

- exact signature, nonce or server-side lookup mechanism for the authorization;
- exact bridge/API transport extension compatible with the existing Electron capability;
- exact place to carry evidence through `/sales` while preserving current DTO validation and idempotency;
- exact UI state source after terminal configuration resolution and Agent health response.

