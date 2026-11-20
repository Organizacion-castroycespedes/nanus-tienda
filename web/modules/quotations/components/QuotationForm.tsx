"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "../../../components/design-system/Button";
import { SearchableSelect } from "../../../components/design-system/SearchableSelect";
import { Select } from "../../../components/design-system/Select";
import { Textarea } from "../../../components/design-system/Textarea";
import { listBranches } from "../../../domains/branches/api";
import type { BranchResponse } from "../../../domains/branches/dtos";
import type { ProductResponse } from "../../../domains/products/dtos";
import { useInventoryScope } from "../../../hooks/useInventoryScope";
import { useAppSelector } from "../../../store/hooks";
import { getCustomers, type CustomerResponse } from "../../inventory/services/customer.service";
import { getProducts } from "../../inventory/services/product.service";
import {
  resolveLineAmounts,
  useQuotationLinePricing,
  type QuotationDraftLine,
} from "../hooks/use-quotation-line-pricing";
import type { QuotationDetail, QuotationPayload, QuotationTextBlocksValue } from "../types";
import { QuotationItemsTable } from "./QuotationItemsTable";
import { QuotationSummaryCard, type QuotationTotals } from "./QuotationSummaryCard";
import { QuotationTextBlocks } from "./QuotationTextBlocks";
import { QuotationTotalsFooter } from "./QuotationTotalsFooter";

const round2 = (value: number) => Math.round((value + 1e-9) * 100) / 100;

const todayInBogota = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const addDays = (date: string, days: number) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

/** Lineas guardadas -> lineas en borrador (conservan valores para solo lectura). */
export const mapDetailToDraftLines = (
  detail: QuotationDetail,
  products: readonly ProductResponse[]
): QuotationDraftLine[] => {
  const byId = new Map(products.map((product) => [product.id, product]));
  return detail.items.map((item) => {
    const product = byId.get(item.productId);
    return {
      key: item.id,
      productId: item.productId,
      productName: item.productName,
      productCode: item.productCode,
      unitCode: item.unitCode,
      allowsDecimal: product
        ? Boolean(product.allowsDecimalQuantity) || (product.saleType ?? "UNIT") !== "UNIT"
        : !Number.isInteger(item.quantity),
      quantity: item.quantity,
      listPrice: item.finalUnitPrice,
      saved: {
        finalUnitPrice: item.finalUnitPrice,
        discountPercent: item.discountPercent,
        promotionName: item.appliedPromotionName,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        lineTotal: item.lineTotal,
      },
    };
  });
};

type Props = {
  title: string;
  eyebrow?: string;
  detail?: QuotationDetail | null;
  readOnly?: boolean;
  defaultValidityDays: number;
  submitLabel: string;
  saving?: boolean;
  /** Botones y etiquetas a la derecha del encabezado (estado, acciones). */
  headerAside?: ReactNode;
  onSubmit?: (payload: QuotationPayload) => Promise<void>;
  onValidationError?: (message: string) => void;
  /** Muestra "Volver" y "Cancelar"; recibe si hay datos sin guardar. */
  onCancel?: (hasChanges: boolean) => void;
};

