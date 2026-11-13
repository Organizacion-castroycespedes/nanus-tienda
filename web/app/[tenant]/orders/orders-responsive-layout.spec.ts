import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readWebSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const ordersPage = readWebSource("app/[tenant]/orders/page.tsx");
const orderForm = readWebSource("modules/inventory/components/OrderForm.tsx");
const orderTicket = readWebSource(
  "modules/inventory/order-capture/OrderCaptureTicket.tsx",
);
const deliveryForm = readWebSource(
  "modules/inventory/components/OrderDeliverForm.tsx",
);
const invoiceForm = readWebSource(
  "modules/inventory/components/OrderInvoiceForm.tsx",
);

describe("orders responsive layout contract", () => {
  it("uses available desktop width and preserves a readable scrollable table", () => {
    expect(ordersPage).toContain(
      'className="w-full min-w-[1360px] table-fixed divide-y divide-slate-200 text-sm"',
    );
    expect(ordersPage).toContain(
      'aria-label="Tabla de pedidos con desplazamiento horizontal"',
    );
    expect(ordersPage).toContain('role="region"');
    expect(ordersPage).toContain("tabIndex={0}");
    expect(ordersPage).toContain("sticky right-0");
  });

  it("compacts filters progressively without removing controls", () => {
    expect(ordersPage).toContain(
      "grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6",
    );
    expect(ordersPage).toContain('label="Buscar"');
    expect(ordersPage).toContain('label="Desde"');
    expect(ordersPage).toContain('label="Hasta"');
    expect(ordersPage).toContain('label="Filas por pagina"');
  });

  it("keeps filters in a collapsible panel and shows the cash scope only inside it", () => {
    expect(ordersPage).toContain("<CollapsibleFilterPanel");
    expect(ordersPage).toContain('storageKey="orders"');
    expect(ordersPage).toContain("activeCount={activeFilterCount}");
    expect(ordersPage).toContain('label="Alcance"');
    expect(ordersPage).not.toContain("Alcance: {cashScope");
  });

  it("captures order products with a POS-style scan bar, ticket and sticky summary", () => {
    expect(orderForm).toContain('<InventoryScanBar');
    expect(orderForm).toContain('id="order-scan"');
    expect(orderForm).toContain("xl:grid-cols-[minmax(0,1fr)_22rem]");
    expect(orderForm).toContain('aria-label="Resumen del pedido"');
    expect(orderForm).toContain("sticky bottom-0");
    expect(orderForm).not.toContain("Agregar item");
    expect(orderTicket).toContain('aria-label="Productos del pedido"');
    expect(orderTicket).toContain("md:grid-cols-[minmax(14rem,2fr)_11rem_9rem_9rem_3rem]");
    expect(orderTicket).toContain("break-words text-sm font-medium leading-5");
    expect(orderTicket).toContain("{row.name}");
  });

  it("charges the invoice balance only when pending and with the modern payment modal", () => {
    expect(invoiceForm).toContain("{remainingToCover > 0 ? (");
    expect(invoiceForm).toContain('aria-label="Pagos nuevos"');
    expect(invoiceForm).toContain("<DocumentPaymentForm");
    expect(invoiceForm).toContain("balanceDue={remainingToCover}");
    expect(invoiceForm).toContain("payments: [],");
    expect(invoiceForm).not.toContain("Agregar pago");
  });

  it("gives delivery and invoice product tables stable readable columns", () => {
    expect(deliveryForm).toContain(
      'aria-label="Productos del pedido para entregar"',
    );
    expect(deliveryForm).toContain("w-full min-w-[800px] table-fixed");
    expect(deliveryForm).toContain("break-words px-4 py-3 leading-5");
    expect(invoiceForm).toContain(
      'aria-label="Productos del pedido para facturar"',
    );
    expect(invoiceForm).toContain("w-full min-w-[760px] table-fixed");
    expect(invoiceForm).toContain("whitespace-nowrap px-4 py-3 text-right tabular-nums");
  });
});
