"use client";

import {
  Eye,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Truck,
  UserCheck,
  Users,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import { Select } from "../../../components/design-system/Select";
import { Textarea } from "../../../components/design-system/Textarea";
import { Toast, type ToastVariant } from "../../../components/design-system/Toast";
import { useAutoClearState } from "../../../lib/useAutoClearState";
import { getApiErrorMessage } from "../../reporteria/utils";
import { PdfPreviewModal } from "../../reporteria/components/PdfPreviewModal";
import { useAppSelector } from "../../../store/hooks";
import { getCurrentCashSession } from "../../finance/services/finance.service";
import type { CashSession } from "../../finance/types";
import {
  getDeliveryCashScope,
  getDeliveryCashScopeLabel,
  shouldBlockCashImpactAction,
  type DeliveryCashScope,
} from "../delivery-cash-scope";
import {
  deliveryActionDescriptions,
  deliveryStatusLabels,
  filterDeliveriesByQuery,
  getDeliveryActionLabel,
  getDeliveryFeeSource,
} from "../delivery-helpers";
import {
  buildDeliveryActionPermissionMap,
  canCreateDelivery,
  canReadDeliveries,
  findDeliveryPermission,
} from "../delivery-permissions";
import {
  buildDeliveryFiltersFromSearchParams,
  defaultDeliveryFilters as defaultFilters,
  serializeDeliveryFilters,
  type DeliveryFilters,
  type DeliverySearchParamsInput,
} from "../delivery-navigation";
import {
  assignDeliveryDriver,
  cancelDelivery,
  dispatchDelivery,
  getDeliveryById,
  getDeliveryTicket,
  listDeliveries,
  markDeliveryDelivered,
  markDeliveryNotDelivered,
  prepareDelivery,
} from "../services/deliveries.service";
import { listDeliveryDrivers } from "../services/delivery-drivers.service";
import {
  DELIVERY_STATUSES,
  type DeliveryActionKey,
  type DeliveryDriver,
  type DeliveryActionPermissionMap,
  type DeliveryListResponse,
  type DeliveryRecord,
  type DeliveryStatus,
  type GetDeliveriesParams,
} from "../types";
import { DeliveryActions } from "./DeliveryActions";
import { DeliveryDetailPanel } from "./DeliveryDetailPanel";
import { DeliveryStatusBadge } from "./DeliveryStatusBadge";

type ActionDraft = {
  reason: string;
  receivedBy: string;
  notes: string;
};

type ActionRequest = {
  action: DeliveryActionKey;
  delivery: DeliveryRecord;
};

const defaultPagination: DeliveryListResponse["pagination"] = {
  page: 1,
  limit: 10,
  total: 0,
  total_pages: 1,
};

const pageSizeOptions = [10, 25, 50];

const emptyActionDraft: ActionDraft = {
  reason: "",
  receivedBy: "",
  notes: "",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const optionalText = (value: string) => {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
};

const buildListParams = (
  filters: DeliveryFilters,
  page: number,
  limit: number,
  currentCashSessionId?: string | null
): GetDeliveriesParams => ({
  status: filters.status || undefined,
  order_id: optionalText(filters.orderId),
  sale_id: optionalText(filters.saleId),
  driver_id: optionalText(filters.driverId),
  cash_scope:
    filters.cashScope === "current" && currentCashSessionId
      ? "current"
      : undefined,
  date_from: optionalText(filters.dateFrom),
  date_to: optionalText(filters.dateTo),
  page,
  limit,
});

const getDriverLabel = (delivery: DeliveryRecord) => {
  const driverName = delivery.driver?.name?.trim();
  if (driverName) {
    return driverName;
  }
  return delivery.driver_id ?? delivery.assigned_courier_id ?? "-";
};

const getDriverActionLabel = (delivery: DeliveryRecord) =>
  delivery.driver_id ? "Cambiar repartidor" : "Asignar repartidor";

const getDeliveryTicketFileName = (deliveryId: string) =>
  `ticket-domicilio-${deliveryId}.pdf`;

const cashScopeClassName: Record<DeliveryCashScope, string> = {
  current: "border-emerald-200 bg-emerald-50 text-emerald-700",
  none: "border-slate-200 bg-slate-50 text-slate-600",
  other: "border-amber-200 bg-amber-50 text-amber-700",
};

const DeliveryCashBadge = ({
  delivery,
  currentCashSessionId,
}: {
  delivery: DeliveryRecord;
  currentCashSessionId?: string | null;
}) => {
  const scope = getDeliveryCashScope(delivery, currentCashSessionId);
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${cashScopeClassName[scope]}`}
    >
      {getDeliveryCashScopeLabel(scope)}
    </span>
  );
};

const getParamValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const DeliveryActionModal = ({
  request,
  draft,
  errorMessage,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  request: ActionRequest;
  draft: ActionDraft;
  errorMessage: string | null;
  saving: boolean;
  onChange: (draft: ActionDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) => {
  const { action, delivery } = request;
  const isFinal =
    action === "cancel" ||
    action === "mark-delivered" ||
    action === "mark-not-delivered";
  const requiresReason = action === "cancel" || action === "mark-not-delivered";

  return (
    <Modal
      title={getDeliveryActionLabel(action, delivery)}
      description={deliveryActionDescriptions[action]}
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant={action === "cancel" ? "danger" : isFinal ? "warning" : "primary"}
            onClick={onSubmit}
            isLoading={saving}
          >
            Confirmar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">
            {delivery.delivery_number || delivery.id}
          </p>
          <p className="mt-1">
            {delivery.customer_name || "Sin contacto"} - {delivery.delivery_address}
          </p>
        </div>

        {action === "mark-delivered" ? (
          <Input
            label="Recibido por"
            value={draft.receivedBy}
            onChange={(event) =>
              onChange({ ...draft, receivedBy: event.target.value })
            }
          />
        ) : null}

        {requiresReason ? (
          <Textarea
            label="Motivo"
            required
            rows={3}
            value={draft.reason}
            onChange={(event) =>
              onChange({ ...draft, reason: event.target.value })
            }
          />
        ) : null}

        <Textarea
          label="Notas"
          rows={3}
          value={draft.notes}
          onChange={(event) => onChange({ ...draft, notes: event.target.value })}
        />

        {isFinal ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Esta accion cambia estado operativo final o sensible. No toca caja.
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

const DeliveryDriverAssignmentModal = ({
  delivery,
  drivers,
  selectedDriverId,
  saving,
  errorMessage,
  onChange,
  onClose,
  onSubmit,
}: {
  delivery: DeliveryRecord;
  drivers: DeliveryDriver[];
  selectedDriverId: string;
  saving: boolean;
  errorMessage: string | null;
  onChange: (driverId: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) => {
  const currentDriver = delivery.driver;
  const hasCurrentDriver =
    currentDriver?.id &&
    !drivers.some((driver) => driver.id === currentDriver.id);

  return (
    <Modal
      title={getDriverActionLabel(delivery)}
      description="Asignacion operativa. No cambia estado, caja ni pagos."
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={onSubmit} isLoading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">
            {delivery.delivery_number || delivery.id}
          </p>
          <p className="mt-1">
            {delivery.customer_name || "Sin contacto"} - {delivery.delivery_address}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Estado actual: {deliveryStatusLabels[delivery.status] ?? delivery.status}
          </p>
        </div>

        <Select
          label="Repartidor"
          value={selectedDriverId}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Sin repartidor</option>
          {hasCurrentDriver && currentDriver ? (
            <option value={currentDriver.id}>
              {currentDriver.name || currentDriver.id} (inactivo)
            </option>
          ) : null}
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name}
              {driver.phone ? ` - ${driver.phone}` : ""}
            </option>
          ))}
        </Select>

        {drivers.length === 0 && !hasCurrentDriver ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No hay repartidores activos para asignar.
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
          Esta accion solo cambia el repartidor asignado. El estado del domicilio
          queda igual.
        </div>

        {errorMessage ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

const DeliverySourceCell = ({ delivery }: { delivery: DeliveryRecord }) => (
  <div className="space-y-1 text-xs text-slate-600">
    <p>
      Pedido:{" "}
      <span className="font-medium text-slate-800">
        {delivery.order_id ?? "-"}
      </span>
    </p>
    <p>
      Venta:{" "}
      <span className="font-medium text-slate-800">
        {delivery.sale_id ?? "-"}
      </span>
    </p>
  </div>
);

const MobileDeliveryCard = ({
  delivery,
  permissions,
  actionDisabled,
  onDetail,
  onAction,
  onAssignDriver,
  onTicket,
  canAssignDriver,
  currentCashSessionId,
}: {
  delivery: DeliveryRecord;
  permissions: DeliveryActionPermissionMap;
  actionDisabled: boolean;
  onDetail: (delivery: DeliveryRecord) => void;
  onAction: (action: DeliveryActionKey, delivery: DeliveryRecord) => void;
  onAssignDriver: (delivery: DeliveryRecord) => void;
  onTicket: (delivery: DeliveryRecord) => void;
  canAssignDriver: boolean;
  currentCashSessionId?: string | null;
}) => (
  <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">
          {delivery.customer_name || "Sin contacto"}
        </p>
        <p className="mt-1 break-words text-sm text-slate-600">
          {delivery.delivery_address}
        </p>
      </div>
      <DeliveryStatusBadge status={delivery.status} />
    </div>
    <div className="mt-3 grid gap-2 text-sm text-slate-600">
      <p>Telefono: {delivery.customer_phone || "-"}</p>
      <p>Repartidor: {getDriverLabel(delivery)}</p>
      <p>
        Caja: <DeliveryCashBadge delivery={delivery} currentCashSessionId={currentCashSessionId} />
      </p>
      <p>Creado: {formatDateTime(delivery.created_at)}</p>
      <p>Despachado: {formatDateTime(delivery.dispatched_at)}</p>
      <p>No entregado: {formatDateTime(delivery.failed_at)}</p>
      <p>Valor: {formatCurrency(delivery.delivery_fee)}</p>
      <DeliverySourceCell delivery={delivery} />
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => onDetail(delivery)}>
        <Eye className="h-4 w-4" />
        Detalle
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onAssignDriver(delivery)}
        disabled={!canAssignDriver}
      >
        <UserCheck className="h-4 w-4" />
        {getDriverActionLabel(delivery)}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => onTicket(delivery)}>
        <FileText className="h-4 w-4" />
        Ticket domicilio
      </Button>
      <DeliveryActions
        delivery={delivery}
        permissions={permissions}
        disabled={actionDisabled}
        onAction={onAction}
      />
    </div>
  </article>
);

export const DeliveriesScreen = ({
  initialSearchParams = {},
}: {
  initialSearchParams?: DeliverySearchParamsInput;
}) => {
  const router = useRouter();
  const params = useParams<{ tenant?: string | string[] }>();
  const initialFilters = useMemo(
    () => buildDeliveryFiltersFromSearchParams(initialSearchParams),
    [initialSearchParams]
  );
  const initialFiltersKey = useMemo(
    () => serializeDeliveryFilters(initialFilters),
    [initialFilters]
  );
  const role = (
    useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? "") ??
    ""
  )
    .trim()
    .toUpperCase();
  const permissionsLoaded = useAppSelector(
    (state) => state.auth.permissionsLoaded
  );
  const authPermissions = useAppSelector((state) => state.auth.permissions);
  const authTenantId = useAppSelector(
    (state) => state.auth.user?.tenantId ?? state.auth.tenantId
  );
  const posCashRegisterId = useAppSelector((state) => state.pos.cashRegisterId);
  const posSessionId = useAppSelector((state) => state.pos.posSessionId);
  const tenantSlug =
    getParamValue(params?.tenant) ??
    authTenantId ??
    "default";
  const deliveryPermission = useMemo(
    () => findDeliveryPermission(authPermissions),
    [authPermissions]
  );
  const canView = canReadDeliveries(deliveryPermission, role);
  const canCreate = canCreateDelivery(deliveryPermission, role);
  const isAdminRole = ["SUPER_ADMIN", "SUPER_USER", "ADMIN"].includes(role);
  const actionPermissions = useMemo<DeliveryActionPermissionMap>(
    () => buildDeliveryActionPermissionMap(deliveryPermission, role),
    [deliveryPermission, role]
  );

  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [currentCashSession, setCurrentCashSession] =
    useState<CashSession | null>(null);
  const [driversLoading, setDriversLoading] = useState(false);
  const [cashSessionLoading, setCashSessionLoading] = useState(true);
  const [lastInitialFiltersKey, setLastInitialFiltersKey] =
    useState(initialFiltersKey);
  const [draftFilters, setDraftFilters] = useState<DeliveryFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<DeliveryFilters>(initialFilters);
  const [pagination, setPagination] = useState(defaultPagination);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [detailDelivery, setDetailDelivery] = useState<DeliveryRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionRequest, setActionRequest] = useState<ActionRequest | null>(null);
  const [actionDraft, setActionDraft] = useState<ActionDraft>(emptyActionDraft);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState(false);
  const [driverAssignmentDelivery, setDriverAssignmentDelivery] =
    useState<DeliveryRecord | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [driverAssignmentError, setDriverAssignmentError] = useState<string | null>(
    null
  );
  const [savingDriverAssignment, setSavingDriverAssignment] = useState(false);
  const [ticketPreview, setTicketPreview] = useState<{
    deliveryId: string;
    title: string;
    fileName: string;
  } | null>(null);

  useAutoClearState(toastMessage, setToastMessage);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  const loadDrivers = useCallback(async () => {
    setDriversLoading(true);
    try {
      const response = await listDeliveryDrivers({ active: true });
      setDrivers(response);
    } catch (error) {
      showToast(
        getApiErrorMessage(error, "No se pudieron cargar los repartidores."),
        "error"
      );
    } finally {
      setDriversLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!permissionsLoaded || !canView) {
      return;
    }

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
  }, [canView, permissionsLoaded, posCashRegisterId, posSessionId]);

  useEffect(() => {
    if (lastInitialFiltersKey === initialFiltersKey) {
      return;
    }

    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPagination(defaultPagination);
    setHasLoaded(false);
    setLastInitialFiltersKey(initialFiltersKey);
  }, [initialFilters, initialFiltersKey, lastInitialFiltersKey]);

  const loadDeliveries = useCallback(
    async (
      filters: DeliveryFilters,
      targetPage: number,
      targetPageSize = pageSize
    ) => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const response = await listDeliveries(
          buildListParams(
            filters,
            targetPage,
            targetPageSize,
            currentCashSession?.id
          )
        );
        setDeliveries(response.data);
        setPagination(response.pagination);
        setHasLoaded(true);
      } catch (error) {
        setErrorMessage(
          getApiErrorMessage(error, "No se pudieron cargar los domicilios.")
        );
        setHasLoaded(true);
      } finally {
        setLoading(false);
      }
    },
    [currentCashSession?.id, pageSize]
  );

  useEffect(() => {
    if (!permissionsLoaded || !canView || cashSessionLoading || hasLoaded) {
      return;
    }
    void loadDeliveries(appliedFilters, 1, pageSize);
  }, [
    appliedFilters,
    canView,
    cashSessionLoading,
    hasLoaded,
    loadDeliveries,
    pageSize,
    permissionsLoaded,
  ]);

  useEffect(() => {
    if (!permissionsLoaded || !canView) {
      return;
    }
    void loadDrivers();
  }, [canView, loadDrivers, permissionsLoaded]);

  const visibleDeliveries = useMemo(
    () => filterDeliveriesByQuery(deliveries, appliedFilters.query),
    [appliedFilters.query, deliveries]
  );

  const applyFilters = () => {
    const nextFilters = draftFilters;
    setAppliedFilters(nextFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
    void loadDeliveries(nextFilters, 1, pageSize);
  };

  const resetFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
    void loadDeliveries(defaultFilters, 1, pageSize);
  };

  const refreshCurrentPage = useCallback(async () => {
    await loadDeliveries(appliedFilters, pagination.page, pageSize);
  }, [appliedFilters, loadDeliveries, pageSize, pagination.page]);

  const changePage = (nextPage: number) => {
    setPagination((prev) => ({ ...prev, page: nextPage }));
    void loadDeliveries(appliedFilters, nextPage, pageSize);
  };

  const changePageSize = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPagination((prev) => ({ ...prev, page: 1, limit: nextPageSize }));
    void loadDeliveries(appliedFilters, 1, nextPageSize);
  };

  const openDetail = async (delivery: DeliveryRecord) => {
    setDetailDelivery(delivery);
    setDetailLoading(true);
    try {
      const detail = await getDeliveryById(delivery.id);
      setDetailDelivery(detail);
    } catch (error) {
      showToast(
        getApiErrorMessage(error, "No se pudo cargar el detalle."),
        "error"
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const openAction = (action: DeliveryActionKey, delivery: DeliveryRecord) => {
    if (shouldBlockCashImpactAction(delivery, currentCashSession?.id)) {
      showToast(
        "Abre la caja actual de este domicilio antes de ejecutar acciones operativas.",
        "error"
      );
      return;
    }
    setActionRequest({ action, delivery });
    setActionDraft(emptyActionDraft);
    setActionError(null);
  };

  const openDriverAssignment = (delivery: DeliveryRecord) => {
    setDriverAssignmentDelivery(delivery);
    setSelectedDriverId(delivery.driver_id ?? "");
    setDriverAssignmentError(null);
  };

  const openDeliveryTicket = (delivery: DeliveryRecord) => {
    const label = delivery.delivery_number || delivery.id.slice(0, 8);
    setTicketPreview({
      deliveryId: delivery.id,
      title: `Ticket domicilio ${label}`,
      fileName: getDeliveryTicketFileName(delivery.id),
    });
  };

  const closeAction = () => {
    if (savingAction) {
      return;
    }
    setActionRequest(null);
    setActionDraft(emptyActionDraft);
    setActionError(null);
  };

  const closeDriverAssignment = () => {
    if (savingDriverAssignment) {
      return;
    }
    setDriverAssignmentDelivery(null);
    setSelectedDriverId("");
    setDriverAssignmentError(null);
  };

  const refreshAfterMutation = async (message: string) => {
    showToast(message, "success");
    await refreshCurrentPage();
    if (detailDelivery) {
      try {
        const detail = await getDeliveryById(detailDelivery.id);
        setDetailDelivery(detail);
      } catch {
        setDetailDelivery(null);
      }
    }
  };

  const handleSubmitAction = async () => {
    if (!actionRequest) {
      return;
    }

    const { action, delivery } = actionRequest;
    const reason = actionDraft.reason.trim();
    const notes = optionalText(actionDraft.notes);

    if ((action === "cancel" || action === "mark-not-delivered") && !reason) {
      setActionError("Motivo es requerido.");
      return;
    }

    setSavingAction(true);
    setActionError(null);
    try {
      if (action === "prepare") {
        await prepareDelivery(delivery.id, {
          notes,
          metadata: { source: "frontend" },
        });
      }
      if (action === "dispatch") {
        await dispatchDelivery(delivery.id, {
          notes,
          metadata: { source: "frontend" },
        });
      }
      if (action === "mark-delivered") {
        await markDeliveryDelivered(delivery.id, {
          received_by: optionalText(actionDraft.receivedBy),
          notes,
          metadata: { source: "frontend", no_cash_integration: true },
        });
      }
      if (action === "mark-not-delivered") {
        await markDeliveryNotDelivered(delivery.id, {
          reason,
          notes,
          metadata: { source: "frontend", no_cash_integration: true },
        });
      }
      if (action === "cancel") {
        await cancelDelivery(delivery.id, {
          reason,
          notes,
          metadata: { source: "frontend", no_cash_integration: true },
        });
      }

      setActionRequest(null);
      setActionDraft(emptyActionDraft);
      await refreshAfterMutation(
        `Accion "${getDeliveryActionLabel(action, delivery)}" ejecutada correctamente.`
      );
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, "No se pudo ejecutar la accion.")
      );
    } finally {
      setSavingAction(false);
    }
  };

  const handleSubmitDriverAssignment = async () => {
    if (!driverAssignmentDelivery) {
      return;
    }

    setSavingDriverAssignment(true);
    setDriverAssignmentError(null);
    try {
      await assignDeliveryDriver(driverAssignmentDelivery.id, {
        driver_id: selectedDriverId || null,
      });
      setDriverAssignmentDelivery(null);
      setSelectedDriverId("");
      await refreshAfterMutation(
        selectedDriverId
          ? "Repartidor asignado correctamente."
          : "Repartidor removido correctamente."
      );
    } catch (error) {
      setDriverAssignmentError(
        getApiErrorMessage(error, "No se pudo asignar el repartidor.")
      );
    } finally {
      setSavingDriverAssignment(false);
    }
  };

  if (!permissionsLoaded) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Cargando permisos...
      </section>
    );
  }

  if (!canView) {
    return (
      <section className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
        No tienes acceso a Domicilios.
      </section>
    );
  }

  const currentPage = pagination.page || 1;
  const totalPages = Math.max(pagination.total_pages || 1, 1);
  const actionDisabled = savingAction || loading;
  const canAssignDriver = actionPermissions.prepare;
  const getRowActionDisabled = (delivery: DeliveryRecord) =>
    actionDisabled ||
    shouldBlockCashImpactAction(delivery, currentCashSession?.id);
  const currentCashSessionId = currentCashSession?.id ?? null;

  return (
    <div className="w-full max-w-full min-w-0 space-y-6 overflow-x-hidden">
      {actionRequest ? (
        <DeliveryActionModal
          request={actionRequest}
          draft={actionDraft}
          errorMessage={actionError}
          saving={savingAction}
          onChange={setActionDraft}
          onClose={closeAction}
          onSubmit={() => void handleSubmitAction()}
        />
      ) : null}

      {driverAssignmentDelivery ? (
        <DeliveryDriverAssignmentModal
          delivery={driverAssignmentDelivery}
          drivers={drivers}
          selectedDriverId={selectedDriverId}
          saving={savingDriverAssignment}
          errorMessage={driverAssignmentError}
          onChange={setSelectedDriverId}
          onClose={closeDriverAssignment}
          onSubmit={() => void handleSubmitDriverAssignment()}
        />
      ) : null}

      {detailDelivery ? (
        <DeliveryDetailPanel
          delivery={detailDelivery}
          loading={detailLoading}
          permissions={actionPermissions}
          actionDisabled={
            actionDisabled || shouldBlockCashImpactAction(detailDelivery, currentCashSessionId)
          }
          currentCashSessionId={currentCashSessionId}
          onClose={() => setDetailDelivery(null)}
          onAction={openAction}
          onAssignDriver={canAssignDriver ? openDriverAssignment : undefined}
          onTicket={openDeliveryTicket}
        />
      ) : null}

      <PdfPreviewModal
        isOpen={Boolean(ticketPreview)}
        title={ticketPreview?.title ?? "Ticket domicilio"}
        fileName={ticketPreview?.fileName ?? "ticket-domicilio.pdf"}
        onClose={() => setTicketPreview(null)}
        getPdf={() =>
          ticketPreview
            ? getDeliveryTicket(ticketPreview.deliveryId)
            : Promise.reject(new Error("delivery ticket not selected"))
        }
      />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Operacion
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">Domicilios</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Consulta y actualiza el estado operativo de domicilios. Caja, POS
              y facturacion electronica quedan fuera de esta pantalla.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              variant="outline"
              onClick={() => router.push(`/${tenantSlug}/deliveries/drivers`)}
              className="w-full sm:w-auto"
            >
              <Users className="h-4 w-4" />
              Repartidores
            </Button>
            <Button
              variant="ghost"
              onClick={() => void refreshCurrentPage()}
              isLoading={loading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            {canCreate ? (
              <Button
                onClick={() => router.push(`/${tenantSlug}/deliveries/new`)}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Crear domicilio
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section
        className={`rounded-lg border p-4 text-sm shadow-sm ${
          currentCashSession
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            {currentCashSession
              ? `Caja actual: ${
                  currentCashSession.cashRegisterNombre ??
                  currentCashSession.cashRegisterCodigo ??
                  currentCashSession.id
                }. La vista operativa usa esta caja cuando filtras por caja actual.`
              : cashSessionLoading
                ? "Verificando caja actual..."
                : "No tienes una caja abierta. La gestion operativa de domicilios con valor esta limitada."}
          </p>
          {!currentCashSession && !cashSessionLoading ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/${tenantSlug}/pos/select-context`)}
            >
              Ir a POS / Seleccionar caja
            </Button>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_170px_1fr_1fr_190px_155px_155px_170px_110px]">
            <Input
              label="Buscar"
              placeholder="Contacto, telefono, direccion"
              value={draftFilters.query}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  query: event.target.value,
                }))
              }
              hint="Busqueda local sobre la pagina cargada."
            />
            <Select
              label="Estado"
              value={draftFilters.status}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  status: event.target.value as "" | DeliveryStatus,
                }))
              }
            >
              <option value="">Todos</option>
              {DELIVERY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {deliveryStatusLabels[status]}
                </option>
              ))}
            </Select>
            <Input
              label="Pedido"
              value={draftFilters.orderId}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  orderId: event.target.value,
                }))
              }
            />
            <Input
              label="Venta/factura"
              value={draftFilters.saleId}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  saleId: event.target.value,
                }))
              }
            />
            <Select
              label="Repartidor"
              value={draftFilters.driverId}
              disabled={driversLoading}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  driverId: event.target.value,
                }))
              }
            >
              <option value="">Todos</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </Select>
            <Input
              label="Desde"
              type="date"
              value={draftFilters.dateFrom}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  dateFrom: event.target.value,
                }))
              }
            />
            <Input
              label="Hasta"
              type="date"
              value={draftFilters.dateTo}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  dateTo: event.target.value,
                }))
              }
            />
            <Select
              label="Caja"
              value={draftFilters.cashScope}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  cashScope: event.target.value === "all" ? "all" : "current",
                }))
              }
              disabled={!isAdminRole && !currentCashSession}
            >
              <option value="current">
                {currentCashSession ? "Caja actual" : "Sin caja actual"}
              </option>
              <option value="all">
                {isAdminRole ? "Todas" : "Consulta general"}
              </option>
            </Select>
            <Select
              label="Filas"
              value={String(pageSize)}
              onChange={(event) => changePageSize(Number(event.target.value))}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={applyFilters} className="w-full sm:w-auto">
              <Search className="h-4 w-4" />
              Buscar
            </Button>
            <Button variant="ghost" onClick={resetFilters} className="w-full sm:w-auto">
              Limpiar filtros
            </Button>
          </div>
      </section>

      {errorMessage ? (
        <section className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {errorMessage}
        </section>
      ) : null}

      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Listado de domicilios
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {pagination.total} registros backend. {visibleDeliveries.length} visibles
                en esta pagina.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              <Truck className="h-4 w-4" />
              {appliedFilters.cashScope === "current" && currentCashSession
                ? "Caja actual"
                : "Consulta general"}
            </div>
          </div>

          <div className="mt-5 hidden overflow-x-auto lg:block">
            <table className="min-w-[1180px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Caja</th>
                  <th className="px-4 py-3 font-medium">Contacto</th>
                  <th className="px-4 py-3 font-medium">Telefono</th>
                  <th className="px-4 py-3 font-medium">Direccion</th>
                  <th className="px-4 py-3 font-medium">Origen</th>
                  <th className="px-4 py-3 font-medium">Repartidor</th>
                  <th className="px-4 py-3 font-medium">Fechas</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                      Cargando domicilios...
                    </td>
                  </tr>
                ) : !hasLoaded ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                      Usa Buscar para consultar domicilios.
                    </td>
                  </tr>
                ) : visibleDeliveries.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                      No hay domicilios para mostrar.
                    </td>
                  </tr>
                ) : (
                  visibleDeliveries.map((delivery) => (
                    <tr key={delivery.id}>
                      <td className="px-4 py-3">
                        <DeliveryStatusBadge status={delivery.status} />
                      </td>
                      <td className="px-4 py-3">
                        <DeliveryCashBadge
                          delivery={delivery}
                          currentCashSessionId={currentCashSessionId}
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-900">
                        <div className="max-w-[180px]">
                          <p className="truncate font-medium">
                            {delivery.customer_name || "Sin contacto"}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {delivery.delivery_number}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {delivery.customer_phone || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="max-w-[220px]">
                          <p className="line-clamp-2">{delivery.delivery_address}</p>
                          {delivery.delivery_reference ? (
                            <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                              {delivery.delivery_reference}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <DeliverySourceCell delivery={delivery} />
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {getDriverLabel(delivery)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <p>Creado: {formatDateTime(delivery.created_at)}</p>
                        <p>Actualizado: {formatDateTime(delivery.updated_at)}</p>
                        <p>Despachado: {formatDateTime(delivery.dispatched_at)}</p>
                        <p>Entregado: {formatDateTime(delivery.delivered_at)}</p>
                        <p>No entregado: {formatDateTime(delivery.failed_at)}</p>
                        <p>Cancelado: {formatDateTime(delivery.cancelled_at)}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <p className="font-medium text-slate-900">
                          {formatCurrency(delivery.delivery_fee)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {getDeliveryFeeSource(delivery)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void openDetail(delivery)}
                          >
                            <Eye className="h-4 w-4" />
                            Detalle
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDriverAssignment(delivery)}
                            disabled={savingAction || loading || !canAssignDriver}
                          >
                            <UserCheck className="h-4 w-4" />
                            {getDriverActionLabel(delivery)}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeliveryTicket(delivery)}
                          >
                            <FileText className="h-4 w-4" />
                            Ticket domicilio
                          </Button>
                          <DeliveryActions
                            delivery={delivery}
                            permissions={actionPermissions}
                            disabled={getRowActionDisabled(delivery)}
                            onAction={openAction}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-3 lg:hidden">
            {loading ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                Cargando domicilios...
              </div>
            ) : !hasLoaded ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                Usa Buscar para consultar domicilios.
              </div>
            ) : visibleDeliveries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                No hay domicilios para mostrar.
              </div>
            ) : (
              visibleDeliveries.map((delivery) => (
                <MobileDeliveryCard
                  key={delivery.id}
                  delivery={delivery}
                  permissions={actionPermissions}
                  actionDisabled={getRowActionDisabled(delivery)}
                  onDetail={(item) => void openDetail(item)}
                  onAction={openAction}
                  onAssignDriver={openDriverAssignment}
                  onTicket={openDeliveryTicket}
                  canAssignDriver={canAssignDriver}
                  currentCashSessionId={currentCashSessionId}
                />
              ))
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Pagina {Math.min(currentPage, totalPages)} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => changePage(Math.max(currentPage - 1, 1))}
                disabled={currentPage <= 1 || loading}
              >
                Anterior
              </Button>
              <Button
                variant="ghost"
                onClick={() => changePage(Math.min(currentPage + 1, totalPages))}
                disabled={currentPage >= totalPages || loading}
              >
                Siguiente
              </Button>
            </div>
          </div>
      </section>
    </div>
  );
};
