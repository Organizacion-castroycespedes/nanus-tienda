"use client";

import { ExternalLink, Eye, Plus, RefreshCw, Truck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { Textarea } from "../../../components/design-system/Textarea";
import { useAppSelector } from "../../../store/hooks";
import { getApiErrorMessage } from "../../reporteria/utils";
import {
  buildDeliveryModuleHref,
  type DeliveryRelationSourceType,
} from "../delivery-navigation";
import {
  canCreateDelivery,
  canReadDeliveries,
  findDeliveryPermission,
} from "../delivery-permissions";
import { getDeliveryFeeSource } from "../delivery-helpers";
import {
  createDeliveryFromOrder,
  createDeliveryFromSale,
  getDeliveryByOrder,
  getDeliveryBySale,
} from "../services/deliveries.service";
import type {
  CreateDeliveryPayload,
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
  defaultCustomerName?: string | null;
};

type RelationFormState = {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryReference: string;
  deliveryFee: string;
  deliveryFeeSource: DeliveryFeeSource;
  notes: string;
};

const sourceCopy: Record<DeliveryRelationSourceType, string> = {
  order: "pedido",
  sale: "venta",
};

const sourceTitle: Record<DeliveryRelationSourceType, string> = {
  order: "Pedido",
  sale: "Venta",
};

const createEmptyForm = (customerName?: string | null): RelationFormState => ({
  customerName: customerName ?? "",
  customerPhone: "",
  deliveryAddress: "",
  deliveryReference: "",
  deliveryFee: "",
  deliveryFeeSource: "NO_FEE",
  notes: "",
});

const optionalText = (value: string) => {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
};

const optionalAmount = (value: string) => {
  if (!value.trim()) {
    return undefined;
  }

  const amount = Number(value);
  return Number.isFinite(amount) ? amount : undefined;
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
  defaultCustomerName,
}: DeliveryRelationCardProps) => {
  const router = useRouter();
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
  const relationLabel = sourceLabel ?? `${sourceTitle[sourceType]} ${sourceId.slice(0, 8)}`;
  const moduleHref = buildDeliveryModuleHref(tenantId, { sourceType, sourceId });

  const [delivery, setDelivery] = useState<DeliveryRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [detailDelivery, setDetailDelivery] = useState<DeliveryRecord | null>(null);
  const [form, setForm] = useState<RelationFormState>(() =>
    createEmptyForm(defaultCustomerName)
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
      setForm(createEmptyForm(defaultCustomerName));
      setValidationMessage(null);
    }
  }, [defaultCustomerName, isCreating, sourceId]);

  const updateField = (field: keyof RelationFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setValidationMessage(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const buildPayload = (): CreateDeliveryPayload => {
    const deliveryFeeSource = form.deliveryFeeSource;
    const deliveryFee =
      sourceType === "sale" && deliveryFeeSource === "NO_FEE"
        ? 0
        : optionalAmount(form.deliveryFee);

    return {
      customer_name: optionalText(form.customerName),
      customer_phone: optionalText(form.customerPhone),
      delivery_address: form.deliveryAddress.trim(),
      delivery_reference: optionalText(form.deliveryReference),
      delivery_fee: deliveryFee,
      delivery_fee_source: sourceType === "sale" ? deliveryFeeSource : undefined,
      notes: optionalText(form.notes),
      metadata: {
        source: `${sourceType}_relation_frontend`,
        no_cash_integration: true,
        no_pos_flow_change: true,
        no_electronic_invoice_change: true,
      },
    };
  };

  const handleCreate = async () => {
    if (!form.deliveryAddress.trim()) {
      setValidationMessage("Direccion es requerida para crear el domicilio.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const created =
        sourceType === "order"
          ? await createDeliveryFromOrder(tenantId, sourceId, buildPayload())
          : await createDeliveryFromSale(tenantId, sourceId, buildPayload());
      setDelivery(created);
      setIsCreating(false);
      setSuccessMessage("Domicilio creado correctamente. No toca caja.");
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
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
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
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Domicilio asociado
          </p>
          <h3 className="text-lg font-semibold text-slate-900">{relationLabel}</h3>
          <p className="mt-1 text-sm text-slate-600">
            Consulta o crea un domicilio sin modificar caja, POS, facturacion,
            totales ni impuestos.
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
        <div className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500">
          Cargando domicilio asociado...
        </div>
      ) : delivery ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {delivery.delivery_number || delivery.id}
              </p>
              <p className="mt-1 break-words text-sm text-slate-600">
                {delivery.customer_name || "Sin contacto"} -{" "}
                {delivery.delivery_address}
              </p>
            </div>
            <DeliveryStatusBadge status={delivery.status} />
          </div>

          <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
            <p>Telefono: {delivery.customer_phone || "-"}</p>
            <p>Repartidor: {delivery.assigned_courier_id || "-"}</p>
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
            <Truck className="mt-0.5 h-5 w-5 text-slate-500" />
            <div className="min-w-0">
              <p className="font-medium text-slate-900">
                {sourceType === "order"
                  ? "Este pedido no tiene domicilio asociado."
                  : "Esta venta no tiene domicilio asociado."}
              </p>
              <p className="mt-1 text-sm text-slate-600">
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
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>

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

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                  : "Informativo. No crea movimientos de caja."
              }
              onChange={(event) => updateField("deliveryFee", event.target.value)}
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
