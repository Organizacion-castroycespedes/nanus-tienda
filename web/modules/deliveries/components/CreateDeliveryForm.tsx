import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { listBranches } from "../../../domains/branches/api";
import type { BranchResponse } from "../../../domains/branches/dtos";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { Textarea } from "../../../components/design-system/Textarea";
import { useAppSelector } from "../../../store/hooks";
import {
  getCurrentCashSession,
  listPaymentMethods,
} from "../../finance/services/finance.service";
import type { CashSession, PaymentMethod } from "../../finance/types";
import {
  getCustomers,
  type CustomerResponse,
} from "../../inventory/services/customer.service";
import {
  getOrders,
  type OrderResponse,
} from "../../inventory/services/order.service";
import {
  getSales,
  type SaleResponse,
} from "../../inventory/services/sale.service";
import {
  buildCustomerAddressOptions,
  buildDeliveryQuickCreatePayload,
  resolveDeliveryBranch,
  validateDeliveryQuickCreate,
  type DeliveryQuickCreateFormLike,
} from "../delivery-quick-create";
import {
  calculateDeliveryTotals,
  formatMoneyInput,
  type DeliverySourceKind,
} from "../delivery-totals";
import {
  getDeliveryByOrder,
  getDeliveryBySale,
} from "../services/deliveries.service";
import { listDeliveryDrivers } from "../services/delivery-drivers.service";
import {
  canManageDeliveryDrivers,
  findDeliveryPermission,
} from "../delivery-permissions";
import type {
  CreateDeliveryPayload,
  DeliveryDriver,
  DeliveryRecord,
} from "../types";

type DeliveryFormState = DeliveryQuickCreateFormLike;

