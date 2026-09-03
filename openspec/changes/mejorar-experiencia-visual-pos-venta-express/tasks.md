## 1. Discovery and POS surface mapping

- [ ] 1.1 Re-read `PosScreen.tsx`, product image helpers, catalog filters and cart rendering to confirm the exact visual surface to change.
- [ ] 1.2 Identify which pieces of POS presentation can stay in `PosScreen.tsx` and which low-risk visual fragments should be extracted.
- [ ] 1.3 Map the approved reference image to the current POS sections: header row, filters, catalog, cards, list, cart, empty state and mobile sheet.

## 2. Catalog filters and product lookup

- [ ] 2.1 Change the POS default stock filter to `Con stock` without altering the underlying low-stock rule.
- [ ] 2.2 Update the filter toolbar so stock, category and subcategory chips stay compact and counters remain visible.
- [ ] 2.3 Preserve search, scanner wedge and keyboard shortcuts while keeping the search control easy to reach from the main layout.
- [ ] 2.4 Keep `Limpiar filtros` clearing search/category/subcategory only, while preserving the operational stock base state.
- [ ] 2.5 Add or adjust tests for default stock mode, `Todos`, `Sin stock`, `Stock bajo` and combined classification filters.

## 3. Product cards and list rows

- [ ] 3.1 Redesign grid cards so product imagery is visually dominant without breaking fallback image behavior.
- [ ] 3.2 Redesign list rows to use the same visual language as the grid while staying denser.
- [ ] 3.3 Preserve stock badges, in-cart feedback and weighable-product actions in both view modes.
- [ ] 3.4 Keep quick-add targets visible, touch-friendly and disabled when current business rules require it.
- [ ] 3.5 Add or adjust tests for product-in-cart feedback and weighable-product presentation helpers if component extraction is needed.

## 4. Cart presentation

- [ ] 4.1 Rework the desktop cart density so more items fit without hiding quantity, totals, discounts or error detail.
- [ ] 4.2 Keep the charge CTA as the main action in the cart and preserve current charge behavior.
- [ ] 4.3 Implement the approved empty-cart state with no fake content.
- [ ] 4.4 Keep the shared mobile cart behavior intact and avoid adding a second cart surface.
- [ ] 4.5 Add or adjust tests that protect the shared cart UI state and the empty-cart path.

## 5. Responsive, accessibility and theme

- [ ] 5.1 Tune the layout for desktop, tablet and mobile so the catalog remains readable and the cart stays reachable.
- [ ] 5.2 Preserve the approved responsive fix for header cart access, floating cart and sidebar labels from `/pos`.
- [ ] 5.3 Validate touch targets, aria states, focus-visible styles and keyboard navigation on the updated controls.
- [ ] 5.4 Keep dark mode contrast and hierarchy aligned with the light-mode layout.

## 6. Validation and QA

- [ ] 6.1 Run focused POS tests for filters, image resolution, cart UI state and any extracted POS-local visual components.
- [ ] 6.2 Run `npm run lint` and `npm run build` in `web/`.
- [ ] 6.3 Run OpenSpec strict validation for the change and for the full repo.
- [ ] 6.4 Run `git diff --check` before handing off.
- [ ] 6.5 Prepare visual QA evidence comparing the implementation against `docs/references/pos-venta-express-approved.png` for desktop, tablet, mobile, empty cart, filled cart, grid, list, filters, low stock and out of stock.
