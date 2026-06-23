import type { CreateDeliveryPayload } from "./types";

export type DeliveryCustomerOption = {
  id: string;
  name: string;
  documentNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  isActive?: boolean;
};

export type DeliveryBranchOption = {
  id: string;
  nombre: string;
  estado?: string;
};

export type DeliverySourceTotals = {
  subtotal: string;
  total: string;
};

export type DeliveryAddressOption = {
  id: string;
  label: string;
  address: string;
  reference?: string;
};

export type BranchResolutionSource = "pos" | "auth" | "single" | "manual";

export type BranchResolution = {
  branchId: string;
  source: BranchResolutionSource;
};

export type DeliveryQuickCreateFormLike = {
  branchId: string;
  customerId: string;
  orderId: string;
  saleId: string;
  driverId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryReference: string;
  deliveryFee: string;
  subtotal: string;
  total: string;
  paymentMethodId: string;
  notes: string;
};

export type DeliveryQuickCreateValidationInput = Pick<
  DeliveryQuickCreateFormLike,
  "branchId" | "customerId" | "customerName" | "customerPhone" | "deliveryAddress" | "deliveryFee"
> & {
  requireDeliveryFee?: boolean;
};

export const normalizeQuickCreateText = (value?: string | null) =>
  (value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const optionalQuickCreateText = (value: string) => {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
};

export const optionalQuickCreateAmount = (value: string) => {
  if (!value.trim()) {
    return undefined;
  }

  const amount = Number(value);
  return Number.isFinite(amount) ? amount : undefined;
};

export const toMoneyInput = (value?: number | string | null) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? String(Number(amount.toFixed(2))) : "";
};

export const getSourceTotals = (total?: number | string | null): DeliverySourceTotals => {
  const normalizedTotal = toMoneyInput(total);
  return {
    subtotal: normalizedTotal,
    total: normalizedTotal,
  };
};

export const filterCustomersForDelivery = <T extends DeliveryCustomerOption>(
  customers: T[],
  query: string,
  limit = 12
) => {
  const normalizedQuery = normalizeQuickCreateText(query);
  const activeCustomers = customers.filter((customer) => customer.isActive !== false);

  if (!normalizedQuery) {
    return activeCustomers.slice(0, limit);
  }

  return activeCustomers
    .filter((customer) =>
      [
        customer.name,
        customer.documentNumber,
        customer.phone,
        customer.email,
      ].some((value) => normalizeQuickCreateText(value).includes(normalizedQuery))
    )
    .slice(0, limit);
};

export const buildCustomerAddressOptions = (
  customer: DeliveryCustomerOption | null,
  extraOptions: Array<{ label: string; address?: string | null; reference?: string | null }> = []
): DeliveryAddressOption[] => {
  const seen = new Set<string>();
  const options: DeliveryAddressOption[] = [];

  const addOption = (
    id: string,
    label: string,
    address?: string | null,
    reference?: string | null
  ) => {
    const normalizedAddress = address?.trim();
    if (!normalizedAddress || seen.has(normalizedAddress)) {
      return;
    }
    seen.add(normalizedAddress);
    options.push({
      id,
      label,
      address: normalizedAddress,
      reference: reference?.trim() || undefined,
    });
  };

  addOption("customer-main", "Direccion del cliente", customer?.address);
  extraOptions.forEach((option, index) =>
    addOption(`source-${index}`, option.label, option.address, option.reference)
  );

  return options;
};

export const resolveDeliveryBranch = ({
  posBranchId,
  authBranchId,
  branches,
}: {
  posBranchId?: string | null;
  authBranchId?: string | null;
  branches: DeliveryBranchOption[];
}): BranchResolution => {
  const activeBranches = branches.filter((branch) => branch.estado !== "INACTIVE");
  const activeIds = new Set(activeBranches.map((branch) => branch.id));
  const isKnownOrPending = (branchId?: string | null) =>
    Boolean(branchId && (activeIds.size === 0 || activeIds.has(branchId)));

  if (isKnownOrPending(posBranchId)) {
    return { branchId: posBranchId!.trim(), source: "pos" };
  }

  if (isKnownOrPending(authBranchId)) {
    return { branchId: authBranchId!.trim(), source: "auth" };
  }

  if (activeBranches.length === 1) {
    return { branchId: activeBranches[0].id, source: "single" };
  }

  return { branchId: "", source: "manual" };
};

export const validateDeliveryQuickCreate = ({
  branchId,
  customerId,
  customerName,
  customerPhone,
  deliveryAddress,
  deliveryFee,
  requireDeliveryFee = false,
}: DeliveryQuickCreateValidationInput) => {
  if (!optionalQuickCreateText(branchId)) {
    return "Selecciona una sucursal para el domicilio.";
  }

  const hasCustomerOrContact =
    Boolean(optionalQuickCreateText(customerId)) ||
    Boolean(optionalQuickCreateText(customerName));

  if (!hasCustomerOrContact) {
    return "Selecciona un cliente o escribe el contacto.";
  }

  if (!optionalQuickCreateText(customerPhone)) {
    return "Escribe el telefono de contacto.";
  }

  if (!optionalQuickCreateText(deliveryAddress)) {
    return "Escribe la direccion de entrega.";
  }

  if (requireDeliveryFee && optionalQuickCreateAmount(deliveryFee) === undefined) {
    return "Escribe el valor domicilio.";
  }

  return null;
};

export const buildDeliveryQuickCreatePayload = (
  form: DeliveryQuickCreateFormLike
): CreateDeliveryPayload => ({
  branch_id: optionalQuickCreateText(form.branchId),
  customer_id: optionalQuickCreateText(form.customerId),
  order_id: optionalQuickCreateText(form.orderId),
  sale_id: optionalQuickCreateText(form.saleId),
  driver_id: optionalQuickCreateText(form.driverId),
  customer_name: optionalQuickCreateText(form.customerName),
  customer_phone: optionalQuickCreateText(form.customerPhone),
  delivery_address: form.deliveryAddress.trim(),
  delivery_reference: optionalQuickCreateText(form.deliveryReference),
  delivery_fee: optionalQuickCreateAmount(form.deliveryFee),
  subtotal: optionalQuickCreateAmount(form.subtotal),
  total: optionalQuickCreateAmount(form.total),
  payment_method_id: optionalQuickCreateText(form.paymentMethodId),
  notes: optionalQuickCreateText(form.notes),
  metadata: {
    source: form.saleId
      ? "sale_quick_create_frontend"
      : form.orderId
        ? "order_quick_create_frontend"
        : "manual_quick_create_frontend",
    cash_session_scope: "current",
    quick_create: true,
  },
});
