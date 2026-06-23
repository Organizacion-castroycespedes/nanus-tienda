import assert from "node:assert/strict";
import test from "node:test";
import { buildDeliveryDriversQuery } from "./delivery-drivers.service";

test("buildDeliveryDriversQuery includes query and active filter", () => {
  assert.equal(
    buildDeliveryDriversQuery({ query: "Carlos", active: true }),
    "/delivery-drivers?query=Carlos&active=true"
  );
});

test("buildDeliveryDriversQuery skips empty filters", () => {
  assert.equal(buildDeliveryDriversQuery({ query: "" }), "/delivery-drivers");
});