export const QuotationForm = ({
  title,
  eyebrow = "Ventas",
  detail = null,
  readOnly = false,
  defaultValidityDays,
  submitLabel,
  saving = false,
  headerAside,
  onSubmit,
  onValidationError,
  onCancel,
}: Props) => {
  const { currentTenant, currentBranch, isSuperRole } = useInventoryScope();
  const authUser = useAppSelector((state) => state.auth.user);
  const [customers, setCustomers] = useState<CustomerResponse[]>([]);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState(detail?.customerId ?? "");
  const [branchId, setBranchId] = useState(detail?.branchId ?? currentBranch ?? "");
  const [notes, setNotes] = useState(detail?.notes ?? "");
  const [textBlocks, setTextBlocks] = useState<QuotationTextBlocksValue>({
    commercialTerms: detail?.commercialTerms ?? "",
    paymentDeliveryTerms: detail?.paymentDeliveryTerms ?? "",
    warrantyTerms: detail?.warrantyTerms ?? "",
  });
  const [lines, setLines] = useState<QuotationDraftLine[]>([]);
  const [linesLoadedFor, setLinesLoadedFor] = useState<string | null>(null);
  // Mientras se usa el buscador de clientes u otro campo del encabezado, el lector no recupera el foco.
  const [headerFocused, setHeaderFocused] = useState(false);

  const canSelectBranch = isSuperRole && !readOnly;

  useEffect(() => {
    if (!detail?.branchId && !branchId && currentBranch) {
      setBranchId(currentBranch);
    }
  }, [branchId, currentBranch, detail?.branchId]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const tenantId = currentTenant ?? authUser?.tenantId ?? undefined;
        const [customersResult, productsResult, branchesResult] = await Promise.all([
          getCustomers(),
          getProducts({ branchId: branchId || undefined }),
          isSuperRole ? listBranches({ tenantId }) : Promise.resolve<BranchResponse[]>([]),
        ]);
        if (!mounted) {
          return;
        }
        setCustomers(customersResult);
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
    void load();
    return () => {
      mounted = false;
    };
  }, [authUser?.tenantId, branchId, currentTenant, isSuperRole]);

  // Las lineas de una cotizacion existente se arman cuando el catalogo esta listo.
  useEffect(() => {
    if (!detail || catalogLoading) {
      return;
    }
    const signature = `${detail.id}:${detail.updatedAt ?? ""}`;
    if (linesLoadedFor === signature) {
      return;
    }
    setLinesLoadedFor(signature);
    setLines(mapDetailToDraftLines(detail, products));
    setCustomerId(detail.customerId);
    setBranchId(detail.branchId);
    setNotes(detail.notes ?? "");
    setTextBlocks({
      commercialTerms: detail.commercialTerms ?? "",
      paymentDeliveryTerms: detail.paymentDeliveryTerms ?? "",
      warrantyTerms: detail.warrantyTerms ?? "",
    });
  }, [catalogLoading, detail, linesLoadedFor, products]);

  const pricing = useQuotationLinePricing({
    lines,
    branchId,
    customerId,
    enabled: !readOnly,
  });

  const totals = useMemo<QuotationTotals>(() => {
    if (readOnly && detail) {
      return {
        subtotal: detail.subtotal,
        taxTotal: detail.taxTotal,
        discountTotal: detail.discountTotal,
        total: detail.total,
        taxes: detail.taxSummary,
        estimated: false,
      };
    }
    let total = 0;
    let taxTotal = 0;
    let discountTotal = 0;
    let estimated = false;
    for (const line of lines) {
      const amounts = resolveLineAmounts(line, pricing[line.key], false);
      total += amounts.lineTotal;
      taxTotal += amounts.taxAmount;
      const preview = pricing[line.key];
      if (preview?.status === "ready") {
        discountTotal += preview.preview.discountAmount * line.quantity;
      }
      estimated = estimated || amounts.pending;
    }
    return {
      subtotal: round2(total - taxTotal),
      taxTotal: round2(taxTotal),
      discountTotal: round2(discountTotal),
      total: round2(total),
      taxes: [],
      estimated,
    };
  }, [detail, lines, pricing, readOnly]);

  const issueDate = detail?.issueDate ?? todayInBogota();
  const validityDays = detail?.validityDays ?? defaultValidityDays;
  const validUntil = detail?.validUntil ?? addDays(issueDate, validityDays);

  const customerOptions = useMemo(
    () =>
      customers
        .filter((customer) => customer.isActive || customer.id === customerId)
        .map((customer) => ({
          value: customer.id,
          label: customer.name,
          description: [customer.documentNumber, customer.phone].filter(Boolean).join(" · ") || null,
          keywords: [customer.documentNumber ?? "", customer.email ?? ""].filter(Boolean),
        })),
    [customerId, customers]
  );

  const selectedBranchName =
    branches.find((branch) => branch.id === branchId)?.nombre ?? detail?.branchName ?? null;

  const handleSubmit = async () => {
    if (!onSubmit) {
      return;
    }
    if (!customerId) {
      onValidationError?.("Selecciona el cliente de la cotización.");
      return;
    }
    if (!branchId) {
      onValidationError?.("Selecciona la sucursal de la cotización.");
      return;
    }
    if (lines.length === 0) {
      onValidationError?.("Agrega al menos un producto del catálogo.");
      return;
    }
    const invalid = lines.find(
      (line) => !(line.quantity > 0) || (!line.allowsDecimal && !Number.isInteger(line.quantity))
    );
    if (invalid) {
      onValidationError?.(
        invalid.allowsDecimal
          ? `Revisa la cantidad de ${invalid.productName}.`
          : `${invalid.productName} se cotiza por unidades enteras.`
      );
      return;
    }
    await onSubmit({
      customerId,
      branchId,
      items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      commercialTerms: textBlocks.commercialTerms,
      paymentDeliveryTerms: textBlocks.paymentDeliveryTerms,
      warrantyTerms: textBlocks.warrantyTerms,
      notes,
    });
  };

  const hasChanges =
    Boolean(customerId) ||
    lines.length > 0 ||
    notes.trim().length > 0 ||
    Object.values(textBlocks).some((value) => value.trim().length > 0);

  const summaryLabel = readOnly ? "PDF listo" : saving ? "Guardando" : totals.estimated ? "Calculando" : "Motor de precios";
  const disabledReason = !branchId
    ? "Selecciona la sucursal para cargar el catálogo y los precios."
    : catalogLoading
      ? "Cargando catálogo…"
      : null;

  return (
    <div className="space-y-6">
      <section className="border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">{eyebrow}</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{title}</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Propuesta comercial con productos del catálogo; el precio queda congelado al aprobar y se respeta al convertir en pedido.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {detail?.code ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                Código: <strong className="text-slate-900 dark:text-white">{detail.code}</strong>
              </div>
            ) : null}
            {headerAside}
            {onCancel ? (
              <Button variant="ghost" size="sm" onClick={() => onCancel(hasChanges)} disabled={saving}>
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {catalogError ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {catalogError}
        </p>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[2fr_360px]">
        <div
          className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"
          onFocusCapture={() => setHeaderFocused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setHeaderFocused(false);
            }
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {readOnly ? (
              <div className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">Cliente</span>
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                  {detail?.customerName ?? "-"}
                  {detail?.customerDocument ? (
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{detail.customerDocument}</span>
                  ) : null}
                </p>
              </div>
            ) : (
              <SearchableSelect
                id="quotation-customer"
                label="Cliente *"
                value={customerId}
                options={customerOptions}
                onChange={setCustomerId}
                loading={catalogLoading}
                placeholder="Selecciona un cliente registrado"
                searchPlaceholder="Busca por nombre, documento o correo"
                noResultsMessage="No hay clientes con ese criterio."
              />
            )}
            {canSelectBranch ? (
              <Select
                label="Sucursal"
                required
                value={branchId}
                onChange={(event) => {
                  setBranchId(event.target.value);
                  setLines([]);
                }}
              >
                <option value="">Selecciona una sucursal</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.nombre}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">Sucursal</span>
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                  {selectedBranchName ?? (branchId ? "Sucursal actual" : "Selecciona la sucursal en el alcance superior")}
                </p>
              </div>
            )}
          </div>

          <Textarea
            label="Observaciones"
            rows={4}
            disabled={readOnly}
            maxLength={5000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />

          {detail?.rejectionReason ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              Motivo del rechazo: {detail.rejectionReason}
            </p>
          ) : null}
        </div>

        <QuotationSummaryCard
          totals={totals}
          issueDate={issueDate}
          validUntil={validUntil}
          validityDays={validityDays}
          statusLabel={summaryLabel}
        />
      </section>

      <QuotationTextBlocks value={textBlocks} readOnly={readOnly} onChange={setTextBlocks} />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Productos cotizados</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Solo productos activos del catálogo. Cantidades enteras salvo productos que permiten decimales.
          </p>
        </div>
        <QuotationItemsTable
          lines={lines}
          products={products}
          pricing={pricing}
          readOnly={readOnly}
          disabledReason={disabledReason}
          scanReleased={headerFocused}
          onChange={setLines}
        />
        <div className="mt-4">
          <QuotationTotalsFooter totals={totals} />
        </div>
      </section>

      {!readOnly && onSubmit ? (
        <div className="flex justify-end gap-3">
          {onCancel ? (
            <Button variant="ghost" onClick={() => onCancel(hasChanges)} disabled={saving}>
              Cancelar
            </Button>
          ) : null}
          <Button onClick={() => void handleSubmit()} disabled={saving || catalogLoading} isLoading={saving}>
            {saving ? "Guardando..." : submitLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
