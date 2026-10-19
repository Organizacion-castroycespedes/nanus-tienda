// @vitest-environment jsdom

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { Provider } from "react-redux";
import { ApiError } from "../../../lib/request";

const mocks = vi.hoisted(() => ({
  createSale: vi.fn(),
  reconcileSale: vi.fn(),
  getPosProducts: vi.fn(),
  getPosCustomers: vi.fn(),
  getPosTaxes: vi.fn(),
  previewPosLinePrice: vi.fn(),
  triggerPrintWorkflow: vi.fn(),
  openCashDrawer: vi.fn(),
  getCurrentCashSession: vi.fn(),
  listPaymentMethods: vi.fn(),
  listFinancialInstitutions: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/tenant-a/pos",
  useParams: () => ({ tenant: "tenant-a" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("../../../domains/pos/hooks/useRequirePosSession", () => ({
  useRequirePosSession: () => ({ hasSession: true }),
}));

vi.mock("../../../lib/permissions", () => ({
  hasMenuAccess: () => true,
}));

vi.mock("../../../hooks/use-confirm", () => ({
  isConfirmCancelledError: () => false,
  useConfirm: () => vi.fn(async () => undefined),
}));

vi.mock("../services/pos.service", () => ({
  createPosWeightCapture: vi.fn(),
  createSale: mocks.createSale,
  getPosCustomers: mocks.getPosCustomers,
  getPosProducts: mocks.getPosProducts,
  getPosTaxes: mocks.getPosTaxes,
  previewPosLinePrice: mocks.previewPosLinePrice,
  reconcileSale: mocks.reconcileSale,
}));

vi.mock("../../finance/services/finance.service", () => ({
  getCurrentCashSession: mocks.getCurrentCashSession,
  listPaymentMethods: mocks.listPaymentMethods,
  listFinancialInstitutions: mocks.listFinancialInstitutions,
}));

vi.mock("../hooks/useSalePrintWorkflow", () => ({
  useSalePrintWorkflow: () => ({
    pdfConfig: null,
    isBillingProcessing: false,
    closePdfModal: vi.fn(),
    triggerPrintWorkflow: mocks.triggerPrintWorkflow,
  }),
}));

vi.mock("../hooks/useDraggableFloatingControl", () => ({
  useDraggableFloatingControl: () => ({
    buttonRef: { current: null },
    buttonProps: {},
    buttonStyle: {},
    isDragging: false,
  }),
}));

vi.mock("../hooks/usePosFiltersStorage", () => ({
  usePosFiltersStorage: () => ({
    filters: {
      activeStockFilter: "available",
      selectedProductCategoryId: "",
      selectedProductSubcategoryId: "",
      productViewMode: "grid",
    },
    updateFilters: vi.fn(),
  }),
}));

vi.mock("./payment/PaymentDialog", () => ({
  PaymentDialog: ({ open, onConfirm, selectedCustomerId }: any) =>
    open ? (
      <button
        type="button"
        aria-label="Confirmar venta"
        onClick={() => onConfirm([{ id: "payment-a", paymentMethodId: "cash", amount: "100", reference: "" }], selectedCustomerId)}
        onDoubleClick={() => onConfirm([{ id: "payment-a", paymentMethodId: "cash", amount: "100", reference: "" }], selectedCustomerId)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onConfirm([{ id: "payment-a", paymentMethodId: "cash", amount: "100", reference: "" }], selectedCustomerId);
          }
        }}
      >
        Confirmar venta
      </button>
    ) : null,
}));

vi.mock("../../../domains/system/api", () => ({
  fetchSystemVersion: vi.fn().mockResolvedValue({ version: "test" }),
}));

vi.mock("../../../domains/peripherals/api", () => ({
  PeripheralAgentRequestError: class PeripheralAgentRequestError extends Error {},
  requestPeripheral: vi.fn(),
}));

vi.mock("../../../domains/peripherals/contracts", () => ({
  getPeripheralFeatureFlags: () => ({
    peripheralsEnabled: true,
    openDrawerEnabled: true,
    scannerEnabled: false,
    scaleEnabled: false,
  }),
  openCashDrawer: mocks.openCashDrawer,
  simulateScannerRead: vi.fn(),
  subscribeScannerEvents: () => () => undefined,
}));

vi.mock("../../../domains/peripherals/pos-sale-integration", () => ({
  buildSalePeripheralFeedbackMessage: () => null,
  hasCashPeripheralPayment: () => true,
  runSalePeripheralOperations: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../domains/peripherals/terminal-config", () => ({
  resolveCurrentPosTerminalConfig: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../domains/parameters/api", () => ({
  PARAMETER_MODES: { ON_DEMAND: "ON_DEMAND", AUTOMATIC: "AUTOMATIC" },
}));

vi.mock("../../inventory/services/product-classification.service", () => ({
  listProductCategories: vi.fn().mockResolvedValue([]),
  listProductSubcategories: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../reporteria/components/PdfPreviewModal", () => ({
  PdfPreviewModal: () => null,
}));

vi.mock("./accounts/PosAccountTabs", () => ({
  PosAccountTabs: ({ accounts, activeAccountId, onSelectAccount }: any) => (
    <div>
      {accounts.map((account: any) => (
        <button
          key={account.id}
          type="button"
          aria-label={`Cuenta ${account.name}`}
          data-active={account.id === activeAccountId}
          onClick={() => onSelectAccount(account.id)}
        >
          {account.name}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("./cart/CartSaleModal", () => ({
  CartSaleModal: ({ onCharge, canCharge }: any) => (
    <button type="button" aria-label="Abrir cobro de prueba" data-can-charge={String(canCharge)} onClick={onCharge}>
      Cobrar
    </button>
  ),
}));

vi.mock("./catalog/PosProductCard", () => ({
  PosProductCard: () => null,
}));

vi.mock("./hardware/PosDiagnosticsPanel", () => ({
  PosDiagnosticsPanel: () => null,
}));

vi.mock("./QuickFiscalCustomerModal", () => ({
  QuickFiscalCustomerModal: () => null,
}));

vi.mock("../../inventory/components/InventoryImagePreview", () => ({
  InventoryImagePreview: () => null,
}));

import { PosScreen } from "./PosScreen";
import { store } from "../../../store";
import { clearAuth, setAuthPermissions, setAuthStatus, setBootstrapped, setUser } from "../../../store/authSlice";
import { clearContext, setContext, setSession } from "../../../store/pos";
import {
  addAccount,
  beginSaleSubmission,
  clearPosCartState,
  markSaleSubmissionUnknown,
  setCartItems,
  setPayments,
  setPosCartContext,
  setSelectedCustomerId,
} from "../../../store/posCart";
import { setCartSheetOpen } from "../../../store/posUi";

const product = {
  id: "product-a",
  name: "Producto A",
  sku: "A-1",
  price: 100,
  stock: 10,
  isActive: true,
  taxId: null,
  priceWithoutTax: 100,
} as any;

const customer = {
  id: "customer-final",
  name: "Consumidor Final",
  isFinalConsumer: true,
  isActive: true,
} as any;

const saleResponse = {
  id: "sale-a",
  tenantId: "tenant-a",
  customerId: customer.id,
  orderId: null,
  type: "CASH",
  status: "CONFIRMED",
  total: 100,
  balance: 0,
  paymentStatus: "PAID",
  totalPaid: 100,
  balanceDue: 0,
  createdAt: "2026-10-17T12:00:00.000Z",
};

const seedStore = () => {
  store.dispatch(clearAuth());
  store.dispatch(clearContext());
  store.dispatch(clearPosCartState());
  store.dispatch(setCartSheetOpen(false));
  store.dispatch(setUser({
    id: "user-a",
    tenantId: "tenant-a",
    tenantSlug: "tenant-a",
    branchId: "branch-a",
    role: "ADMIN",
    name: "Cajero",
    email: "cashier@example.test",
  } as any));
  store.dispatch(setAuthStatus("authenticated"));
  store.dispatch(setAuthPermissions([]));
  store.dispatch(setBootstrapped(true));
  store.dispatch(setContext({
    tenantId: "tenant-a",
    branchId: "branch-a",
    branchName: "Sucursal A",
    terminalId: "terminal-a",
    terminalName: "Terminal A",
    cashRegisterId: "cash-a",
  }));
  store.dispatch(setSession({
    posSessionId: "pos-session-a",
    branchId: "branch-a",
    terminalId: "terminal-a",
    cashRegisterId: "cash-a",
  }));
  store.dispatch(setPosCartContext({
    tenantId: "tenant-a",
    branchId: "branch-a",
    terminalId: "terminal-a",
    userId: "user-a",
    posSessionId: "pos-session-a",
  }));
  store.dispatch(setCartItems([{
    ...product,
    productId: product.id,
    quantity: 1,
    pricingStatus: "READY",
    pricingRequestKey: "branch-a:customer-final:product-a:1",
    finalUnitPrice: 100,
    lineSubtotal: 100,
    lineTotal: 100,
    taxes: [],
  }]));
  store.dispatch(setSelectedCustomerId(customer.id));
  store.dispatch(setPayments([{
    id: "payment-a",
    paymentMethodId: "cash",
    amount: "100",
    reference: "",
  }]));
};

const renderScreen = () =>
  render(
    <Provider store={store}>
      <PosScreen />
    </Provider>,
  );

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mocks.createSale.mockReset();
  mocks.createSale.mockResolvedValue(saleResponse);
  mocks.reconcileSale.mockReset();
  mocks.getPosProducts.mockReset();
  mocks.getPosProducts.mockResolvedValue([product]);
  mocks.getPosCustomers.mockReset();
  mocks.getPosCustomers.mockResolvedValue([customer]);
  mocks.getPosTaxes.mockReset();
  mocks.getPosTaxes.mockResolvedValue([]);
  mocks.previewPosLinePrice.mockReset();
  mocks.previewPosLinePrice.mockImplementation(async (request: any) => ({
    productId: request.productId,
    quantity: request.quantity,
    baseUnitPrice: 100,
    finalUnitPrice: 100,
    discountAmount: 0,
    discountPercent: 0,
    appliedPromotionId: null,
    appliedPromotionName: null,
    taxId: null,
    taxRate: 0,
    taxBase: request.quantity * 100,
    taxAmount: 0,
    taxes: [],
    lineSubtotal: request.quantity * 100,
    lineTotal: request.quantity * 100,
    explanation: "test",
  }));
  mocks.triggerPrintWorkflow.mockReset();
  mocks.triggerPrintWorkflow.mockResolvedValue(undefined);
  mocks.openCashDrawer.mockReset();
  mocks.openCashDrawer.mockResolvedValue({ success: true });
  mocks.getCurrentCashSession.mockResolvedValue({ id: "cash-session-a", cashRegisterNombre: "Caja A" });
  mocks.listPaymentMethods.mockResolvedValue([{ id: "cash", nombre: "Efectivo", codigo: "CASH", tipo: "CASH", active: true }]);
  mocks.listFinancialInstitutions.mockResolvedValue([]);
  seedStore();
});

afterEach(() => {
  cleanup();
});

describe("PosScreen sale recovery integration", () => {
  it("accepts double click and Enter before rerender with one POST and one original key", async () => {
    renderScreen();
    const charge = await screen.findByRole("button", { name: "Abrir cobro de prueba" });
    await waitFor(() => expect(charge.getAttribute("data-can-charge")).toBe("true"));
    fireEvent.click(charge);
    const confirm = await screen.findByRole("button", { name: "Confirmar venta" });

    fireEvent.doubleClick(confirm);
    fireEvent.keyDown(confirm, { key: "Enter" });

    await waitFor(() => expect(mocks.createSale).toHaveBeenCalledTimes(1));
    expect(mocks.createSale.mock.calls[0][1]).toEqual(
      expect.objectContaining({ "Idempotency-Key": expect.any(String) }),
    );
    await waitFor(() => expect(store.getState().posCart.saleStatus).toBe("CONFIRMED"));
  });

  it("keeps the confirmed account independent and allows the next account immediately", async () => {
    renderScreen();
    const charge1 = await screen.findByRole("button", { name: "Abrir cobro de prueba" });
    await waitFor(() => expect(charge1.getAttribute("data-can-charge")).toBe("true"));
    fireEvent.click(charge1);
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar venta" }));
    await waitFor(() => expect(mocks.createSale).toHaveBeenCalledTimes(1));

    store.dispatch(addAccount({ name: "Cuenta 2" }));
    store.dispatch(setCartItems([{
      ...product,
      productId: "product-b",
      name: "Producto B",
      quantity: 1,
      pricingStatus: "READY",
      pricingRequestKey: "branch-a:customer-final:product-b:1",
      finalUnitPrice: 100,
      lineSubtotal: 100,
      lineTotal: 100,
      taxes: [],
    }]));
    store.dispatch(setSelectedCustomerId(customer.id));

    const charge2 = await screen.findByRole("button", { name: "Abrir cobro de prueba" });
    await waitFor(() => expect(charge2.getAttribute("data-can-charge")).toBe("true"));
    fireEvent.click(charge2);
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar venta" }));
    await waitFor(() => expect(mocks.createSale).toHaveBeenCalledTimes(2));

    const keys = mocks.createSale.mock.calls.map((call) => call[1]["Idempotency-Key"]);
    expect(new Set(keys).size).toBe(2);
    expect(store.getState().posCart.accounts.every((account) => account.saleStatus !== "UNKNOWN")).toBe(true);
  });

  it("keeps CONFIRMED after independent post-create failures without another POST", async () => {
    mocks.openCashDrawer.mockRejectedValue(new Error("drawer unavailable"));
    mocks.triggerPrintWorkflow.mockRejectedValue(new Error("print unavailable"));
    mocks.getPosProducts
      .mockResolvedValueOnce([product])
      .mockRejectedValueOnce(new Error("catalog unavailable"));

    renderScreen();
    const charge = await screen.findByRole("button", { name: "Abrir cobro de prueba" });
    await waitFor(() => expect(charge.getAttribute("data-can-charge")).toBe("true"));
    fireEvent.click(charge);
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar venta" }));

    await waitFor(() => expect(mocks.createSale).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(store.getState().posCart.saleStatus).toBe("CONFIRMED"));
    expect(mocks.createSale).toHaveBeenCalledTimes(1);
  });

  it("returns a definitive stock rejection to an editable draft without retrying", async () => {
    mocks.createSale.mockRejectedValueOnce(
      new ApiError("Stock unavailable", 409, "INSUFFICIENT_STOCK", {
        code: "INSUFFICIENT_STOCK",
        productId: product.id,
        requestedQuantity: 6,
        availableQuantity: 0,
        aggregateAvailableQuantity: 0,
        eligibleLotQuantity: null,
      }),
    );

    renderScreen();
    const charge = await screen.findByRole("button", { name: "Abrir cobro de prueba" });
    await waitFor(() => expect(charge.getAttribute("data-can-charge")).toBe("true"));
    fireEvent.click(charge);
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar venta" }));

    await waitFor(() => expect(mocks.createSale).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(store.getState().posCart.saleStatus).toBe("DRAFT"));

    const state = store.getState().posCart;
    expect(state.saleAttempt).toBeNull();
    expect(state.items[0]?.quantity).toBe(1);
    expect(state.items[0]?.stock).toBe(0);
    expect(mocks.createSale).toHaveBeenCalledTimes(1);
  });

  it("applies a delayed POST result to Cuenta 1 while Cuenta 2 and Cuenta 3 remain intact", async () => {
    let resolveCreateSale!: (value: typeof saleResponse) => void;
    mocks.createSale.mockImplementation(
      () => new Promise((resolve) => {
        resolveCreateSale = resolve;
      }),
    );

    renderScreen();
    const account1Id = store.getState().posCart.activeAccountId;
    const charge = await screen.findByRole("button", { name: "Abrir cobro de prueba" });
    await waitFor(() => expect(charge.getAttribute("data-can-charge")).toBe("true"));
    fireEvent.click(charge);
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar venta" }));
    await waitFor(() => expect(mocks.createSale).toHaveBeenCalledTimes(1));

    store.dispatch(addAccount({ name: "Cuenta 2" }));
    store.dispatch(setCartItems([{
      ...product,
      productId: "product-six",
      name: "Seis artículos",
      quantity: 6,
      pricingStatus: "READY",
      pricingRequestKey: "branch-a:customer-final:product-six:6",
      finalUnitPrice: 155500,
      lineSubtotal: 933000,
      lineTotal: 933000,
      taxes: [],
    }]));
    const account2Id = store.getState().posCart.activeAccountId;
    store.dispatch(addAccount({ name: "Cuenta 3" }));
    const account3Id = store.getState().posCart.activeAccountId;

    resolveCreateSale(saleResponse);

    await waitFor(() => {
      expect(store.getState().posCart.accounts.find((account) => account.id === account1Id)?.saleStatus)
        .toBe("CONFIRMED");
    });
    expect(store.getState().posCart.activeAccountId).toBe(account3Id);
    expect(store.getState().posCart.accounts.find((account) => account.id === account1Id)?.items).toHaveLength(0);
    expect(store.getState().posCart.accounts.find((account) => account.id === account2Id)?.items[0]?.quantity).toBe(6);
    expect(store.getState().posCart.accounts.find((account) => account.id === account3Id)?.items).toHaveLength(0);
    expect(mocks.createSale).toHaveBeenCalledTimes(1);
  });

  it("applies delayed reconciliation to its origin account only", async () => {
    let resolveReconciliation!: (value: typeof saleResponse) => void;
    mocks.reconcileSale.mockImplementation(
      () => new Promise((resolve) => {
        resolveReconciliation = resolve;
      }),
    );

    const attemptId = "attempt-account-1";
    store.dispatch(beginSaleSubmission({ attemptId, startedAt: "2026-10-17T12:00:00.000Z" }));
    store.dispatch(markSaleSubmissionUnknown());
    renderScreen();

    const account1Id = store.getState().posCart.activeAccountId;
    fireEvent.click(await screen.findByRole("button", { name: "Verificar venta" }));
    await waitFor(() => expect(mocks.reconcileSale).toHaveBeenCalledWith(attemptId));

    store.dispatch(addAccount({ name: "Cuenta 2" }));
    store.dispatch(setCartItems([{
      ...product,
      productId: "product-b",
      name: "Cuenta 2 preservada",
      quantity: 6,
      pricingStatus: "READY",
      pricingRequestKey: "branch-a:customer-final:product-b:6",
      finalUnitPrice: 155500,
      lineSubtotal: 933000,
      lineTotal: 933000,
      taxes: [],
    }]));
    const account2Id = store.getState().posCart.activeAccountId;

    resolveReconciliation(saleResponse);

    await waitFor(() => {
      expect(store.getState().posCart.accounts.find((account) => account.id === account1Id)?.saleStatus)
        .toBe("CONFIRMED");
    });
    expect(store.getState().posCart.activeAccountId).toBe(account2Id);
    expect(store.getState().posCart.accounts.find((account) => account.id === account1Id)?.items).toHaveLength(0);
    expect(store.getState().posCart.accounts.find((account) => account.id === account2Id)?.items[0]?.quantity).toBe(6);
    expect(mocks.createSale).not.toHaveBeenCalled();
  });
});
