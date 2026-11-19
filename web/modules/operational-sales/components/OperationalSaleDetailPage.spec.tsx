import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  blob: vi.fn(), invoice: vi.fn(), ticket: vi.fn(), printInvoice: vi.fn(), printTicket: vi.fn(),
  retry: vi.fn(), refresh: vi.fn(), recover: vi.fn(), detail: vi.fn(), from: "orders",
}));

vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("next/navigation", () => ({ useParams: () => ({ tenant: "demo", saleId: "sale-1" }), useSearchParams: () => new URLSearchParams(mocks.from ? `from=${mocks.from}` : "") }));
vi.mock("../../../lib/http", () => ({ apiBlobClientWithBaseUrl: mocks.blob, apiClient: vi.fn() }));
vi.mock("../../../lib/permissions", () => ({ hasPermission: () => true }));
vi.mock("../../../store/hooks", () => ({ useAppSelector: (select: (state: unknown) => unknown) => select({ auth: { user: { role: "ADMIN" }, role: "ADMIN" } }) }));
vi.mock("../../../domains/pos/hooks/usePosContext", () => ({ usePosContext: () => ({}) }));
vi.mock("../hooks/use-operational-sale-detail", () => ({ useOperationalSaleDetail: () => mocks.detail() }));
vi.mock("../../reporteria/services/reporting.service", () => ({ getElectronicInvoice: mocks.invoice, getElectronicInvoicePrintData: vi.fn(), getPosSaleTicket: mocks.ticket, getPosSaleTicketPrintData: vi.fn() }));
vi.mock("../../reporteria/electronic-invoice-direct-print", () => ({ printElectronicInvoiceTicket: vi.fn() }));
vi.mock("../../reporteria/direct-print", () => ({ printReporteriaSaleTicket: vi.fn() }));
vi.mock("./wizard/PreInvoiceWizardModal", () => ({ PreInvoiceWizardModal: () => null }));
vi.mock("./EditSalePaymentsModal", () => ({ EditSalePaymentsModal: () => null }));
vi.mock("./VoidSaleModal", () => ({ VoidSaleModal: () => null }));
vi.mock("../../../components/design-system/confirm-dialog", () => ({ ConfirmDialog: () => null }));
vi.mock("../../reporteria/components/PdfPreviewModal", async () => {
  const React = await import("react");
  return { PdfPreviewModal: ({ isOpen, title, getPdf }: { isOpen: boolean; title: string; getPdf: () => Promise<Blob> }) => {
    const [result, setResult] = React.useState("");
    React.useEffect(() => { if (isOpen) void getPdf().then(() => setResult("PDF válido")).catch((error: Error) => setResult(error.message)); }, [isOpen, getPdf]);
    return isOpen ? <div>{title} {result}</div> : null;
  } };
});

import { ActionCard, OperationalSaleDetailPage } from "./OperationalSaleDetailPage";
import { ApiError } from "../../../lib/request";
import type { OperationalSaleDetail } from "../types";

const sale = (status: string) => ({
  id: "sale-1", status, electronicBillingEnabled: true,
  electronicBilling: { status: "ACCEPTED", retryability: { canRetry: true, canRecoverProviderCreateIntent: true } },
  paymentStatus: "PAID", customer: { id: "customer-1", name: "Cliente" }, branch: { id: "branch", name: "Sucursal" },
  operator: { id: null, email: null }, items: [], payments: [], total: 1, createdAt: "2026-01-01",
} as unknown as OperationalSaleDetail);
const props = (status: string) => ({ sale: sale(status), tenantContext: "demo", onReload: vi.fn(), onRefreshStatus: mocks.refresh, onRetry: mocks.retry, onRequestBilling: vi.fn(), onRecoverProviderCreateIntent: mocks.recover, onPrintInvoice: mocks.printInvoice, onPrintTicket: mocks.printTicket, refreshLoading: false, printLoading: false, ticketLoading: false, actionMessage: null });

