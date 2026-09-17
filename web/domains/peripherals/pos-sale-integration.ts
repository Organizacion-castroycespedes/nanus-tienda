import {
  buildSaleTicketPayload,
  getPeripheralFeatureFlags,
  openCashDrawer,
  printSaleTicket,
} from "./contracts";
import { canonicalPosSourceToSaleTicketInput } from "../../modules/reporteria/canonical-printable-document";
import { isCashPaymentMethod } from "../../modules/shared/payments/payment-allocation.helper";
import type {
  PeripheralOperationError,
  PeripheralTicketPayment,
  SaleTicketInput,
} from "./types";

const defaultPrinterDeviceId = "mock-printer-001";
const defaultCashDrawerDeviceId = "mock-cashdrawer-001";
const defaultTerminalId = "local-terminal";

export type PosSalePeripheralItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type PosSalePeripheralPayment = {
  paymentMethodId: string;
  methodName?: string | null;
  methodType?: string | null;
  methodCode?: string | null;
  amount: number;
};

export type PosSalePeripheralContext = {
  saleId: string;
  saleNumber?: string | null;
  documentNumber?: string | null;
  date?: string | null;
  tenantId?: string | null;
  branchId?: string | null;
  terminalId?: string | null;
  businessName?: string | null;
  nit?: string | null;
  phone?: string | null;
  email?: string | null;
  logo?: string | null;
  address?: string | null;
  branchName?: string | null;
  cashier?: string | null;
  customerName?: string | null;
  items: PosSalePeripheralItem[];
  subtotal: number;
  taxes: number;
  discounts: number;
  total: number;
  payments: PosSalePeripheralPayment[];
};

export type SalePeripheralFeedback = {
  variant: "success" | "warning";
  message: string;
  operation: "print" | "cash-drawer";
  error?: PeripheralOperationError;
};

export const isCashPeripheralPayment = (payment: PosSalePeripheralPayment) =>
  payment.amount > 0 &&
  isCashPaymentMethod({
    tipo: payment.methodType ?? undefined,
    codigo: payment.methodCode ?? undefined,
    nombre: payment.methodName ?? undefined,
  });

export const hasCashPeripheralPayment = (payments: PosSalePeripheralPayment[]) =>
  payments.some(isCashPeripheralPayment);

export const buildSaleTicketInputFromPos = (
  context: PosSalePeripheralContext
): SaleTicketInput => ({
  ...canonicalPosSourceToSaleTicketInput({
    saleId: context.saleId,
    saleNumber: context.saleNumber,
    documentNumber: context.documentNumber,
    date: context.date ?? new Date().toISOString(),
    tenantId: context.tenantId,
    branchId: context.branchId,
    terminalId: context.terminalId ?? defaultTerminalId,
    businessName: context.businessName ?? "Manus POS",
    nit: context.nit,
    phone: context.phone,
    email: context.email,
    logo: context.logo,
    address: context.address ?? (context.branchName ? `Sucursal: ${context.branchName}` : undefined),
    branchName: context.branchName,
    cashier: context.cashier,
    customerName: context.customerName ?? "Consumidor final",
    items: context.items,
    subtotal: context.subtotal,
    taxes: context.taxes,
    discounts: context.discounts,
    total: context.total,
    payments: context.payments.map<PeripheralTicketPayment>((payment) => ({
      method: payment.methodName ?? payment.methodType ?? "Metodo de pago",
      amount: payment.amount,
    })),
  }),
  tenantId: context.tenantId ?? undefined,
  branchId: context.branchId ?? undefined,
  terminalId: context.terminalId ?? defaultTerminalId,
  deviceId: defaultPrinterDeviceId,
  saleId: context.saleId,
  saleNumber: context.saleNumber ?? context.saleId,
  documentNumber: context.documentNumber ?? context.saleNumber ?? context.saleId,
});

const isAgentOffline = (error?: PeripheralOperationError) =>
  error?.code === "AGENT_OFFLINE";

const printWarningMessage = (error?: PeripheralOperationError) =>
  isAgentOffline(error)
    ? "Venta guardada, pero no se pudo contactar el agente de perifericos"
    : "Venta guardada, pero no se pudo imprimir el ticket";

const drawerWarningMessage = (error?: PeripheralOperationError) =>
  isAgentOffline(error)
    ? "Venta guardada, pero no se pudo contactar el agente de perifericos"
    : "Venta guardada, pero no se pudo confirmar la apertura del cajon";

export const runSalePeripheralOperations = async (
  context: PosSalePeripheralContext
): Promise<SalePeripheralFeedback[]> => {
  const flags = getPeripheralFeatureFlags();
  const feedback: SalePeripheralFeedback[] = [];

  if (!flags.peripheralsEnabled) {
    return feedback;
  }

  const terminalId = context.terminalId ?? defaultTerminalId;
  const ticketInput = buildSaleTicketInputFromPos(context);

  if (flags.printSaleEnabled) {
    // Build explicitly here so sale integration keeps the same payload contract
    // that admin diagnostics uses through /printer/print-ticket.
    buildSaleTicketPayload(ticketInput);
    const printResult = await printSaleTicket(ticketInput);

    if (printResult.success) {
      feedback.push({
        variant: "success",
        message: "Ticket enviado a impresion",
        operation: "print",
      });
    } else if (
      printResult.error.code !== "PERIPHERALS_DISABLED" &&
      printResult.error.code !== "OPERATION_DISABLED"
    ) {
      feedback.push({
        variant: "warning",
        message: printWarningMessage(printResult.error),
        operation: "print",
        error: printResult.error,
      });
    }
  }

  if (hasCashPeripheralPayment(context.payments) && flags.openDrawerEnabled) {
    const drawerResult = await openCashDrawer({
      tenantId: context.tenantId ?? undefined,
      branchId: context.branchId ?? undefined,
      terminalId,
      deviceId: defaultCashDrawerDeviceId,
      reason: "SALE_CASH_PAYMENT",
    });

    if (drawerResult.success) {
      feedback.push({
        variant: "success",
        message: "Cajon abierto",
        operation: "cash-drawer",
      });
    } else if (
      drawerResult.error.code !== "PERIPHERALS_DISABLED" &&
      drawerResult.error.code !== "OPERATION_DISABLED"
    ) {
      feedback.push({
        variant: "warning",
        message: drawerWarningMessage(drawerResult.error),
        operation: "cash-drawer",
        error: drawerResult.error,
      });
    }
  }

  return feedback;
};

export const buildSalePeripheralFeedbackMessage = (
  feedback: SalePeripheralFeedback[]
) => {
  if (feedback.length === 0) {
    return null;
  }

  const warnings = feedback.filter((item) => item.variant === "warning");
  const successes = feedback.filter((item) => item.variant === "success");
  const uniqueMessages = [...successes, ...warnings].reduce<string[]>(
    (messages, item) =>
      messages.includes(item.message) ? messages : [...messages, item.message],
    []
  );

  return {
    variant: warnings.length > 0 ? ("warning" as const) : ("success" as const),
    message: uniqueMessages.join(". "),
  };
};