const emptyForm: DeliveryFormState = {
  branchId: "",
  customerId: "",
  orderId: "",
  saleId: "",
  driverId: "",
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
const getParamValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

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

const saleLabel = (sale: SaleResponse) =>
  [
    `Venta ${shortId(sale.id)}`,
    sale.status,
    formatDate(sale.createdAt),
    formatCurrency(sale.total),
  ].join(" - ");

const isDeliveryReadyOrder = (order: OrderResponse) => order.status !== "CANCELLED";

const isDeliveryReadySale = (sale: SaleResponse) =>
  sale.status !== "CANCELLED" && sale.status !== "REFUNDED";

const driverLabel = (driver: DeliveryDriver) =>
  [driver.name, driver.phone].filter(Boolean).join(" - ");

export const CreateDeliveryForm = ({
  isSaving,
  onCancel,
  onSubmit,
}: {
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (payload: CreateDeliveryPayload) => Promise<void> | void;
}) => {
  const router = useRouter();
  const params = useParams<{ tenant?: string | string[] }>();
  const authUser = useAppSelector((state) => state.auth.user);
  const role = (
    useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? "") ??
    ""
  )
    .trim()
    .toUpperCase();
  const authPermissions = useAppSelector((state) => state.auth.permissions);
  const tenantId = useAppSelector(
    (state) => state.auth.user?.tenantId ?? state.auth.tenantId ?? undefined
  );
  const posBranchId = useAppSelector((state) => state.pos.branchId);
  const posCashRegisterId = useAppSelector((state) => state.pos.cashRegisterId);
  const posSessionId = useAppSelector((state) => state.pos.posSessionId);
  const authBranchId = authUser?.branchId ?? null;
  const tenantSlug =
    getParamValue(params?.tenant) ??
    tenantId ??
    "default";

  const [form, setForm] = useState<DeliveryFormState>(emptyForm);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerResponse[]>([]);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerResponse | null>(null);
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [currentCashSession, setCurrentCashSession] =
    useState<CashSession | null>(null);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [sales, setSales] = useState<SaleResponse[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [cashSessionLoading, setCashSessionLoading] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [driversLoading, setDriversLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [salesLoading, setSalesLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [customersError, setCustomersError] = useState<string | null>(null);
  const [driversError, setDriversError] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [existingDelivery, setExistingDelivery] =
    useState<DeliveryRecord | null>(null);
  const [existingDeliveryError, setExistingDeliveryError] = useState<string | null>(
    null
  );
  const [existingDeliveryLoading, setExistingDeliveryLoading] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [selectedAddressOptionId, setSelectedAddressOptionId] = useState("");

  const activeBranches = useMemo(
    () => branches.filter(isActiveBranch),
    [branches]
  );

  const deliveryPermission = useMemo(
    () => findDeliveryPermission(authPermissions),
    [authPermissions]
  );

  const canManageDrivers = canManageDeliveryDrivers(deliveryPermission, role);

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

  const customerOptions = useMemo(() => {
    const activeCustomers = customers.filter((customer) => customer.isActive);
    if (
      !selectedCustomer ||
      activeCustomers.some((customer) => customer.id === selectedCustomer.id)
    ) {
      return activeCustomers;
    }

    return [selectedCustomer, ...activeCustomers];
  }, [customers, selectedCustomer]);

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

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === form.orderId) ?? null,
    [form.orderId, orders]
  );

  const selectedSale = useMemo(
    () => sales.find((sale) => sale.id === form.saleId) ?? null,
    [form.saleId, sales]
  );

  const sourceKind: DeliverySourceKind = form.saleId
    ? "sale"
    : form.orderId
      ? "order"
      : "manual";

  const existingDeliveryHref = existingDelivery
    ? `/${tenantSlug}/deliveries?${
        existingDelivery.order_id
          ? `order_id=${encodeURIComponent(existingDelivery.order_id)}`
          : `sale_id=${encodeURIComponent(existingDelivery.sale_id ?? "")}`
      }`
    : "";

  useEffect(() => {
    let isActive = true;

    setCatalogLoading(true);
    setCatalogError(null);

    Promise.allSettled([
      listPaymentMethods({ tenantId, active: true }),
      listBranches({ tenantId }),
    ])
      .then(([paymentMethodsResult, branchesResult]) => {
        if (!isActive) {
          return;
        }

        const failedCatalogs: string[] = [];

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
    let isActive = true;

    setCashSessionLoading(true);
    getCurrentCashSession(posCashRegisterId ?? undefined)
      .then((session) => {
        if (isActive) {
          setCurrentCashSession(session);
        }
      })
      .catch(() => {
        if (isActive) {
          setCurrentCashSession(null);
        }
      })
      .finally(() => {
        if (isActive) {
          setCashSessionLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [posCashRegisterId, posSessionId]);

  useEffect(() => {
    let isActive = true;

    setDriversLoading(true);
    setDriversError(null);

    listDeliveryDrivers({ active: true })
      .then((result) => {
        if (isActive) {
          setDrivers(result.filter((driver) => driver.active));
        }
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setDrivers([]);
        setDriversError(
          "No se pudieron cargar repartidores. Verifica V066__delivery_drivers.sql."
        );
      })
      .finally(() => {
        if (isActive) {
          setDriversLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    setCustomersLoading(true);
    setCustomersError(null);

    getCustomers({
      query: customerQuery,
      limit: 25,
    })
      .then((result) => {
        if (!isActive) {
          return;
        }

        setCustomers(result.filter((customer) => customer.isActive));
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setCustomers([]);
        setCustomersError("No se pudieron buscar clientes.");
      })
      .finally(() => {
        if (isActive) {
          setCustomersLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [customerQuery]);

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
      customerId: selectedCustomer.id,
    })
      .then((result) => {
        if (!isActive) {
          return;
        }

        setOrders(result.filter(isDeliveryReadyOrder));
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

    getSales({
      branchId: form.branchId || undefined,
      customerId: selectedCustomer.id,
    })
      .then((result) => {
        if (!isActive) {
          return;
        }

        setSales(result.filter(isDeliveryReadySale));
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

  const getSourceSubtotal = useCallback(
    (nextSource: DeliverySourceKind, order?: OrderResponse | null, sale?: SaleResponse | null) => {
      if (nextSource === "sale") {
        return sale?.total ?? selectedSale?.total ?? 0;
      }
      if (nextSource === "order") {
        return order?.total ?? selectedOrder?.total ?? 0;
      }
      return 0;
    },
    [selectedOrder, selectedSale]
  );

  const withCalculatedTotals = useCallback(
    (
      nextForm: DeliveryFormState,
      options: {
        source?: DeliverySourceKind;
        sourceSubtotal?: number | string | null;
        deliveryFee?: string;
      } = {}
    ): DeliveryFormState => {
      const nextSource =
        options.source ??
        (nextForm.saleId ? "sale" : nextForm.orderId ? "order" : "manual");
      const totals = calculateDeliveryTotals({
        source: nextSource,
        sourceSubtotal:
          options.sourceSubtotal ??
          (nextSource === "manual" ? 0 : nextForm.subtotal),
        deliveryFee: options.deliveryFee ?? nextForm.deliveryFee,
      });

      return {
        ...nextForm,
        subtotal: formatMoneyInput(totals.sourceSubtotal),
        total: formatMoneyInput(totals.total),
      };
    },
    []
  );

  const detectExistingDelivery = useCallback(
    async ({ orderId, saleId }: { orderId?: string; saleId?: string }) => {
      setExistingDelivery(null);
      setExistingDeliveryError(null);

      if (!orderId && !saleId) {
        return;
      }

      setExistingDeliveryLoading(true);
      try {
        const existing = saleId
          ? await getDeliveryBySale("", saleId)
          : orderId
            ? await getDeliveryByOrder("", orderId)
            : null;
        setExistingDelivery(existing);
      } catch {
        setExistingDeliveryError(
          "No se pudo verificar si ya existe un domicilio asociado."
        );
      } finally {
        setExistingDeliveryLoading(false);
      }
    },
    []
  );

  const updateField = (field: keyof DeliveryFormState, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "deliveryFee") {
        return withCalculatedTotals(next, {
          source: sourceKind,
          sourceSubtotal: getSourceSubtotal(sourceKind),
          deliveryFee: value,
        });
      }
      return next;
    });
    setValidationMessage(null);
  };

  const handleCustomerChange = (customerId: string) => {
    const customer =
      customerOptions.find((item) => item.id === customerId) ?? null;
    setValidationMessage(null);
    setExistingDelivery(null);
    setExistingDeliveryError(null);

    if (!customer) {
      setSelectedCustomer(null);
      setForm((prev) => ({
        ...prev,
        customerId: "",
        orderId: "",
        saleId: "",
        subtotal: "0.00",
        total: formatMoneyInput(prev.deliveryFee),
      }));
      return;
    }

    setSelectedCustomer(customer);
    setCustomerQuery(customer.name);
    setForm((prev) => ({
      ...withCalculatedTotals(
        {
          ...prev,
          customerId: customer.id,
          orderId: "",
          saleId: "",
          customerName: customer.name,
          customerPhone: customer.phone ?? prev.customerPhone,
          deliveryAddress: customer.address ?? prev.deliveryAddress,
        },
        { source: "manual", sourceSubtotal: 0 }
      ),
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
      setExistingDelivery(null);
      setExistingDeliveryError(null);
      setForm((prev) =>
        withCalculatedTotals(
          {
            ...prev,
            orderId: "",
            saleId: "",
          },
          { source: "manual", sourceSubtotal: 0 }
        )
      );
      return;
    }

    const linkedSaleId = order.generatedSaleId ?? "";
    const linkedSale = linkedSaleId
      ? sales.find((sale) => sale.id === linkedSaleId) ?? null
      : null;
    setForm((prev) => ({
      ...withCalculatedTotals(
        {
          ...prev,
          orderId: order.id,
          saleId: linkedSaleId,
          customerId: order.customerId || prev.customerId,
          customerName: order.customerName ?? prev.customerName,
          branchId: order.branchId ?? prev.branchId,
        },
        {
          source: linkedSaleId ? "sale" : "order",
          sourceSubtotal: linkedSale?.total ?? order.total,
        }
      ),
    }));
    void detectExistingDelivery({
      orderId: order.id,
      saleId: linkedSaleId || undefined,
    });
  };

  const handleSaleChange = (saleId: string) => {
    const sale = sales.find((item) => item.id === saleId);
    setValidationMessage(null);

    if (!sale) {
      setExistingDelivery(null);
      setExistingDeliveryError(null);
      setForm((prev) =>
        withCalculatedTotals(
          {
            ...prev,
            orderId: "",
            saleId: "",
          },
          { source: "manual", sourceSubtotal: 0 }
        )
      );
      return;
    }

    setForm((prev) => ({
      ...withCalculatedTotals(
        {
          ...prev,
          saleId: sale.id,
          orderId: sale.orderId ?? "",
          customerId: sale.customerId || prev.customerId,
          customerName: sale.customerName || prev.customerName,
          branchId: sale.branchId || prev.branchId,
        },
        { source: "sale", sourceSubtotal: sale.total }
      ),
    }));
    void detectExistingDelivery({
      orderId: sale.orderId ?? undefined,
      saleId: sale.id,
    });
  };

  const clearSourceSelection = () => {
    setExistingDelivery(null);
    setExistingDeliveryError(null);
    setValidationMessage(null);
    setForm((prev) =>
      withCalculatedTotals(
        {
          ...prev,
          orderId: "",
          saleId: "",
        },
        { source: "manual", sourceSubtotal: 0 }
      )
    );
  };

  const handleSubmit = async () => {
    const totals = calculateDeliveryTotals({
      source: sourceKind,
      sourceSubtotal: form.subtotal,
      deliveryFee: form.deliveryFee,
    });

    if (totals.hasNegativeDeliveryFee) {
      setValidationMessage("Valor domicilio no puede ser negativo.");
      return;
    }

    if (existingDelivery) {
      setValidationMessage(
        "Ya existe un domicilio para este pedido o venta. Usa Ver/Gestionar domicilio."
      );
      return;
    }

    if ((totals.deliveryFee > 0 || form.paymentMethodId) && !currentCashSession) {
      setValidationMessage(
        "Abre una caja antes de crear domicilios con valor o metodo de pago."
      );
      return;
    }

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

    await onSubmit(
      buildDeliveryQuickCreatePayload({
        ...form,
        subtotal: formatMoneyInput(totals.sourceSubtotal),
        total: formatMoneyInput(totals.total),
      })
    );
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-800 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Nuevo domicilio
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Crear domicilio
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
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

      <div
        className={`mt-5 rounded-lg border p-3 text-sm ${
          currentCashSession
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        <p>
          {currentCashSession
            ? `Caja actual: ${
                currentCashSession.cashRegisterNombre ??
                currentCashSession.cashRegisterCodigo ??
                currentCashSession.id
              }. Los domicilios con valor se asociaran a esta caja.`
            : cashSessionLoading
              ? "Verificando caja actual..."
              : "No tienes una caja abierta. Solo puedes crear domicilios sin valor y sin metodo de pago."}
        </p>
        {!currentCashSession && !cashSessionLoading ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => router.push(`/${tenantSlug}/pos/select-context`)}
            disabled={isSaving}
          >
            Ir a POS / Seleccionar caja
          </Button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Input
          label="Buscar cliente"
          placeholder="Nombre, documento, telefono o correo"
          value={customerQuery}
          onChange={(event) => setCustomerQuery(event.target.value)}
          disabled={customersLoading}
          hint={
            customersError ??
            (customersLoading ? "Buscando clientes..." : undefined)
          }
        />
        <Select
          label="Cliente"
          value={form.customerId}
          onChange={(event) => handleCustomerChange(event.target.value)}
          disabled={customersLoading}
          hint={
            customerQuery && customerOptions.length === 0 && !customersLoading
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

      <div className="mt-4 grid gap-4 lg:grid-cols-4">
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
        <Select
          label="Repartidor"
          value={form.driverId}
          onChange={(event) => updateField("driverId", event.target.value)}
          disabled={driversLoading || drivers.length === 0}
          hint={
            driversError ??
            (driversLoading
              ? "Cargando repartidores..."
              : drivers.length === 0
                ? "No hay repartidores activos."
                : "Opcional. No cambia estado.")
          }
        >
          <option value="">
            {driversLoading
              ? "Cargando repartidores..."
              : drivers.length === 0
                ? "No hay repartidores activos"
                : "Sin repartidor asignado"}
          </option>
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driverLabel(driver)}
            </option>
          ))}
        </Select>
      </div>

      {canManageDrivers ? (
        <div className="mt-2 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${tenantSlug}/deliveries/drivers`)}
            disabled={isSaving}
          >
            Gestionar repartidores
          </Button>
        </div>
      ) : null}

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
              : form.saleId && form.orderId
                ? "Inferido desde la venta/factura seleccionada."
                : ordersError ?? undefined
          }
        >
          <option value="">
            {ordersLoading ? "Cargando pedidos..." : "Sin pedido asociado"}
          </option>
          {form.orderId && !orders.some((order) => order.id === form.orderId) ? (
            <option value={form.orderId}>
              Pedido asociado {shortId(form.orderId)}
            </option>
          ) : null}
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
              : form.orderId && form.saleId
                ? "Inferida desde el pedido seleccionado."
                : salesError ?? undefined
          }
        >
          <option value="">
            {salesLoading ? "Cargando ventas..." : "Sin venta/factura asociada"}
          </option>
          {form.saleId && !sales.some((sale) => sale.id === form.saleId) ? (
            <option value={form.saleId}>
              Venta asociada {shortId(form.saleId)}
            </option>
          ) : null}
          {!salesLoading && selectedCustomer && sales.length === 0 ? (
            <option value="" disabled>
              No hay ventas/facturas disponibles
            </option>
          ) : null}
          {sales.map((sale) => (
            <option key={sale.id} value={sale.id}>
              {saleLabel(sale)}
            </option>
          ))}
        </Select>
      </div>

      {form.orderId || form.saleId ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
          <span>
            Origen seleccionado:
            {form.saleId
              ? ` venta/factura ${shortId(form.saleId)}`
              : ` pedido ${shortId(form.orderId)}`}
            {form.orderId && form.saleId
              ? ` con pedido ${shortId(form.orderId)}`
              : ""}
            .
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={clearSourceSelection}
            disabled={isSaving}
          >
            Limpiar origen
          </Button>
        </div>
      ) : null}

      {existingDeliveryLoading ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:text-slate-300">
          Verificando domicilio asociado...
        </div>
      ) : null}

      {existingDelivery ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span>
            Ya existe un domicilio para este flujo:
            {" "}
            {existingDelivery.delivery_number}.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(existingDeliveryHref)}
          >
            Ver/Gestionar domicilio
          </Button>
        </div>
      ) : null}

      {existingDeliveryError ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {existingDeliveryError}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Input
          label="Valor domicilio"
          type="number"
          min="0"
          step="0.01"
          value={form.deliveryFee}
          onChange={(event) => updateField("deliveryFee", event.target.value)}
          hint="Se suma al total operativo del domicilio."
        />
        <Input
          label="Subtotal"
          type="number"
          min="0"
          step="0.01"
          value={form.subtotal}
          readOnly
          hint={
            sourceKind === "manual"
              ? "Manual: subtotal 0."
              : `Calculado desde ${sourceKind === "order" ? "pedido" : "venta/factura"} (${formatCurrency(Number(form.subtotal || 0))}).`
          }
        />
        <Input
          label="Total"
          type="number"
          min="0"
          step="0.01"
          value={form.total}
          readOnly
          hint={`Total calculado: ${formatCurrency(Number(form.total || 0))}.`}
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
