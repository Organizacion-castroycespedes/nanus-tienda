import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import posCartReducer, {
  addAccount,
  allowSaleSubmissionRetry,
  allowUnknownSaleRetry,
  applyDefinitiveStockRejection,
  beginSaleSubmission,
  confirmSaleForAccount,
  buildPosCartStorageKey,
  hydratePosCart,
  initialPosCartState,
  loadPersistedPosCartState,
  markSaleSubmissionUnknown,
  markUnknownForAccount,
  persistPosCartState,
  removeAccount,
  renameAccount,
  resetPosCartSale,
  setSaleStatus,
  setPosCartContext,
  setCartItems,
  hasProtectedSaleAttempt,
  switchAccount,
  POS_SALE_STATUSES,
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
    assert.equal(rehydrated.saleStatus, POS_SALE_STATUSES.UNKNOWN);
    assert.equal(rehydrated.saleAttempt?.attemptId, "attempt-a");
    assert.equal(rehydrated.items.length, 1);
  });

  it("keeps services sellable and defaults legacy cart items to physical", () => {
    const contextState = posCartReducer(initialPosCartState, setPosCartContext(context));
    const rehydrated = posCartReducer(
      contextState,
      hydratePosCart({
        contextKey: contextState.contextKey!,
        snapshot: {
          items: [
            {
              productId: "physical-a",
              name: "Producto físico",
              sku: "P-1",
              quantity: 1,
              price: 100,
              stock: 3,
              taxId: null,
              priceWithoutTax: 100,
            },
            {
              productId: "service-a",
              name: "Servicio",
              sku: "S-1",
              quantity: 4,
              price: 25,
              stock: 0,
              isInventoryable: false,
              taxId: null,
              priceWithoutTax: 25,
            },
          ],
        },
      }),
    );

    assert.equal(rehydrated.items[0]?.isInventoryable, true);
    assert.equal(rehydrated.items[1]?.isInventoryable, false);
    assert.equal(rehydrated.items[1]?.quantity, 4);
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
    const editAttempt = posCartReducer(unknown, setSaleStatus(POS_SALE_STATUSES.DRAFT));
    const cartEditAttempt = posCartReducer(unknown, setCartItems([]));
    const retryable = posCartReducer(unknown, allowSaleSubmissionRetry());
    const sameKeyRetry = posCartReducer(unknown, allowUnknownSaleRetry());

    assert.equal(unknown.saleStatus, POS_SALE_STATUSES.UNKNOWN);
    assert.equal(editAttempt.saleStatus, POS_SALE_STATUSES.UNKNOWN);
    assert.deepEqual(cartEditAttempt.items, unknown.items);
    assert.equal(retryable.saleStatus, POS_SALE_STATUSES.UNKNOWN);
    assert.equal(retryable.saleAttempt?.attemptId, "attempt-a");
    assert.equal(sameKeyRetry.saleStatus, POS_SALE_STATUSES.DRAFT);
    assert.equal(sameKeyRetry.saleAttempt?.attemptId, "attempt-a");
  });

  it("does not remove an account while its sale attempt is UNKNOWN", () => {
    const scoped = posCartReducer(initialPosCartState, setPosCartContext(context));
    const withItem = posCartReducer(scoped, setCartItems([{
      productId: "product-a",
      name: "Producto A",
      sku: "A-1",
      quantity: 1,
      price: 100,
      stock: 5,
      taxId: null,
      priceWithoutTax: 100,
    }]));
    const unknown = posCartReducer(
      posCartReducer(withItem, beginSaleSubmission({ attemptId: "attempt-a", startedAt: "2026-09-16T12:00:00.000Z" })),
      markSaleSubmissionUnknown()
    );
    const protectedState = posCartReducer(unknown, removeAccount(unknown.activeAccountId));

    assert.equal(protectedState.accounts.length, 1);
    assert.equal(protectedState.saleStatus, POS_SALE_STATUSES.UNKNOWN);
    assert.equal(protectedState.saleAttempt?.attemptId, "attempt-a");
  });

  it("keeps the attempt while SUBMITTING receives stale draft or reset actions", () => {
    const submitting = posCartReducer(
      {
        ...initialPosCartState,
        contextKey: "pos-cart:test",
        items: [{
          productId: "product-a",
          name: "Producto A",
          sku: "A-1",
          quantity: 1,
          price: 100,
          stock: 5,
          taxId: null,
          priceWithoutTax: 100,
        }],
      },
      beginSaleSubmission({ attemptId: "attempt-a", startedAt: "2026-09-16T12:00:00.000Z" })
    );
    const staleDraft = posCartReducer(submitting, setSaleStatus(POS_SALE_STATUSES.DRAFT));
    const staleRetry = posCartReducer(submitting, allowSaleSubmissionRetry());
    const staleReset = posCartReducer(submitting, resetPosCartSale());

    for (const state of [staleDraft, staleRetry, staleReset]) {
      assert.equal(state.saleStatus, POS_SALE_STATUSES.SUBMITTING);
      assert.equal(state.saleAttempt?.attemptId, "attempt-a");
      assert.equal(state.items.length, 1);
    }
  });

  it("protects voluntary logout when any account is submitting or unknown", () => {
    assert.equal(hasProtectedSaleAttempt(initialPosCartState), false);

    const submitting = posCartReducer(
      initialPosCartState,
      beginSaleSubmission({ attemptId: "attempt-a", startedAt: "2026-09-16T12:00:00.000Z" })
    );
    assert.equal(hasProtectedSaleAttempt(submitting), true);

    const unknown = posCartReducer(submitting, markSaleSubmissionUnknown());
    assert.equal(hasProtectedSaleAttempt(unknown), true);

    const withSecondAccount = posCartReducer(unknown, addAccount({ name: "Cuenta 2" }));
    assert.equal(hasProtectedSaleAttempt(withSecondAccount), true);
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

  it("applies a late confirmation only to the origin account", () => {
    const scoped = posCartReducer(initialPosCartState, setPosCartContext(context));
    const account1Id = scoped.activeAccountId;
    const withAccount1Sale = posCartReducer(
      posCartReducer(scoped, setCartItems([{
        productId: "product-1",
        name: "Cuenta 1 item",
        sku: "C1",
        quantity: 1,
        price: 155500,
        stock: 10,
        taxId: null,
        priceWithoutTax: 155500,
      }])),
      beginSaleSubmission({ attemptId: "attempt-account-1", startedAt: "2026-10-17T12:00:00.000Z" })
    );
    const withAccount2 = posCartReducer(withAccount1Sale, addAccount({ name: "Cuenta 2" }));
    const account2Id = withAccount2.activeAccountId;
    const withAccount2Items = posCartReducer(withAccount2, setCartItems([{
      productId: "product-2",
      name: "Seis artículos",
      sku: "C2",
      quantity: 6,
      price: 155500,
      stock: 10,
      taxId: null,
      priceWithoutTax: 155500,
    }]));
    const withAccount3 = posCartReducer(withAccount2Items, addAccount({ name: "Cuenta 3" }));
    const account3Id = withAccount3.activeAccountId;

    const confirmedOrigin = posCartReducer(
      withAccount3,
      confirmSaleForAccount({
        accountId: account1Id,
        attemptId: "attempt-account-1",
        contextKey: withAccount3.contextKey!,
        selectedCustomerId: null,
        payments: [],
      })
    );

    const account1 = confirmedOrigin.accounts.find((account) => account.id === account1Id);
    const account2 = confirmedOrigin.accounts.find((account) => account.id === account2Id);
    const account3 = confirmedOrigin.accounts.find((account) => account.id === account3Id);
    assert.equal(confirmedOrigin.activeAccountId, account3Id);
    assert.equal(account1?.saleStatus, POS_SALE_STATUSES.CONFIRMED);
    assert.equal(account1?.saleAttempt, null);
    assert.equal(account1?.items.length, 0);
    assert.equal(account2?.items[0]?.quantity, 6);
    assert.equal(account3?.items.length, 0);
    assert.equal(confirmedOrigin.items.length, 0);
  });

  it("rejects late callbacks when the attempt or context is stale", () => {
    const scoped = posCartReducer(initialPosCartState, setPosCartContext(context));
    const withAttempt = posCartReducer(
      posCartReducer(scoped, setCartItems([{
        productId: "product-a",
        name: "Producto A",
        sku: "A-1",
        quantity: 1,
        price: 100,
        stock: 5,
        taxId: null,
        priceWithoutTax: 100,
      }])),
      beginSaleSubmission({ attemptId: "attempt-a", startedAt: "2026-10-17T12:00:00.000Z" })
    );
    const staleAttempt = posCartReducer(
      withAttempt,
      beginSaleSubmission({ attemptId: "attempt-b", startedAt: "2026-10-17T12:01:00.000Z" })
    );
    const staleResult = posCartReducer(
      staleAttempt,
      markUnknownForAccount({
        accountId: staleAttempt.activeAccountId,
        attemptId: "attempt-a",
        contextKey: staleAttempt.contextKey!,
      })
    );
    const staleContext = posCartReducer(
      staleAttempt,
      markUnknownForAccount({
        accountId: staleAttempt.activeAccountId,
        attemptId: "attempt-b",
        contextKey: "pos-cart:other-context",
      })
    );

    assert.equal(staleResult.saleStatus, POS_SALE_STATUSES.SUBMITTING);
    assert.equal(staleResult.saleAttempt?.attemptId, "attempt-b");
    assert.equal(staleContext.saleStatus, POS_SALE_STATUSES.SUBMITTING);
    assert.equal(staleContext.saleAttempt?.attemptId, "attempt-b");
  });

  it("returns only the rejected account to draft and updates its stock", () => {
    const scoped = posCartReducer(initialPosCartState, setPosCartContext(context));
    const withItems = posCartReducer(scoped, setCartItems([{
      productId: "product-a",
      name: "Producto A",
      sku: "A-1",
      quantity: 6,
      price: 100,
      stock: 10,
      taxId: null,
      priceWithoutTax: 100,
    }]));
    const submitting = posCartReducer(
      withItems,
      beginSaleSubmission({ attemptId: "attempt-stock", startedAt: "2026-10-19T12:00:00.000Z" }),
    );
    const recovered = posCartReducer(
      submitting,
      applyDefinitiveStockRejection({
        accountId: submitting.activeAccountId,
        attemptId: "attempt-stock",
        contextKey: submitting.contextKey!,
        productId: "product-a",
        availableQuantity: 2,
      }),
    );

    assert.equal(recovered.saleStatus, POS_SALE_STATUSES.DRAFT);
    assert.equal(recovered.saleAttempt, null);
    assert.equal(recovered.items[0].quantity, 6);
    assert.equal(recovered.items[0].stock, 2);
  });
});

describe("weighted sale capture storage", () => {
  it("does not persist capture nonce in localStorage", () => {
    const storage = installStorage();
    const context = { tenantId: "tenant-w", branchId: "branch-w", terminalId: "terminal-w", userId: "user-w", posSessionId: "session-w" };
    const scoped = posCartReducer(initialPosCartState, setPosCartContext(context));
    const withWeight = posCartReducer(scoped, setCartItems([{
      productId: "product-w", saleMode: "WEIGHT", weightCapture: {
        captureId: "capture-w", nonce: "never-persist-this-nonce", expiresAt: "2026-10-08T00:01:00.000Z",
      }, name: "Weight", sku: "W-1", quantity: 0.245, price: 100, stock: 4, taxId: null, priceWithoutTax: 100,
    }]));
    persistPosCartState(withWeight);
    const serialized = storage.get(withWeight.contextKey!) ?? "";
    assert.doesNotMatch(serialized, /never-persist-this-nonce/);
    assert.doesNotMatch(serialized, /capture-w/);
    assert.match(serialized, /"saleMode":"WEIGHT"/);
  });
});
