# Design

## Diagnosis

1. The sample order `8741658f-...` was not queried directly in code. The root cause is visible in the service flow: `createFromOrder()` delegated to `create()`, and `create()` only attached cash context when `delivery_fee > 0` or `payment_method_id` existed.
2. `GET /api/orders/:id/delivery` is read-only and did not validate an open cash session. It remains read-only.
3. `POST /api/orders/:id/delivery` did not require open cash. It now does.
4. A delivery from an order should inherit current cash context for logistics. If the order already has `cash_session_id`, it must match the current cash session.
5. A historical order without `cash_session_id` can create a delivery in the current cash session when the user has an open cash session. Metadata marks `source_order_without_cash_session = true`.
6. If the order belongs to another cash session, the API rejects the operation with an explicit error.
7. `delivery_fee = 0` still appears in `cash_scope=current` when the delivery has `cash_session_id`; it contributes `cash_impact_amount = 0`.
8. Historical deliveries without `cash_session_id` remain excluded from `cash_scope=current`.

## Backend

`OrderController.createDelivery()` is guarded with `@RequireOpenCashSession()`.

`DeliveriesService.createFromOrder()`:

- loads the order and its `cash_session_id`
- resolves the branch
- checks for an existing delivery
- completes cash context only when the existing delivery is still initial and has no cash session
- creates new deliveries with `cash_session_id`, `cash_register_id`, and `terminal_id`

The service does not create payments or cash movements. The closing impact remains `cash_impact_amount = delivery_fee`.

## Frontend

`getOrderDelivery()` now sends POS session context when available. `createOrderDelivery()` already did this.

Copy in `DeliveryRelationCard` was adjusted so order-created deliveries are not described as completely detached from cash context. It still states that POS, fiscal totals, and taxes are not modified.

## Safety

- Existing delivery with another `cash_session_id` is not reassigned.
- Existing delivery with final/non-initial status and no cash session is not changed.
- Existing delivery with same current cash session is returned idempotently.
- No order, sale, invoice, payment, or inventory total is mutated.
