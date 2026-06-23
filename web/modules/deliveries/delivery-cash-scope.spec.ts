import assert from "node:assert/strict";
import test from "node:test";
import {
  getDeliveryCashScope,
  getDeliveryCashScopeLabel,
  hasDeliveryCashImpact,
  shouldBlockCashImpactAction,
} from "./delivery-cash-scope";

test("delivery cash scope labels current none and other cash sessions", () => {
  assert.equal(getDeliveryCashScope({ cash_session_id: null }, "cash-1"), "none");
  assert.equal(getDeliveryCashScope({ cash_session_id: "cash-1" }, "cash-1"), "current");
  assert.equal(getDeliveryCashScope({ cash_session_id: "cash-2" }, "cash-1"), "other");
  assert.equal(getDeliveryCashScopeLabel("current"), "Caja actual");
  assert.equal(getDeliveryCashScopeLabel("none"), "Sin caja");
  assert.equal(getDeliveryCashScopeLabel("other"), "Otra caja");
});

test("cash-impact delivery actions need current matching cash session", () => {
  const delivery = {
    delivery_fee: 5000,
    payment_method_id: null,
    cash_session_id: "cash-1",
  };

  assert.equal(hasDeliveryCashImpact(delivery), true);
  assert.equal(shouldBlockCashImpactAction(delivery, null), true);
  assert.equal(shouldBlockCashImpactAction(delivery, "cash-2"), true);
  assert.equal(shouldBlockCashImpactAction(delivery, "cash-1"), false);
  assert.equal(
    shouldBlockCashImpactAction({
      delivery_fee: 0,
      payment_method_id: null,
      cash_session_id: null,
    }, null),
    false
  );
});
