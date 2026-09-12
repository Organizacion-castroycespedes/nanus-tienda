"use client";

import { ExternalLink, Eye, Plus, RefreshCw, Truck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { Textarea } from "../../../components/design-system/Textarea";
import { useAppSelector } from "../../../store/hooks";
import {
  getCustomerById,
  type CustomerResponse,
} from "../../inventory/services/customer.service";
import {
  getCurrentCashSession,
  listPaymentMethods,
} from "../../finance/services/finance.service";
import type { CashSession, PaymentMethod } from "../../finance/types";
import { getApiErrorMessage } from "../../reporteria/utils";
import {
  buildDeliveryQuickCreatePayload,
  validateDeliveryQuickCreate,
  type DeliveryQuickCreateFormLike,
} from "../delivery-quick-create";
import {
  buildDeliveryModuleHref,
  type DeliveryRelationSourceType,
} from "../delivery-navigation";
import {
  canCreateDelivery,
  canManageDeliveryDrivers,
  canReadDeliveries,
  findDeliveryPermission,
} from "../delivery-permissions";
import { getDeliveryFeeSource } from "../delivery-helpers";
import {
  calculateDeliveryTotals,
  formatMoneyInput,
  type DeliverySourceKind,
} from "../delivery-totals";
import { listDeliveryDrivers } from "../services/delivery-drivers.service";
import {
  createDeliveryFromOrder,
  createDeliveryFromSale,
  getDeliveryByOrder,
  getDeliveryBySale,
} from "../services/deliveries.service";
import type {
  CreateDeliveryPayload,
  DeliveryDriver,
  DeliveryFeeSource,
  DeliveryRecord,
} from "../types";
import { DeliveryDetailPanel } from "./DeliveryDetailPanel";
import { DeliveryStatusBadge } from "./DeliveryStatusBadge";

type DeliveryRelationCardProps = {
  sourceType: DeliveryRelationSourceType;
  sourceId: string;
  tenantId: string;
  sourceLabel?: string;
  sourceBranchId?: string | null;
  sourceCustomerId?: string | null;
  sourceSaleId?: string | null;
  sourceTotal?: number | null;
  defaultCustomerName?: string | null;
  defaultCustomerPhone?: string | null;
  defaultDeliveryAddress?: string | null;
};

type RelationFormState = DeliveryQuickCreateFormLike & {
  deliveryFeeSource: DeliveryFeeSource;
};

const sourceCopy: Record<DeliveryRelationSourceType, string> = {
  order: "pedido",
  sale: "venta",
};

const sourceTitle: Record<DeliveryRelationSourceType, string> = {
  order: "Pedido",
  sale: "Venta",
};

const createEmptyForm = ({
  sourceType,
  sourceId,
  sourceBranchId,
  sourceCustomerId,
  sourceSaleId,
  sourceTotal,
  customerName,
  customerPhone,
  deliveryAddress,
}: {
  sourceType: DeliveryRelationSourceType;
  sourceId: string;
  sourceBranchId?: string | null;
  sourceCustomerId?: string | null;
  sourceSaleId?: string | null;
  sourceTotal?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
}): RelationFormState => {
  const subtotal = formatMoneyInput(sourceTotal ?? 0);
  return {
    branchId: sourceBranchId ?? "",
    customerId: sourceCustomerId ?? "",
    orderId: sourceType === "order" ? sourceId : "",
    saleId: sourceType === "sale" ? sourceId : sourceSaleId ?? "",
    driverId: "",
    customerName: customerName ?? "",
    customerPhone: customerPhone ?? "",
    deliveryAddress: deliveryAddress ?? "",
    deliveryReference: "",
    deliveryFee: "",
    subtotal,
    total: subtotal,
    paymentMethodId: "",
    notes: "",
    deliveryFeeSource: "NO_FEE",
  };
};

const paymentMethodLabel = (method: PaymentMethod) =>
  [method.nombre, method.tipo].filter(Boolean).join(" - ");

const driverLabel = (driver: DeliveryDriver) =>
  [driver.name, driver.phone].filter(Boolean).join(" - ");

const buildCustomerSeed = (customer: CustomerResponse | null) => ({
  customerName: customer?.name ?? null,
  customerPhone: customer?.phone ?? null,
  deliveryAddress: customer?.address ?? null,
});

const getSourceKind = (sourceType: DeliveryRelationSourceType): DeliverySourceKind =>
  sourceType === "sale" ? "sale" : "order";

const recalculateFormTotals = (
  form: RelationFormState,
  sourceType: DeliveryRelationSourceType,
  sourceTotal?: number | null,
  deliveryFee = form.deliveryFee
): RelationFormState => {
  const totals = calculateDeliveryTotals({
    source: getSourceKind(sourceType),
    sourceSubtotal: sourceTotal ?? form.subtotal,
    deliveryFee,
  });

  return {
    ...form,
    deliveryFee,
    subtotal: formatMoneyInput(totals.sourceSubtotal),
    total: formatMoneyInput(totals.total),
  };
};

const getErrorStatus = (error: unknown) =>
  typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status)
    : null;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

