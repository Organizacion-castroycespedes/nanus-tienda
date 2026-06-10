import {
  buildOrderTicketPayload,
  getPeripheralFeatureFlags,
  openCashDrawer,
  printOrderTicket,
} from "./contracts";
import type {
  OrderTicketInput,
  PeripheralOperationError,
  PeripheralTicketPayment,
} from "./types";

const defaultPrinterDeviceId = "mock-printer-001";
const defaultCashDrawerDeviceId = "mock-cashdrawer-001";
const defaultTerminalId = "local-terminal";

export type OrderPeripheralItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type OrderPeripheralPayment = {
  paymentMethodId?: string;
  methodName?: string | null;
  methodType?: string | null;
  amount: number;
};

export type OrderPeripheralContext = {
  orderId: string;
  orderNumber?: string | null;
  documentNumber?: string | null;
  date?: string | null;
  tenantId?: string | null;
  branchId?: string | null;
  terminalId?: string | null;
  businessName?: string | null;
  branchName?: string | null;
  cashier?: string | null;
  customerName?: string | null;
  status?: string | null;
  items: OrderPeripheralItem[];
  subtotal: number;
  taxes: number;
  discounts: number;
  total: number;
  balanceDue?: number | null;
  payments: OrderPeripheralPayment[];
};

export type OrderPeripheralOperationOptions = {
  printTicket?: boolean;
  openCashDrawer?: boolean;
};

export type OrderPeripheralFeedback = {
  variant: "success" | "warning";
  message: string;
  operation: "print" | "cash-drawer";
  error?: PeripheralOperationError;
};

export const isCashOrderPeripheralPayment = (payment: OrderPeripheralPayment) =>
  payment.amount > 0 && payment.methodType === "CASH";

export const hasCashOrderPeripheralPayment = (
  payments: OrderPeripheralPayment[]
) => payments.some(isCashOrderPeripheralPayment);

export const buildOrderTicketInputFromInventory = (
  context: OrderPeripheralContext
): OrderTicketInput => ({
  tenantId: context.tenantId ?? undefined,
  branchId: context.branchId ?? undefined,
  terminalId: context.terminalId ?? defaultTerminalId,
  deviceId: defaultPrinterDeviceId,
  businessName: context.businessName ?? "Manus POS",
  address: context.branchName ? `Sucursal: ${context.branchName}` : undefined,
  cashier: context.cashier ?? undefined,
  customerName: context.customerName ?? "Cliente",
  orderId: context.orderId,
  orderNumber: context.orderNumber ?? context.orderId,
  documentNumber: context.documentNumber ?? context.orderNumber ?? context.orderId,
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
  notes: [
    context.status ? `Estado: ${context.status}` : undefined,
    context.balanceDue !== undefined && context.balanceDue !== null
      ? `Saldo pendiente: ${context.balanceDue}`
      : undefined,
  ].filter((line): line is string => Boolean(line)),
  footer: "Pedido registrado",
});

const isAgentOffline = (error?: PeripheralOperationError) =>
  error?.code === "AGENT_OFFLINE";

const printWarningMessage = (error?: PeripheralOperationError) =>
  isAgentOffline(error)
    ? "Pedido guardado, pero no se pudo contactar el agente de perifericos"
    : "Pedido guardado, pero fallo la impresion MOCK";

const drawerWarningMessage = (error?: PeripheralOperationError) =>
  isAgentOffline(error)
    ? "Pedido guardado, pero no se pudo contactar el agente de perifericos"
    : "Pedido guardado, pero fallo la apertura de caja MOCK";

export const runOrderPeripheralOperations = async (
  context: OrderPeripheralContext,
  options: OrderPeripheralOperationOptions = {}
): Promise<OrderPeripheralFeedback[]> => {
  const flags = getPeripheralFeatureFlags();
  const feedback: OrderPeripheralFeedback[] = [];

  if (!flags.peripheralsEnabled) {
    return feedback;
  }

  const shouldPrintTicket = options.printTicket !== false;
  const shouldOpenDrawer = options.openCashDrawer !== false;
  const terminalId = context.terminalId ?? defaultTerminalId;

  if (shouldPrintTicket && flags.printOrderEnabled) {
    const ticketInput = buildOrderTicketInputFromInventory(context);
    // Build explicitly here so order integration keeps the same payload
    // contract that admin diagnostics uses through /printer/print-ticket.
    buildOrderTicketPayload(ticketInput);
    const printResult = await printOrderTicket(ticketInput);

    if (printResult.success) {
      feedback.push({
        variant: "success",
        message: "Ticket MOCK de pedido enviado",
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
    hasCashOrderPeripheralPayment(context.payments) &&
    flags.openDrawerEnabled
  ) {
    const drawerResult = await openCashDrawer({
      tenantId: context.tenantId ?? undefined,
      branchId: context.branchId ?? undefined,
      terminalId,
      deviceId: defaultCashDrawerDeviceId,
      reason: "ORDER_CASH_PAYMENT",
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

export const buildOrderPeripheralFeedbackMessage = (
  feedback: OrderPeripheralFeedback[]
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
