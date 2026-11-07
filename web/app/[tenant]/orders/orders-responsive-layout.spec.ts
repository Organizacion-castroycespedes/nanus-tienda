import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readWebSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const ordersPage = readWebSource("app/[tenant]/orders/page.tsx");
const orderForm = readWebSource("modules/inventory/components/OrderForm.tsx");
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

  it("keeps long selected product names readable before the five-column layout", () => {
    expect(orderForm).toContain("sm:grid-cols-2 xl:grid-cols-[minmax(16rem,2fr)");
    expect(orderForm).not.toContain("md:grid-cols-[2fr_1fr_1fr_1fr_auto]");
    expect(orderForm).toContain(
      'className="mt-1 break-words text-xs leading-5 text-slate-500 dark:text-slate-400"',
    );
    expect(orderForm).toContain("{selectedProduct.name}");
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
