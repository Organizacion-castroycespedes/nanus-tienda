import assert from "node:assert/strict";
import test from "node:test";
import { buildDeliveriesQuery } from "./delivery-query";

test("buildDeliveriesQuery includes only supported backend filters", () => {
  assert.equal(
    buildDeliveriesQuery({
      status: "CREATED",
      order_id: "order-1",
      sale_id: "sale-1",
      date_from: "2026-06-01",
      date_to: "2026-06-21",
      page: 2,
      limit: 25,
    }),
    "/deliveries?status=CREATED&order_id=order-1&sale_id=sale-1&date_from=2026-06-01&date_to=2026-06-21&page=2&limit=25"
  );
});

test("buildDeliveriesQuery skips empty values", () => {
  assert.equal(
    buildDeliveriesQuery({
      status: "",
      order_id: "",
      page: 1,
      limit: 10,
    }),
    "/deliveries?page=1&limit=10"
  );
});
