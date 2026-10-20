// @vitest-environment jsdom

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, cleanup, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { ApiError } from "../../../lib/request";

const mocks = vi.hoisted(() => ({
  createSale: vi.fn(),
  reconcileSale: vi.fn(),
  getPosProducts: vi.fn(),
  getPosCustomers: vi.fn(),
  getPosTaxes: vi.fn(),
  previewPosLinePrice: vi.fn(),
  requestElectronicBilling: vi.fn(),
  resolveTenantSettings: vi.fn(),
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

vi.mock("../../reporteria/services/electronic-billing.service", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../reporteria/services/electronic-billing.service")>(),
  requestElectronicBilling: mocks.requestElectronicBilling,
}));

vi.mock("../../reporteria/services/reporting.service", () => ({
  getElectronicInvoice: vi.fn(),
  getElectronicInvoicePrintData: vi.fn(),
  getPosSaleTicket: vi.fn(),
  getPosSaleTicketPrintData: vi.fn(),
}));

vi.mock("../../reporteria/direct-print", () => ({ printReporteriaSaleTicket: vi.fn() }));
vi.mock("../../reporteria/electronic-invoice-direct-print", () => ({ printElectronicInvoiceTicket: vi.fn() }));

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

vi.mock("../../../domains/parameters/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../domains/parameters/api")>(),
  resolveTenantSettings: mocks.resolveTenantSettings,
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
import { setBranding } from "../../../store/brandingSlice";
import type { ElectronicBillingRequestResult } from "../../reporteria/services/electronic-billing.service";

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

const openPayment = async () => {
  const charge = await screen.findByRole("button", { name: "Abrir cobro de prueba" });
  await waitFor(() => expect(charge.getAttribute("data-can-charge")).toBe("true"));
  fireEvent.click(charge);
  const confirm = await screen.findByRole("button", { name: "Confirmar venta" });
  await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
  return confirm;
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const stockRejection = (code = "INSUFFICIENT_STOCK") =>
  new ApiError("La disponibilidad actual no alcanza para esta venta.", 409, code, {
    code,
    productId: product.id,
    requestedQuantity: 1,
    availableQuantity: 0,
    aggregateAvailableQuantity: code === "INSUFFICIENT_FEFO_STOCK" ? 10 : 0,
    eligibleLotQuantity: code === "INSUFFICIENT_FEFO_STOCK" ? 0 : null,
  });

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("Unexpected network request in isolated test"))));
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
  mocks.requestElectronicBilling.mockReset();
  mocks.requestElectronicBilling.mockResolvedValue({ result: "REQUESTED" });
  mocks.resolveTenantSettings.mockReset();
  mocks.resolveTenantSettings.mockResolvedValue({ values: {} });
  mocks.openCashDrawer.mockReset();
  mocks.openCashDrawer.mockResolvedValue({ success: true });
  mocks.getCurrentCashSession.mockResolvedValue({ id: "cash-session-a", cashRegisterNombre: "Caja A" });
  mocks.listPaymentMethods.mockResolvedValue([{ id: "cash", nombre: "Efectivo", codigo: "CASH", tipo: "CASH", active: true }]);
  mocks.listFinancialInstitutions.mockResolvedValue([]);
  seedStore();
  store.dispatch(setBranding({ electronicBillingEnabled: true, electronicBillingMode: "AUTOMATIC" }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (vi.isMockFunction(console.error)) vi.mocked(console.error).mockRestore();
});