export const DeliveryRelationCard = ({
  sourceType,
  sourceId,
  tenantId,
  sourceLabel,
  sourceBranchId,
  sourceCustomerId,
  sourceSaleId,
  sourceTotal,
  defaultCustomerName,
  defaultCustomerPhone,
  defaultDeliveryAddress,
}: DeliveryRelationCardProps) => {
  const router = useRouter();
  const authUser = useAppSelector((state) => state.auth.user);
  const posBranchId = useAppSelector((state) => state.pos.branchId);
  const posCashRegisterId = useAppSelector((state) => state.pos.cashRegisterId);
  const role = (
    useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? "") ?? ""
  )
    .trim()
    .toUpperCase();
  const permissionsLoaded = useAppSelector(
    (state) => state.auth.permissionsLoaded
  );
  const authPermissions = useAppSelector((state) => state.auth.permissions);
  const deliveryPermission = useMemo(
    () => findDeliveryPermission(authPermissions),
    [authPermissions]
  );
  const canView = canReadDeliveries(deliveryPermission, role);
  const canCreate = canCreateDelivery(deliveryPermission, role);
  const canManageDrivers = canManageDeliveryDrivers(deliveryPermission, role);
  const relationLabel = sourceLabel ?? `${sourceTitle[sourceType]} ${sourceId.slice(0, 8)}`;
  const moduleHref = buildDeliveryModuleHref(tenantId, { sourceType, sourceId });
  const initialBranchId =
    sourceBranchId ?? posBranchId ?? authUser?.branchId ?? "";

  const [delivery, setDelivery] = useState<DeliveryRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [driversLoading, setDriversLoading] = useState(false);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [cashSessionLoading, setCashSessionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [driversError, setDriversError] = useState<string | null>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [detailDelivery, setDetailDelivery] = useState<DeliveryRecord | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [currentCashSession, setCurrentCashSession] =
    useState<CashSession | null>(null);
  const [form, setForm] = useState<RelationFormState>(() =>
    createEmptyForm({
      sourceType,
      sourceId,
      sourceBranchId: initialBranchId,
      sourceCustomerId,
      sourceSaleId,
      sourceTotal,
      customerName: defaultCustomerName,
      customerPhone: defaultCustomerPhone,
      deliveryAddress: defaultDeliveryAddress,
    })
  );

  const loadRelation = useCallback(async () => {
    if (!permissionsLoaded || !canView) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const result =
        sourceType === "order"
          ? await getDeliveryByOrder(tenantId, sourceId)
          : await getDeliveryBySale(tenantId, sourceId);
      setDelivery(result ?? null);
    } catch (error) {
      if (getErrorStatus(error) === 404) {
        setDelivery(null);
        return;
      }

      setErrorMessage(
        getApiErrorMessage(
          error,
          `No se pudo consultar el domicilio de la ${sourceCopy[sourceType]}.`
        )
      );
    } finally {
      setLoading(false);
    }
  }, [canView, permissionsLoaded, sourceId, sourceType, tenantId]);

  useEffect(() => {
    void loadRelation();
  }, [loadRelation]);

  useEffect(() => {
    if (!isCreating) {
      setForm(
        createEmptyForm({
          sourceType,
          sourceId,
          sourceBranchId: initialBranchId,
          sourceCustomerId,
          sourceSaleId,
          sourceTotal,
          customerName: defaultCustomerName,
          customerPhone: defaultCustomerPhone,
          deliveryAddress: defaultDeliveryAddress,
        })
      );
      setValidationMessage(null);
    }
  }, [
    defaultCustomerName,
    defaultCustomerPhone,
    defaultDeliveryAddress,
    initialBranchId,
    isCreating,
    sourceCustomerId,
    sourceId,
    sourceSaleId,
    sourceTotal,
    sourceType,
  ]);

  useEffect(() => {
    if (!isCreating) {
      return;
    }

    let active = true;

    setCatalogLoading(true);
    setCatalogError(null);
    listPaymentMethods({ tenantId, active: true })
      .then((result) => {
        if (active) {
          setPaymentMethods(result.filter((method) => method.active));
        }
      })
      .catch(() => {
        if (active) {
          setPaymentMethods([]);
          setCatalogError("No se pudieron cargar metodos de pago.");
        }
      })
      .finally(() => {
        if (active) {
          setCatalogLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isCreating, tenantId]);

  useEffect(() => {
    if (!isCreating) {
      return;
    }

    let active = true;

    setDriversLoading(true);
    setDriversError(null);
    listDeliveryDrivers({ active: true })
      .then((result) => {
        if (active) {
          setDrivers(result.filter((driver) => driver.active));
        }
      })
      .catch(() => {
        if (active) {
          setDrivers([]);
          setDriversError("No se pudieron cargar repartidores.");
        }
      })
      .finally(() => {
        if (active) {
          setDriversLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isCreating]);

  useEffect(() => {
    if (!isCreating) {
      return;
    }

    let active = true;

    setCashSessionLoading(true);
    getCurrentCashSession(posCashRegisterId ?? undefined)
      .then((session) => {
        if (active) {
          setCurrentCashSession(session);
        }
      })
      .catch(() => {
        if (active) {
          setCurrentCashSession(null);
        }
      })
      .finally(() => {
        if (active) {
          setCashSessionLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isCreating, posCashRegisterId]);

  useEffect(() => {
    if (!isCreating || !sourceCustomerId) {
      return;
    }

    let active = true;

    setCustomerLoading(true);
    setCustomerError(null);
    getCustomerById(sourceCustomerId)
      .then((customer) => {
        if (!active) {
          return;
        }
        const seed = buildCustomerSeed(customer);
        setForm((prev) => ({
          ...prev,
          customerId: customer.id,
          customerName: seed.customerName ?? prev.customerName,
          customerPhone: seed.customerPhone ?? prev.customerPhone,
          deliveryAddress: seed.deliveryAddress ?? prev.deliveryAddress,
        }));
      })
      .catch(() => {
        if (active) {
          setCustomerError("No se pudo cargar telefono/direccion del cliente.");
        }
      })
      .finally(() => {
        if (active) {
          setCustomerLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isCreating, sourceCustomerId]);

  const updateField = (field: keyof RelationFormState, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "deliveryFee") {
        return recalculateFormTotals(next, sourceType, sourceTotal, value);
      }
      return next;
    });
    setValidationMessage(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const buildPayload = (): CreateDeliveryPayload => {
    const deliveryFeeSource = form.deliveryFeeSource;
    const basePayload = buildDeliveryQuickCreatePayload(form);
    const payload = { ...basePayload };
    delete payload.customer_id;
    delete payload.order_id;
    delete payload.sale_id;

    return {
      ...payload,
      delivery_fee:
        sourceType === "sale" && deliveryFeeSource === "NO_FEE"
          ? 0
          : payload.delivery_fee,
      delivery_fee_source: sourceType === "sale" ? deliveryFeeSource : undefined,
      metadata: {
        ...payload.metadata,
        source: `${sourceType}_relation_frontend`,
        source_sale_id: sourceType === "order" ? sourceSaleId ?? undefined : undefined,
        no_cash_integration: sourceType === "sale" ? true : undefined,
        no_pos_flow_change: true,
        no_electronic_invoice_change: true,
      },
    };
  };

  const handleCreate = async () => {
    const totals = calculateDeliveryTotals({
      source: getSourceKind(sourceType),
      sourceSubtotal: form.subtotal,
      deliveryFee: form.deliveryFee,
    });

    if (totals.hasNegativeDeliveryFee) {
      setValidationMessage("Valor domicilio no puede ser negativo.");
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

    const payload = buildPayload();
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const created =
        sourceType === "order"
          ? await createDeliveryFromOrder(tenantId, sourceId, payload)
          : await createDeliveryFromSale(tenantId, sourceId, payload);
      setDelivery(created);
      setIsCreating(false);
      setSuccessMessage("Domicilio creado correctamente.");
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          `No se pudo crear el domicilio de la ${sourceCopy[sourceType]}.`
        )
      );
    } finally {
      setSaving(false);
    }
  };

  if (!permissionsLoaded) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:text-slate-300">
        Cargando permisos de domicilios...
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        No tienes permiso para ver domicilios asociados.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {detailDelivery ? (
        <DeliveryDetailPanel
          delivery={detailDelivery}
          loading={false}
          onClose={() => setDetailDelivery(null)}
        />
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Domicilio asociado
          </p>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{relationLabel}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Consulta o crea un domicilio sin modificar POS, facturacion, totales
            ni impuestos.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void loadRelation()}
          isLoading={loading}
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500 dark:text-slate-400">
          Cargando domicilio asociado...
        </div>
      ) : delivery ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:bg-slate-800 dark:border-slate-700">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {delivery.delivery_number || delivery.id}
              </p>
              <p className="mt-1 break-words text-sm text-slate-600 dark:text-slate-300">
                {delivery.customer_name || "Sin contacto"} -{" "}
                {delivery.delivery_address}
              </p>
            </div>
            <DeliveryStatusBadge status={delivery.status} />
          </div>

          <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 dark:text-slate-300">
            <p>Telefono: {delivery.customer_phone || "-"}</p>
            <p>
              Repartidor:{" "}
              {delivery.driver?.name ?? delivery.driver_id ?? delivery.assigned_courier_id ?? "-"}
            </p>
            <p>Valor domicilio: {formatCurrency(delivery.delivery_fee)}</p>
            <p>Fuente financiera: {getDeliveryFeeSource(delivery)}</p>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetailDelivery(delivery)}
              className="w-full sm:w-auto"
            >
              <Eye className="h-4 w-4" />
              Ver domicilio
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(moduleHref)}
              className="w-full sm:w-auto"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir en Domicilios
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start gap-3">
            <Truck className="mt-0.5 h-5 w-5 text-slate-500 dark:text-slate-400" />
            <div className="min-w-0">
              <p className="font-medium text-slate-900 dark:text-white">
                {sourceType === "order"
                  ? "Este pedido no tiene domicilio asociado."
                  : "Esta venta no tiene domicilio asociado."}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Puedes crear uno si el backend y tus permisos lo permiten.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {canCreate ? (
              <Button
                size="sm"
                onClick={() => setIsCreating((prev) => !prev)}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Crear domicilio
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(moduleHref)}
              className="w-full sm:w-auto"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir en Domicilios
            </Button>
          </div>
        </div>
      )}

      {isCreating && !delivery ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:bg-slate-800 dark:border-slate-700">
          <div
            className={`mb-4 rounded-lg border p-3 text-sm ${
              currentCashSession
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {currentCashSession
              ? `Caja actual: ${
                  currentCashSession.cashRegisterNombre ??
                  currentCashSession.cashRegisterCodigo ??
                  currentCashSession.id
                }.`
              : cashSessionLoading
                ? "Verificando caja actual..."
                : "No tienes una caja abierta. Solo puedes crear sin valor y sin metodo de pago."}
          </div>

          {catalogError || driversError || customerError ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {[catalogError, driversError, customerError].filter(Boolean).join(" ")}
            </div>
          ) : null}

          <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
            Pedido fijo: {sourceId.slice(0, 8).toUpperCase()}
            {sourceSaleId ? (
              <> · Venta/factura asociada: {sourceSaleId.slice(0, 8).toUpperCase()}</>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Contacto"
              value={form.customerName}
              disabled={customerLoading}
              onChange={(event) => updateField("customerName", event.target.value)}
            />
            <Input
              label="Telefono"
              value={form.customerPhone}
              disabled={customerLoading}
              onChange={(event) => updateField("customerPhone", event.target.value)}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Select
              label="Metodo de pago"
              value={form.paymentMethodId}
              onChange={(event) =>
                updateField("paymentMethodId", event.target.value)
              }
              disabled={catalogLoading || paymentMethods.length === 0}
            >
              <option value="">
                {catalogLoading
                  ? "Cargando metodos..."
                  : paymentMethods.length === 0
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
                driversLoading
                  ? "Cargando repartidores..."
                  : drivers.length === 0
                    ? "No hay repartidores activos."
                    : "Opcional. No cambia estado."
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
                onClick={() => router.push(`/${tenantId}/deliveries/drivers`)}
                disabled={saving}
              >
                Gestionar repartidores
              </Button>
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Textarea
              label="Direccion"
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

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {sourceType === "sale" ? (
              <Select
                label="Fuente financiera"
                value={form.deliveryFeeSource}
                onChange={(event) =>
                  updateField(
                    "deliveryFeeSource",
                    event.target.value as DeliveryFeeSource
                  )
                }
              >
                <option value="NO_FEE">NO_FEE</option>
                <option value="INVOICE_INCLUDED">INVOICE_INCLUDED</option>
              </Select>
            ) : null}
            <Input
              label="Valor domicilio"
              type="number"
              min="0"
              step="0.01"
              value={form.deliveryFee}
              disabled={sourceType === "sale" && form.deliveryFeeSource === "NO_FEE"}
              hint={
                sourceType === "sale"
                  ? "Informativo. No modifica total ni impuestos."
                  : "Informativo. Solo afecta valor operativo del domicilio."
              }
              onChange={(event) => updateField("deliveryFee", event.target.value)}
            />
            <Input
              label="Subtotal"
              type="number"
              value={form.subtotal}
              readOnly
              hint={`Origen: ${formatCurrency(Number(form.subtotal || 0))}.`}
            />
            <Input
              label="Total"
              type="number"
              value={form.total}
              readOnly
              hint={`Calculado: ${formatCurrency(Number(form.total || 0))}.`}
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
            <Button
              variant="ghost"
              onClick={() => setIsCreating(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={() => void handleCreate()} isLoading={saving}>
              Crear domicilio
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
