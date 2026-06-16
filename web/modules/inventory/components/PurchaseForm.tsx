"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { listBranches } from "../../../domains/branches/api";
import type { BranchResponse } from "../../../domains/branches/dtos";
import { getAuthContext } from "../../../domains/pos/api";
import type { PosBranch } from "../../../domains/pos/types";
import type { ProductResponse } from "../../../domains/products/dtos";
import { useInventoryScope } from "../../../hooks/useInventoryScope";
import { getProducts } from "../services/product.service";
import { createPurchase, type PurchaseResponse } from "../services/purchase.service";
import { getSuppliers, type SupplierResponse } from "../services/supplier.service";
import { useAppSelector } from "../../../store/hooks";
import type { PurchasePeripheralContext } from "../../../domains/peripherals/purchase-integration";

type PurchaseFormItem = {
  productId: string;
  quantity: string;
  cost: string;
};

type PurchaseFormValues = {
  supplierId: string;
  branchId: string;
  type: "CASH" | "CREDIT";
  items: PurchaseFormItem[];
};

type PurchaseFormErrors = {
  supplierId?: string;
  branchId?: string;
  terminalId?: string;
  items?: string;
  submit?: string;
};

type PurchaseFormProps = {
  onCancel: () => void;
  onSuccess: (
    response?: PurchaseResponse,
    peripheralContext?: PurchasePeripheralContext
  ) => void;
  onError?: (error: unknown) => void;
  onDirtyChange?: (isDirty: boolean) => void;
};

const createEmptyItem = (): PurchaseFormItem => ({
  productId: "",
  quantity: "",
  cost: "",
});

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

