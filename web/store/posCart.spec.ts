import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import posCartReducer, {
  addAccount,
  allowSaleSubmissionRetry,
  allowUnknownSaleRetry,
  beginSaleSubmission,
  buildPosCartStorageKey,
  hydratePosCart,
  initialPosCartState,
  loadPersistedPosCartState,
  markSaleSubmissionUnknown,
  persistPosCartState,
  removeAccount,
  renameAccount,
  setSaleStatus,
  setPosCartContext,
  setCartItems,
  switchAccount,
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
    const sameKeyRetry = posCartReducer(unknown, allowUnknownSaleRetry());

    assert.equal(unknown.saleStatus, "UNKNOWN");
    assert.equal(editAttempt.saleStatus, "UNKNOWN");
    assert.deepEqual(cartEditAttempt.items, unknown.items);
    assert.equal(retryable.saleStatus, "DRAFT");
    assert.equal(retryable.saleAttempt, null);
    assert.equal(sameKeyRetry.saleStatus, "DRAFT");
    assert.equal(sameKeyRetry.saleAttempt?.attemptId, "attempt-a");
  });

  it("supports multi-account cart management (create, switch, rename, remove and persist)", () => {
    const storage = installStorage();
    const contextState = posCartReducer(initialPosCartState, setPosCartContext(context));

    // Initially 1 account
    assert.equal(contextState.accounts.length, 1);
    assert.equal(contextState.accounts[0].name, "Cuenta 1");
    const account1Id = contextState.accounts[0].id;

    // Add item to Cuenta 1
    const stateWithItem1 = posCartReducer(
      contextState,
      setCartItems([
        {
          productId: "product-1",
          name: "Item 1",
          sku: "SKU-1",
          quantity: 2,
          price: 50,
          stock: 10,
          taxId: null,
          priceWithoutTax: 50,
        },
      ])
    );
    assert.equal(stateWithItem1.items.length, 1);
    assert.equal(stateWithItem1.items[0].name, "Item 1");

    // Add a new account (Cuenta 2)
    const stateWithAccount2 = posCartReducer(stateWithItem1, addAccount({ name: "Mesa 5" }));
    assert.equal(stateWithAccount2.accounts.length, 2);
    assert.equal(stateWithAccount2.activeAccountId !== account1Id, true);
    assert.equal(stateWithAccount2.items.length, 0); // New account is empty

    const account2Id = stateWithAccount2.activeAccountId;

    // Add item to Mesa 5
    const stateWithItem2 = posCartReducer(
      stateWithAccount2,
      setCartItems([
        {
          productId: "product-2",
          name: "Item 2",
          sku: "SKU-2",
          quantity: 1,
          price: 120,
          stock: 5,
          taxId: null,
          priceWithoutTax: 120,
        },
      ])
    );
    assert.equal(stateWithItem2.items.length, 1);
    assert.equal(stateWithItem2.items[0].name, "Item 2");

    // Switch back to Cuenta 1
    const switchedBack = posCartReducer(stateWithItem2, switchAccount(account1Id));
    assert.equal(switchedBack.activeAccountId, account1Id);
    assert.equal(switchedBack.items.length, 1);
    assert.equal(switchedBack.items[0].name, "Item 1");

    // Rename Mesa 5 to Barra
    const renamed = posCartReducer(switchedBack, renameAccount({ id: account2Id, name: "Barra" }));
    const barraAccount = renamed.accounts.find((acc) => acc.id === account2Id);
    assert.equal(barraAccount?.name, "Barra");

    // Persist and rehydrate
    persistPosCartState(renamed);
    const snapshot = loadPersistedPosCartState(renamed.contextKey!);
    const rehydrated = posCartReducer(
      contextState,
      hydratePosCart({ contextKey: contextState.contextKey!, snapshot })
    );

    assert.equal(rehydrated.accounts.length, 2);
    assert.equal(rehydrated.activeAccountId, account1Id);
    assert.equal(rehydrated.items[0].name, "Item 1");

    // Remove account
    const removed = posCartReducer(rehydrated, removeAccount(account2Id));
    assert.equal(removed.accounts.length, 1);
    assert.equal(removed.accounts[0].id, account1Id);
  });
});
