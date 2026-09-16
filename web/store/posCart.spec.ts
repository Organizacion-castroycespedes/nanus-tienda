import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import posCartReducer, {
  allowSaleSubmissionRetry,
  beginSaleSubmission,
  buildPosCartStorageKey,
  hydratePosCart,
  initialPosCartState,
  loadPersistedPosCartState,
  markSaleSubmissionUnknown,
  persistPosCartState,
  setSaleStatus,
  setPosCartContext,
  setCartItems,
} from "./posCart";

const globalAny = globalThis as typeof globalThis & {
  window?: { localStorage: Storage };
};

const installStorage = () => {
  const values = new Map<string, string>();
  const localStorage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  } satisfies Storage;
  globalAny.window = { localStorage };
  return values;
};

afterEach(() => {
  delete globalAny.window;
});

describe("POS sale submission recovery", () => {
  const context = {
    tenantId: "tenant-a",
    branchId: "branch-a",
    terminalId: "terminal-a",
    userId: "user-a",
    posSessionId: "session-a",
  };

  it("isolates the persisted cart by the authenticated POS context", () => {
    assert.equal(
      buildPosCartStorageKey(context),
      "pos-cart:tenant-a:branch-a:terminal-a:user-a:session-a"
    );
    assert.notEqual(
      buildPosCartStorageKey({ ...context, tenantId: "tenant-b" }),
      buildPosCartStorageKey(context)
    );
  });

  it("rehydrates an interrupted submission as UNKNOWN instead of retrying it", () => {
    const storage = installStorage();
    const contextState = posCartReducer(initialPosCartState, setPosCartContext(context));
    const stateWithCart = {
      ...contextState,
      items: [
        {
          productId: "product-a",
          name: "Producto A",
          sku: "A-1",
          quantity: 1,
          price: 100,
          stock: 5,
          taxId: null,
          priceWithoutTax: 100,
        },
      ],
    };
    const submitting = posCartReducer(
      stateWithCart,
      beginSaleSubmission({ attemptId: "attempt-a", startedAt: "2026-09-16T12:00:00.000Z" })
    );

    persistPosCartState(submitting);
    const snapshot = loadPersistedPosCartState(submitting.contextKey!);
    const rehydrated = posCartReducer(
      contextState,
      hydratePosCart({ contextKey: contextState.contextKey!, snapshot })
    );

    assert.equal(storage.size, 1);
    assert.equal(rehydrated.saleStatus, "UNKNOWN");
    assert.equal(rehydrated.saleAttempt?.attemptId, "attempt-a");
    assert.equal(rehydrated.items.length, 1);
  });

  it("requires an explicit operator action before an unknown attempt can retry", () => {
    const submitting = posCartReducer(
      {
        ...initialPosCartState,
        contextKey: "pos-cart:test",
        items: [
          {
            productId: "product-a",
            name: "Producto A",
            sku: "A-1",
            quantity: 1,
            price: 100,
            stock: 5,
            taxId: null,
            priceWithoutTax: 100,
          },
        ],
      },
      beginSaleSubmission({ attemptId: "attempt-a", startedAt: "2026-09-16T12:00:00.000Z" })
    );
    const unknown = posCartReducer(submitting, markSaleSubmissionUnknown());
    const editAttempt = posCartReducer(unknown, setSaleStatus("DRAFT"));
    const cartEditAttempt = posCartReducer(unknown, setCartItems([]));
    const retryable = posCartReducer(unknown, allowSaleSubmissionRetry());

    assert.equal(unknown.saleStatus, "UNKNOWN");
    assert.equal(editAttempt.saleStatus, "UNKNOWN");
    assert.deepEqual(cartEditAttempt.items, unknown.items);
    assert.equal(retryable.saleStatus, "DRAFT");
    assert.equal(retryable.saleAttempt, null);
  });
});
