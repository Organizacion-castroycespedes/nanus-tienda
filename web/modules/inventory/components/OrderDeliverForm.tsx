"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import {
  isConfirmCancelledError,
  useConfirm,
} from "../../../hooks/use-confirm";
import {
  deliverOrder,
  getOrderById,
  type OrderDetailResponse,
  type OrderResponse,
} from "../services/order.service";
import { buildConfirmFromApiError } from "../../../lib/api-messages";
import { useAppSelector } from "../../../store/hooks";
import type { OrderPeripheralContext } from "../../../domains/peripherals/order-integration";
import type { ProductResponse } from "../../../domains/products/dtos";
import { getProducts } from "../services/product.service";
import {
  getInventoryReceiptRemaining,
  prepareInventoryReceiptQuantity,
  resolveInventoryProductSaleType,
} from "../barcode/barcode-lines";
import {
  resolveInventoryBarcode,
  resolveInventoryBarcodeInScope,
  type InventoryBarcodeProduct,
} from "../barcode/barcode-resolver";
import { searchInventoryProducts } from "../barcode/inventory-product-search";
import {
  createInventoryScanFeedback,
  createInventoryScanSoundPlayer,
  inventoryScanMessages,
  type InventoryScanFeedback,
  type InventoryScanTone,
} from "../barcode/inventory-scan-feedback";
import { InventoryProductSearchResults } from "../barcode/InventoryProductSearchResults";
import { InventoryQuantityDialog } from "../barcode/InventoryQuantityDialog";
import { InventoryScanBar } from "../barcode/InventoryScanBar";
import { useInventoryBarcodeCapture } from "../barcode/use-inventory-barcode-capture";

type DeliverItemValue = {
  productId: string;
  quantity: string;
};

type DeliverFormErrors = {
  items?: string;
  submit?: string;
};

type OrderDeliverFormProps = {
  orderId: string;
  onCancel: () => void;
  onSuccess: (
    response?: OrderResponse,
    peripheralContext?: OrderPeripheralContext
  ) => void;
};

/** Producto escaneable en la entrega (catálogo con códigos o respaldo por nombre). */
type DeliveryScanProduct = InventoryBarcodeProduct & { name: string; source?: ProductResponse };

const ORDER_DOCUMENT_LABEL = "este pedido";

const formatQuantity = (value: number) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

