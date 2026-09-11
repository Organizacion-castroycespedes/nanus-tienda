## Context

`/[tenant]/pos` already has functional sale flows, but the current presentation spreads attention across too many controls and uses small product imagery. The approved reference image for `Venta express` shows a stronger sale-first hierarchy: large product cards, compact filters, a clear desktop cart column, and a mobile experience that still preserves fast access to cart and charge.

This change is visual-first, but it is not purely cosmetic. The default stock filter changes to `Con stock`, the product image hierarchy changes, and the catalog/cart density changes across desktop, tablet and mobile. The previously approved responsive fix for shared cart state, sidebar labels and global POS context must remain intact.

Stakeholders: cashiers, store operators, support/QA, and product owners reviewing visual parity.

## Goals / Non-Goals

**Goals:**

- Deliver high visual parity with the approved `Venta express` mockup.
- Make product identification faster by enlarging and prioritizing product imagery.
- Keep the catalog as the primary workspace and the cart as a stable secondary column on desktop.
- Keep the shared mobile cart behavior from the approved responsive fix.
- Start the catalog in `Con stock` while preserving all stock rules and counters.
- Preserve scanner, balanza, charging, taxes, discounts, weights and current cart logic.
- Keep dark mode working and readable.
- Keep touch targets and keyboard affordances usable.

**Non-Goals:**

- No global sidebar, header or tenant navigation redesign.
- No new external UI dependency.
- No rewrite of sale, pricing, tax or payment logic.
- No fake `Guardar venta` capability.
- No removal of weighable-product flows.
- No regression to the approved responsive fix.

## Decisions

### Decision: Keep `PosScreen.tsx` as the behavioral root, extract only low-risk visual helpers if needed

`PosScreen.tsx` already owns sale behavior, search, cart, peripheral states and responsive logic. A full rewrite would risk destabilizing the current POS. The safer plan is to keep business behavior where it is and extract only presentational fragments such as card, list row, toolbar or cart sections if they reduce complexity.

Alternative considered: split the module into many independent containers. Rejected because it adds churn without improving the sale contract.

### Decision: Treat the approved image as the layout truth for density and hierarchy

The reference is not just inspiration. The implementation should match the structure, spacing, image prominence and cart proportion as closely as the current product data allows. This includes 2-card desktop preference, compact filter chips, visible stock states and a cart that reads like a sales panel instead of a settings pane.

Alternative considered: loosely adapt the current layout and just enlarge product thumbnails. Rejected because it would keep the current “administrative” feeling.

### Decision: Preserve current image resolution strategy

The existing `resolveEffectivePosProductImage()` and `InventoryImagePreview` path stay in place. The redesign should change how images are presented, not how images are sourced. That keeps fallback behavior, tenant image resolution and catalog image precedence stable.

Alternative considered: replace image logic with a new preview pipeline. Rejected because it would blur the scope and increase regressions.

### Decision: Use `Con stock` as the operational default filter

The POS should open in the most common operational mode. `available` becomes the initial state while still keeping `Todos`, `Stock bajo` and `Sin stock` available with counters. Clearing search/classification filters should not remove the stock mode base.

Alternative considered: keep `Todos` as default to mirror the current behavior. Rejected because it slows down the cashier path and conflicts with the approved brief.

### Decision: Cart stays compact on desktop and shared on mobile

Desktop should keep a stable right cart column with denser rows, clear totals and a strong charge CTA. Mobile/tablet should keep using the single shared cart state already approved, with the same open/close behavior from header and floating control.

Alternative considered: create a separate mobile cart surface. Rejected because it would duplicate state and break the approved responsive fix.

### Decision: Keep dark mode and accessibility as hard constraints

The reference is light mode, but the product still needs dark mode parity. Card contrast, chip states, disabled actions, focus rings and touch targets must remain usable in both themes.

Alternative considered: optimize only for the reference screenshot. Rejected because it would create a visually nice but operationally unsafe POS.

### Decision: Build parity through Tailwind and existing primitives

The repo already has the primitives needed for the redesign. The work should reuse existing design-system components and POS-local markup/styles rather than introducing a new design system layer.

Alternative considered: add generic card/sheet/badge components first. Rejected because the change is localized to POS and should not spill into unrelated areas.

## Risks / Trade-offs

- [Risk] Larger images can reduce items per row on smaller tablets. → Mitigation: keep responsive column rules flexible and allow 1- or 2-column adaptation based on actual width.
- [Risk] Denser cart rows can hide important pricing details. → Mitigation: use progressive disclosure for taxes, promotions and errors.
- [Risk] A visually rich card can hurt performance if images are too heavy. → Mitigation: keep the existing image preview path and only reshape presentation.
- [Risk] The default `Con stock` filter may surprise users expecting current behavior. → Mitigation: make the active stock chips explicit and keep `Todos` one tap away.
- [Risk] Visual parity on dark mode may diverge from the light-mode reference. → Mitigation: validate both themes and keep contrast rules strict.
- [Risk] POS-local extraction can create unnecessary component sprawl. → Mitigation: extract only if it reduces duplication or improves testability.

## Migration Plan

1. Update POS visual structure incrementally, starting with filters and product card hierarchy.
2. Adjust catalog density and cart density without changing business logic.
3. Keep the approved shared cart state, sidebar labels and global POS context untouched.
4. Add focused tests for default filter behavior, product classification and cart UI state where feasible.
5. Validate the result against the approved image across desktop, tablet and mobile sizes.

Rollback is reverting the POS visual files and the new OpenSpec artifacts. No database, API or persistence migration is involved.

## Open Questions

- Should the final visual refactor extract `PosProductCard`, `PosProductListItem`, `PosCatalogToolbar` and `PosCartPanel`, or keep everything inside `PosScreen.tsx`?
- How close should the mobile layout stay to the desktop composition before readability drops on narrow devices?
- Do we need a dedicated QA artifact in the repo, or is the approved image plus manual QA enough for this phase?
