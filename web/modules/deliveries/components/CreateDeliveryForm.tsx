import { useEffect, useMemo, useState } from "react";
import { listBranches } from "../../../domains/branches/api";
import type { BranchResponse } from "../../../domains/branches/dtos";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { Textarea } from "../../../components/design-system/Textarea";
import { useAppSelector } from "../../../store/hooks";
import {
  listPaymentMethods,
} from "../../finance/services/finance.service";
import type { PaymentMethod } from "../../finance/types";
import {
  getCustomers,
  type CustomerResponse,
} from "../../inventory/services/customer.service";
import {
  getOrders,
  type OrderResponse,
} from "../../inventory/services/order.service";
import { getPosSalesReport } from "../../reporteria/services/reporting.service";
import type { PosSalesListRow } from "../../reporteria/types";
import {
  buildCustomerAddressOptions,
  buildDeliveryQuickCreatePayload,
  filterCustomersForDelivery,
  getSourceTotals,
  resolveDeliveryBranch,
  validateDeliveryQuickCreate,
  type DeliveryQuickCreateFormLike,
} from "../delivery-quick-create";
import type { CreateDeliveryPayload } from "../types";

type DeliveryFormState = DeliveryQuickCreateFormLike;

const emptyForm: DeliveryFormState = {
  branchId: "",
  customerId: "",
  orderId: "",
  saleId: "",
  customerName: "",
  customerPhone: "",
  deliveryAddress: "",
  deliveryReference: "",
  deliveryFee: "",
  subtotal: "",
  total: "",
  paymentMethodId: "",
  notes: "",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

const formatDate = (value?: string | null) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
  }).format(date);
};

const shortId = (value: string) => value.slice(0, 8).toUpperCase();

const isActiveBranch = (branch: BranchResponse) => branch.estado !== "INACTIVE";

const branchLabel = (branch: BranchResponse) =>
  [branch.nombre, branch.codigo].filter(Boolean).join(" - ");

const paymentMethodLabel = (method: PaymentMethod) =>
  [method.nombre, method.tipo].filter(Boolean).join(" - ");

const orderLabel = (order: OrderResponse) =>
  [
    `Pedido ${shortId(order.id)}`,
    order.status,
    formatDate(order.createdAt),
    formatCurrency(order.total),
  ].join(" - ");

const saleLabel = (sale: PosSalesListRow) =>
  [
    `Venta ${shortId(sale.saleId)}`,
    sale.status,
    formatDate(sale.date),
    formatCurrency(sale.total),
  ].join(" - ");