describe("PosScreen sale recovery integration", () => {
  it.each([
    { electronicBillingEnabled: true, electronicBillingMode: "AUTOMATIC" as const },
    { electronicBillingEnabled: false, electronicBillingMode: "AUTOMATIC" as const },
    { electronicBillingEnabled: true, electronicBillingMode: "ON_DEMAND" as const },
  ])("keeps a pending POST commercial with billing $electronicBillingEnabled/$electronicBillingMode", async (branding) => {
    store.dispatch(setBranding(branding));
    const pending = deferred<typeof saleResponse>();
    mocks.createSale.mockReturnValueOnce(pending.promise);
    renderScreen();
    fireEvent.click(await openPayment());
    await waitFor(() => expect(store.getState().posCart.saleStatus).toBe("SUBMITTING"));
    expect(screen.queryByText("Facturación electrónica")).toBeNull();
    expect(screen.getByRole("button", { name: "Registrando venta…" }).getAttribute("aria-busy")).toBe("true");
    expect(mocks.requestElectronicBilling).not.toHaveBeenCalled();
    expect(mocks.openCashDrawer).not.toHaveBeenCalled();
    await act(async () => pending.resolve(saleResponse));
    await waitFor(() => expect(store.getState().posCart.saleStatus).toBe("CONFIRMED"));
    expect(mocks.createSale).toHaveBeenCalledTimes(1);
  });

  it("shows local validation without a sale POST or fiscal modal", async () => {
    renderScreen();
    const confirm = await openPayment();
    // Stock can change after the payment dialog opened. Exercise submitSale validation.
    act(() => store.dispatch(setCartItems(store.getState().posCart.items.map((item) => ({ ...item, stock: 0 })))));
    fireEvent.click(confirm);
    expect((await screen.findByRole("alert")).textContent).toContain("Hay items que superan el stock disponible.");
    expect(store.getState().posCart.saleStatus).toBe("DRAFT");
    expect(store.getState().posCart.saleAttempt).toBeNull();
    expect(mocks.createSale).not.toHaveBeenCalled();
    expect(mocks.requestElectronicBilling).not.toHaveBeenCalled();
    expect(screen.queryByText("Facturación electrónica")).toBeNull();
  });

  it.each([
    ["timeout", new DOMException("Timed out", "TimeoutError")],
    ["network", new TypeError("Failed to fetch")],
    ["server", new ApiError("Internal server error", 500)],
    ["400", new ApiError("Invalid sale", 400)],
    ["403", new ApiError("Forbidden", 403)],
    ["404", new ApiError("Not found", 404)],
    ["generic 409", new ApiError("Conflict", 409)],
    ["idempotency", new ApiError("Idempotency-Key was already used with a different sale request", 409)],
    ["incomplete stock", new ApiError("Stock", 409, "INSUFFICIENT_STOCK", { code: "INSUFFICIENT_STOCK", productId: "product-a", requestedQuantity: 1, availableQuantity: 0 })],
    ["stock at wrong status", new ApiError("Stock", 400, "INSUFFICIENT_STOCK", stockRejection().details)],
    ["unknown domain", new ApiError("Conflict", 409, "OTHER", { ...(stockRejection().details as object), code: "OTHER" })],
  ])("preserves UNKNOWN and the original key for %s", async (_name, error) => {
    mocks.createSale.mockRejectedValueOnce(error);
    renderScreen();
    fireEvent.click(await openPayment());
    await waitFor(() => expect(store.getState().posCart.saleStatus).toBe("UNKNOWN"));
    const key = mocks.createSale.mock.calls[0][1]["Idempotency-Key"];
    expect(store.getState().posCart.saleAttempt?.attemptId).toBe(key);
    expect(store.getState().posCart.items[0]?.quantity).toBe(1);
    expect(screen.getByText("Venta pendiente de verificación")).toBeTruthy();
    expect(screen.queryByText("Facturación electrónica")).toBeNull();
    expect(mocks.requestElectronicBilling).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar venta" }));
    expect(mocks.createSale).toHaveBeenCalledTimes(1);
    expect(store.getState().posCart.saleAttempt?.attemptId).toBe(key);
  });

  it.each([200, 404, 409, 500])("reconciles %s without replacing the unknown key", async (status) => {
    const attemptId = "attempt-reconcile";
    store.dispatch(beginSaleSubmission({ attemptId, startedAt: new Date().toISOString() }));
    store.dispatch(markSaleSubmissionUnknown());
    if (status === 200) mocks.reconcileSale.mockResolvedValueOnce(saleResponse);
    else mocks.reconcileSale.mockRejectedValueOnce(new ApiError("Recovery", status));
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: "Verificar venta" }));
    await waitFor(() => expect(mocks.reconcileSale).toHaveBeenCalledWith(attemptId));
    if (status === 200) {
      await screen.findByText("Venta sale-a encontrada y confirmada.");
      expect(store.getState().posCart.saleStatus).toBe("CONFIRMED");
      expect(store.getState().posCart.items).toHaveLength(0);
      expect(store.getState().posCart.saleAttempt).toBeNull();
    } else {
      await screen.findByText(status === 404
        ? "No se encontro una venta con esta clave. Puedes reintentar con la misma clave."
        : status === 409
          ? "La venta sigue pendiente en el servidor. Espera y verifica de nuevo."
          : "No se pudo verificar la venta. Conservamos el intento para evitar duplicados.");
      expect(store.getState().posCart.saleStatus).toBe("UNKNOWN");
      expect(store.getState().posCart.saleAttempt?.attemptId).toBe(attemptId);
      expect(Boolean(screen.queryByRole("button", { name: "Reintentar con la misma clave" }))).toBe(status === 404);
    }
    expect(mocks.createSale).not.toHaveBeenCalled();
    expect(mocks.requestElectronicBilling).not.toHaveBeenCalled();
    expect(screen.queryByText("Facturación electrónica")).toBeNull();
  });

  it("retries only explicitly after reconciliation 404 with identical payload and key", async () => {
    mocks.createSale.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    mocks.reconcileSale.mockRejectedValueOnce(new ApiError("Not found", 404));
    renderScreen();
    fireEvent.click(await openPayment());
    await waitFor(() => expect(store.getState().posCart.saleStatus).toBe("UNKNOWN"));
    const originalCall = mocks.createSale.mock.calls[0];
    fireEvent.click(screen.getByRole("button", { name: "Verificar venta" }));
    const retry = await screen.findByRole("button", { name: "Reintentar con la misma clave" });
    await waitFor(() => expect((retry as HTMLButtonElement).disabled).toBe(false));
    expect(mocks.createSale).toHaveBeenCalledTimes(1);
    fireEvent.click(retry);
    await waitFor(() => expect(store.getState().posCart.saleStatus).toBe("CONFIRMED"));
    expect(mocks.createSale).toHaveBeenCalledTimes(2);
    expect(mocks.createSale.mock.calls[1]).toEqual(originalCall);
  });

  it.each(["account", "context", "attempt"])("ignores cross-origin feedback after %s changes", async (change) => {
    const pending = deferred<typeof saleResponse>();
    mocks.createSale.mockReturnValueOnce(pending.promise);
    renderScreen();
    fireEvent.click(await openPayment());
    await waitFor(() => expect(store.getState().posCart.saleStatus).toBe("SUBMITTING"));
    const originId = store.getState().posCart.activeAccountId;
    act(() => {
      if (change === "account") store.dispatch(addAccount({ name: "Cuenta 2" }));
      if (change === "context") store.dispatch(setPosCartContext({
        tenantId: "tenant-a", branchId: "branch-a", terminalId: "terminal-b",
        userId: "user-a", posSessionId: "pos-session-b",
      }));
      if (change === "attempt") store.dispatch(beginSaleSubmission({
        attemptId: "replacement-attempt", startedAt: new Date().toISOString(),
      }));
    });
    const activeBefore = structuredClone(store.getState().posCart.accounts.find((a) => a.id === store.getState().posCart.activeAccountId));
    await act(async () => pending.reject(stockRejection()));
    expect(store.getState().posCart.accounts.find((a) => a.id === store.getState().posCart.activeAccountId)).toEqual(activeBefore);
    if (change === "account") {
      expect(store.getState().posCart.accounts.find((a) => a.id === originId)?.saleStatus).toBe("DRAFT");
      expect(store.getState().posCart.accounts.find((a) => a.id === originId)?.items[0]?.quantity).toBe(1);
    }
    expect(screen.queryByText(/solicitaste 1 y hay 0/)).toBeNull();
    expect(document.querySelector('[role="status"][aria-live="polite"]')).toBeNull();
    expect(mocks.createSale).toHaveBeenCalledTimes(1);
    expect(mocks.requestElectronicBilling).not.toHaveBeenCalled();
  });

  it.each(["rejection", "transport"])("keeps CONFIRMED after a later fiscal %s", async (failure) => {
    const fiscal = deferred<ElectronicBillingRequestResult>();
    mocks.requestElectronicBilling.mockReturnValueOnce(fiscal.promise);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderScreen();
    fireEvent.click(await openPayment());
    await waitFor(() => expect(store.getState().posCart.saleStatus).toBe("CONFIRMED"));
    await waitFor(() => expect(mocks.requestElectronicBilling).toHaveBeenCalledWith(saleResponse.id));
    const fiscalHeading = await screen.findByText("Facturación electrónica");
    expect(within(fiscalHeading.closest('[role="dialog"]') as HTMLElement).queryByRole("button")).toBeNull();
    if (failure === "transport") {
      await act(async () => fiscal.reject(new TypeError("Billing unavailable")));
      await screen.findByText(/La venta se guardó, pero la factura electrónica no fue emitida/);
    } else {
      await act(async () => fiscal.resolve({
        saleId: saleResponse.id, result: "REQUESTED", eligibility: "ELIGIBLE", requestCreated: true,
        electronicDocumentId: null,
        electronicBilling: {
          status: "REJECTED", electronicDocumentId: null, documentType: "INVOICE", fullNumber: null,
          cufe: null, cude: null, failureClass: "VALIDATION", errorCode: "FAK61",
          errorMessage: "Correo inválido", failures: [], message: "Correo inválido",
        },
      }));
      await screen.findByText(/La venta se guardó, pero la factura electrónica fue rechazada.*FAK61/);
    }
    expect(screen.queryByText("Facturación electrónica")).toBeNull();
    expect(store.getState().posCart.saleStatus).toBe("CONFIRMED");
    expect(store.getState().posCart.items).toHaveLength(0);
    expect(store.getState().posCart.saleAttempt).toBeNull();
    expect(mocks.createSale).toHaveBeenCalledTimes(1);
  });

  it("accepts double click and Enter before rerender with one POST and one original key", async () => {
    renderScreen();
    const charge = await screen.findByRole("button", { name: "Abrir cobro de prueba" });
    await waitFor(() => expect(charge.getAttribute("data-can-charge")).toBe("true"));
    fireEvent.click(charge);
    const confirm = await screen.findByRole("button", { name: "Confirmar venta" });

    act(() => {
      confirm.click();
      confirm.click();
      fireEvent.keyDown(confirm, { key: "Enter" });
    });

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
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.requestElectronicBilling.mockRejectedValue(new Error("billing unavailable"));
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

  it.each(["INSUFFICIENT_STOCK", "INSUFFICIENT_FEFO_STOCK"])("shows %s in the real payment dialog and toast without fiscal processing", async (code) => {
    mocks.createSale.mockRejectedValueOnce(stockRejection(code));

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
    const message = "Producto A: solicitaste 1 y hay 0 disponibles. Ajusta el carrito y vuelve a cobrar.";
    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect(screen.getByRole("status").textContent).toContain(message);
    expect(screen.queryByText("Facturación electrónica")).toBeNull();
    expect(mocks.requestElectronicBilling).not.toHaveBeenCalled();
    expect(mocks.openCashDrawer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar cobro" }));
    expect(screen.queryByRole("dialog", { name: "Cobrar venta" })).toBeNull();
    expect(store.getState().posCart.items[0]?.quantity).toBe(1);
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