beforeEach(() => { vi.clearAllMocks(); mocks.from = "orders"; });
afterEach(cleanup);

describe("documentos de venta anulada", () => {
  it.each(["CANCELLED", "REFUNDED"])("bloquea originales para %s sin solicitar documentos", (status) => {
    render(<ActionCard {...props(status)} />);
    for (const name of ["Ver factura electrónica", "Imprimir factura FE", "Ver ticket", "Imprimir ticket", "Reintentar procesamiento", "Recuperar procesamiento"]) {
      const button = screen.getByRole("button", { name }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(screen.getByText("Venta anulada. Esta operación no está disponible.")).toBeTruthy();
    expect(mocks.invoice).not.toHaveBeenCalled();
    expect(mocks.ticket).not.toHaveBeenCalled();
    expect(mocks.printInvoice).not.toHaveBeenCalled();
    expect(mocks.printTicket).not.toHaveBeenCalled();
    expect(mocks.retry).not.toHaveBeenCalled();
    expect(mocks.recover).not.toHaveBeenCalled();
    expect(mocks.blob).not.toHaveBeenCalled();
  });

  it("mantiene disponibles los documentos de una venta vigente", () => {
    render(<ActionCard {...props("CONFIRMED")} />);
    expect((screen.getByRole("button", { name: "Ver factura electrónica" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Imprimir ticket" }));
    expect(mocks.printTicket).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: /Consultar comprobante/ })).toBeNull();
  });

  it("conserva la consulta histórica de estado FE", () => {
    const cancelled = sale("CANCELLED");
    cancelled.electronicBilling = { ...cancelled.electronicBilling!, status: "REJECTED" };
    render(<ActionCard {...props("CANCELLED")} sale={cancelled} />);
    fireEvent.click(screen.getByRole("button", { name: "Actualizar estado FE" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("consulta y muestra solo un comprobante PDF válido", async () => {
    mocks.blob.mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
    render(<ActionCard {...props("CANCELLED")} />);
    fireEvent.click(screen.getByRole("button", { name: /Consultar comprobante/ }));
    await waitFor(() => expect(screen.getByText(/PDF válido/)).toBeTruthy());
    expect(mocks.blob.mock.calls[0][1]).toBe("/reports/pos-sales/sale-1/cancel-ticket");
  });

  it("informa cuando el comprobante no existe", async () => {
    mocks.blob.mockRejectedValue(new ApiError("not found", 404));
    render(<ActionCard {...props("CANCELLED")} />);
    fireEvent.click(screen.getByRole("button", { name: /Consultar comprobante/ }));
    await waitFor(() => expect(screen.getByText(/No hay comprobante de anulación disponible/)).toBeTruthy());
  });

  it("rechaza respuestas que no son PDF", async () => {
    mocks.blob.mockResolvedValue(new Blob(["error"], { type: "text/html" }));
    render(<ActionCard {...props("CANCELLED")} />);
    fireEvent.click(screen.getByRole("button", { name: /Consultar comprobante/ }));
    await waitFor(() => expect(screen.getByText(/no es un PDF válido/)).toBeTruthy());
  });

  it("muestra errores inesperados del comprobante", async () => {
    mocks.blob.mockRejectedValue(new ApiError("Servicio de reportes no disponible", 503));
    render(<ActionCard {...props("REFUNDED")} />);
    fireEvent.click(screen.getByRole("button", { name: /Consultar comprobante/ }));
    await waitFor(() => expect(screen.getByText(/Servicio de reportes no disponible/)).toBeTruthy());
  });

  it.each([["orders", "/demo/orders"], ["pos", "/demo/operations/sales"], ["", "/demo/operations/sales"]])("conserva retorno desde %s", (from, href) => {
    mocks.from = from;
    mocks.detail.mockReturnValue({ data: null, loading: false, error: "No disponible", reload: vi.fn() });
    render(<OperationalSaleDetailPage />);
    expect(screen.getByRole("link").getAttribute("href")).toBe(href);
  });
});
