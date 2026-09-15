import assert from "node:assert/strict";
import test from "node:test";
import {
  createDefaultCashPayment,
  findCashPaymentMethod,
  isCashPaymentMethod,
  rebalanceCashPayment,
  parseDocumentPaymentAmount,
  summarizeDocumentPayments,
} from "./payment-allocation.helper";

test("cash predicate accepts type, code and name", () => {
  assert.equal(isCashPaymentMethod({ id: "cash-1", tipo: "CASH" }), true);
  assert.equal(
    isCashPaymentMethod({ id: "cash-2", tipo: "CARD", codigo: "EFECTIVO" }),
    true
  );
  assert.equal(
    isCashPaymentMethod({ id: "cash-3", tipo: "BANK", nombre: "Pago en Efectivo" }),
    true
  );
  assert.equal(
    isCashPaymentMethod({ id: "card-1", tipo: "CARD", codigo: "PSE", nombre: "Transferencia" }),
    false
  );
});

test("document payment defaults and remaining balances use exact cents", () => {
  assert.equal(parseDocumentPaymentAmount("35000000"), 35000000);
  assert.equal(parseDocumentPaymentAmount("10.001"), null);
  assert.deepEqual(
    summarizeDocumentPayments(35000000, [
      { id: "one", paymentMethodId: "cash", amount: "10000000" },
      { id: "two", paymentMethodId: "transfer", amount: "25000000" },
    ]),
    { total: 35000000, remaining: 0, overpayment: false, valid: true }
  );
  assert.equal(
    summarizeDocumentPayments(35000000, [{ id: "one", paymentMethodId: "cash", amount: "10000000" }]).remaining,
    25000000
  );
});

test("cash helper finds the canonical cash payment method", () => {
  const result = findCashPaymentMethod([
    { id: "card-1", tipo: "CARD", codigo: "TC", nombre: "Tarjeta" },
    { id: "cash-1", tipo: "BANK", codigo: "EFECTIVO", nombre: "Pago contado" },
  ]);

  assert.equal(result?.id, "cash-1");
});

test("cash helper supports default and rebalance flows", () => {
  const paymentMethods = [
    { id: "cash-1", tipo: "BANK", codigo: "EFECTIVO", nombre: "Efectivo" },
    { id: "card-1", tipo: "CARD", codigo: "TC", nombre: "Tarjeta" },
  ];

  const defaultPayment = createDefaultCashPayment(12000, paymentMethods, (id, amount) => ({
    id: `${id}:${amount}`,
    paymentMethodId: id,
    amount,
  }));

  assert.equal(defaultPayment.error, null);
  assert.equal(defaultPayment.payments[0]?.paymentMethodId, "cash-1");
  assert.equal(defaultPayment.payments[0]?.amount, "12000");

  const rebalanceResult = rebalanceCashPayment(
    12000,
    [
      { id: "card-payment", paymentMethodId: "card-1", amount: "2000" },
      { id: "cash-payment", paymentMethodId: "cash-1", amount: "10000" },
    ],
    paymentMethods[0],
    (id, amount) => ({ id: `${id}:${amount}`, paymentMethodId: id, amount })
  );

  assert.equal(rebalanceResult.error, null);
  assert.equal(rebalanceResult.payments[1]?.paymentMethodId, "cash-1");
  assert.equal(rebalanceResult.payments[1]?.amount, "10000");
});
