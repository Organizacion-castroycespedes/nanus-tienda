"use client";

import { Download, Eye, PackageCheck, Plus, RefreshCw, Search, X, XCircle } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { NoticeDialog } from "../../../components/design-system/NoticeDialog";
import { Select } from "../../../components/design-system/Select";
import { listPaymentMethods } from "../../../modules/finance/services/finance.service";
import type { PaymentMethod } from "../../../modules/finance/types";
import { useInventoryScope } from "../../../hooks/useInventoryScope";
import { hasPermission } from "../../../lib/permissions";
import { useNoticeDialog } from "../../../hooks/useNoticeDialog";
import { useAppSelector } from "../../../store/hooks";
import {
  CancelPurchaseForm,
  validateCancelPurchaseReason,
} from "../../../modules/inventory/components/CancelPurchaseForm";
import { DocumentPaymentForm } from "../../../modules/finance/components/DocumentPaymentForm";
import { PurchaseActionHeader } from "../../../modules/inventory/components/PurchaseActionHeader";
import { PurchaseForm } from "../../../modules/inventory/components/PurchaseForm";
import {
  OVERPAYMENT_SETTLEMENT_MESSAGE,
  SettlePartialPurchaseForm,
  validateSettlePartialPurchaseReason,
} from "../../../modules/inventory/components/SettlePartialPurchaseForm";
import { PurchaseDetailPanel } from "../../../modules/inventory/components/PurchaseDetailPanel";
import { PurchaseReceiveForm } from "../../../modules/inventory/components/PurchaseReceiveForm";
import { usePurchases } from "../../../modules/inventory/hooks/use-purchases";
import type { PurchaseResponse } from "../../../modules/inventory/services/purchase.service";
import { isPurchaseCancelable } from "../../../modules/inventory/utils/purchase-cancellation";
import { getPurchaseTicket } from "../../../modules/reporteria/services/reporting.service";
import { downloadBlob, getApiErrorMessage } from "../../../modules/reporteria/utils";

type PurchaseFilters = {
  query: string;
  tenantId: string;
  branchId: string;
  fromDate: string;
  toDate: string;
  status: string;
  paymentMethod: string;
};

type PurchasePanelAction =
  | "detail"
  | "receive"
  | "pay"
  | "cancel"
  | "settle-partial"
  | "ticket";

type NoticeConfirmAction = "cancel" | "settle-partial" | "discard-create" | null;

const defaultFilters: PurchaseFilters = {
  query: "",
  tenantId: "",
  branchId: "",
  fromDate: "",
  toDate: "",
  status: "",
  paymentMethod: "",
};

const pageSizeOptions = [10, 25, 50];

const purchaseStatusOptions: Array<PurchaseResponse["status"]> = [
  "DRAFT",
  "PENDING",
  "PARTIAL",
  "RECEIVED",
  "CERRADA_PARCIAL",
  "CANCELLED",
];

const filterQueryKeys = [
  "search",
  "tenantId",
  "branchId",
  "fromDate",
  "toDate",
  "status",
  "paymentMethod",
  "page",
  "pageSize",
] as const;

const getFiltersFromQuery = (params: URLSearchParams): PurchaseFilters => ({
  query: params.get("search") ?? "",
  tenantId: params.get("tenantId") ?? "",
  branchId: params.get("branchId") ?? "",
  fromDate: params.get("fromDate") ?? "",
  toDate: params.get("toDate") ?? "",
  status: params.get("status") ?? "",
  paymentMethod: params.get("paymentMethod") ?? "",
});

const getPageFromQuery = (params: URLSearchParams) => {
  const queryPage = Number(params.get("page"));
  return Number.isFinite(queryPage) && queryPage > 0 ? queryPage - 1 : 0;
};

const getPageSizeFromQuery = (params: URLSearchParams) => {
  const queryPageSize = Number(params.get("pageSize"));
  return pageSizeOptions.includes(queryPageSize) ? queryPageSize : 10;
};

const writeFiltersToQuery = (
  params: URLSearchParams,
  filters: PurchaseFilters,
  nextPage: number,
  nextPageSize: number
) => {
  const entries: Array<[keyof PurchaseFilters, string]> = [
    ["query", "search"],
    ["tenantId", "tenantId"],
    ["branchId", "branchId"],
    ["fromDate", "fromDate"],
    ["toDate", "toDate"],
    ["status", "status"],
    ["paymentMethod", "paymentMethod"],
  ];

  entries.forEach(([filterKey, queryKey]) => {
    const value = filters[filterKey].trim();
    if (value) {
      params.set(queryKey, value);
    } else {
      params.delete(queryKey);
    }
  });

  if (nextPage > 0) {
    params.set("page", String(nextPage + 1));
  } else {
    params.delete("page");
  }

  if (nextPageSize !== 10) {
    params.set("pageSize", String(nextPageSize));
  } else {
    params.delete("pageSize");
  }
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));