const createDeliveryIdempotencyKey = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `order-delivery-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const OrderDeliverForm = ({
  orderId,
  onCancel,
  onSuccess,
}: OrderDeliverFormProps) => {
  const confirm = useConfirm();
  const authUser = useAppSelector((state) => state.auth.user);
  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  // Una clave por apertura del formulario: un reintento (doble clic o red) no entrega dos veces.
  const [idempotencyKey] = useState(createDeliveryIdempotencyKey);
  const [values, setValues] = useState<DeliverItemValue[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<DeliverFormErrors>({});
  const valuesRef = useRef<DeliverItemValue[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const [catalog, setCatalog] = useState<ProductResponse[]>([]);
  const [catalogWarning, setCatalogWarning] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<InventoryScanFeedback | null>(null);
  const [candidates, setCandidates] = useState<DeliveryScanProduct[] | null>(null);
  const [quantityDialog, setQuantityDialog] = useState<{
    product: DeliveryScanProduct;
    max: number;
  } | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const sounds = useMemo(() => createInventoryScanSoundPlayer(), []);

  const commitValues = useCallback((next: DeliverItemValue[]) => {
    valuesRef.current = next;
    setValues(next);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadOrder = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const result = await getOrderById(orderId);
        if (!mounted) {
          return;
        }

        setOrder(result);
        commitValues(
          result.items.map((item) => ({
            productId: item.productId,
            quantity: "",
          }))
        );

        // Catálogo con códigos de barras de la sucursal del pedido, solo para el lector.
        try {
          const products = await getProducts({ branchId: result.branchId ?? undefined });
          if (mounted) {
            setCatalog(products);
            setCatalogWarning(null);
          }
        } catch {
          if (mounted) {
            setCatalogWarning(
              "No se pudieron cargar los códigos de barras; busca los productos por nombre."
            );
          }
        }
      } catch {
        if (mounted) {
          setLoadError("No se pudo cargar el detalle del pedido.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadOrder();

    return () => {
      mounted = false;
    };
  }, [commitValues, orderId]);

  const rows = useMemo(() => {
    if (!order) {
      return [];
    }

    return order.items.map((item, index) => {
      const pending = Math.max(item.orderedQuantity - item.deliveredQuantity, 0);
      return {
        item,
        index,
        pending,
      };
    });
  }, [order]);

  const catalogById = useMemo(
    () => new Map(catalog.map((product) => [product.id, product])),
    [catalog]
  );

  const deliveryItems = useMemo(
    () =>
      (order?.items ?? []).map((item) => ({
        id: item.id,
        productId: item.productId,
        orderedQuantity: Number(item.orderedQuantity) || 0,
        receivedQuantity: Number(item.deliveredQuantity) || 0,
      })),
    [order]
  );

  /** Productos del pedido para el lector: catálogo con códigos o respaldo por nombre. */
  const scopeProducts: DeliveryScanProduct[] = useMemo(() => {
    const seen = new Set<string>();
    const list: DeliveryScanProduct[] = [];
    for (const item of order?.items ?? []) {
      if (seen.has(item.productId)) {
        continue;
      }
      seen.add(item.productId);
      const product = catalogById.get(item.productId);
      list.push(
        product
          ? { ...product, source: product }
          : {
              id: item.productId,
              name: item.productName || item.productId,
              sku: "",
              primaryBarcode: null,
              barcodeCodes: [],
              barcodes: [],
            }
      );
    }
    return list;
  }, [catalogById, order]);

  const catalogScanProducts: DeliveryScanProduct[] = useMemo(
    () => catalog.map((product) => ({ ...product, source: product })),
    [catalog]
  );

  /** Cantidad a entregar ya preparada por línea del pedido (id de la línea). */
  const getPreparedByItem = useCallback(() => {
    const prepared: Record<string, number> = {};
    (order?.items ?? []).forEach((item, index) => {
      const quantity = Number(valuesRef.current[index]?.quantity ?? "");
      if (Number.isFinite(quantity) && quantity > 0) {
        prepared[item.id] = quantity;
      }
    });
    return prepared;
  }, [order]);

  const notify = useCallback(
    (tone: InventoryScanTone, message: string) => {
      setScanFeedback(createInventoryScanFeedback(tone, message));
      if (tone === "success") {
        sounds.success();
      } else if (tone === "error" || tone === "warning") {
        sounds.error();
      }
    },
    [sounds]
  );

  const getRemainingForProduct = useCallback(
    (productId: string) => {
      const prepared = getPreparedByItem();
      return deliveryItems
        .filter((item) => item.productId === productId)
        .reduce((sum, item) => sum + getInventoryReceiptRemaining(item, prepared), 0);
    },
    [deliveryItems, getPreparedByItem]
  );

  const applyDeliveryQuantity = useCallback(
    (product: DeliveryScanProduct, quantity: number) => {
      const result = prepareInventoryReceiptQuantity(
        deliveryItems,
        getPreparedByItem(),
        product.id,
        quantity
      );
      if (result.ok) {
        const itemIndex = (order?.items ?? []).findIndex((item) => item.id === result.purchaseItemId);
        if (itemIndex >= 0) {
          commitValues(
            valuesRef.current.map((value, index) =>
              index === itemIndex
                ? { ...value, quantity: String(result.prepared[result.purchaseItemId]) }
                : value
            )
          );
        }
        setHighlightedItemId(result.purchaseItemId);
        setCandidates(null);
        setErrors((prev) => ({ ...prev, items: undefined, submit: undefined }));
        notify("success", inventoryScanMessages.prepared(product.name, result.remaining));
        return;
      }
      if (result.reason === "EXCEEDS_PENDING") {
        notify("error", inventoryScanMessages.exceedsPending(product.name, result.remaining));
        return;
      }
      if (result.reason === "NOT_IN_DOCUMENT") {
        notify("error", inventoryScanMessages.outOfScope(product.name, ORDER_DOCUMENT_LABEL));
        return;
      }
      notify("error", inventoryScanMessages.invalidQuantity());
    },
    [commitValues, deliveryItems, getPreparedByItem, notify, order]
  );

  const prepareProduct = useCallback(
    (product: DeliveryScanProduct) => {
      setCandidates(null);
      const saleType = product.source ? resolveInventoryProductSaleType(product.source) : "UNIT";
      if (saleType === "UNIT") {
        applyDeliveryQuantity(product, 1);
        return;
      }
      const remaining = getRemainingForProduct(product.id);
      if (remaining <= 0) {
        notify("error", inventoryScanMessages.exceedsPending(product.name, 0));
        return;
      }
      setQuantityDialog({ product, max: remaining });
    },
    [applyDeliveryQuantity, getRemainingForProduct, notify]
  );

  const handleScan = useCallback(
    (code: string) => {
      const resolution = resolveInventoryBarcodeInScope(code, scopeProducts, catalogScanProducts);
      switch (resolution.kind) {
        case "MATCH":
          prepareProduct(resolution.product);
          return;
        case "AMBIGUOUS":
          setCandidates(resolution.candidates);
          notify("warning", inventoryScanMessages.ambiguous(resolution.code, resolution.candidates.length));
          return;
        case "OUT_OF_SCOPE":
          setCandidates(null);
          notify("error", inventoryScanMessages.outOfScope(resolution.product.name, ORDER_DOCUMENT_LABEL));
          return;
        case "PRESENTATION_UNSUPPORTED":
          setCandidates(null);
          notify("error", inventoryScanMessages.presentationUnsupported(resolution.code));
          return;
        default:
          setCandidates(null);
          notify("error", inventoryScanMessages.notFound(resolution.code));
      }
    },
    [catalogScanProducts, notify, prepareProduct, scopeProducts]
  );

  const hasPending = rows.some(({ pending }) => pending > 0);

  const capture = useInventoryBarcodeCapture({
    enabled: Boolean(order) && hasPending && !isSubmitting,
    focusReleased: quantityDialog !== null,
    onScan: handleScan,
    onDuplicateIgnored: (code) => notify("info", inventoryScanMessages.duplicateIgnored(code)),
    // Un código leído con el foco en "Entregar ahora" se procesa como escaneo.
    fieldScanScope: formRef,
    onFieldScan: (code) => {
      handleScan(code);
      return true;
    },
    onManualSubmit: (query) => {
      const exact = resolveInventoryBarcode(query, scopeProducts);
      if (exact.kind !== "NOT_FOUND") {
        handleScan(query);
        capture.clear();
        return;
      }
      const results = searchInventoryProducts(scopeProducts, query);
      if (results.length === 1) {
        prepareProduct(results[0]);
        capture.clear();
        return;
      }
      if (results.length === 0) {
        handleScan(query);
        capture.clear();
      }
    },
  });

  const searchResults = useMemo(
    () => (candidates ? [] : searchInventoryProducts(scopeProducts, capture.query)),
    [candidates, capture.query, scopeProducts]
  );

  const selectFromList = (product: DeliveryScanProduct) => {
    capture.clear();
    prepareProduct(product);
    capture.focusScanInput();
  };

  const validate = () => {
    const nextErrors: DeliverFormErrors = {};

    const hasAnyQuantity = values.some((value) => {
      const quantity = Number(value.quantity);
      return Number.isFinite(quantity) && quantity > 0;
    });

    const hasInvalidQuantity = rows.some(({ pending }, index) => {
      const quantity = Number(values[index]?.quantity ?? "");
      if (!Number.isFinite(quantity) || quantity === 0) {
        return false;
      }
      return quantity < 0 || quantity > pending;
    });

    if (!hasAnyQuantity) {
      nextErrors.items = "Debes ingresar al menos una cantidad a entregar.";
    } else if (hasInvalidQuantity) {
      nextErrors.items =
        "Las cantidades a entregar deben ser mayores a 0 y no pueden exceder el pendiente.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
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
        items: rows
          .map(({ item, index, pending }) => {
            const quantity = Number(values[index]?.quantity ?? "");
            if (!Number.isFinite(quantity) || quantity <= 0 || quantity > pending) {
              return null;
            }

            return {
              product_id: item.productId,
              quantity,
            };
          })
          .filter((item): item is { product_id: string; quantity: number } => item !== null),
      };

      await confirm({
        title: "Confirmar entrega",
        description:
          "Se registrará la entrega parcial del pedido y se descontará inventario.",
        confirmText: "Confirmar entrega",
        cancelText: "Volver",
        variant: "warning",
      });

      const response = await deliverOrder(orderId, payload, {
        "Idempotency-Key": idempotencyKey,
      });
      const peripheralContext: OrderPeripheralContext | undefined = order
        ? {
            orderId: response.id,
            orderNumber: response.id,
            documentNumber: response.id,
            date: response.createdAt,
            businessName: response.tenantName ?? authUser?.tenantName ?? "Manus POS",
            branchName: response.branchName ?? order.branchName ?? undefined,
            cashier: authUser?.name ?? authUser?.email ?? undefined,
            customerName: response.customerName ?? order.customerName ?? "Cliente",
            status: response.status,
            items: order.items.map((item) => ({
              name: item.productName ?? item.productId,
              quantity: item.orderedQuantity,
              unitPrice: Number(item.price),
              total: Number(item.subtotal),
            })),
            subtotal: Number(response.total),
            taxes: 0,
            discounts: 0,
            total: Number(response.total),
            balanceDue: response.balanceDue,
            payments: [],
          }
        : undefined;

      onSuccess(response, peripheralContext);
    } catch (error) {
      if (isConfirmCancelledError(error)) {
        return;
      }

      const apiDialog = buildConfirmFromApiError(
        error,
        "No se pudo registrar la entrega."
      );
      // corregir-lotes-entrega-pedidos: mensajes claros cuando el stock no alcanza.
      const stockMessage = apiDialog.description?.includes("insufficient lot stock for delivery")
        ? "No hay stock suficiente en lotes vigentes para esta entrega. Revisa lotes vencidos o bloqueados en Inventario > Lotes."
        : apiDialog.description?.includes("insufficient stock for delivery")
          ? "No hay stock suficiente en inventario para entregar esa cantidad. Ajusta la cantidad a entregar o registra la entrada de mercancía."
          : null;
      const dialog = stockMessage ? { ...apiDialog, description: stockMessage } : apiDialog;
      setErrors({
        submit: dialog.description ?? "No se pudo registrar la entrega.",
      });
      await confirm({
        ...dialog,
        confirmText: "Entendido",
        hideCancel: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Orders</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Entregar pedido</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Registra cantidades entregadas por item sin cerrar automaticamente el pedido.
          </p>
        </div>
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600 dark:text-slate-300">
          Cargando detalle del pedido...
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      ) : order ? (
        <form ref={formRef} className="grid gap-5" onSubmit={handleSubmit}>
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Cliente</p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  {order.customerName || order.customerId}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Sucursal</p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  {order.branchName || order.branchId || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{order.status}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Tipo</p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{order.type}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Terminal</p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  {order.terminalName || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total</p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  {formatCurrency(Number(order.total))}
                </p>
              </div>
            </div>
          </section>

          {hasPending ? (
            <div className="grid gap-2">
              <InventoryScanBar
                id="order-delivery-scan"
                capture={capture}
                feedback={scanFeedback}
                disabled={isSubmitting}
                label="Escanear productos a entregar"
                placeholder="Escanea solo productos de este pedido o búscalos por nombre"
              >
                {candidates ? (
                  <InventoryProductSearchResults
                    title="Elige el producto del código ambiguo"
                    products={candidates}
                    onSelect={selectFromList}
                  />
                ) : capture.query.trim().length >= 2 ? (
                  <InventoryProductSearchResults
                    title="Productos de este pedido"
                    products={searchResults}
                    emptyMessage="Ningún producto de este pedido coincide."
                    onSelect={selectFromList}
                    renderMeta={(product) =>
                      `Pendiente ${formatQuantity(getRemainingForProduct(product.id))}`
                    }
                  />
                ) : null}
              </InventoryScanBar>
              {catalogWarning ? <p className="text-xs text-amber-700">{catalogWarning}</p> : null}
            </div>
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700">
            <div
              className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
              role="region"
              aria-label="Productos del pedido para entregar"
              tabIndex={0}
            >
              <table className="w-full min-w-[800px] table-fixed divide-y divide-slate-200 text-sm">
                <colgroup>
                  <col className="w-[40%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[13%]" />
                  <col className="w-[17%]" />
                </colgroup>
                <thead className="bg-slate-50 text-left text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 text-right font-medium">Cantidad pedida</th>
                    <th className="px-4 py-3 text-right font-medium">Cantidad entregada</th>
                    <th className="px-4 py-3 text-right font-medium">Pendiente</th>
                    <th className="px-4 py-3 text-right font-medium">Entregar ahora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ item, index, pending }) => (
                    <tr
                      key={item.id}
                      className={highlightedItemId === item.id ? "bg-blue-50/70 dark:bg-blue-500/10" : undefined}
                    >
                      <td className="break-words px-4 py-3 leading-5 text-slate-900 dark:text-white">
                        {item.productName || item.productId}
                        {pending > 0 ? (
                          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                            Preparado {formatQuantity(Number(values[index]?.quantity) || 0)} de{" "}
                            {formatQuantity(pending)}
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">{item.orderedQuantity}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">{item.deliveredQuantity}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">{pending}</td>
                      <td className="px-4 py-3">
                        <Input
                          label=""
                          type="number"
                          min="0"
                          step="0.01"
                          max={String(pending)}
                          placeholder="0"
                          value={values[index]?.quantity ?? ""}
                          onChange={(event) => {
                            const rawValue = event.target.value;
                            const numericValue = Number(rawValue);
                            const nextValue =
                              rawValue === "" || !Number.isFinite(numericValue)
                                ? rawValue
                                : String(Math.min(Math.max(numericValue, 0), pending));
                            commitValues(
                              valuesRef.current.map((value, valueIndex) =>
                                valueIndex === index
                                  ? { ...value, quantity: nextValue }
                                  : value
                              )
                            );
                            setErrors((prev) => ({ ...prev, items: undefined, submit: undefined }));
                          }}
                          disabled={pending <= 0}
                          aria-label={`Entregar ahora: ${item.productName || item.productId}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {errors.items ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {errors.items}
            </div>
          ) : null}

          {errors.submit ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errors.submit}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" isLoading={isSubmitting}>
              Guardar entrega
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      {quantityDialog ? (
        <InventoryQuantityDialog
          title="Cantidad a entregar"
          label="Cantidad"
          productName={quantityDialog.product.name}
          max={quantityDialog.max}
          onCancel={() => {
            setQuantityDialog(null);
            capture.focusScanInput();
          }}
          onConfirm={(quantity) => {
            const product = quantityDialog.product;
            setQuantityDialog(null);
            applyDeliveryQuantity(product, quantity);
            capture.focusScanInput();
          }}
        />
      ) : null}
    </section>
  );
};
