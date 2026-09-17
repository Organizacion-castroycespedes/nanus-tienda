import type {
  BaseTicketInput,
  OrderTicketInput,
  PeripheralTicketContent,
  PeripheralTicketPayload,
  PurchaseTicketInput,
  SaleTicketInput,
} from "./types";

const buildCommonContent = (
  input: BaseTicketInput,
  title: string,
  extraLines: Array<string | undefined> = []
): PeripheralTicketContent => {
  const lines = [
    ...extraLines.filter((line): line is string => Boolean(line)),
    ...(input.notes ?? []),
  ];

  return {
    title,
    businessName: input.businessName,
    nit: input.nit,
    phone: input.phone,
    email: input.email,
    logo: input.logo,
    address: input.address,
    cashier: input.cashier,
    documentNumber: input.documentNumber,
    date: input.date,
    items: input.items ?? [],
    subtotal: input.subtotal,
    taxes: input.taxes,
    discounts: input.discounts,
    total: input.total,
    paid: input.paid,
    change: input.change,
    balance: input.balance,
    payments: input.payments,
    footer: input.footer,
    lines: lines.length > 0 ? lines : undefined,
  };
};

export const buildSaleTicketPayload = (
  sale: SaleTicketInput
): PeripheralTicketPayload => ({
  tenantId: sale.tenantId,
  branchId: sale.branchId,
  terminalId: sale.terminalId,
  deviceId: sale.deviceId,
  ticketType: "SALE",
  content: {
    ...buildCommonContent(sale, "VENTA", [
      sale.customerName ? `Cliente: ${sale.customerName}` : undefined,
    ]),
    documentNumber: sale.documentNumber ?? sale.saleNumber,
    saleNumber: sale.saleNumber,
    taxLines: sale.taxLines,
    footer: sale.footer ?? "Gracias por su compra",
  },
});

export const buildPurchaseTicketPayload = (
  purchase: PurchaseTicketInput
): PeripheralTicketPayload => ({
  tenantId: purchase.tenantId,
  branchId: purchase.branchId,
  terminalId: purchase.terminalId,
  deviceId: purchase.deviceId,
  ticketType: "PURCHASE",
  content: {
    ...buildCommonContent(purchase, "COMPRA", [
      purchase.supplierName ? `Proveedor: ${purchase.supplierName}` : undefined,
    ]),
    documentNumber: purchase.documentNumber ?? purchase.purchaseNumber,
    footer: purchase.footer ?? "Registro de compra",
  },
});

export const buildOrderTicketPayload = (
  order: OrderTicketInput
): PeripheralTicketPayload => ({
  tenantId: order.tenantId,
  branchId: order.branchId,
  terminalId: order.terminalId,
  deviceId: order.deviceId,
  ticketType: "ORDER",
  content: {
    ...buildCommonContent(order, "PEDIDO", [
      order.customerName ? `Cliente: ${order.customerName}` : undefined,
      order.tableName ? `Mesa: ${order.tableName}` : undefined,
    ]),
    documentNumber: order.documentNumber ?? order.orderNumber,
    footer: order.footer ?? "Pedido registrado",
  },
});
