"use client";

import { Download, Eye, PackageCheck, Plus, RefreshCw, Search, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../components/design-system/Toast";
import { listPaymentMethods } from "../../../modules/finance/services/finance.service";
import type { PaymentMethod } from "../../../modules/finance/types";
import { useInventoryScope } from "../../../hooks/useInventoryScope";
import { hasPermission } from "../../../lib/permissions";
import { useAutoClearState } from "../../../lib/useAutoClearState";
import { useAppSelector } from "../../../store/hooks";
import {
  CancelPurchaseDialog,
  validateCancelPurchaseReason,
} from "../../../modules/inventory/components/CancelPurchaseDialog";
import { DocumentPaymentForm } from "../../../modules/finance/components/DocumentPaymentForm";
import { PurchaseForm } from "../../../modules/inventory/components/PurchaseForm";
import {
  OVERPAYMENT_SETTLEMENT_MESSAGE,
  SettlePartialPurchaseDialog,
  validateSettlePartialPurchaseReason,
} from "../../../modules/inventory/components/SettlePartialPurchaseDialog";
import { PurchaseDetailDialog } from "../../../modules/inventory/components/PurchaseDetailDialog";
import { PurchaseReceiveForm } from "../../../modules/inventory/components/PurchaseReceiveForm";
import { usePurchases } from "../../../modules/inventory/hooks/use-purchases";
import type { PurchaseResponse } from "../../../modules/inventory/services/purchase.service";
import { isPurchaseCancelable } from "../../../modules/inventory/utils/purchase-cancellation";
import { PdfPreviewModal } from "../../../modules/reporteria/components/PdfPreviewModal";
import { getPurchaseTicket } from "../../../modules/reporteria/services/reporting.service";
import { downloadBlob, getApiErrorMessage } from "../../../modules/reporteria/utils";

type PurchaseFilters = {
  query: string;
  tenantId: string;
  branchId: string;
  fromDate: string;
  toDate: string;
  paymentMethod: string;
};

const defaultFilters: PurchaseFilters = {
  query: "",
  tenantId: "",
  branchId: "",
  fromDate: "",
  toDate: "",
  paymentMethod: "",
};

const pageSizeOptions = [10, 25, 50];

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
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [receivingPurchaseId, setReceivingPurchaseId] = useState<string | null>(null);
  const [payingPurchase, setPayingPurchase] = useState<PurchaseResponse | null>(null);
  const [previewPurchase, setPreviewPurchase] = useState<PurchaseResponse | null>(null);
  const [cancelingPurchase, setCancelingPurchase] = useState<PurchaseResponse | null>(null);
  const [liquidatingPurchaseId, setLiquidatingPurchaseId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationError, setCancellationError] = useState<string | null>(null);
  const [liquidationReason, setLiquidationReason] = useState("");
  const [liquidationError, setLiquidationError] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const { currentTenant } = useInventoryScope();
  const role = useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? "");
  const canViewAllTenants = role === "SUPER_ADMIN";

  const isAdminLikeRole =
    role === "ADMIN" || role === "USER" || role === "SUPER_ADMIN" || role === "SUPER_USER";
  const canCreate = hasPermission("inventory.create") || isAdminLikeRole;
  const canReceive = hasPermission("inventory.update") || isAdminLikeRole;
  const canCancel = hasPermission("inventory.cancel");
  const canSettlePartial = hasPermission("inventory.settle_partial");

  useAutoClearState(toastMessage, setToastMessage);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  const resolvePurchaseFilters = useCallback(
    (filters?: PurchaseFilters) => {
      if (canViewAllTenants) {
        return {
          tenantId: filters?.tenantId || undefined,
          branchId: filters?.branchId || undefined,
          fromDate: filters?.fromDate || undefined,
          toDate: filters?.toDate || undefined,
          paymentMethod: filters?.paymentMethod || undefined,
        };
      }

      return {
        tenantId: currentTenant || undefined,
        branchId: filters?.branchId || undefined,
        fromDate: filters?.fromDate || undefined,
        toDate: filters?.toDate || undefined,
        paymentMethod: filters?.paymentMethod || undefined,
      };
    },
    [canViewAllTenants, currentTenant]
  );

  const loadPurchases = useCallback(async (filters?: PurchaseFilters) => {
    const activeFilters = filters ?? appliedFilters;
    await loadPurchaseList(resolvePurchaseFilters(activeFilters));
  }, [appliedFilters, loadPurchaseList, resolvePurchaseFilters]);

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
    if (!query) {
      return purchases;
    }

    return purchases.filter((purchase) => {
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
  }, [appliedFilters.query, purchases]);

  const paginatedPurchases = useMemo(() => {
    const start = page * pageSize;
    return filteredPurchases.slice(start, start + pageSize);
  }, [filteredPurchases, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / pageSize));

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPage(0);
    void loadPurchases(draftFilters);
  };

  const resetFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPage(0);
  };

  const handleCreateSuccess = async () => {
    setShowCreateForm(false);
    showToast("Compra creada correctamente.", "success");
    if (hasSearched) {
      await loadPurchases();
    }
  };

  const handleReceiveSuccess = async () => {
    setReceivingPurchaseId(null);
    showToast("Recepcion registrada correctamente.", "success");
    if (hasSearched) {
      await loadPurchases();
    }
  };

  const canCancelPurchase = (purchase: PurchaseResponse) =>
    isPurchaseCancelable(purchase, canCancel);

  const canLiquidatePurchase = (purchase: PurchaseResponse) =>
    canSettlePartial && purchase.status === "PARTIAL";

  const openCancelModal = (purchase: PurchaseResponse) => {
    setCancelingPurchase(purchase);
    setCancellationReason("");
    setCancellationError(null);
  };

  const closeCancelModal = () => {
    if (isCancelling) {
      return;
    }
    setCancelingPurchase(null);
    setCancellationReason("");
    setCancellationError(null);
  };

  const handleCancelPurchase = async () => {
    const reason = cancellationReason.trim();
    if (!cancelingPurchase) {
      return;
    }
    const validationError = validateCancelPurchaseReason(reason);
    if (validationError) {
      setCancellationError(validationError);
      return;
    }

    setCancellationError(null);
    try {
      await cancelItem(cancelingPurchase.id, { motivoCancelacion: reason });
      setCancelingPurchase(null);
      setCancellationReason("");
      showToast("Compra cancelada correctamente.", "success");
    } catch (error) {
      const apiMessage = error instanceof Error ? error.message : getApiErrorMessage(error, "");
      const message = isPurchaseCancellationConflict(apiMessage)
        ? "Esta compra no puede cancelarse porque ya fue recibida, cerrada o pagada."
        : "No se pudo cancelar la compra. Intenta nuevamente.";
      setCancellationError(message);
      showToast(message, "error");
    }
  };

  const openDetail = (purchase: PurchaseResponse) => {
    setIsDetailOpen(true);
    void loadPurchaseDetail(purchase.id);
  };

  const openLiquidateModal = (purchase: PurchaseResponse) => {
    setLiquidatingPurchaseId(purchase.id);
    setLiquidationReason("");
    setLiquidationError(null);
    void loadPurchaseDetail(purchase.id);
  };

  const openLiquidateFromDetail = () => {
    if (!purchaseDetail) {
      return;
    }
    setIsDetailOpen(false);
    setLiquidatingPurchaseId(purchaseDetail.id);
    setLiquidationReason("");
    setLiquidationError(null);
  };

  const closeLiquidateModal = () => {
    if (isLiquidating) {
      return;
    }
    setLiquidatingPurchaseId(null);
    setLiquidationReason("");
    setLiquidationError(null);
  };

  const handleLiquidatePurchase = async () => {
    const reason = liquidationReason.trim();
    if (!liquidatingPurchaseId) {
      return;
    }
    const validationError = validateSettlePartialPurchaseReason(reason);
    if (validationError) {
      setLiquidationError(validationError);
      return;
    }

    setLiquidationError(null);
    try {
      await liquidateItem(liquidatingPurchaseId, { motivoLiquidacion: reason });
      setLiquidatingPurchaseId(null);
      setLiquidationReason("");
      showToast("Compra liquidada correctamente con las cantidades recibidas.", "success");
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
      showToast(message, "error");
    }
  };

  const canAccessTicket = (status: PurchaseResponse["status"]) => status !== "DRAFT";

  const handleDownloadTicket = async (purchase: PurchaseResponse) => {
    try {
      const blob = await getPurchaseTicket(purchase.id);
      downloadBlob(blob, `ticket-compra-${purchase.id}.pdf`);
    } catch (error) {
      showToast(getApiErrorMessage(error, "No se pudo descargar el ticket."), "error");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Purchases</p>
            <h1 className="text-2xl font-semibold text-slate-900">Compras</h1>
            <p className="mt-2 text-sm text-slate-600">
              Consulta compras registradas por proveedor, tipo y estado.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => void loadPurchases()} isLoading={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            {canCreate ? (
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4" />
                Crear compra
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {showCreateForm ? (
        <PurchaseForm
          onCancel={() => setShowCreateForm(false)}
          onSuccess={() => void handleCreateSuccess()}
        />
      ) : null}

      {receivingPurchaseId ? (
        <PurchaseReceiveForm
          purchaseId={receivingPurchaseId}
          onCancel={() => setReceivingPurchaseId(null)}
          onSuccess={() => void handleReceiveSuccess()}
        />
      ) : null}

      {payingPurchase ? (
        <DocumentPaymentForm
          title="Registrar pago al proveedor"
          description="Aplica egresos o abonos parciales sobre la compra seleccionada."
          branchId={payingPurchase.branchId ?? ""}
          referenceType="PURCHASE"
          referenceId={payingPurchase.id}
          direction="OUT"
          total={payingPurchase.total}
          totalPaid={payingPurchase.totalPaid}
          balanceDue={payingPurchase.balanceDue}
          paymentStatus={payingPurchase.paymentStatus}
          onCancel={() => setPayingPurchase(null)}
          onSuccess={async () => {
            setPayingPurchase(null);
            showToast("Pago registrado correctamente.", "success");
            if (hasSearched) {
              await loadPurchases();
            }
          }}
        />
      ) : null}

      <PdfPreviewModal
        isOpen={Boolean(previewPurchase)}
        title={
          previewPurchase
            ? `Ticket de compra ${previewPurchase.id.slice(0, 8)}`
            : "Ticket de compra"
        }
        fileName={
          previewPurchase ? `ticket-compra-${previewPurchase.id}.pdf` : "ticket-compra.pdf"
        }
        onClose={() => setPreviewPurchase(null)}
        getPdf={() =>
          previewPurchase
            ? getPurchaseTicket(previewPurchase.id)
            : Promise.reject(new Error("purchase ticket not selected"))
        }
      />

      {cancelingPurchase ? (
        <CancelPurchaseDialog
          purchase={cancelingPurchase}
          reason={cancellationReason}
          error={cancellationError}
          isSubmitting={isCancelling}
          onReasonChange={(value) => {
            setCancellationReason(value);
            setCancellationError(null);
          }}
          onCancel={closeCancelModal}
          onConfirm={() => void handleCancelPurchase()}
        />
      ) : null}

      {isDetailOpen ? (
        <PurchaseDetailDialog
          purchase={purchaseDetail}
          loading={loadingDetail}
          canLiquidate={canSettlePartial}
          onClose={() => setIsDetailOpen(false)}
          onLiquidate={openLiquidateFromDetail}
        />
      ) : null}

      {liquidatingPurchaseId ? (
        <SettlePartialPurchaseDialog
          purchase={purchaseDetail}
          loading={loadingDetail}
          reason={liquidationReason}
          error={liquidationError}
          isSubmitting={isLiquidating}
          onReasonChange={(value) => {
            setLiquidationReason(value);
            setLiquidationError(null);
          }}
          onCancel={closeLiquidateModal}
          onConfirm={() => void handleLiquidatePurchase()}
        />
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div
          className={
            canViewAllTenants
              ? "grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_180px_180px_220px_220px_220px_auto_auto]"
              : "grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_180px_180px_220px_auto_auto]"
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
              setPageSize(Number(event.target.value));
              setPage(0);
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

      {errorMessage ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {errorMessage}
        </section>
      ) : null}

      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}

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
                          onClick={() => openDetail(purchase)}
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
                            onClick={() => setReceivingPurchaseId(purchase.id)}
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
                            onClick={() => setPayingPurchase(purchase)}
                          >
                            Pagar
                          </Button>
                        ) : null}
                        {canLiquidatePurchase(purchase) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openLiquidateModal(purchase)}
                          >
                            Liquidar
                          </Button>
                        ) : null}
                        {canCancelPurchase(purchase) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openCancelModal(purchase)}
                          >
                            <XCircle className="h-4 w-4" />
                            Cancelar compra
                          </Button>
                        ) : null}
                        {canAccessTicket(purchase.status) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewPurchase(purchase)}
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
              onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
              disabled={page === 0 || loading}
            >
              Anterior
            </Button>
            <Button
              variant="ghost"
              onClick={() => setPage((prev) => Math.min(prev + 1, Math.max(totalPages - 1, 0)))}
              disabled={page >= totalPages - 1 || loading}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PurchasesPage;
