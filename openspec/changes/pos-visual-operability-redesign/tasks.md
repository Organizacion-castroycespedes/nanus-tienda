## 1. Discovery

- [x] 1.1 Inspect current POS route and component structure.
- [x] 1.2 Inspect `web/components/design-system`.
- [x] 1.3 Identify existing card, button, input, badge, drawer/sheet, dialog and select components.
- [x] 1.4 Identify current POS state management for cart, products, customer, scanner and scale.
- [x] 1.5 Identify current tax, discount, inventory and payment boundaries.
- [x] 1.6 Confirm OpenSpec repository convention.

## 2. OpenSpec

- [x] 2.1 Create OpenSpec change `pos-visual-operability-redesign`.
- [x] 2.2 Create proposal document.
- [x] 2.3 Create design document.
- [x] 2.4 Create POS spec requirements.
- [x] 2.5 Validate OpenSpec change using the repo validation command.

## 3. Mockups / Visual Planning

- [x] 3.1 Document Mock 1: empty cart POS.
- [x] 3.2 Document Mock 2: POS with cart items.
- [x] 3.3 Document Mock 3: disconnected scanner and scale.
- [x] 3.4 Document Mock 4: weighable product with connected scale.
- [x] 3.5 Document Mock 5: mobile/Capacitor layout.
- [x] 3.6 Confirm Storybook/Ladle/demo visual scripts are not configured and use Markdown mockups.
- [x] 3.7 Create `docs/pos-visual-experience.md`.

## 4. Layout

- [x] 4.1 Refactor POS shell layout in `PosScreen.tsx`.
- [x] 4.2 Add compact sale context bar.
- [x] 4.3 Move product search to primary top position.
- [x] 4.4 Create responsive product grid.
- [x] 4.5 Add desktop sticky cart panel.
- [x] 4.6 Add tablet/mobile floating cart summary.
- [x] 4.7 Add mobile bottom sheet cart.
- [x] 4.8 Preserve global route/header behavior.

## 5. Peripherals

- [x] 5.1 Create compact peripheral status bar.
- [x] 5.2 Create compact peripheral status chips.
- [x] 5.3 Convert scanner mock panel into collapsible diagnostic component.
- [x] 5.4 Convert scale mock panel into collapsible diagnostic component.
- [x] 5.5 Add visibility rules for disconnected peripherals.
- [x] 5.6 Add or reuse `NEXT_PUBLIC_POS_MOCK_DEVICES` condition for mock controls.
- [x] 5.7 Ensure peripherals do not occupy primary workspace during normal sale.

## 6. Product Operation

- [x] 6.1 Modernize product card visual hierarchy.
- [x] 6.2 Add compact quick-add button.
- [x] 6.3 Add contextual weighable product action.
- [x] 6.4 Add stock state badges.
- [x] 6.5 Preserve product search behavior.
- [x] 6.6 Preserve product filter behavior.
- [x] 6.7 Preserve current price display logic.

## 7. Cart Operation

- [x] 7.1 Refactor cart visual hierarchy.
- [x] 7.2 Keep final total always visible.
- [x] 7.3 Keep item taxes collapsed by default.
- [x] 7.4 Preserve quantity adjustment.
- [x] 7.5 Preserve item removal.
- [x] 7.6 Preserve discount display.
- [x] 7.7 Keep charge button sticky or fixed within cart.
- [x] 7.8 Add empty cart state.

## 8. Keyboard and Focus

- [x] 8.1 Autofocus search on POS load.
- [x] 8.2 Restore search focus after adding item.
- [x] 8.3 Add optional shortcut for search.
- [x] 8.4 Add optional shortcut for customer selection when safe.
- [x] 8.5 Add optional shortcut for charge.
- [x] 8.6 Ensure shortcuts do not break normal input typing.

## 9. Responsive Behavior

- [x] 9.1 Test desktop layout.
- [ ] 9.2 Test tablet layout.
- [ ] 9.3 Test mobile layout.
- [ ] 9.4 Test Capacitor safe area behavior.
- [ ] 9.5 Verify floating cart does not hide critical actions.
- [ ] 9.6 Verify cart drawer/bottom sheet works with multiple items.

## 10. QA

- [x] 10.1 Test empty cart.
- [ ] 10.2 Test cart with one item.
- [ ] 10.3 Test cart with multiple items.
- [ ] 10.4 Test add product.
- [ ] 10.5 Test remove product.
- [ ] 10.6 Test modify quantity.
- [ ] 10.7 Test discounts.
- [ ] 10.8 Test taxes.
- [ ] 10.9 Test charge action.
- [ ] 10.10 Test disconnected scanner.
- [ ] 10.11 Test disconnected scale.
- [ ] 10.12 Test weighable product.
- [ ] 10.13 Test low-stock and no-stock states.
- [x] 10.14 Run OpenSpec validation.
- [x] 10.15 Run lint.
- [x] 10.16 Run tests if available.
- [x] 10.17 Run build if feasible.
- [x] 10.18 Run visual/browser validation if available.

## Validation Notes

- OpenSpec strict validation: PASS.
- `cd web && npm.cmd run lint`: PASS with pre-existing warnings outside POS.
- `cd web && npx.cmd tsx --test modules/pos/components/pos-discount-display.spec.ts`: PASS.
- `cd web && npm.cmd run build`: PASS with pre-existing warnings outside POS.
- QA visual local: PASS reported by user on `/00000000-0000-0000-0000-000000000001/pos` with `Super User` and valid POS session.
- Confirmed visually: POS loads correctly, main search is top-priority, sale context is compact, scanner/scale are compact, diagnostics are collapsed, filters are compact, product cards are modernized, sticky side cart is visible, and empty cart state is correct.
- Browser automated validation: NOT EXECUTED because the Browser/node runtime failed to start with `windows sandbox failed: spawn setup refresh`.
