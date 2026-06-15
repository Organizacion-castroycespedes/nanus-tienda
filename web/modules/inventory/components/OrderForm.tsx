"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { listBranches } from "../../../domains/branches/api";
import type { BranchResponse } from "../../../domains/branches/dtos";
import { getAuthContext } from "../../../domains/pos/api";
import type { PosBranch } from "../../../domains/pos/types";
import type { ProductResponse } from "../../../domains/products/dtos";
import { useConfirm } from "../../../hooks/use-confirm";
import { useInventoryScope } from "../../../hooks/useInventoryScope";
import { buildConfirmFromApiError } from "../../../lib/api-messages";
import { useAppSelector } from "../../../store/hooks";
import { getCustomers, type CustomerResponse } from "../services/customer.service";
import {
  createOrder,
  updateOrder,
  type OrderDetailResponse,
  type OrderResponse,
} from "../services/order.service";
import { getProducts } from "../services/product.service";
import type { OrderPeripheralContext } from "../../../domains/peripherals/order-integration";

type OrderFormItem = {
  productId: string;
  quantity: string;
  price: string;
};

type OrderFormValues = {
  customerId: string;
  branchId: string;
  type: "CASH" | "CREDIT";
  items: OrderFormItem[];
};

type OrderFormErrors = {
  customerId?: string;
  branchId?: string;
  terminalId?: string;
  items?: string;
  submit?: string;
};

type OrderFormProps = {
  mode?: "create" | "edit";
  order?: OrderDetailResponse | null;
  onCancel: () => void;
  onSuccess: (
    response?: OrderResponse,
    peripheralContext?: OrderPeripheralContext
  ) => void;
};

const createEmptyItem = (): OrderFormItem => ({
  productId: "",
  quantity: "",
  price: "",
});