export const PurchaseForm = ({
  onCancel,
  onSuccess,
  onError,
  onDirtyChange,
}: PurchaseFormProps) => {
  const router = useRouter();
  const { currentBranch, currentTenant, isSuperRole } = useInventoryScope();
  const authUser = useAppSelector((state) => state.auth.user);
  const currentPosBranchId = useAppSelector((state) => state.pos.branchId);
  const currentPosTerminalId = useAppSelector((state) => state.pos.terminalId);
  const authBranchName = authUser?.branchName ?? null;
  const [values, setValues] = useState<PurchaseFormValues>({
    supplierId: "",
    branchId: currentBranch ?? "",
    type: "CASH",
    items: [createEmptyItem()],
  });
  const [errors, setErrors] = useState<PurchaseFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([]);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [contextBranches, setContextBranches] = useState<PosBranch[]>([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState("");
  const [terminalLoading, setTerminalLoading] = useState(false);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const markDirty = () => {
    onDirtyChange?.(true);
  };

  useEffect(() => {
    if (!currentBranch) {
      return;
    }
    setValues((prev) =>
      prev.branchId === currentBranch ? prev : { ...prev, branchId: currentBranch }
    );
  }, [currentBranch]);

  useEffect(() => {
    let mounted = true;

    const loadCatalogs = async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const branchPromise =
          isSuperRole && currentTenant
            ? listBranches({ tenantId: currentTenant })
            : Promise.resolve<BranchResponse[]>([]);
        const [suppliersResult, productsResult, branchesResult] = await Promise.all([
          getSuppliers(),
          getProducts({ branchId: values.branchId || currentBranch || undefined }),
          branchPromise,
        ]);

        if (!mounted) {
          return;
        }

        setSuppliers(suppliersResult.filter((supplier) => supplier.isActive));
        setProducts(productsResult.filter((product) => product.isActive));
        setBranches(branchesResult.filter((branch) => branch.estado === "ACTIVE"));
      } catch {
        if (mounted) {
          setCatalogError("No se pudieron cargar proveedores, productos o sucursales.");
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
  }, [currentTenant, isSuperRole, currentBranch, values.branchId]);

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
    if (isSuperRole) {
      return branches.find((branch) => branch.id === values.branchId)?.nombre ?? "";
    }
    return authBranchName ?? values.branchId;
  }, [authBranchName, branches, isSuperRole, values.branchId]);

  const selectedBranchTerminals = useMemo(
    () =>
      contextBranches.find((branch) => branch.id === values.branchId)?.terminals ?? [],
    [contextBranches, values.branchId]
  );

  useEffect(() => {
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
    selectedBranchTerminals,
    selectedTerminalId,
    values.branchId,
  ]);

  const resolvedTerminalId = useMemo(() => {
    if (currentPosBranchId === values.branchId && currentPosTerminalId) {
      return currentPosTerminalId;
    }
    return selectedTerminalId || undefined;
  }, [currentPosBranchId, currentPosTerminalId, selectedTerminalId, values.branchId]);

  const resolvedTerminalName = useMemo(
    () =>
      selectedBranchTerminals.find((terminal) => terminal.id === resolvedTerminalId)
        ?.name ?? "",
    [resolvedTerminalId, selectedBranchTerminals]
  );

  const terminalDisplayName =
    terminalLoading
      ? "Cargando..."
      : resolvedTerminalName || (resolvedTerminalId ? "Terminal activa" : "Sin terminal activa");

  const contextTarget = `/${currentTenant ?? authUser?.tenantId ?? "default"}/pos/select-context`;

  const itemSubtotals = useMemo(
    () =>
      values.items.map((item) => {
        const quantity = Number(item.quantity);
        const cost = Number(item.cost);

        if (!Number.isFinite(quantity) || !Number.isFinite(cost)) {
          return 0;
        }

        return quantity * cost;
      }),
    [values.items]
  );

  const total = useMemo(
    () => itemSubtotals.reduce((sum, subtotal) => sum + subtotal, 0),
    [itemSubtotals]
  );

  const validate = () => {
    const nextErrors: PurchaseFormErrors = {};

    if (!values.supplierId) {
      nextErrors.supplierId = "Debes seleccionar un proveedor.";
    }

    if (!values.branchId) {
      nextErrors.branchId = "Debes seleccionar una sucursal.";
    }

    if (!resolvedTerminalId) {
      nextErrors.terminalId =
        values.branchId && !terminalLoading
          ? "La sucursal seleccionada no tiene terminal activa disponible. Abre caja o selecciona contexto para operar la compra."
          : "Selecciona una terminal antes de registrar la compra.";
    }

    if (
      resolvedTerminalId === currentPosTerminalId &&
      currentPosBranchId &&
      values.branchId &&
      currentPosBranchId !== values.branchId
    ) {
      nextErrors.terminalId =
        "La terminal activa no pertenece a la sucursal de la compra.";
    }

    const hasInvalidItems = values.items.some((item) => {
      const quantity = Number(item.quantity);
      const cost = Number(item.cost);
      return (
        !item.productId ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(cost) ||
        cost < 0
      );
    });

    if (values.items.length === 0 || hasInvalidItems) {
      nextErrors.items =
        "Todos los items deben tener producto, cantidad mayor a 0 y costo valido.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleItemChange = (
    index: number,
    field: keyof PurchaseFormItem,
    value: string
  ) => {
    markDirty();
    setValues((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
              ...(field === "productId"
                ? {
                    cost:
                      value && Number(products.find((product) => product.id === value)?.cost) > 0
                        ? String(products.find((product) => product.id === value)?.cost)
                        : "",
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
      const response = await createPurchase({
        supplierId: values.supplierId,
        branchId: values.branchId,
        terminalId: resolvedTerminalId ?? "",
        type: values.type,
        total,
        items: values.items.map((item, index) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          cost: Number(item.cost),
          subtotal: itemSubtotals[index] ?? 0,
        })),
      });

      const selectedSupplier = suppliers.find(
        (supplier) => supplier.id === values.supplierId
      );
      const peripheralContext: PurchasePeripheralContext = {
        purchaseId: response.id,
        purchaseNumber: response.id,
        documentNumber: response.id,
        date: response.createdAt,
        businessName: response.tenantName ?? authUser?.tenantName ?? "Manus POS",
        branchName: response.branchName ?? selectedBranchName,
        cashier: authUser?.name ?? authUser?.email ?? undefined,
        supplierName: response.supplierName ?? selectedSupplier?.name ?? "Proveedor",
        items: values.items.map((item, index) => {
          const product = products.find((candidate) => candidate.id === item.productId);
          const quantity = Number(item.quantity);
          const cost = Number(item.cost);

          return {
            name: product?.name ?? item.productId,
            quantity,
            unitPrice: cost,
            total: itemSubtotals[index] ?? 0,
          };
        }),
        subtotal: total,
        taxes: 0,
        discounts: 0,
        total: response.total ?? total,
        payments:
          response.type === "CASH" && Number(response.totalPaid) > 0
            ? [
                {
                  methodName: "Efectivo",
                  methodType: "CASH",
                  amount: Number(response.totalPaid),
                },
              ]
            : [],
      };

      onSuccess(response, peripheralContext);
      onDirtyChange?.(false);
    } catch (error) {
      onError?.(error);
      setErrors({
        submit: "No se pudo guardar la compra.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Purchases</p>
          <h2 className="text-xl font-semibold text-slate-900">Crear compra</h2>
          <p className="mt-2 text-sm text-slate-600">
            Registra el proveedor, el tipo de compra y los items. Esta accion aun no
            mueve inventario.
          </p>
        </div>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>

      <form className="grid gap-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Select
              label="Proveedor"
              required
              value={values.supplierId}
              disabled={catalogLoading || suppliers.length === 0}
              onChange={(event) => {
                markDirty();
                setValues((prev) => ({ ...prev, supplierId: event.target.value }));
                setErrors((prev) => ({ ...prev, supplierId: undefined, submit: undefined }));
              }}
            >
              <option value="">
                {catalogLoading ? "Cargando..." : "Selecciona un proveedor"}
              </option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
            {errors.supplierId ? (
              <p className="text-xs text-rose-600">{errors.supplierId}</p>
            ) : null}
          </div>

          {isSuperRole ? (
            <div className="space-y-1">
              <Select
                label="Sucursal"
                required
                value={values.branchId}
                disabled={catalogLoading || branches.length === 0}
                onChange={(event) => {
                  markDirty();
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

          <div className="space-y-1">
            {selectedBranchTerminals.length > 1 ? (
              <Select
                label="Terminal"
                required
                value={resolvedTerminalId ?? ""}
                disabled={terminalLoading}
                onChange={(event) => {
                  markDirty();
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
              <Input label="Terminal" value={terminalDisplayName} disabled readOnly />
            )}
            {terminalError ? (
              <p className="text-xs text-amber-700">{terminalError}</p>
            ) : null}
            {errors.terminalId ? (
              <div className="space-y-2">
                <p className="text-xs text-rose-600">{errors.terminalId}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(contextTarget)}
                >
                  Ir a seleccion de contexto
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-1">
          <Select
            label="Tipo"
            value={values.type}
            onChange={(event) => {
              markDirty();
              setValues((prev) => ({
                ...prev,
                type: event.target.value as "CASH" | "CREDIT",
              }));
            }}
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
                Agrega productos, cantidades y costos para calcular el total.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                markDirty();
                setValues((prev) => ({
                  ...prev,
                  items: [...prev.items, createEmptyItem()],
                }));
              }}
            >
              <Plus className="h-4 w-4" />
              Agregar item
            </Button>
          </div>

          <div className="grid gap-4">
            {values.items.map((item, index) => {
              const selectedProduct = products.find(
                (product) => product.id === item.productId
              );
              const productCost = Number(selectedProduct?.cost ?? 0);

              return (
              <div
                key={`${index}-${item.productId}`}
                className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[2fr_1fr_1fr_auto]"
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
                  label="Cantidad"
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.quantity}
                  onChange={(event) =>
                    handleItemChange(index, "quantity", event.target.value)
                  }
                />

                <Input
                  label="Costo"
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.cost}
                  onChange={(event) => handleItemChange(index, "cost", event.target.value)}
                />

                {selectedProduct && productCost <= 0 ? (
                  <p className="text-xs text-amber-700 md:col-start-3">
                    Este producto no tiene costo registrado. Ingresa el costo de compra.
                  </p>
                ) : null}

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
                    onClick={() => {
                      markDirty();
                      setValues((prev) => ({
                        ...prev,
                        items:
                          prev.items.length > 1
                            ? prev.items.filter((_, itemIndex) => itemIndex !== index)
                            : prev.items,
                      }));
                    }}
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
            Guardar compra
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
};
