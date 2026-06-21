## 1. Discovery

- [ ] 1.1 Confirm whether delivery creation stays inline in `/{tenant}/deliveries` or needs a dedicated `/{tenant}/deliveries/new` route.
- [ ] 1.2 Review current `CreateDeliveryForm`, `DeliveriesScreen`, delivery types and delivery service payload mapping.
- [ ] 1.3 Review available frontend services for customers, branches, orders, payment methods and sales/factura source records.
- [ ] 1.4 Confirm no required changes touch caja, POS, electronic invoicing, order lifecycle, courier assignment or delivery state transitions.

## 2. Selector Data

- [ ] 2.1 Add or reuse a delivery quick-create data loader for active customers, active payment methods and active branches.
- [ ] 2.2 Add customer search/filter behavior that can match by name, document, phone or email without exposing IDs.
- [ ] 2.3 Add branch resolution from `state.pos.branchId`, `state.auth.user.branchId`, single active branch or branch selector fallback.
- [ ] 2.4 Add optional customer-scoped order loading for the selector using existing order read APIs when possible.
- [ ] 2.5 Add optional customer-scoped sale/factura loading for the selector using an existing read API or a new tenant-safe read-only endpoint if no suitable API exists.
- [ ] 2.6 Keep any new backend selector endpoint read-only, tenant-scoped and free of caja, POS, electronic invoicing or order mutations.

## 3. Quick-Create Form

- [ ] 3.1 Replace visible `customer_id` input with a cliente search/selector.
- [ ] 3.2 Preload contact name, phone and address from selected customer while keeping fields editable.
- [ ] 3.3 Support multiple address options when available and copy the selected address into the delivery snapshot.
- [ ] 3.4 Replace visible `payment_method_id` input with an active metodo de pago selector.
- [ ] 3.5 Replace visible `branch_id` input with inferred branch display or sucursal selector fallback.
- [ ] 3.6 Replace visible `order_id` input with an optional pedido selector filtered to selected customer.
- [ ] 3.7 Replace visible `sale_id` input with an optional venta/factura selector filtered to selected customer.
- [ ] 3.8 Autopopulate contact, address, branch, subtotal and total when a pedido or venta/factura source is selected.
- [ ] 3.9 Preserve manual creation when no customer, pedido or venta/factura source is selected.
- [ ] 3.10 Map selected records back into `CreateDeliveryPayload` internally without asking the seller to type UUIDs.

## 4. Validation And UX

- [ ] 4.1 Add validation for cliente or manual contact/telefono, delivery address and valor domicilio when applicable.
- [ ] 4.2 Rewrite validation messages and labels to avoid visible `customer_id`, `order_id`, `sale_id`, `branch_id` and `payment_method_id`.
- [ ] 4.3 Add loading, empty and error states for customer, branch, order, sale/factura and payment method selectors.
- [ ] 4.4 Keep fields grouped for fast desktop scanning and stacked/wrapped for mobile.
- [ ] 4.5 Verify quick-create flow has no global horizontal overflow on narrow viewport.

## 5. Tests And QA

- [ ] 5.1 Add or update focused frontend tests for payload mapping, branch inference, source total calculation and validation helpers where practical.
- [ ] 5.2 Manually verify authorized user can see Domicilios and open quick creation.
- [ ] 5.3 Manually verify seller can select customer, prefilled phone/contact/address appear and address remains editable.
- [ ] 5.4 Manually verify metodo de pago selector stores the selected method internally.
- [ ] 5.5 Manually verify pedido and venta/factura selectors are optional and source selection preloads subtotal/total.
- [ ] 5.6 Manually verify form saves a domicilio and does not touch caja, POS, electronic invoicing or order lifecycle.
- [ ] 5.7 Run `C:\nvm4w\nodejs\openspec.cmd validate --all --strict`.
- [ ] 5.8 Run `cd web && npm run lint`.
- [ ] 5.9 Run `cd web && npm run build`.