const getProductDefaultPrice = (product: ProductResponse | undefined) => {
  const price = Number(product?.price);
  return Number.isFinite(price) && price > 0 ? String(price) : "";
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

const mapOrderToValues = (
  order: OrderDetailResponse | null | undefined,
  fallbackBranchId: string
): OrderFormValues => ({
  customerId: order?.customerId ?? "",
  branchId: order?.branchId ?? fallbackBranchId,
  type: order?.type ?? "CASH",
  items:
    order?.items.map((item) => ({
      productId: item.productId,
      quantity: String(item.orderedQuantity),
      price: String(item.price),
    })) ?? [createEmptyItem()],
});

export const OrderForm = ({
  mode = "create",
  order,
  onCancel,
  onSuccess,
}: OrderFormProps) => {
  const { currentBranch, currentTenant } = useInventoryScope();
  const confirm = useConfirm();
  const authUser = useAppSelector((state) => state.auth.user);
  const authRole = useAppSelector((state) => state.auth.role ?? null);
  const currentPosBranchId = useAppSelector((state) => state.pos.branchId);
  const currentPosTerminalId = useAppSelector((state) => state.pos.terminalId);
  const role = authUser?.role ?? authRole;
  const authBranchName = authUser?.branchName ?? null;
  const [values, setValues] = useState<OrderFormValues>(() =>
    mapOrderToValues(order, currentBranch ?? "")
  );
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customers, setCustomers] = useState<CustomerResponse[]>([]);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [contextBranches, setContextBranches] = useState<PosBranch[]>([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState("");
  const [terminalLoading, setTerminalLoading] = useState(false);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const canSelectBranch =
    role === "SUPER_ADMIN" || role === "SUPER_USER" || role === "ADMIN" || role === "USER";

  useEffect(() => {
    setValues(mapOrderToValues(order, currentBranch ?? ""));
  }, [currentBranch, order]);

  useEffect(() => {
    if (mode === "edit" || !currentBranch) {
      return;
    }
    setValues((prev) =>
      prev.branchId === currentBranch ? prev : { ...prev, branchId: currentBranch }
    );
  }, [currentBranch, mode]);

  useEffect(() => {
    let mounted = true;

    const loadCatalogs = async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const branchPromise =
          canSelectBranch && currentTenant
            ? listBranches({ tenantId: currentTenant })
            : Promise.resolve<BranchResponse[]>([]);
        const [customersResult, productsResult, branchesResult] = await Promise.all([
          getCustomers(),
          getProducts({ branchId: values.branchId || currentBranch || undefined }),
          branchPromise,
        ]);

        if (!mounted) {
          return;
        }

        setCustomers(customersResult.filter((customer) => customer.isActive));
        setProducts(productsResult.filter((product) => product.isActive));
        setBranches(branchesResult.filter((branch) => branch.estado === "ACTIVE"));
      } catch {
        if (mounted) {
          setCatalogError("No se pudieron cargar clientes, productos o sucursales.");
        }
      } finally {
        if (mounted) {
          setCatalogLoading(false);
        }
      }
    };

    void loadCatalogs();

    return () => {
      mounted = false;
    };
  }, [canSelectBranch, currentTenant, currentBranch, values.branchId]);

  useEffect(() => {
    let mounted = true;

    const loadContextBranches = async () => {
      setTerminalLoading(true);
      setTerminalError(null);
      try {
        const response = await getAuthContext();
        if (!mounted) {
          return;
        }

        const targetTenantId = currentTenant ?? authUser?.tenantId ?? null;
        const tenantBranches = response.tenants
          .filter((tenant) => !targetTenantId || tenant.id === targetTenantId)
          .flatMap((tenant) => tenant.branches);
        setContextBranches(tenantBranches);
      } catch {
        if (mounted) {
          setTerminalError("No se pudieron cargar las terminales disponibles.");
          setContextBranches([]);
        }
      } finally {
        if (mounted) {
          setTerminalLoading(false);
        }
      }
    };

    void loadContextBranches();

    return () => {
      mounted = false;
    };
  }, [authUser?.tenantId, currentTenant]);

  const selectedBranchName = useMemo(() => {
    if (canSelectBranch) {
      return branches.find((branch) => branch.id === values.branchId)?.nombre ?? "";
    }
    return authBranchName ?? values.branchId;
  }, [authBranchName, branches, canSelectBranch, values.branchId]);

  const selectedBranchTerminals = useMemo(
    () =>
      contextBranches.find((branch) => branch.id === values.branchId)?.terminals ?? [],
    [contextBranches, values.branchId]
  );

  useEffect(() => {
    if (mode !== "create") {
      return;
    }
    if (!values.branchId) {
      setSelectedTerminalId("");
      return;
    }
    if (currentPosBranchId === values.branchId && currentPosTerminalId) {
      setSelectedTerminalId("");
      return;
    }
    if (
      selectedTerminalId &&
      selectedBranchTerminals.some((terminal) => terminal.id === selectedTerminalId)
    ) {
      return;
    }

    setSelectedTerminalId(selectedBranchTerminals[0]?.id ?? "");
  }, [
    currentPosBranchId,
    currentPosTerminalId,
    mode,
    selectedBranchTerminals,
    selectedTerminalId,
    values.branchId,
  ]);

  const resolvedTerminalId = useMemo(() => {
    if (mode !== "create") {
      return undefined;
    }
    if (currentPosBranchId === values.branchId && currentPosTerminalId) {
      return currentPosTerminalId;
    }
    return selectedTerminalId || undefined;
  }, [currentPosBranchId, currentPosTerminalId, mode, selectedTerminalId, values.branchId]);

  const resolvedTerminalName = useMemo(
    () =>
      selectedBranchTerminals.find((terminal) => terminal.id === resolvedTerminalId)
        ?.name ?? "",
    [resolvedTerminalId, selectedBranchTerminals]
  );

  const itemSubtotals = useMemo(
    () =>
      values.items.map((item) => {
        const quantity = Number(item.quantity);
        const price = Number(item.price);

        if (!Number.isFinite(quantity) || !Number.isFinite(price)) {
          return 0;
        }

        return quantity * price;
      }),
    [values.items]
  );

  const total = useMemo(
    () => itemSubtotals.reduce((sum, subtotal) => sum + subtotal, 0),
    [itemSubtotals]
  );

  const validate = () => {
    const nextErrors: OrderFormErrors = {};

    if (!values.customerId) {
      nextErrors.customerId = "Debes seleccionar un cliente.";
    }

    if (!values.branchId) {
      nextErrors.branchId = "Debes seleccionar una sucursal.";
    }

    if (mode === "create" && !resolvedTerminalId) {
      nextErrors.terminalId =
        values.branchId && !terminalLoading
          ? "La sucursal seleccionada no tiene terminal activa disponible."
          : "Selecciona una terminal antes de crear el pedido.";
    }

    if (
      mode === "create" &&
      resolvedTerminalId === currentPosTerminalId &&
      currentPosBranchId &&
      values.branchId &&
      currentPosBranchId !== values.branchId
    ) {
      nextErrors.terminalId =
        "La terminal seleccionada no pertenece a la sucursal del pedido.";
    }

    const hasInvalidItems = values.items.some((item) => {
      const quantity = Number(item.quantity);
      const price = Number(item.price);
      return (
        !item.productId ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(price) ||
        price < 0
      );
    });

    if (values.items.length === 0 || hasInvalidItems) {
      nextErrors.items =
        "Todos los items deben tener producto, cantidad mayor a 0 y precio valido.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleItemChange = (
    index: number,
    field: keyof OrderFormItem,
    value: string
  ) => {
    setValues((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
              ...(field === "productId"
                ? {
                    price: getProductDefaultPrice(
                      products.find((product) => product.id === value)
                    ),
                  }
                : {}),
            }
          : item
      ),
    }));
    setErrors((prev) => ({ ...prev, items: undefined, submit: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const payload = {
        customerId: values.customerId,
        branchId: values.branchId,
        type: values.type,
        total,
        items: values.items.map((item, index) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          price: Number(item.price),
          subtotal: itemSubtotals[index] ?? 0,
        })),
      };

      const response =
        mode === "edit" && order
          ? await updateOrder(order.id, payload)
          : await createOrder({
              ...payload,
              terminalId: resolvedTerminalId,
            });
      const selectedCustomer = customers.find(
        (customer) => customer.id === values.customerId
      );
      const peripheralContext: OrderPeripheralContext = {
        orderId: response.id,
        orderNumber: response.id,
        documentNumber: response.id,
        date: response.createdAt,
        businessName: response.tenantName ?? authUser?.tenantName ?? "Manus POS",
        branchName: response.branchName ?? selectedBranchName,
        cashier: authUser?.name ?? authUser?.email ?? undefined,
        customerName: response.customerName ?? selectedCustomer?.name ?? "Cliente",
        status: response.status,
        items: values.items.map((item, index) => {
          const product = products.find((candidate) => candidate.id === item.productId);
          const quantity = Number(item.quantity);
          const price = Number(item.price);

          return {
            name: product?.name ?? item.productId,
            quantity,
            unitPrice: price,
            total: itemSubtotals[index] ?? 0,
          };
        }),
        subtotal: total,
        taxes: 0,
        discounts: 0,
        total: response.total ?? total,
        balanceDue: response.balanceDue,
        payments: [],
      };

      onSuccess(response, peripheralContext);
    } catch (error) {
      const fallback =
        mode === "edit" ? "No se pudo actualizar el pedido." : "No se pudo guardar el pedido.";
      setErrors({
        submit: fallback,
      });
      const dialog = buildConfirmFromApiError(error, fallback);
      await confirm({
        ...dialog,
        confirmText: "Entendido",
        hideCancel: true,
      }).catch(() => undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = mode === "edit" ? "Editar pedido" : "Crear pedido";
  const submitLabel = mode === "edit" ? "Guardar cambios" : "Guardar pedido";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Orders</p>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm text-slate-600">
            Registra el cliente, la sucursal, el tipo de pedido y los items.
          </p>
        </div>
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
      </div>

      <form className="grid gap-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Select
              label="Cliente"
              required
              value={values.customerId}
              disabled={catalogLoading || customers.length === 0}
              onChange={(event) => {
                setValues((prev) => ({ ...prev, customerId: event.target.value }));
                setErrors((prev) => ({ ...prev, customerId: undefined, submit: undefined }));
              }}
            >
              <option value="">
                {catalogLoading ? "Cargando..." : "Selecciona un cliente"}
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
            {errors.customerId ? <p className="text-xs text-rose-600">{errors.customerId}</p> : null}
          </div>

          {canSelectBranch ? (
            <div className="space-y-1">
              <Select
                label="Sucursal"
                required
                value={values.branchId}
                disabled={catalogLoading || branches.length === 0}
                onChange={(event) => {
                  setValues((prev) => ({ ...prev, branchId: event.target.value }));
                  setSelectedTerminalId("");
                  setErrors((prev) => ({
                    ...prev,
                    branchId: undefined,
                    terminalId: undefined,
                    submit: undefined,
                  }));
                }}
              >
                <option value="">
                  {catalogLoading ? "Cargando..." : "Selecciona una sucursal"}
                </option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.nombre}
                  </option>
                ))}
              </Select>
              {errors.branchId ? <p className="text-xs text-rose-600">{errors.branchId}</p> : null}
            </div>
          ) : (
            <div className="space-y-1">
              <Input label="Sucursal" value={selectedBranchName} disabled readOnly />
            </div>
          )}

          {mode === "create" ? (
            <div className="space-y-1">
              {selectedBranchTerminals.length > 1 ? (
                <Select
                  label="Terminal"
                  required
                  value={resolvedTerminalId ?? ""}
                  disabled={terminalLoading}
                  onChange={(event) => {
                    setSelectedTerminalId(event.target.value);
                    setErrors((prev) => ({
                      ...prev,
                      terminalId: undefined,
                      submit: undefined,
                    }));
                  }}
                >
                  <option value="">
                    {terminalLoading ? "Cargando..." : "Selecciona una terminal"}
                  </option>
                  {selectedBranchTerminals.map((terminal) => (
                    <option key={terminal.id} value={terminal.id}>
                      {terminal.name} ({terminal.code})
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  label="Terminal"
                  value={
                    terminalLoading
                      ? "Cargando..."
                      : resolvedTerminalName || "Sin terminal activa"
                  }
                  disabled
                  readOnly
                />
              )}
              {terminalError ? (
                <p className="text-xs text-amber-700">{terminalError}</p>
              ) : null}
              {errors.terminalId ? (
                <p className="text-xs text-rose-600">{errors.terminalId}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-1">
          <Select
            label="Tipo"
            value={values.type}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                type: event.target.value as "CASH" | "CREDIT",
              }))
            }
          >
            <option value="CASH">CASH</option>
            <option value="CREDIT">CREDIT</option>
          </Select>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Items</h3>
              <p className="text-sm text-slate-600">
                Agrega productos, cantidades y precios para calcular el total.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                setValues((prev) => ({
                  ...prev,
                  items: [...prev.items, createEmptyItem()],
                }))
              }
            >
              <Plus className="h-4 w-4" />
              Agregar item
            </Button>
          </div>

          <div className="grid gap-4">
            {values.items.map((item, index) => {
              const selectedProduct = products.find((product) => product.id === item.productId);
              const selectedProductPrice = Number(selectedProduct?.price);
              const productHasNoDefaultPrice =
                Boolean(selectedProduct) &&
                (!Number.isFinite(selectedProductPrice) || selectedProductPrice <= 0);

              return (
                <div
                  key={`${index}-${item.productId}`}
                  className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto]"
                >
                  <Select
                    label="Producto"
                    value={item.productId}
                    disabled={catalogLoading || products.length === 0}
                    onChange={(event) =>
                      handleItemChange(index, "productId", event.target.value)
                    }
                  >
                    <option value="">
                      {catalogLoading ? "Cargando..." : "Selecciona un producto"}
                    </option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </Select>

                  <Input
                    label="Cantidad pedida"
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.quantity}
                    onChange={(event) =>
                      handleItemChange(index, "quantity", event.target.value)
                    }
                  />

                  <Input
                    label="Entregado"
                    type="number"
                    min="0"
                    step="0.01"
                    value={mode === "edit" && order ? String(order.items[index]?.deliveredQuantity ?? 0) : "0"}
                    disabled
                    readOnly
                  />

                  <div className="space-y-1">
                    <Input
                      label="Precio"
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={(event) => handleItemChange(index, "price", event.target.value)}
                    />
                    {productHasNoDefaultPrice ? (
                      <p className="text-xs text-amber-700">
                        Este producto no tiene precio registrado. Ingresa el precio manualmente.
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-end gap-2">
                    <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Subtotal
                      </p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {formatCurrency(itemSubtotals[index] ?? 0)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setValues((prev) => ({
                          ...prev,
                          items:
                            prev.items.length > 1
                              ? prev.items.filter((_, itemIndex) => itemIndex !== index)
                              : prev.items,
                        }))
                      }
                      disabled={values.items.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {errors.items ? <p className="mt-3 text-xs text-rose-600">{errors.items}</p> : null}
        </section>

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-700">Resumen</p>
              <p className="text-sm text-emerald-900/80">
                El total general se calcula con la suma de subtotales por item.
              </p>
            </div>
            <p className="text-xl font-semibold text-emerald-950">{formatCurrency(total)}</p>
          </div>
        </section>

        {catalogError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {catalogError}
          </div>
        ) : null}

        {errors.submit ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errors.submit}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" isLoading={isSubmitting}>
            {submitLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
};
