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

// Document inputs are strict; preserve POS's existing parsing contract above.
export const parseDocumentPaymentAmount = (value: string): number | null => {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed <= 999999999999.99 ? parsed : null;
};

const paymentCents = (value: number) => {
  const [whole, fraction] = value.toFixed(2).split(".");
  return Number(whole) * 100 + Number(fraction);
};

export const summarizeDocumentPayments = (pending: number, payments: PaymentDraftLike[]) => {
  const amounts = payments.map((line) => parseDocumentPaymentAmount(line.amount));
  const cents = amounts.reduce<number>((sum, amount) => sum + paymentCents(amount ?? 0), 0);
  const pendingCents = paymentCents(pending);
  return {
    total: cents / 100,
    remaining: Math.max(0, pendingCents - cents) / 100,
    overpayment: cents > pendingCents,
    valid: amounts.length > 0 && amounts.every((amount) => amount !== null && amount > 0),
  };
};

export const rebalanceDocumentPayments = <T extends PaymentDraftLike & { automatic?: boolean }>(
  pending: number,
  payments: T[],
): T[] => {
  const manual = payments.filter((line) => !line.automatic);
  let remaining = summarizeDocumentPayments(pending, manual).remaining;
  return payments.map((line) => {
    if (!line.automatic) return line;
    const result = { ...line, amount: formatPaymentAmount(remaining) };
    remaining = 0;
    return result;
  });
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
  
  const nonCashPayments = payments.filter(
    (payment) => payment.paymentMethodId !== cashMethod.id
  );
  const nonCashTotal = round(
    nonCashPayments.reduce(
      (sum, payment) => sum + parsePaymentAmount(payment.amount),
      0
    )
  );
  const remaining = round(Math.max(total - nonCashTotal, 0));

  const result = [...nonCashPayments];

  if (remaining > 0 || result.length === 0) {
    if (cashIndex >= 0) {
      const cashPayment = payments[cashIndex];
      const updatedCashPayment = {
        ...cashPayment,
        paymentMethodId: cashMethod.id,
        amount: formatPaymentAmount(remaining),
      };
      result.splice(Math.min(cashIndex, result.length), 0, updatedCashPayment);
    } else {
      const cashPayment = createPayment(cashMethod.id, formatPaymentAmount(remaining));
      result.unshift(cashPayment);
    }
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
