# Design: mejorar-experiencia-operativa-visual-pos

## Goal
Make the POS workspace feel denser and more operational without changing business behavior. The POS must prioritize products, cart and charge actions.
QA visual showed that the fixed POS header card still consumed too much vertical space, so the operational controls now need to live in a floating panel that starts closed.

## UI Strategy
- Reuse the existing sidebar collapse mechanism in the authenticated tenant layout.
- Detect POS routes and start them with the sidebar collapsed.
- Keep the global layout intact for non-POS routes.
- Replace the always-visible POS header card with a floating trigger and on-demand modal panel.
- Keep the floating POS and cart triggers draggable so the operator can move them away from dense content.
- Use Pointer Events with a small drag threshold so click and drag stay distinct.
- Clamp floating control positions to the viewport, snap them to a horizontal edge on release, and keep their saved positions independent.
- Keep filters/customer/search inside the floating panel and closed by default.
- Keep desktop cart structure stable.
- Use a centered modal for mobile cart to reduce wasted vertical space and improve touch control.
- Add a safe audio helper that plays `product-added-p.mp3` only after a successful add-to-cart operation.
- Show operational context in the topbar using real session data already available in auth/POS state, with short labels and truncation.

## Data Flow
- POS context selector continues to own tenant, branch and terminal selection.
- POS state stores the selected ids and, if needed, display names for the topbar.
- The topbar reads the current POS context and auth session.
- Product add actions remain in the same code path; only successful adds trigger audio.

## Responsiveness
- Desktop: sidebar collapsed by default on POS, filters panel compact, cart unchanged.
- Tablet: same model, but controls must remain touch-friendly.
- Mobile: cart opens as a centered modal, filters/client panel stays reachable from a single compact control.
- Floating triggers stay inside the viewport, snap to an edge on release, and keep only a local visual preference.

## Validation
- No business logic changes for pricing, discounts, taxes, stock, payments or peripherals.
- No backend or database changes expected.
- The sound must fail silently if the browser blocks playback.