const isPurchaseCancellationConflict = (message: string) =>
  /recibid|cerrad|pagad|inventario|reverso|estado/i.test(message);

const purchasePanelActions = new Set<PurchasePanelAction>([
  "detail",
  "receive",
  "pay",
  "cancel",
  "settle-partial",
  "ticket",
]);

const isPurchasePanelAction = (value: string | null): value is PurchasePanelAction =>
  value !== null && purchasePanelActions.has(value as PurchasePanelAction);

const PurchasesPage = () => {
  const {
    purchases,
    loading,
    canceling: isCancelling,
    liquidating: isLiquidating,
    loadingDetail,
    purchaseDetail,
    errorMessage,
    hasLoaded: hasSearched,
    loadPurchases: loadPurchaseList,
    loadPurchaseDetail,
    cancelItem,
    liquidateItem,
  } = usePurchases();
  const [draftFilters, setDraftFilters] = useState<PurchaseFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<PurchaseFilters>(defaultFilters);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationError, setCancellationError] = useState<string | null>(null);
  const [liquidationReason, setLiquidationReason] = useState("");
  const [liquidationError, setLiquidationError] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [noticeConfirmAction, setNoticeConfirmAction] = useState<NoticeConfirmAction>(null);
  const [createHasUnsavedChanges, setCreateHasUnsavedChanges] = useState(false);
  const notice = useNoticeDialog();
  const ticketFrameRef = useRef<HTMLIFrameElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activePurchaseId = searchParams.get("purchaseId");
  const activeActionParam = searchParams.get("action");
  const isCreateAction = activeActionParam === "create";
  const activeAction = isPurchasePanelAction(activeActionParam) ? activeActionParam : null;
  const filterQuerySignature = filterQueryKeys
    .map((key) => `${key}:${searchParams.get(key) ?? ""}`)
    .join("|");
  const activeViewMode: PurchasePanelAction | "create" | null = isCreateAction
    ? "create"
    : activeAction;
  const isActionMode = activeViewMode !== null;
  const { currentTenant } = useInventoryScope();
  const role = useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? "");
  const canViewAllTenants = role === "SUPER_ADMIN";

  const isAdminLikeRole =
    role === "ADMIN" || role === "USER" || role === "SUPER_ADMIN" || role === "SUPER_USER";
  const canCreate = hasPermission("inventory.create") || isAdminLikeRole;
  const canReceive = hasPermission("inventory.update") || isAdminLikeRole;
  const canCancel = hasPermission("inventory.cancel");
  const canSettlePartial = hasPermission("inventory.settle_partial");

  const openPurchasePanel = useCallback(
    (action: PurchasePanelAction, purchaseId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("purchaseId", purchaseId);
      params.set("action", action);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const openCreateForm = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("purchaseId");
    params.set("action", "create");
    const nextQuery = params.toString();
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleBackToList = useCallback(() => {
    setCreateHasUnsavedChanges(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("purchaseId");
    params.delete("action");
    const nextQuery = params.toString();
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const requestBackToList = useCallback(() => {
    if (activeViewMode === "create" && createHasUnsavedChanges) {
      setNoticeConfirmAction("discard-create");
      notice.showWarning("Cambios sin guardar", "Tienes cambios sin guardar. ¿Deseas salir?");
      return;
    }

    handleBackToList();
  }, [activeViewMode, createHasUnsavedChanges, handleBackToList, notice]);

  const resolvePurchaseFilters = useCallback(
    (filters?: PurchaseFilters) => {
      if (canViewAllTenants) {
        return {
          tenantId: filters?.tenantId || undefined,
          branchId: filters?.branchId || undefined,
          fromDate: filters?.fromDate || undefined,
          toDate: filters?.toDate || undefined,
          status: filters?.status || undefined,
          paymentMethod: filters?.paymentMethod || undefined,
        };
      }

      return {
        tenantId: currentTenant || undefined,
        branchId: filters?.branchId || undefined,
        fromDate: filters?.fromDate || undefined,
        toDate: filters?.toDate || undefined,
        status: filters?.status || undefined,
        paymentMethod: filters?.paymentMethod || undefined,
      };
    },
    [canViewAllTenants, currentTenant]
  );

  const loadPurchases = useCallback(async (filters?: PurchaseFilters) => {
    const activeFilters = filters ?? appliedFilters;
    await loadPurchaseList(resolvePurchaseFilters(activeFilters));
  }, [appliedFilters, loadPurchaseList, resolvePurchaseFilters]);

  const pushListQuery = useCallback(
    (filters: PurchaseFilters, nextPage: number, nextPageSize: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("purchaseId");
      params.delete("action");
      writeFiltersToQuery(params, filters, nextPage, nextPageSize);
      const nextQuery = params.toString();
      router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const activePurchase = useMemo(() => {
    if (!activePurchaseId) {
      return null;
    }
    return (
      purchases.find((purchase) => purchase.id === activePurchaseId) ??
      (purchaseDetail?.id === activePurchaseId ? purchaseDetail : null)
    );
  }, [activePurchaseId, purchaseDetail, purchases]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const nextFilters = getFiltersFromQuery(params);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPage(getPageFromQuery(params));
    setPageSize(getPageSizeFromQuery(params));
  }, [filterQuerySignature]);

  useEffect(() => {
    if (!activePurchaseId || !activeAction) {
      return;
    }
    if (
      activeAction === "detail" ||
      activeAction === "receive" ||
      activeAction === "pay" ||
      activeAction === "cancel" ||
      activeAction === "settle-partial" ||
      activeAction === "ticket"
    ) {
      void loadPurchaseDetail(activePurchaseId);
    }
  }, [activeAction, activePurchaseId, loadPurchaseDetail]);

  useEffect(() => {
    if (activeAction !== "cancel") {
      setCancellationReason("");
      setCancellationError(null);
    }
    if (activeAction !== "settle-partial") {
      setLiquidationReason("");
      setLiquidationError(null);
    }
  }, [activeAction, activePurchaseId]);

  useEffect(() => {
    void (async () => {
      try {
        const result = await listPaymentMethods({ active: true });
        setPaymentMethods(result.filter((method) => method.active));
      } catch {
        setPaymentMethods([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (activeAction !== "ticket" || !activePurchaseId) {
      setPreviewBlob(null);
      setPreviewError(null);
      return;
    }

    let active = true;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewBlob(null);

    void getPurchaseTicket(activePurchaseId)
      .then((blob) => {
        if (active) {
          setPreviewBlob(blob);
        }
      })
      .catch((error) => {
        if (active) {
          const message = getApiErrorMessage(error, "No se pudo abrir el PDF.");
          setPreviewError(message);
          notice.showFromApiError(error, message);
        }
      })
      .finally(() => {
        if (active) {
          setPreviewLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeAction, activePurchaseId, notice.showFromApiError]);

  const previewObjectUrl = useMemo(() => {
    if (!previewBlob) {
      return null;
    }
    return URL.createObjectURL(previewBlob);
  }, [previewBlob]);

  useEffect(() => {
    return () => {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
    };
  }, [previewObjectUrl]);

  const tenantOptions = useMemo(() => {
    const seen = new Map<string, string>();
    purchases.forEach((purchase) => {
      if (purchase.tenantId && purchase.tenantName && !seen.has(purchase.tenantId)) {
        seen.set(purchase.tenantId, purchase.tenantName);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [purchases]);

  const branchOptions = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();
    purchases
      .filter((purchase) =>
        draftFilters.tenantId ? purchase.tenantId === draftFilters.tenantId : true
      )
      .forEach((purchase) => {
        if (purchase.branchId && purchase.branchName) {
          const key = `${purchase.tenantId}:${purchase.branchId}`;
          if (!seen.has(key)) {
            seen.set(key, { id: purchase.branchId, name: purchase.branchName });
          }
        }
      });

    return Array.from(seen.values());
  }, [draftFilters.tenantId, purchases]);

  const filteredPurchases = useMemo(() => {
    const query = appliedFilters.query.trim().toLowerCase();
    const statusFilter = appliedFilters.status.trim();
    const statusMatches = (purchase: PurchaseResponse) =>
      !statusFilter || purchase.status === statusFilter;

    if (!query) {
      return purchases.filter(statusMatches);
    }

    return purchases.filter((purchase) => {
      if (!statusMatches(purchase)) {
        return false;
      }

      const supplierName = (purchase.supplierName ?? "").toLowerCase();
      const type = purchase.type.toLowerCase();
      const status = purchase.status.toLowerCase();
      const branchName = (purchase.branchName ?? "").toLowerCase();
      const terminalName = (purchase.terminalName ?? "").toLowerCase();
      return (
        supplierName.includes(query) ||
        type.includes(query) ||
        status.includes(query) ||
        branchName.includes(query) ||
        terminalName.includes(query)
      );
    });
  }, [appliedFilters.query, appliedFilters.status, purchases]);

  const paginatedPurchases = useMemo(() => {
    const start = page * pageSize;
    return filteredPurchases.slice(start, start + pageSize);
  }, [filteredPurchases, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / pageSize));

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPage(0);
    pushListQuery(draftFilters, 0, pageSize);
    void loadPurchases(draftFilters);
  };

  const resetFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPage(0);
    pushListQuery(defaultFilters, 0, pageSize);
  };

  const discardCreateChanges = () => {
    setNoticeConfirmAction(null);
    notice.close();
    handleBackToList();
  };

  const handleCreateSuccess = async (response?: unknown) => {
    handleBackToList();
    notice.showFromApiResponse(response, "Compra creada correctamente.", "Operacion exitosa");
    if (hasSearched) {
      await loadPurchases();
    }
  };

  const handleReceiveSuccess = async (response?: unknown) => {
    handleBackToList();
    notice.showFromApiResponse(
      response,
      "Recepcion registrada correctamente.",
      "Operacion exitosa"
    );
    if (hasSearched) {
      await loadPurchases();
    }
  };

  const canCancelPurchase = (purchase: PurchaseResponse) =>
    isPurchaseCancelable(purchase, canCancel);

  const canLiquidatePurchase = (purchase: PurchaseResponse) =>
    canSettlePartial && purchase.status === "PARTIAL";

  const closeCancelForm = () => {
    if (isCancelling) {
      return;
    }
    setNoticeConfirmAction(null);
    notice.close();
    handleBackToList();
    setCancellationReason("");
    setCancellationError(null);
  };

  const requestCancelConfirmation = () => {
    const reason = cancellationReason.trim();
    if (!activePurchase) {
      return;
    }
    const validationError = validateCancelPurchaseReason(reason);
    if (validationError) {
      setCancellationError(validationError);
      return;
    }

    setCancellationError(null);
    setNoticeConfirmAction("cancel");
    notice.showWarning(
      "Cancelar compra",
      "Esta accion cambiara el estado de la compra y no podra recibirse mercancia asociada."
    );
  };

  const handleCancelPurchase = async () => {
    const reason = cancellationReason.trim();
    if (!activePurchase) {
      return;
    }

    setCancellationError(null);
    try {
      const response = await cancelItem(activePurchase.id, { motivoCancelacion: reason });
      handleBackToList();
      setCancellationReason("");
      setNoticeConfirmAction(null);
      notice.showFromApiResponse(
        response,
        "Compra cancelada correctamente.",
        "Operacion exitosa"
      );
      if (hasSearched) {
        await loadPurchases();
      }
    } catch (error) {
      const apiMessage = error instanceof Error ? error.message : getApiErrorMessage(error, "");
      const message = isPurchaseCancellationConflict(apiMessage)
        ? "Esta compra no puede cancelarse porque ya fue recibida, cerrada o pagada."
        : "No se pudo cancelar la compra. Intenta nuevamente.";
      setCancellationError(message);
      setNoticeConfirmAction(null);
      notice.showFromApiError(error, message);
    }
  };

  const openLiquidateFromDetail = () => {
    if (!purchaseDetail) {
      return;
    }
    openPurchasePanel("settle-partial", purchaseDetail.id);
    setLiquidationReason("");
    setLiquidationError(null);
  };

  const closeLiquidateForm = () => {
    if (isLiquidating) {
      return;
    }
    setNoticeConfirmAction(null);
    notice.close();
    handleBackToList();
    setLiquidationReason("");
    setLiquidationError(null);
  };

  const requestLiquidateConfirmation = () => {
    const reason = liquidationReason.trim();
    if (!activePurchaseId) {
      return;
    }
    const validationError = validateSettlePartialPurchaseReason(reason);
    if (validationError) {
      setLiquidationError(validationError);
      return;
    }

    setLiquidationError(null);
    setNoticeConfirmAction("settle-partial");
    notice.showWarning(
      "Liquidar compra parcial",
      "Esta accion cerrara la compra con las cantidades realmente recibidas. No podras recibir cantidades pendientes despues de liquidarla."
    );
  };

  const handleLiquidatePurchase = async () => {
    const reason = liquidationReason.trim();
    if (!activePurchaseId) {
      return;
    }

    setLiquidationError(null);
    try {
      const response = await liquidateItem(activePurchaseId, { motivoLiquidacion: reason });
      handleBackToList();
      setLiquidationReason("");
      setNoticeConfirmAction(null);
      notice.showFromApiResponse(
        response,
        "Compra liquidada correctamente con las cantidades recibidas.",
        "Operacion exitosa"
      );
    } catch (error) {
      const apiMessage = error instanceof Error
        ? error.message
        : getApiErrorMessage(error, "");
      const message = /pagos registrados superan el valor recibido/i.test(apiMessage)
        ? OVERPAYMENT_SETTLEMENT_MESSAGE
        : /estado parcial/i.test(apiMessage)
          ? "Esta compra no puede liquidarse porque no está en estado parcial."
          : "No se pudo liquidar la compra. Intenta nuevamente.";
      setLiquidationError(message);
      setNoticeConfirmAction(null);
      notice.showFromApiError(error, message);
    }
  };

  const canAccessTicket = (status: PurchaseResponse["status"]) => status !== "DRAFT";

  const handleDownloadTicket = async (purchase: PurchaseResponse) => {
    try {
      const blob = await getPurchaseTicket(purchase.id);
      downloadBlob(blob, `ticket-compra-${purchase.id}.pdf`);
    } catch (error) {
      notice.showFromApiError(error, "No se pudo descargar el ticket.");
    }
  };

  const actionHeaderCopy = useMemo(() => {
    switch (activeViewMode) {
      case "create":
        return {
          title: "Crear compra",
          subtitle: "Registra una nueva compra y sus productos asociados.",
        };
      case "detail":
        return {
          title: "Detalle de compra",
          subtitle: "Consulta estado, productos, pagos y trazabilidad de la compra.",
        };
      case "receive":
        return {
          title: "Recibir compra",
          subtitle: "Registra las cantidades realmente recibidas.",
        };
      case "pay":
        return {
          title: "Pagar compra",
          subtitle: "Registra pagos asociados a la compra.",
        };
      case "cancel":
        return {
          title: "Cancelar compra",
          subtitle: "Cancela una compra que aun no puede continuar su flujo.",
        };
      case "settle-partial":
        return {
          title: "Liquidar compra parcial",
          subtitle: "Cierra una compra parcial con las cantidades realmente recibidas.",
        };
      case "ticket":
        return {
          title: "Ticket de compra",
          subtitle: "Visualiza el documento generado para esta compra.",
        };
      default:
        return null;
    }
  }, [activeViewMode]);

  const actionHeaderPurchase = activePurchase ?? purchaseDetail;

  const isInvalidAction = useMemo(() => {
    const purchase = actionHeaderPurchase;
    if (!activeAction || activeAction === "detail" || !purchase) {
      return false;
    }

    if (activeAction === "receive") {
      return (
        purchase.status === "CANCELLED" ||
        purchase.status === "RECEIVED" ||
        purchase.status === "CERRADA_PARCIAL"
      );
    }

    if (activeAction === "pay") {
      return purchase.status === "CANCELLED" || purchase.balanceDue <= 0 || !purchase.branchId;
    }

    if (activeAction === "settle-partial") {
      return purchase.status !== "PARTIAL";
    }

    if (activeAction === "cancel") {
      return !canCancelPurchase(purchase);
    }

    if (activeAction === "ticket") {
      return !canAccessTicket(purchase.status);
    }

    return false;
  }, [activeAction, actionHeaderPurchase]);

  const actionUnavailablePanel = (
    <section className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-amber-700">Accion no disponible</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            Accion no disponible
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Esta accion no esta disponible para el estado actual de la compra.
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Vuelve al listado y selecciona una accion valida para esta compra.
        </div>
        <Button variant="outline" onClick={handleBackToList} className="w-full sm:w-auto">
          Volver al listado
        </Button>
      </div>
    </section>
  );

  const contextualPanel = (
    <>
      {isInvalidAction ? actionUnavailablePanel : null}

      {!isInvalidAction && activeAction === "receive" && activePurchaseId ? (
        <PurchaseReceiveForm
          purchaseId={activePurchaseId}
          onCancel={handleBackToList}
          onSuccess={(response) => void handleReceiveSuccess(response)}
          onError={(error) =>
            notice.showFromApiError(error, "No se pudo registrar la recepcion.")
          }
        />
      ) : null}

      {!isInvalidAction && activeAction === "pay" && activePurchase ? (
        <DocumentPaymentForm
          title="Pagar compra"
          description="Registra el pago asociado a esta compra."
          branchId={activePurchase.branchId ?? ""}
          referenceType="PURCHASE"
          referenceId={activePurchase.id}
          direction="OUT"
          total={activePurchase.total}
          totalLabel="Total compra"
          effectiveTotal={
            activePurchase.status === "CERRADA_PARCIAL"
              ? activePurchase.totalLiquidado ?? activePurchase.total
              : activePurchase.totalRecibido ?? activePurchase.totalLiquidado ?? null
          }
          totalPaid={activePurchase.totalPaid}
          balanceDue={activePurchase.balanceDue}
          paymentStatus={activePurchase.paymentStatus}
          blockReason={
            activePurchase.status === "CANCELLED"
              ? "No se puede pagar una compra cancelada."
              : null
          }
          confirmLabel="Confirmar pago"
          cancelLabel="Volver"
          onCancel={handleBackToList}
          onSuccess={async () => {
            handleBackToList();
            notice.showSuccess("Operacion exitosa", "Pago registrado correctamente.");
            if (hasSearched) {
              await loadPurchases();
            }
          }}
          onError={(error) => notice.showFromApiError(error, "No se pudo registrar el pago.")}
        />
      ) : null}

      {!isInvalidAction && activeAction === "ticket" && activePurchase ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleBackToList();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="purchase-ticket-title"
            aria-describedby="purchase-ticket-description"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="purchase-ticket-title" className="text-xl font-semibold text-slate-900">
                  Ticket de compra {activePurchase.id.slice(0, 8)}
                </h2>
                <p id="purchase-ticket-description" className="mt-2 text-sm text-slate-600">
                  Vista previa del ticket generado por el backend.
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar ticket"
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                onClick={handleBackToList}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-[420px] flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 sm:min-h-[520px]">
              {previewLoading ? (
                <div className="flex h-[420px] items-center justify-center text-sm text-slate-200 sm:h-[520px]">
                  Generando vista previa del PDF...
                </div>
              ) : previewError ? (
                <div className="flex h-[420px] items-center justify-center px-6 text-center text-sm text-rose-200 sm:h-[520px]">
                  {previewError}
                </div>
              ) : previewObjectUrl ? (
                <iframe
                  ref={ticketFrameRef}
                  src={previewObjectUrl}
                  title={`Ticket de compra ${activePurchase.id.slice(0, 8)}`}
                  className="h-[420px] w-full bg-white sm:h-[520px]"
                />
              ) : (
                <div className="flex h-[420px] items-center justify-center text-sm text-slate-200 sm:h-[520px]">
                  No fue posible cargar el archivo.
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={handleBackToList}>
                Cerrar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (previewBlob) {
                    downloadBlob(previewBlob, `ticket-compra-${activePurchase.id}.pdf`);
                  }
                }}
                disabled={!previewBlob || previewLoading}
              >
                Descargar
              </Button>
              <Button
                onClick={() => ticketFrameRef.current?.contentWindow?.print()}
                disabled={!previewObjectUrl || previewLoading}
              >
                Imprimir
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {!isInvalidAction && activeAction === "cancel" && activePurchase ? (
        <CancelPurchaseForm
          purchase={activePurchase}
          reason={cancellationReason}
          error={cancellationError}
          isSubmitting={isCancelling}
          onReasonChange={(value) => {
            setCancellationReason(value);
            setCancellationError(null);
          }}
          onCancel={closeCancelForm}
          onConfirm={requestCancelConfirmation}
        />
      ) : null}

      {!isInvalidAction && activeAction === "detail" ? (
        <PurchaseDetailPanel
          purchase={purchaseDetail}
          loading={loadingDetail}
          canReceive={Boolean(
            purchaseDetail &&
              canReceive &&
              purchaseDetail.status !== "CANCELLED" &&
              purchaseDetail.status !== "RECEIVED" &&
              purchaseDetail.status !== "CERRADA_PARCIAL"
          )}
          canLiquidate={canSettlePartial}
          canPay={Boolean(
            purchaseDetail &&
              canReceive &&
              purchaseDetail.status !== "CANCELLED" &&
              purchaseDetail.balanceDue > 0 &&
              purchaseDetail.branchId
          )}
          canCancel={Boolean(purchaseDetail && canCancelPurchase(purchaseDetail))}
          canViewTicket={Boolean(purchaseDetail && canAccessTicket(purchaseDetail.status))}
          onClose={handleBackToList}
          onReceive={
            purchaseDetail
              ? () => openPurchasePanel("receive", purchaseDetail.id)
              : undefined
          }
          onLiquidate={openLiquidateFromDetail}
          onPay={
            purchaseDetail
              ? () => openPurchasePanel("pay", purchaseDetail.id)
              : undefined
          }
          onCancelPurchase={
            purchaseDetail
              ? () => openPurchasePanel("cancel", purchaseDetail.id)
              : undefined
          }
          onViewTicket={
            purchaseDetail
              ? () => openPurchasePanel("ticket", purchaseDetail.id)
              : undefined
          }
          onDownload={
            purchaseDetail
              ? () => void handleDownloadTicket(purchaseDetail)
              : undefined
          }
        />
      ) : null}

      {!isInvalidAction && activeAction === "settle-partial" && activePurchaseId ? (
        <SettlePartialPurchaseForm
          purchase={purchaseDetail}
          loading={loadingDetail}
          reason={liquidationReason}
          error={liquidationError}
          isSubmitting={isLiquidating}
          onReasonChange={(value) => {
            setLiquidationReason(value);
            setLiquidationError(null);
          }}
          onCancel={closeLiquidateForm}
          onConfirm={requestLiquidateConfirmation}
        />
      ) : null}
    </>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Purchases</p>
            <h1 className="text-2xl font-semibold text-slate-900">Compras</h1>
            <p className="mt-2 text-sm text-slate-600">
              {isActionMode
                ? "Completa la accion activa y vuelve al listado cuando termines."
                : "Consulta compras registradas por proveedor, tipo y estado."}
            </p>
          </div>
          {!isActionMode ? (
            <div className="flex flex-wrap gap-3">
              <Button variant="ghost" onClick={() => void loadPurchases()} isLoading={loading}>
                <RefreshCw className="h-4 w-4" />
                Actualizar
              </Button>
              {canCreate ? (
                <Button onClick={openCreateForm}>
                  <Plus className="h-4 w-4" />
                  Crear compra
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {isActionMode && actionHeaderCopy ? (
        <PurchaseActionHeader
          title={actionHeaderCopy.title}
          subtitle={actionHeaderCopy.subtitle}
          purchaseCode={actionHeaderPurchase?.id.slice(0, 8)}
          status={actionHeaderPurchase?.status}
          onBack={requestBackToList}
        />
      ) : null}

      {activeViewMode === "create" ? (
        <PurchaseForm
          onCancel={requestBackToList}
          onSuccess={(response) => void handleCreateSuccess(response)}
          onError={(error) => notice.showFromApiError(error, "No se pudo guardar la compra.")}
          onDirtyChange={setCreateHasUnsavedChanges}
        />
      ) : null}

      {!isActionMode ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div
            className={
              canViewAllTenants
                ? "grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_180px_180px_180px_180px_180px_180px_auto_auto]"
                : "grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_180px_180px_180px_180px_auto_auto]"
            }
          >
            <Input
              label="Buscar"
              placeholder="Proveedor, sucursal, terminal, tipo o estado"
              value={draftFilters.query}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, query: event.target.value }))
              }
            />
            {canViewAllTenants ? (
              <Select
                label="Tenant"
                value={draftFilters.tenantId}
                onChange={(event) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    tenantId: event.target.value,
                    branchId:
                      prev.tenantId && prev.tenantId !== event.target.value ? "" : prev.branchId,
                  }))
                }
              >
                <option value="">Todos</option>
                {tenantOptions.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </Select>
            ) : null}
            {canViewAllTenants ? (
              <Select
                label="Sucursal"
                value={draftFilters.branchId}
                onChange={(event) =>
                  setDraftFilters((prev) => ({ ...prev, branchId: event.target.value }))
                }
              >
                <option value="">Todas</option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            ) : null}
            <Input
              label="Desde"
              type="date"
              value={draftFilters.fromDate}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, fromDate: event.target.value }))
              }
            />
            <Input
              label="Hasta"
              type="date"
              value={draftFilters.toDate}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, toDate: event.target.value }))
              }
            />
            <Select
              label="Estado"
              value={draftFilters.status}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, status: event.target.value }))
              }
            >
              <option value="">Todos</option>
              {purchaseStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
            <Select
              label="Metodo de pago"
              value={draftFilters.paymentMethod}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, paymentMethod: event.target.value }))
              }
            >
              <option value="">Todos</option>
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.nombre}
                </option>
              ))}
            </Select>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={applyFilters}>
                <Search className="h-4 w-4" />
                Buscar
              </Button>
              <Button variant="ghost" onClick={resetFilters}>
                Limpiar
              </Button>
            </div>
            <Select
              label="Filas por pagina"
              value={String(pageSize)}
              onChange={(event) => {
                const nextPageSize = Number(event.target.value);
                setPageSize(nextPageSize);
                setPage(0);
                pushListQuery(appliedFilters, 0, nextPageSize);
              }}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
        </section>
      ) : null}

      {errorMessage ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {errorMessage}
        </section>
      ) : null}

      <NoticeDialog
        open={notice.open}
        title={notice.title}
        message={notice.message}
        variant={notice.variant}
        onClose={() => {
          setNoticeConfirmAction(null);
          notice.close();
        }}
        onConfirm={
          noticeConfirmAction === "cancel"
            ? () => void handleCancelPurchase()
            : noticeConfirmAction === "settle-partial"
              ? () => void handleLiquidatePurchase()
              : noticeConfirmAction === "discard-create"
                ? discardCreateChanges
                : undefined
        }
        closeText={noticeConfirmAction ? "Volver" : "Entendido"}
        confirmText={
          noticeConfirmAction === "cancel"
            ? "Confirmar cancelacion"
            : noticeConfirmAction === "settle-partial"
              ? "Confirmar liquidacion"
              : noticeConfirmAction === "discard-create"
                ? "Salir sin guardar"
                : "Confirmar"
        }
        confirming={
          noticeConfirmAction === "cancel"
            ? isCancelling
            : noticeConfirmAction === "settle-partial"
              ? isLiquidating
              : false
        }
      />

      {!isActionMode ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Proveedor</th>
                  <th className="px-4 py-3 font-medium">Sucursal</th>
                  <th className="px-4 py-3 font-medium">Terminal</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Pagado</th>
                  <th className="px-4 py-3 font-medium">Saldo</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Pago</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-6 text-center text-slate-500">
                      Cargando compras...
                    </td>
                  </tr>
                ) : !hasSearched ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-6 text-center text-slate-500">
                      Usa el boton Buscar para consultar compras.
                    </td>
                  </tr>
                ) : paginatedPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-6 text-center text-slate-500">
                      No hay compras para mostrar.
                    </td>
                  </tr>
                ) : (
                  paginatedPurchases.map((purchase) => (
                    <tr key={purchase.id}>
                      <td className="px-4 py-3 text-slate-900">
                        {purchase.supplierName || purchase.supplierId}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{purchase.branchName ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{purchase.terminalName ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatCurrency(Number(purchase.total))}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatCurrency(Number(purchase.totalPaid))}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatCurrency(Number(purchase.balanceDue))}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{purchase.type}</td>
                      <td className="px-4 py-3 text-slate-700">{purchase.status}</td>
                      <td className="px-4 py-3 text-slate-700">{purchase.paymentStatus}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatDate(purchase.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPurchasePanel("detail", purchase.id)}
                          >
                            <Eye className="h-4 w-4" />
                            Detalle
                          </Button>
                          {canReceive &&
                          purchase.status !== "CANCELLED" &&
                          purchase.status !== "RECEIVED" &&
                          purchase.status !== "CERRADA_PARCIAL" ? (
                            <Button
                              variant="ghost"
                              onClick={() => openPurchasePanel("receive", purchase.id)}
                            >
                              <PackageCheck className="h-4 w-4" />
                              Recibir
                            </Button>
                          ) : null}
                          {canReceive &&
                          purchase.status !== "CANCELLED" &&
                          purchase.balanceDue > 0 &&
                          purchase.branchId ? (
                            <Button
                              variant="ghost"
                              onClick={() => openPurchasePanel("pay", purchase.id)}
                            >
                              Pagar
                            </Button>
                          ) : null}
                          {canLiquidatePurchase(purchase) ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPurchasePanel("settle-partial", purchase.id)}
                            >
                              Liquidar
                            </Button>
                          ) : null}
                          {canCancelPurchase(purchase) ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPurchasePanel("cancel", purchase.id)}
                            >
                              <XCircle className="h-4 w-4" />
                              Cancelar compra
                            </Button>
                          ) : null}
                          {canAccessTicket(purchase.status) ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPurchasePanel("ticket", purchase.id)}
                            >
                              <Eye className="h-4 w-4" />
                              Ver Ticket
                            </Button>
                          ) : null}
                          {canAccessTicket(purchase.status) ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleDownloadTicket(purchase)}
                            >
                              <Download className="h-4 w-4" />
                              Descargar
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <span>
              Pagina {Math.min(page + 1, totalPages)} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  const nextPage = Math.max(page - 1, 0);
                  setPage(nextPage);
                  pushListQuery(appliedFilters, nextPage, pageSize);
                }}
                disabled={page === 0 || loading}
              >
                Anterior
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  const nextPage = Math.min(page + 1, Math.max(totalPages - 1, 0));
                  setPage(nextPage);
                  pushListQuery(appliedFilters, nextPage, pageSize);
                }}
                disabled={page >= totalPages - 1 || loading}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {isActionMode ? contextualPanel : null}
    </div>
  );
};

export default PurchasesPage;
