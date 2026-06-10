import {
  buildPurchaseTicketPayload,
  getPeripheralFeatureFlags,
  openCashDrawer,
  printPurchaseTicket,
} from "./contracts";
import type {
  PeripheralOperationError,
  PeripheralTicketPayment,
  PurchaseTicketInput,
} from "./types";

const defaultPrinterDeviceId = "mock-printer-001";
const defaultCashDrawerDeviceId = "mock-cashdrawer-001";
const defaultTerminalId = "local-terminal";

export type PurchasePeripheralItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type PurchasePeripheralPayment = {
  paymentMethodId?: string;
  methodName?: string | null;
  methodType?: string | null;
  amount: number;
};

export type PurchasePeripheralContext = {
  purchaseId: string;
  purchaseNumber?: string | null;
  documentNumber?: string | null;
  date?: string | null;
  tenantId?: string | null;
  branchId?: string | null;
  terminalId?: string | null;
  businessName?: string | null;
  branchName?: string | null;
  cashier?: string | null;
  supplierName?: string | null;
  items: PurchasePeripheralItem[];
  subtotal: number;
  taxes: number;
  discounts: number;
  total: number;
  payments: PurchasePeripheralPayment[];
};

export type PurchasePeripheralOperationOptions = {
  printTicket?: boolean;
  openCashDrawer?: boolean;
};

export type PurchasePeripheralFeedback = {
  variant: "success" | "warning";
  message: string;
  operation: "print" | "cash-drawer";
  error?: PeripheralOperationError;
};

export const isCashPurchasePeripheralPayment = (
  payment: PurchasePeripheralPayment
) => payment.amount > 0 && payment.methodType === "CASH";

export const hasCashPurchasePeripheralPayment = (
  payments: PurchasePeripheralPayment[]
) => payments.some(isCashPurchasePeripheralPayment);

export const buildPurchaseTicketInputFromInventory = (
  context: PurchasePeripheralContext
): PurchaseTicketInput => ({
  tenantId: context.tenantId ?? undefined,
  branchId: context.branchId ?? undefined,
  terminalId: context.terminalId ?? defaultTerminalId,
  deviceId: defaultPrinterDeviceId,
  businessName: context.businessName ?? "Manus POS",
  address: context.branchName ? `Sucursal: ${context.branchName}` : undefined,
  cashier: context.cashier ?? undefined,
  supplierName: context.supplierName ?? "Proveedor",
  purchaseId: context.purchaseId,
  purchaseNumber: context.purchaseNumber ?? context.purchaseId,
  documentNumber: context.documentNumber ?? context.purchaseNumber ?? context.purchaseId,
  date: context.date ?? new Date().toISOString(),
  items: context.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.total,
  })),
  subtotal: context.subtotal,
  taxes: context.taxes,
  discounts: context.discounts,
  total: context.total,
  payments: context.payments.map<PeripheralTicketPayment>((payment) => ({
    method: payment.methodName ?? payment.methodType ?? "Metodo de pago",
    amount: payment.amount,
  })),
  footer: "Compra registrada",
});

const isAgentOffline = (error?: PeripheralOperationError) =>
  error?.code === "AGENT_OFFLINE";

const printWarningMessage = (error?: PeripheralOperationError) =>
  isAgentOffline(error)
    ? "Compra guardada, pero no se pudo contactar el agente de perifericos"
    : "Compra guardada, pero fallo la impresion MOCK";

const drawerWarningMessage = (error?: PeripheralOperationError) =>
  isAgentOffline(error)
    ? "Compra guardada, pero no se pudo contactar el agente de perifericos"
    : "Compra guardada, pero fallo la apertura de caja MOCK";

export const runPurchasePeripheralOperations = async (
  context: PurchasePeripheralContext,
  options: PurchasePeripheralOperationOptions = {}
): Promise<PurchasePeripheralFeedback[]> => {
  const flags = getPeripheralFeatureFlags();
  const feedback: PurchasePeripheralFeedback[] = [];

  if (!flags.peripheralsEnabled) {
    return feedback;
  }

  const shouldPrintTicket = options.printTicket !== false;
  const shouldOpenDrawer = options.openCashDrawer !== false;
  const terminalId = context.terminalId ?? defaultTerminalId;

  if (shouldPrintTicket && flags.printPurchaseEnabled) {
    const ticketInput = buildPurchaseTicketInputFromInventory(context);
    // Build explicitly here so purchase integration keeps the same payload
    // contract that admin diagnostics uses through /printer/print-ticket.
    buildPurchaseTicketPayload(ticketInput);
    const printResult = await printPurchaseTicket(ticketInput);

    if (printResult.success) {
      feedback.push({
        variant: "success",
        message: "Ticket MOCK de compra enviado",
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

  if (
    shouldOpenDrawer &&
    hasCashPurchasePeripheralPayment(context.payments) &&
    flags.openDrawerEnabled
  ) {
    const drawerResult = await openCashDrawer({
      tenantId: context.tenantId ?? undefined,
      branchId: context.branchId ?? undefined,
      terminalId,
      deviceId: defaultCashDrawerDeviceId,
      reason: "PURCHASE_CASH_PAYMENT",
    });

    if (drawerResult.success) {
      feedback.push({
        variant: "success",
        message: "Caja MOCK abierta",
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

export const buildPurchasePeripheralFeedbackMessage = (
  feedback: PurchasePeripheralFeedback[]
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