export const CreateDeliveryForm = ({
  isSaving,
  onCancel,
  onSubmit,
}: {
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (payload: CreateDeliveryPayload) => Promise<void> | void;
}) => {
  const authUser = useAppSelector((state) => state.auth.user);
  const tenantId = useAppSelector(
    (state) => state.auth.user?.tenantId ?? state.auth.tenantId ?? undefined
  );
  const posBranchId = useAppSelector((state) => state.pos.branchId);
  const authBranchId = authUser?.branchId ?? null;

  const [form, setForm] = useState<DeliveryFormState>(emptyForm);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerResponse[]>([]);
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [sales, setSales] = useState<PosSalesListRow[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [salesLoading, setSalesLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [selectedAddressOptionId, setSelectedAddressOptionId] = useState("");

  const activeBranches = useMemo(
    () => branches.filter(isActiveBranch),
    [branches]
  );

  const branchResolution = useMemo(
    () =>
      resolveDeliveryBranch({
        posBranchId,
        authBranchId,
        branches: activeBranches.map((branch) => ({
          id: branch.id,
          nombre: branch.nombre,
          estado: branch.estado,
        })),
      }),
    [activeBranches, authBranchId, posBranchId]
  );

  const selectedBranch = useMemo(
    () => activeBranches.find((branch) => branch.id === form.branchId) ?? null,
    [activeBranches, form.branchId]
  );

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === form.customerId) ?? null,
    [customers, form.customerId]
  );

  const customerOptions = useMemo(() => {
    const filtered = filterCustomersForDelivery(customers, customerQuery);
    if (!selectedCustomer || filtered.some((customer) => customer.id === selectedCustomer.id)) {
      return filtered;
    }

    return [selectedCustomer, ...filtered];
  }, [customerQuery, customers, selectedCustomer]);

  const addressOptions = useMemo(
    () => buildCustomerAddressOptions(selectedCustomer),
    [selectedCustomer]
  );

  const branchIsInferred =
    Boolean(branchResolution.branchId) && branchResolution.source !== "manual";

  const branchDisplayName =
    selectedBranch?.nombre ??
    (branchResolution.source === "auth" ? authUser?.branchName : null) ??
    (branchIsInferred ? "Sucursal de sesion" : "");

  useEffect(() => {
    let isActive = true;

    setCatalogLoading(true);
    setCatalogError(null);

    Promise.allSettled([
      getCustomers(),
      listPaymentMethods({ tenantId, active: true }),
      listBranches({ tenantId }),
    ])
      .then(([customersResult, paymentMethodsResult, branchesResult]) => {
        if (!isActive) {
          return;
        }

        const failedCatalogs: string[] = [];

        if (customersResult.status === "fulfilled") {
          setCustomers(customersResult.value.filter((customer) => customer.isActive));
        } else {
          setCustomers([]);
          failedCatalogs.push("clientes");
        }

        if (paymentMethodsResult.status === "fulfilled") {
          setPaymentMethods(
            paymentMethodsResult.value.filter((method) => method.active)
          );
        } else {
          setPaymentMethods([]);
          failedCatalogs.push("metodos de pago");
        }

        if (branchesResult.status === "fulfilled") {
          setBranches(branchesResult.value.filter(isActiveBranch));
        } else {
          setBranches([]);
          failedCatalogs.push("sucursales");
        }

        setCatalogError(
          failedCatalogs.length > 0
            ? `No se pudieron cargar ${failedCatalogs.join(", ")}.`
            : null
        );
      })
      .finally(() => {
        if (isActive) {
          setCatalogLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [tenantId]);

  useEffect(() => {
    if (!branchResolution.branchId) {
      return;
    }

    setForm((prev) =>
      prev.branchId === branchResolution.branchId
        ? prev
        : { ...prev, branchId: branchResolution.branchId }
    );
  }, [branchResolution.branchId]);

  useEffect(() => {
    if (addressOptions.length === 0) {
      setSelectedAddressOptionId("");
      return;
    }

    if (!addressOptions.some((option) => option.id === selectedAddressOptionId)) {
      setSelectedAddressOptionId(addressOptions[0].id);
    }
  }, [addressOptions, selectedAddressOptionId]);

  useEffect(() => {
    if (!selectedCustomer) {
      setOrders([]);
      setOrdersError(null);
      setOrdersLoading(false);
      return;
    }

    let isActive = true;

    setOrdersLoading(true);
    setOrdersError(null);

    getOrders({
      tenantId,
      branchId: form.branchId || undefined,
    })
      .then((result) => {
        if (!isActive) {
          return;
        }

        setOrders(
          result.filter((order) => order.customerId === selectedCustomer.id)
        );
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setOrders([]);
        setOrdersError("No se pudieron cargar pedidos del cliente.");
      })
      .finally(() => {
        if (isActive) {
          setOrdersLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [form.branchId, selectedCustomer, tenantId]);

  useEffect(() => {
    if (!selectedCustomer) {
      setSales([]);
      setSalesError(null);
      setSalesLoading(false);
      return;
    }

    let isActive = true;

    setSalesLoading(true);
    setSalesError(null);

    getPosSalesReport({
      tenantId,
      branchId: form.branchId || undefined,
      customerDocument: selectedCustomer.documentNumber ?? undefined,
      customerName: selectedCustomer.name,
    })
      .then((result) => {
        if (!isActive) {
          return;
        }

        setSales(result.rows);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setSales([]);
        setSalesError("No hay servicio disponible para listar ventas/facturas.");
      })
      .finally(() => {
        if (isActive) {
          setSalesLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [form.branchId, selectedCustomer, tenantId]);

  const updateField = (field: keyof DeliveryFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setValidationMessage(null);
  };

  const handleCustomerChange = (customerId: string) => {
    const customer = customers.find((item) => item.id === customerId) ?? null;
    setValidationMessage(null);

    if (!customer) {
      setForm((prev) => ({
        ...prev,
        customerId: "",
        orderId: "",
        saleId: "",
      }));
      return;
    }

    setCustomerQuery(customer.name);
    setForm((prev) => ({
      ...prev,
      customerId: customer.id,
      orderId: "",
      saleId: "",
      customerName: customer.name,
      customerPhone: customer.phone ?? prev.customerPhone,
      deliveryAddress: customer.address ?? prev.deliveryAddress,
    }));
  };

  const handleAddressOptionChange = (addressOptionId: string) => {
    const option = addressOptions.find((item) => item.id === addressOptionId);
    setSelectedAddressOptionId(addressOptionId);
    setValidationMessage(null);

    if (!option) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      deliveryAddress: option.address,
      deliveryReference: option.reference ?? prev.deliveryReference,
    }));
  };

  const handleOrderChange = (orderId: string) => {
    const order = orders.find((item) => item.id === orderId);
    setValidationMessage(null);

    if (!order) {
      setForm((prev) => ({ ...prev, orderId: "" }));
      return;
    }

    const totals = getSourceTotals(order.total);
    setForm((prev) => ({
      ...prev,
      orderId: order.id,
      saleId: "",
      customerId: order.customerId || prev.customerId,
      customerName: order.customerName ?? prev.customerName,
      branchId: order.branchId ?? prev.branchId,
      subtotal: totals.subtotal,
      total: totals.total,
    }));
  };

  const handleSaleChange = (saleId: string) => {
    const sale = sales.find((item) => item.saleId === saleId);
    setValidationMessage(null);

    if (!sale) {
      setForm((prev) => ({ ...prev, saleId: "" }));
      return;
    }

    const totals = getSourceTotals(sale.total);
    setForm((prev) => ({
      ...prev,
      saleId: sale.saleId,
      orderId: "",
      customerName: sale.customerName || prev.customerName,
      branchId: sale.branchId || prev.branchId,
      subtotal: totals.subtotal,
      total: totals.total,
    }));
  };

  const handleSubmit = async () => {
    const nextValidationMessage = validateDeliveryQuickCreate({
      branchId: form.branchId,
      customerId: form.customerId,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      deliveryAddress: form.deliveryAddress,
      deliveryFee: form.deliveryFee,
    });

    if (nextValidationMessage) {
      setValidationMessage(nextValidationMessage);
      return;
    }

    await onSubmit(buildDeliveryQuickCreatePayload(form));
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Nuevo domicilio
          </p>
          <h2 className="text-xl font-semibold text-slate-900">
            Crear domicilio
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Busca cliente, confirma direccion y registra el domicilio sin escribir
            codigos internos.
          </p>
        </div>
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Volver al listado
        </Button>
      </div>

      {catalogError ? (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {catalogError}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Input
          label="Buscar cliente"
          placeholder="Nombre, documento, telefono o correo"
          value={customerQuery}
          onChange={(event) => setCustomerQuery(event.target.value)}
          disabled={catalogLoading}
        />
        <Select
          label="Cliente"
          value={form.customerId}
          onChange={(event) => handleCustomerChange(event.target.value)}
          disabled={catalogLoading}
          hint={
            customerQuery && customerOptions.length === 0
              ? "Sin resultados. Puedes capturar contacto manual."
              : undefined
          }
        >
          <option value="">Cliente manual / no registrado</option>
          {customerOptions.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {[customer.name, customer.documentNumber, customer.phone]
                .filter(Boolean)
                .join(" - ")}
            </option>
          ))}
        </Select>
        {branchIsInferred ? (
          <Input
            label="Sucursal"
            value={branchDisplayName}
            readOnly
            disabled
            hint="Tomada del contexto de sesion."
          />
        ) : (
          <Select
            label="Sucursal"
            value={form.branchId}
            onChange={(event) => updateField("branchId", event.target.value)}
            disabled={catalogLoading || activeBranches.length === 0}
          >
            <option value="">
              {activeBranches.length === 0
                ? "No hay sucursales activas"
                : "Selecciona una sucursal"}
            </option>
            {activeBranches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branchLabel(branch)}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Input
          label="Contacto"
          value={form.customerName}
          onChange={(event) => updateField("customerName", event.target.value)}
        />
        <Input
          label="Telefono"
          value={form.customerPhone}
          onChange={(event) => updateField("customerPhone", event.target.value)}
        />
        <Select
          label="Metodo de pago"
          value={form.paymentMethodId}
          onChange={(event) => updateField("paymentMethodId", event.target.value)}
          disabled={catalogLoading || paymentMethods.length === 0}
        >
          <option value="">
            {paymentMethods.length === 0
              ? "No hay metodos activos"
              : "Sin metodo registrado"}
          </option>
          {paymentMethods.map((method) => (
            <option key={method.id} value={method.id}>
              {paymentMethodLabel(method)}
            </option>
          ))}
        </Select>
      </div>

      {addressOptions.length > 1 ? (
        <div className="mt-4">
          <Select
            label="Direccion guardada"
            value={selectedAddressOptionId}
            onChange={(event) => handleAddressOptionChange(event.target.value)}
          >
            {addressOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} - {option.address}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Textarea
          label="Direccion de entrega"
          required
          rows={3}
          value={form.deliveryAddress}
          onChange={(event) =>
            updateField("deliveryAddress", event.target.value)
          }
        />
        <Textarea
          label="Referencia"
          rows={3}
          value={form.deliveryReference}
          onChange={(event) =>
            updateField("deliveryReference", event.target.value)
          }
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Select
          label="Pedido asociado"
          value={form.orderId}
          onChange={(event) => handleOrderChange(event.target.value)}
          disabled={!selectedCustomer || ordersLoading || Boolean(form.saleId)}
          hint={
            !selectedCustomer
              ? "Primero selecciona un cliente."
              : ordersError ?? undefined
          }
        >
          <option value="">
            {ordersLoading ? "Cargando pedidos..." : "Sin pedido asociado"}
          </option>
          {!ordersLoading && selectedCustomer && orders.length === 0 ? (
            <option value="" disabled>
              No hay pedidos disponibles
            </option>
          ) : null}
          {orders.map((order) => (
            <option key={order.id} value={order.id}>
              {orderLabel(order)}
            </option>
          ))}
        </Select>
        <Select
          label="Venta o factura asociada"
          value={form.saleId}
          onChange={(event) => handleSaleChange(event.target.value)}
          disabled={!selectedCustomer || salesLoading || Boolean(form.orderId)}
          hint={
            !selectedCustomer
              ? "Primero selecciona un cliente."
              : salesError ?? undefined
          }
        >
          <option value="">
            {salesLoading ? "Cargando ventas..." : "Sin venta/factura asociada"}
          </option>
          {!salesLoading && selectedCustomer && sales.length === 0 ? (
            <option value="" disabled>
              No hay ventas/facturas disponibles
            </option>
          ) : null}
          {sales.map((sale) => (
            <option key={sale.saleId} value={sale.saleId}>
              {saleLabel(sale)}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Input
          label="Valor domicilio"
          type="number"
          min="0"
          step="0.01"
          value={form.deliveryFee}
          onChange={(event) => updateField("deliveryFee", event.target.value)}
        />
        <Input
          label="Subtotal"
          type="number"
          min="0"
          step="0.01"
          value={form.subtotal}
          onChange={(event) => updateField("subtotal", event.target.value)}
          hint={
            form.orderId || form.saleId
              ? `Calculado desde ${form.orderId ? "pedido" : "venta/factura"}.`
              : undefined
          }
        />
        <Input
          label="Total"
          type="number"
          min="0"
          step="0.01"
          value={form.total}
          onChange={(event) => updateField("total", event.target.value)}
          hint={
            form.orderId || form.saleId
              ? `Calculado desde ${form.orderId ? "pedido" : "venta/factura"}.`
              : undefined
          }
        />
      </div>

      <div className="mt-4">
        <Textarea
          label="Notas"
          rows={3}
          value={form.notes}
          onChange={(event) => updateField("notes", event.target.value)}
        />
      </div>

      {validationMessage ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {validationMessage}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button onClick={() => void handleSubmit()} isLoading={isSaving}>
          Crear domicilio
        </Button>
      </div>
    </section>
  );
};
