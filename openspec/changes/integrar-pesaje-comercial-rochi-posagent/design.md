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

The preferred lifecycle is one bounded request: resolve authorized configuration, open or acquire the device, synchronize, obtain one fresh reading, normalize to kilograms, return attribution, then close or release safely. A short session may be introduced only if repeated reads during one operator action require it and it preserves the same timeout, owner and invalidation rules.

Permanent connection was rejected because it increases port contention, startup coupling, stale-reading risk and accidental activation of peripherals.

### 2. Keep product semantics in the existing model

`UNIT` remains scale-independent. `WEIGHT` requires the weighing path. `BOTH` must present an explicit unit-versus-weight choice before quantity is committed. Legacy flags may help compatibility during migration, but SHALL NOT override an explicit valid `saleType`.

No product table or second commercial model is proposed.

### 3. Treat unit verification as configuration and procedure

ROCHI frames do not carry unit or stability metadata. The Agent must use explicit device configuration and an operator verification procedure. The initial commercial scope uses KG verification. LB conversion remains a model-specific driver policy and is not inferred from a frame.

`stable=true` is not part of the REAL acceptance proof. A repeated value is not metrological stability.

### 4. Separate simulation from REAL operation

The existing MOCK service and fallback configuration remain useful for development and QA. They must be labeled and must not satisfy a REAL commercial capture. An unavailable configuration or Agent error must not silently resolve to `FALLBACK_MOCK` in a weighted sale.

### 5. Reuse pricing and sale pipelines

The captured quantity enters the existing cart and `/pricing/preview-line` path. Backend sale validation remains authoritative and recalculates or verifies commercial totals using the existing sale service. Capture evidence is an additional gate, not a second pricing engine.

### 6. Bind capture ownership at the trusted boundary

Frontend identifiers are hints, not proof. The backend and local Agent must corroborate tenant, branch, active terminal, configured device and operation using existing authorization/configuration mechanisms. The final contract must include a unique capture identity, expiry, source, device, terminal, product/operation association and one-use semantics, without accepting a frontend-only token as authenticity.

### 7. Prefer the existing local transport seam

The implementation should extend the existing local Agent/Electron capability rather than create a remote endpoint or a parallel service. The exact HTTP/IPC shape remains an implementation detail to be selected after confirming the current runtime trust boundary and compatibility with other peripherals.

## AS-IS and gap

- Product sale model is persisted and validated, but POS handling of `BOTH` is not an explicit mode-selection flow.
- POS uses `scaleMockEnabled`, reads `mock-scale-001`, and checks MOCK `stable`.
- `ScaleService` returns a simulated `1.25 kg`; ROCHI is not wired into the commercial ScaleModule.
- Terminal settings already expose `scaleDeviceId`, `enableScale`, modes and configuration sources.
- Device registration/bindings are generic and do not yet prove ROCHI COM/PnP ownership.
- Current sale payloads carry quantity and price, but no trusted capture evidence.

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

## Open Questions

- Which existing local authentication or Electron capability is authoritative for binding the Agent response to the active POS operation?
- Is manual weight override a permitted business policy, and which existing permission should authorize it?
- Should a capture evidence identifier be carried transiently through `/sales` or persisted for audit? The answer must preserve atomic sale/inventory behavior.
- Is one open-read-close operation sufficient for operator UX, or is a bounded temporary session required for the weighing interaction?

