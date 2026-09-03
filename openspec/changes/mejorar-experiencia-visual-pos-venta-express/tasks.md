## 1. Discovery and POS surface mapping

- [x] 1.1 Re-read `PosScreen.tsx`, product image helpers, catalog filters and cart rendering to confirm the exact visual surface to change.
- [x] 1.2 Identify which pieces of POS presentation can stay in `PosScreen.tsx` and which low-risk visual fragments should be extracted.
- [x] 1.3 Map the approved reference image to the current POS sections: header row, filters, catalog, cards, list, cart, empty state and mobile sheet.

## 2. Catalog filters and product lookup

- [x] 2.1 Change the POS default stock filter to `Con stock` without altering the underlying low-stock rule.
- [x] 2.2 Update the filter toolbar so stock, category and subcategory chips stay compact and counters remain visible.
- [x] 2.3 Preserve search, scanner wedge and keyboard shortcuts while keeping the search control easy to reach from the main layout.
- [x] 2.4 Keep `Limpiar filtros` clearing search/category/subcategory only, while preserving the operational stock base state.
- [x] 2.5 Add or adjust tests for default stock mode, `Todos`, `Sin stock`, `Stock bajo` and combined classification filters.

## 3. Product cards and list rows

- [x] 3.1 Redesign grid cards so product imagery is visually dominant without breaking fallback image behavior.
- [x] 3.2 Redesign list rows to use the same visual language as the grid while staying denser.
- [x] 3.3 Preserve stock badges, in-cart feedback and weighable-product actions in both view modes.
- [x] 3.4 Keep quick-add targets visible, touch-friendly and disabled when current business rules require it.
- [x] 3.5 Add or adjust tests for product-in-cart feedback and weighable-product presentation helpers if component extraction is needed.

## 4. Cart presentation

- [x] 4.1 Rework the desktop cart density so more items fit without hiding quantity, totals, discounts or error detail.
- [x] 4.2 Keep the charge CTA as the main action in the cart and preserve current charge behavior.
- [x] 4.3 Implement the approved empty-cart state with no fake content.
- [x] 4.4 Keep the shared mobile cart behavior intact and avoid adding a second cart surface.
- [x] 4.5 Add or adjust tests that protect the shared cart UI state and the empty-cart path.

## 5. Responsive, accessibility and theme

- [x] 5.1 Tune the layout for desktop, tablet and mobile so the catalog remains readable and the cart stays reachable.
- [x] 5.2 Preserve the approved responsive fix for header cart access, floating cart and sidebar labels from `/pos`.
- [x] 5.3 Validate touch targets, aria states, focus-visible styles and keyboard navigation on the updated controls.
- [x] 5.4 Keep dark mode contrast and hierarchy aligned with the light-mode layout.

## 6. Validation and QA

- [x] 6.1 Run focused POS tests for filters, image resolution, cart UI state and any extracted POS-local visual components.
- [x] 6.2 Run `npm run lint` and `npm run build` in `web/`.
- [x] 6.3 Run OpenSpec strict validation for the change and for the full repo.
- [x] 6.4 Run `git diff --check` before handing off.
- [x] 6.5 Prepare visual QA evidence comparing the implementation against `docs/references/pos-venta-express-approved.png` for desktop, tablet, mobile, empty cart, filled cart, grid, list, filters, low stock and out of stock.

### QA Evidence

- Manual QA final: PASS.
- Visual parity: HIGH.
- Reference used: `docs/references/pos-venta-express-approved.png`.
- Confirmed PASS: catalog, grid, list, peripherals, desktop cart, empty cart, mobile cart, 946x704, 1366x768, dark mode, accessibility, bug 1, bug 2, bug 3.
