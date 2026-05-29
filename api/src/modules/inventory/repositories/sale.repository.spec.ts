import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import {
  SaleRepository,
  type CreateSaleInput,
} from "./sale.repository";

const ids = {
  tenant: "00000000-0000-0000-0000-000000000001",
  branch: "00000000-0000-0000-0000-000000000002",
  terminal: "00000000-0000-0000-0000-000000000003",
  user: "00000000-0000-0000-0000-000000000004",
  posSession: "00000000-0000-0000-0000-000000000005",
  customer: "00000000-0000-0000-0000-000000000006",
  order: "00000000-0000-0000-0000-000000000007",
  product: "00000000-0000-0000-0000-000000000008",
  orderItem: "00000000-0000-0000-0000-000000000009",
  sale: "00000000-0000-0000-0000-000000000010",
};

type RecordedCall = {
  text: string;
  params: unknown[];
};

const saleInput: CreateSaleInput = {
  tenantId: ids.tenant,
  branchId: ids.branch,
  terminalId: ids.terminal,
  userId: ids.user,
  posSessionId: ids.posSession,
  customerId: ids.customer,
  orderId: ids.order,
  type: "CASH",
  items: [
    {
      productId: ids.product,
      quantity: 2,
      price: 1250,
      orderItemId: ids.orderItem,
    },
  ],
};

const payments = [
  {
    paymentMethod: "CASH" as const,
    amount: 2500,
    reference: "POS-TEST",
  },
];

const saleRow = {
  id: ids.sale,
  tenant_id: ids.tenant,
  customer_id: ids.customer,
  order_id: ids.order,
  type: "CASH" as const,
  status: "CONFIRMED" as const,
  total: 2500,
  balance: 0,
  created_at: new Date("2026-05-28T00:00:00.000Z"),
};

const withSaleV2Flag = async <T>(
  value: string | undefined,
  action: () => Promise<T>
): Promise<T> => {
  const previousValue = process.env.INVENTORY_SALE_V2_ENABLED;

  if (value === undefined) {
    delete process.env.INVENTORY_SALE_V2_ENABLED;
  } else {
    process.env.INVENTORY_SALE_V2_ENABLED = value;
  }

  try {
    return await action();
  } finally {
    if (previousValue === undefined) {
      delete process.env.INVENTORY_SALE_V2_ENABLED;
    } else {
      process.env.INVENTORY_SALE_V2_ENABLED = previousValue;
    }
  }
};

const buildClient = () => {
  const calls: RecordedCall[] = [];
  const client = {
    query: async <T>(text: string, params: unknown[]) => {
      calls.push({ text, params });
      return { rows: [saleRow] as T[] };
    },
  };

  return {
    calls,
    client: client as unknown as PoolClient,
  };
};

const callRepository = async (flagValue?: string) =>
  withSaleV2Flag(flagValue, async () => {
    const repository = new SaleRepository({} as never);
    const { calls, client } = buildClient();
    const result = await repository.createSaleWithFunction(
      saleInput,
      payments,
      client
    );

    assert.deepEqual(result, saleRow);

    return calls;
  });

const findCreateSaleCall = (calls: RecordedCall[]) => {
  const call = calls.find((recordedCall) =>
    recordedCall.text.includes("inventory_create_sale")
  );

  assert.ok(call, "create sale function call not found");
  return call;
};

const assertCreateSaleCall = (
  calls: RecordedCall[],
  expectedFunctionName: "inventory_create_sale" | "inventory_create_sale_v2"
) => {
  const call = findCreateSaleCall(calls);

  assert.match(call.text, new RegExp(`FROM ${expectedFunctionName}\\(`));
  assert.equal(call.params[0], ids.tenant);
  assert.equal(call.params[1], ids.branch);
  assert.equal(call.params[2], ids.terminal);
  assert.equal(call.params[3], ids.user);
  assert.equal(call.params[4], ids.posSession);
  assert.equal(call.params[5], ids.customer);
  assert.equal(call.params[6], ids.order);
  assert.equal(call.params[7], "CASH");
  assert.deepEqual(JSON.parse(call.params[8] as string), [
    {
      product_id: ids.product,
      quantity: 2,
      price: 1250,
      order_item_id: ids.orderItem,
    },
  ]);
  assert.deepEqual(JSON.parse(call.params[9] as string), [
    {
      payment_method: "CASH",
      amount: 2500,
      reference: "POS-TEST",
    },
  ]);
};

test("SaleRepository normal flow uses inventory_create_sale_v2 when flag is not set", async () => {
  const calls = await callRepository(undefined);

  assert.equal(calls.length, 1);
  assertCreateSaleCall(calls, "inventory_create_sale_v2");
});

test("SaleRepository normal flow uses inventory_create_sale_v2 when flag is false", async () => {
  const calls = await callRepository("false");

  assert.equal(calls.length, 1);
  assertCreateSaleCall(calls, "inventory_create_sale_v2");
});

test("SaleRepository normal flow uses inventory_create_sale_v2 when flag is true", async () => {
  const calls = await callRepository("true");

  assert.equal(calls.length, 1);
  assertCreateSaleCall(calls, "inventory_create_sale_v2");
});

test("SaleRepository normal flow ignores unexpected flag values and still uses v2", async () => {
  const calls = await callRepository("TRUE");

  assert.equal(calls.length, 1);
  assertCreateSaleCall(calls, "inventory_create_sale_v2");
});

test("SaleRepository does not query tenant config to choose sale function", async () => {
  const calls = await callRepository(undefined);
  const configCall = calls.find((call) => call.text.includes("FROM tenants"));

  assert.equal(configCall, undefined);
  assert.equal(calls.length, 1);
});

test("SaleRepository keeps create sale payload unchanged for v2", async () => {
  const calls = await callRepository(undefined);

  assert.equal(calls.length, 1);
  assertCreateSaleCall(calls, "inventory_create_sale_v2");
});
