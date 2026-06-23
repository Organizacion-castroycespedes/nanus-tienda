# Design

## Diagnosis

1. The order modal uses its own `DeliveryRelationCard`, not `CreateDeliveryForm`.
2. The driver selector was missing because `DeliveryRelationCard` did not load or render delivery drivers.
3. The modal had no scoped max-height/overflow behavior from the order page, so tall content could exceed the viewport.
4. `POST /api/orders/:id/delivery` already accepts `driver_id`.
5. `POST /api/orders/:id/delivery` already accepts `payment_method_id`.
6. `POST /api/orders/:id/delivery` already accepts `delivery_fee`, `delivery_address`, `delivery_reference`, and `notes`.
7. `POST /api/orders/:id/delivery` now requires and resolves current cash session from the previous change.
8. Orders expose `generatedSaleId` in the frontend list. Backend now also infers the latest non-cancelled sale for the order and stores it as `sale_id`.
9. Duplicate prevention is enforced by the backend and the modal shows an existing delivery instead of keeping the create form as the first path.

## Frontend

`DeliveryRelationCard` remains the relation component, but it now shares operational helpers with the main delivery creation flow:

- `delivery-quick-create.ts` for payload and validation
- `delivery-totals.ts` for subtotal/total calculation
- delivery driver service for active drivers
- payment method service for active methods
- customer service to preload phone/address by `customerId`

The order page passes source context into the modal:

- `customerId`
- `branchId`
- `generatedSaleId`
- `total`

The order modal uses `size="xl"` and `max-height` with `overflow-y-auto`.

## Backend

`DeliveriesService.loadOrderForDelivery()` now resolves `generated_sale_id` through a lateral query.

`createFromOrder()` sends that generated sale to the shared delivery create flow. This preserves both `order_id` and `sale_id` when the order already has a sale.

## Safety

- The path endpoint keeps `order_id` fixed.
- Relation IDs are not sent as manual fields from the frontend to path-specific endpoints.
- Driver assignment during creation does not change delivery status.
- Delivery fee is the only delivery cash impact.
- No POS, payment, fiscal, invoice, or inventory behavior is mutated.
