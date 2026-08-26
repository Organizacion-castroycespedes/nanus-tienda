export type PaymentMethodLike = {
  id: string;
  codigo?: string | null;
  nombre?: string | null;
  tipo?: string | null;
};

export type PaymentDraftLike = {
  id: string;
  paymentMethodId: string;
  amount: string;
};

export type CashPaymentMethodLike = {
  codigo?: string | null;
  nombre?: string | null;
  tipo?: string | null;
};

type RebalanceResult<TPayment extends PaymentDraftLike> = {
  payments: TPayment[];
  error: string | null;
};

const round = (value: number) => Number(value.toFixed(2));

const normalizeText = (value?: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

export const parsePaymentAmount = (value: string) => {
  const sanitized = value.replace(",", ".").replace(/[^0-9.]/g, "");
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? round(parsed) : 0;
};

export const formatPaymentAmount = (value: number) => {
  const rounded = round(Math.max(value, 0));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
};

export const isCashPaymentMethod = (method: CashPaymentMethodLike) => {
  const type = normalizeText(method.tipo);
  if (type === "CASH") {
    return true;
  }

  const code = normalizeText(method.codigo);
  const name = normalizeText(method.nombre);
  return code === "CASH" || code === "EFECTIVO" || name.includes("EFECTIVO") || name === "CASH";
};

export const findCashPaymentMethod = <TMethod extends PaymentMethodLike>(
  paymentMethods: TMethod[]
): TMethod | null => {
  return paymentMethods.find((method) => isCashPaymentMethod(method)) ?? null;
};

export const createDefaultCashPayment = <TPayment extends PaymentDraftLike>(
  total: number,
  paymentMethods: PaymentMethodLike[],
  createPayment: (paymentMethodId: string, amount: string) => TPayment
): RebalanceResult<TPayment> => {
  const cashMethod = findCashPaymentMethod(paymentMethods);
  if (!cashMethod) {
    return {
      payments: [createPayment(paymentMethods[0]?.id ?? "", "")],
      error: "No hay un metodo de pago EFECTIVO/CASH activo. Configura el pago manualmente.",
    };
  }

  return {
    payments: [createPayment(cashMethod.id, formatPaymentAmount(total))],
    error: null,
  };
};

export const rebalanceCashPayment = <TPayment extends PaymentDraftLike>(
  total: number,
  payments: TPayment[],
  cashMethod: PaymentMethodLike | null,
  createPayment: (paymentMethodId: string, amount: string) => TPayment
): RebalanceResult<TPayment> => {
  if (!cashMethod) {
    return {
      payments,
      error: "No hay un metodo de pago EFECTIVO/CASH activo. Configura el pago manualmente.",
    };
  }

  const cashIndex = payments.findIndex(
    (payment) => payment.paymentMethodId === cashMethod.id
  );
  const cashPayment =
    cashIndex >= 0 ? payments[cashIndex] : createPayment(cashMethod.id, "0");
  const nonCashPayments = payments.filter(
    (payment, index) => index !== cashIndex && payment.paymentMethodId !== cashMethod.id
  );
  const nonCashTotal = round(
    nonCashPayments.reduce(
      (sum, payment) => sum + parsePaymentAmount(payment.amount),
      0
    )
  );
  const remaining = round(Math.max(total - nonCashTotal, 0));
  const updatedCashPayment = {
    ...cashPayment,
    paymentMethodId: cashMethod.id,
    amount: formatPaymentAmount(remaining),
  };
  const result = [...nonCashPayments];

  if (cashIndex < 0) {
    result.unshift(updatedCashPayment);
  } else {
    result.splice(Math.min(cashIndex, result.length), 0, updatedCashPayment);
  }

  return {
    payments: result,
    error:
      nonCashTotal > total
        ? "Los pagos diferentes a efectivo no pueden superar el total."
        : null,
  };
};

export const validatePaymentAllocation = (
  total: number,
  payments: PaymentDraftLike[]
) => {
  const paid = round(
    payments.reduce((sum, payment) => sum + parsePaymentAmount(payment.amount), 0)
  );

  if (payments.some((payment) => parsePaymentAmount(payment.amount) < 0)) {
    return "Los montos de pago no pueden ser negativos.";
  }
  if (paid > total) {
    return "El total pagado no puede superar el total.";
  }
  if (paid !== round(total)) {
    return "El total pagado debe ser igual al total.";
  }
  return null;
};
