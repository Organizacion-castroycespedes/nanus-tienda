"use client";

import { Plus, X } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { listProducts } from "../../../domains/products/api";
import type { ProductResponse } from "../../../domains/products/dtos";
import {
  getPurchaseById,
  receivePurchase,
  type PurchaseDetailResponse,
  type PurchaseResponse,
  type ReceivePurchasePayload,
} from "../services/purchase.service";
import {
  listInventoryLocations,
  type InventoryLocationResponse,
} from "../services/inventory-location.service";
import { getProducts } from "../services/product.service";
import {
  addQuantityToReceiveItem,
  createReceiveEntry,
  getItemsExceedingPending,
  getItemsWithDuplicateLots,
  getPendingReceiveRows,
  getPreparedQuantityByItem,
  getReceivableEntries,
  getReceiveQuantity,
  removeReceiveEntry,
  splitReceiveItem,
  type ReceiveEntryValue,
} from "./purchase-receive-lines";
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

type ReceiveFormErrors = {
  items?: string;
  supplierInvoiceNumber?: string;
  submit?: string;
};
type ReceiveStep = "information" | "products" | "confirmation";

type PurchaseReceiveFormProps = {
  purchaseId: string;
  /** Factura ya registrada en una recepción anterior (viene del listado de compras). */
  initialSupplierInvoiceNumber?: string | null;
  initialSupplierInvoiceDate?: string | Date | null;
  onCancel: () => void;
  onSuccess: (response?: PurchaseResponse) => void;
  onError?: (error: unknown) => void;
};

/** Producto que se puede escanear en la recepción (catálogo con códigos o respaldo por SKU). */
type ReceiptScanProduct = InventoryBarcodeProduct & { name: string; source?: ProductResponse };

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

const formatQuantity = (value: number) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value);

const getTodayInputValue = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const today = getTodayInputValue();

const createReceiptIdempotencyKey = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `purchase-receipt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

/** Normaliza una fecha del API a yyyy-mm-dd para el input date. */
const toDateInputValue = (value: string | Date | null | undefined) => {
  if (!value) {
    return "";
  }
  const text = value instanceof Date ? value.toISOString() : String(value);
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return match ? match[1] : "";
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
};

export const PurchaseReceiveForm = ({
  purchaseId,
  initialSupplierInvoiceNumber,
  initialSupplierInvoiceDate,
  onCancel,
  onSuccess,
  onError,
}: PurchaseReceiveFormProps) => {
  const [purchase, setPurchase] = useState<PurchaseDetailResponse | null>(null);
  const [entries, setEntriesState] = useState<ReceiveEntryValue[]>([]);
  // Fuente sincrónica para escaneos consecutivos antes del siguiente render.
  const entriesRef = useRef<ReceiveEntryValue[]>([]);
  const entryKeyRef = useRef(0);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [barcodeProducts, setBarcodeProducts] = useState<ProductResponse[]>([]);
  const [locations, setLocations] = useState<InventoryLocationResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lookupWarning, setLookupWarning] = useState<string | null>(null);
  const [scanCatalogWarning, setScanCatalogWarning] = useState<string | null>(null);
  const [errors, setErrors] = useState<ReceiveFormErrors>({});
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState(today);
  const [receiveStep, setReceiveStep] = useState<ReceiveStep>("information");
  const [idempotencyKey] = useState(createReceiptIdempotencyKey);
  const [scanFeedback, setScanFeedback] = useState<InventoryScanFeedback | null>(null);
  const [candidates, setCandidates] = useState<ReceiptScanProduct[] | null>(null);
  const [quantityDialog, setQuantityDialog] = useState<{
    product: ReceiptScanProduct;
    max: number;
  } | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [invoiceFromPreviousReceipt, setInvoiceFromPreviousReceipt] = useState(false);
  const invoicePrefilledRef = useRef(false);
  const typedInvoiceRef = useRef(false);
  const sounds = useMemo(() => createInventoryScanSoundPlayer(), []);
  const formRef = useRef<HTMLFormElement>(null);

  const nextEntryKey = () => {
    entryKeyRef.current += 1;
    return `entry-${entryKeyRef.current}`;
  };

  const setEntries = useCallback((next: ReceiveEntryValue[]) => {
    entriesRef.current = next;
    setEntriesState(next);
  }, []);

  const updateEntry = (key: string, patch: Partial<ReceiveEntryValue>) => {
    setEntries(
      entriesRef.current.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry))
    );
    setErrors((prev) => ({ ...prev, items: undefined, submit: undefined }));
  };

  useEffect(() => {
    let mounted = true;

    const loadPurchase = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const result = await getPurchaseById(purchaseId);
        if (!mounted) {
          return;
        }

        setPurchase(result);
        entryKeyRef.current = 0;
        setEntries(
          result.items.map((item) => {
            entryKeyRef.current += 1;
            return createReceiveEntry(item, `entry-${entryKeyRef.current}`);
          })
        );

        try {
          const [productResult, locationResult] = await Promise.all([
            listProducts({
              tenantId: result.tenantId,
              branchId: result.branchId ?? undefined,
            }).catch(() => listProducts({ tenantId: result.tenantId })),
            result.branchId
              ? listInventoryLocations({
                  branchId: result.branchId,
                  isActive: true,
                })
              : Promise.resolve([] as InventoryLocationResponse[]),
          ]);
          if (!mounted) {
            return;
          }
          setProducts(productResult);
          setLocations(locationResult);
          setLookupWarning(null);
        } catch {
          if (mounted) {
            setLookupWarning(
              "No se pudo cargar configuracion operativa de productos o ubicaciones."
            );
          }
        }

        // Catálogo con códigos de barras para el lector (el listado de inventario no los incluye).
        try {
          const catalog = await getProducts({ branchId: result.branchId ?? undefined });
          if (mounted) {
            setBarcodeProducts(catalog);
            setScanCatalogWarning(null);
          }
        } catch {
          if (mounted) {
            setScanCatalogWarning(
              "No se pudieron cargar los códigos de barras; el lector solo reconocerá el SKU."
            );
          }
        }
      } catch {
        if (mounted) {
          setLoadError("No se pudo cargar el detalle de la compra.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadPurchase();

    return () => {
      mounted = false;
    };
  }, [purchaseId, setEntries]);

  // Recepción parcial previa: la factura ya existe; se precarga (editable) y se inicia en Productos.
  useEffect(() => {
    if (!purchase || invoicePrefilledRef.current) {
      return;
    }
    const knownNumber = (purchase.supplierInvoiceNumber ?? initialSupplierInvoiceNumber ?? "").trim();
    if (!knownNumber) {
      return;
    }
    invoicePrefilledRef.current = true;
    // Si el usuario ya empezó a escribir la factura, no se le sobrescribe.
    if (typedInvoiceRef.current) {
      return;
    }
    setSupplierInvoiceNumber(knownNumber);
    const knownDate = toDateInputValue(purchase.supplierInvoiceDate ?? initialSupplierInvoiceDate);
    if (knownDate) {
      setSupplierInvoiceDate(knownDate);
    }
    setInvoiceFromPreviousReceipt(true);
    setReceiveStep((current) => (current === "information" ? "products" : current));
  }, [initialSupplierInvoiceDate, initialSupplierInvoiceNumber, purchase]);

  const productById = useMemo(() => {
    const map = new Map<string, ProductResponse>();
    products.forEach((product) => map.set(product.id, product));
    return map;
  }, [products]);

  const barcodeProductById = useMemo(
    () => new Map(barcodeProducts.map((product) => [product.id, product])),
    [barcodeProducts]
  );

  const locationIds = useMemo(
    () => new Set(locations.map((location) => location.id)),
    [locations]
  );

  const rows = useMemo(() => {
    if (!purchase) {
      return [];
    }

    return getPendingReceiveRows(purchase.items);
  }, [purchase]);

  const receiptItems = useMemo(
    () =>
      (purchase?.items ?? []).map((item) => ({
        id: item.id,
        productId: item.productId,
        orderedQuantity: Number(item.orderedQuantity) || 0,
        receivedQuantity: Number(item.receivedQuantity) || 0,
      })),
    [purchase]
  );

  /** Productos de la compra para el lector: catálogo con códigos o respaldo por SKU. */
  const scopeProducts: ReceiptScanProduct[] = useMemo(() => {
    const seen = new Set<string>();
    const list: ReceiptScanProduct[] = [];
    for (const item of purchase?.items ?? []) {
      if (seen.has(item.productId)) {
        continue;
      }
      seen.add(item.productId);
      const catalogProduct = barcodeProductById.get(item.productId);
      list.push(
        catalogProduct
          ? { ...catalogProduct, source: catalogProduct }
          : {
              id: item.productId,
              name: item.productName || item.productId,
              sku: item.productSku ?? "",
              primaryBarcode: null,
              barcodeCodes: [],
              barcodes: [],
            }
      );
    }
    return list;
  }, [barcodeProductById, purchase]);

  const catalogScanProducts: ReceiptScanProduct[] = useMemo(
    () => barcodeProducts.map((product) => ({ ...product, source: product })),
    [barcodeProducts]
  );

  const preparedByItem = useMemo(() => getPreparedQuantityByItem(entries), [entries]);

  const isBlockedStatus =
    purchase?.status === "CANCELLED" ||
    purchase?.status === "RECEIVED" ||
    purchase?.status === "CERRADA_PARCIAL";

  const getItemPolicy = (item: { productId: string; requiresLot?: boolean; requiresExpiration?: boolean; isPerishable?: boolean; isInventoryable?: boolean }) => {
    const product = productById.get(item.productId);
    const isInventoryable = product?.isInventoryable ?? item.isInventoryable ?? true;
    return {
      product,
      isInventoryable,
      requiresLot: isInventoryable && Boolean(product?.requiresLot ?? item.requiresLot),
      requiresExpiration:
        isInventoryable && Boolean(product?.requiresExpiration ?? item.requiresExpiration),
      isPerishable: isInventoryable && Boolean(product?.isPerishable ?? item.isPerishable),
    };
  };

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
      const prepared = getPreparedQuantityByItem(entriesRef.current);
      return receiptItems
        .filter((item) => item.productId === productId)
        .reduce((sum, item) => sum + getInventoryReceiptRemaining(item, prepared), 0);
    },
    [receiptItems]
  );

  const applyReceiptQuantity = useCallback(
    (product: ReceiptScanProduct, quantity: number) => {
      const result = prepareInventoryReceiptQuantity(
        receiptItems,
        getPreparedQuantityByItem(entriesRef.current),
        product.id,
        quantity
      );
      if (result.ok) {
        setEntries(addQuantityToReceiveItem(entriesRef.current, result.purchaseItemId, quantity));
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
        notify("error", inventoryScanMessages.outOfScope(product.name));
        return;
      }
      notify("error", inventoryScanMessages.invalidQuantity());
    },
    [notify, receiptItems, setEntries]
  );

  const prepareProduct = useCallback(
    (product: ReceiptScanProduct) => {
      setCandidates(null);
      const source = product.source ?? productById.get(product.id);
      const saleType = source ? resolveInventoryProductSaleType(source) : "UNIT";
      if (saleType === "UNIT") {
        applyReceiptQuantity(product, 1);
        return;
      }
      const remaining = getRemainingForProduct(product.id);
      if (remaining <= 0) {
        notify("error", inventoryScanMessages.exceedsPending(product.name, 0));
        return;
      }
      setQuantityDialog({ product, max: remaining });
    },
    [applyReceiptQuantity, getRemainingForProduct, notify, productById]
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
          notify("error", inventoryScanMessages.outOfScope(resolution.product.name));
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

  const captureEnabled =
    receiveStep === "products" && !isBlockedStatus && !isSubmitting && rows.length > 0;

  const capture = useInventoryBarcodeCapture({
    enabled: captureEnabled,
    focusReleased: quantityDialog !== null,
    // En recepción hay campos de lote; el foco inicial lo da el paso de productos.
    autoFocus: true,
    onScan: handleScan,
    onDuplicateIgnored: (code) => notify("info", inventoryScanMessages.duplicateIgnored(code)),
    // Lectura con el foco en lote, costo o cantidad: si es un producto se procesa como
    // escaneo y el campo recupera su valor; un código desconocido en un campo de texto
    // (p. ej. un lote escaneado a propósito) se conserva, sin enviar el formulario.
    fieldScanScope: formRef,
    onFieldScan: (code, field) => {
      if (field instanceof HTMLInputElement && field.type === "number") {
        handleScan(code);
        return true;
      }
      const resolution = resolveInventoryBarcodeInScope(code, scopeProducts, catalogScanProducts);
      if (resolution.kind === "NOT_FOUND") {
        notify("info", `Código conservado en el campo: ${code}`);
        return false;
      }
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

  const selectFromList = (product: ReceiptScanProduct) => {
    capture.clear();
    prepareProduct(product);
    capture.focusScanInput();
  };

  const validate = () => {
    const nextErrors: ReceiveFormErrors = {};

    if (!supplierInvoiceNumber.trim()) {
      nextErrors.supplierInvoiceNumber = "Número de factura requerido.";
    }

    if (isBlockedStatus) {
      nextErrors.items = "No se puede recibir una compra cancelada, recibida o cerrada parcial.";
      setErrors(nextErrors);
      return false;
    }

    if (rows.length === 0) {
      nextErrors.items = "Esta compra no tiene productos pendientes por recibir.";
      setErrors(nextErrors);
      return false;
    }

    const pendingItemIds = new Set(rows.map(({ item }) => item.id));
    const itemErrors: string[] = [];
    let hasInvalidQuantity = false;

    for (const entry of entries) {
      if (!pendingItemIds.has(entry.purchaseItemId)) {
        continue;
      }
      const quantity = getReceiveQuantity(entry);
      if (quantity < 0 || (entry.quantity.trim() !== "" && !Number.isFinite(Number(entry.quantity)))) {
        hasInvalidQuantity = true;
        continue;
      }
      if (quantity === 0) {
        continue;
      }

      const item = purchase?.items.find((candidate) => candidate.id === entry.purchaseItemId);
      if (!item) {
        continue;
      }
      const { requiresLot, requiresExpiration } = getItemPolicy(item);
      const label = item.productName || item.productId;

      if (requiresLot) {
        if (!entry.lotCode.trim()) {
          itemErrors.push(`${label}: lote requerido.`);
        }
        if (requiresExpiration && !entry.expirationDate) {
          itemErrors.push(`${label}: fecha de vencimiento requerida.`);
        }
        if (entry.expirationDate && entry.expirationDate < today) {
          itemErrors.push(`${label}: vencimiento no puede ser anterior a hoy.`);
        }
        if (entry.unitCost) {
          const unitCost = Number(entry.unitCost);
          if (!Number.isFinite(unitCost) || unitCost < 0) {
            itemErrors.push(`${label}: costo no valido.`);
          }
        }
        if (entry.locationId && !locationIds.has(entry.locationId)) {
          itemErrors.push(`${label}: ubicacion no valida.`);
        }
      }
    }

    const exceeding = getItemsExceedingPending(
      rows.map(({ item }) => item),
      entries
    );
    const duplicatedLots = getItemsWithDuplicateLots(entries).filter((itemId) =>
      pendingItemIds.has(itemId)
    );
    const hasAnyQuantity = getReceivableEntries(entries).some((entry) =>
      pendingItemIds.has(entry.purchaseItemId)
    );
    const nameOf = (itemId: string) => {
      const item = purchase?.items.find((candidate) => candidate.id === itemId);
      return item?.productName || item?.productId || itemId;
    };

    if (hasInvalidQuantity || exceeding.length > 0) {
      nextErrors.items =
        "Las cantidades a recibir deben ser mayores a 0 y no pueden exceder el pendiente." +
        (exceeding.length > 0 ? ` Revisa: ${exceeding.map(nameOf).join(", ")}.` : "");
    } else if (!hasAnyQuantity) {
      nextErrors.items = "Debes ingresar al menos una cantidad a recibir.";
    } else if (duplicatedLots.length > 0) {
      nextErrors.items = `Lote repetido en la misma línea: ${duplicatedLots.map(nameOf).join(", ")}.`;
    } else if (itemErrors.length > 0) {
      nextErrors.items = itemErrors.join(" ");
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const receivableEntries = useMemo(() => {
    const pendingItemIds = new Set(rows.map(({ item }) => item.id));
    return getReceivableEntries(entries).filter((entry) => pendingItemIds.has(entry.purchaseItemId));
  }, [entries, rows]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (receiveStep === "information") {
      if (!supplierInvoiceNumber.trim()) {
        setErrors({ supplierInvoiceNumber: "Número de factura requerido." });
        return;
      }
      setErrors({});
      setReceiveStep("products");
      return;
    }

    if (!validate()) {
      return;
    }

    if (receiveStep === "products") {
      setReceiveStep("confirmation");
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const payload = {
        supplierInvoiceNumber: supplierInvoiceNumber.trim(),
        supplierInvoiceDate: supplierInvoiceDate || null,
        items: receivableEntries.map((entry) => {
          const quantity = getReceiveQuantity(entry);
          const item = purchase?.items.find((candidate) => candidate.id === entry.purchaseItemId);
          const { requiresLot } = getItemPolicy(item ?? { productId: entry.productId });
          const payloadItem: ReceivePurchasePayload["items"][number] = {
            product_id: entry.productId,
            productId: entry.productId,
            purchaseItemId: entry.purchaseItemId,
            quantity,
            receivedQuantity: quantity,
          };

          if (!requiresLot) {
            return payloadItem;
          }

          return {
            ...payloadItem,
            lotCode: entry.lotCode.trim().toUpperCase(),
            expirationDate: entry.expirationDate || undefined,
            locationId: entry.locationId || undefined,
            unitCost: entry.unitCost ? Number(entry.unitCost) : undefined,
          };
        }),
      };

      const response = await receivePurchase(purchaseId, payload, {
        "Idempotency-Key": idempotencyKey,
      });
      onSuccess(response);
    } catch (error) {
      onError?.(error);
      setErrors({
        submit: getErrorMessage(error, "No se pudo registrar la recepcion."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuantityInput = (entry: ReceiveEntryValue, pending: number, label = "") => {
    const othersPrepared =
      (preparedByItem[entry.purchaseItemId] ?? 0) - getReceiveQuantity(entry);
    const maxForEntry = Math.max(Math.round((pending - othersPrepared) * 100) / 100, 0);
    return (
      <Input
        label={label}
        type="number"
        min="0"
        step="0.01"
        max={String(maxForEntry)}
        placeholder="0"
        aria-label={label || "Cantidad a recibir"}
        value={entry.quantity}
        onChange={(event) => {
          const rawValue = event.target.value;
          const numericValue = Number(rawValue);
          const nextValue =
            rawValue === "" || !Number.isFinite(numericValue)
              ? rawValue
              : String(Math.min(Math.max(numericValue, 0), maxForEntry));
          updateEntry(entry.key, { quantity: nextValue });
        }}
        disabled={isBlockedStatus || pending <= 0}
      />
    );
  };

  return (
    <section className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-800 dark:border-slate-700">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Purchases</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Recibir compra</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Escanea o registra las cantidades realmente recibidas. El inventario solo cambia al
            confirmar la recepción.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={onCancel}
          disabled={isSubmitting}
          className="w-full shrink-0 sm:w-auto"
        >
          Volver
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600 dark:text-slate-300">
          Cargando detalle de la compra...
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      ) : purchase ? (
        <form ref={formRef} className="grid w-full min-w-0 gap-5" onSubmit={handleSubmit}>
          <ol className="grid gap-2 sm:grid-cols-3" aria-label="Pasos de recepción">
            {(["information", "products", "confirmation"] as ReceiveStep[]).map((step, index) => (
              <li key={step} className={`rounded-xl border px-3 py-2 text-sm ${receiveStep === step ? "border-blue-500 bg-blue-50 font-semibold text-blue-800" : "border-slate-200 text-slate-500"}`}>
                {index + 1}. {step === "information" ? "Información" : step === "products" ? "Productos" : "Confirmación"}
              </li>
            ))}
          </ol>
          <section className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            {invoiceFromPreviousReceipt ? (
              <p className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                Factura registrada en una recepción anterior. Puedes editarla si esta entrega
                llegó con otra factura.
              </p>
            ) : null}
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <Input
                label="Número de factura del proveedor *"
                value={supplierInvoiceNumber}
                onChange={(event) => {
                  typedInvoiceRef.current = true;
                  setSupplierInvoiceNumber(event.target.value);
                  setErrors((current) => ({ ...current, supplierInvoiceNumber: undefined }));
                }}
                hint={errors.supplierInvoiceNumber}
                disabled={isBlockedStatus}
              />
              <Input
                label="Fecha de factura"
                type="date"
                value={supplierInvoiceDate}
                onChange={(event) => setSupplierInvoiceDate(event.target.value)}
                disabled={isBlockedStatus}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="min-w-0 rounded-xl bg-white/70 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Proveedor</p>
                <p className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-white">
                  {purchase.supplierName || purchase.supplierId}
                </p>
              </div>
              <div className="min-w-0 rounded-xl bg-white/70 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Sucursal</p>
                <p className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-white">
                  {purchase.branchName || purchase.branchId || "-"}
                </p>
              </div>
              <div className="min-w-0 rounded-xl bg-white/70 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</p>
                <p className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-white">
                  {purchase.status}
                </p>
              </div>
              <div className="min-w-0 rounded-xl bg-white/70 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Tipo</p>
                <p className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-white">
                  {purchase.type}
                </p>
              </div>
              <div className="min-w-0 rounded-xl bg-white/70 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Terminal</p>
                <p className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-white">
                  {purchase.terminalName || "-"}
                </p>
              </div>
              <div className="min-w-0 rounded-xl bg-white/70 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total</p>
                <p className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-white">
                  {formatCurrency(Number(purchase.total))}
                </p>
              </div>
            </div>
          </section>

          {lookupWarning ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {lookupWarning}
            </div>
          ) : null}

          {captureEnabled ? (
            <div className="grid gap-2">
              <InventoryScanBar
                id="purchase-receipt-scan"
                capture={capture}
                feedback={scanFeedback}
                label="Escanear productos recibidos"
                placeholder="Escanea solo productos de esta compra o búscalos por nombre"
              >
                {candidates ? (
                  <InventoryProductSearchResults
                    title="Elige el producto del código ambiguo"
                    products={candidates}
                    onSelect={selectFromList}
                  />
                ) : capture.query.trim().length >= 2 ? (
                  <InventoryProductSearchResults
                    title="Productos de esta compra"
                    products={searchResults}
                    emptyMessage="Ningún producto de esta compra coincide."
                    onSelect={selectFromList}
                    renderMeta={(product) =>
                      `Pendiente ${formatQuantity(getRemainingForProduct(product.id))}`
                    }
                  />
                ) : null}
              </InventoryScanBar>
              {scanCatalogWarning ? (
                <p className="text-xs text-amber-700">{scanCatalogWarning}</p>
              ) : null}
            </div>
          ) : null}

          {receiveStep !== "information" && rows.length > 0 ? (
          <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700">
            <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain">
              <div className="min-w-[1040px]">
              <table className="w-full divide-y divide-slate-200 text-sm" aria-label="Productos de la compra para recibir">
                <thead className="bg-slate-50 text-left text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="w-[320px] px-4 py-3 font-medium">Producto</th>
                    <th className="w-[120px] px-4 py-3 font-medium">Pedido</th>
                    <th className="w-[170px] px-4 py-3 font-medium">Recibido acumulado</th>
                    <th className="w-[120px] px-4 py-3 font-medium">Pendiente</th>
                    <th className="w-[180px] px-4 py-3 font-medium">Recibir ahora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ item, pending }) => {
                    const { product, isInventoryable, requiresLot, requiresExpiration, isPerishable } =
                      getItemPolicy(item);
                    const itemEntries = entries.filter((entry) => entry.purchaseItemId === item.id);
                    const prepared = preparedByItem[item.id] ?? 0;
                    const progress = pending > 0 ? Math.min(prepared / pending, 1) : 0;
                    const isSplit = itemEntries.length > 1;
                    const showLotFields = requiresLot && (prepared > 0 || isSplit);
                    const productLabel = item.productName || product?.name || item.productId;

                    return (
                      <Fragment key={item.id}>
                        <tr className={highlightedItemId === item.id ? "bg-blue-50/70" : undefined}>
                          <td className="px-4 py-3 text-slate-900 dark:text-white">
                            <div className="space-y-2">
                              <div>
                                <p className="font-medium">{productLabel}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {product?.sku || item.productSku || item.productId}
                                </p>
                              </div>
                              <div
                                className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"
                                role="progressbar"
                                aria-label={`Preparado de ${productLabel}`}
                                aria-valuemin={0}
                                aria-valuemax={pending}
                                aria-valuenow={prepared}
                              >
                                <div
                                  className={`h-full ${progress >= 1 ? "bg-emerald-500" : "bg-blue-500"}`}
                                  style={{ width: `${progress * 100}%` }}
                                />
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Preparado {formatQuantity(prepared)} de {formatQuantity(pending)}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {isPerishable ? (
                                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                    Perecedero
                                  </span>
                                ) : null}
                                {requiresLot ? (
                                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                    Requiere lote
                                  </span>
                                ) : null}
                                {requiresExpiration ? (
                                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                    Requiere vencimiento
                                  </span>
                                ) : null}
                                {!isInventoryable ? (
                                  <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                                    Servicio, sin inventario
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.orderedQuantity}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.receivedQuantity}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{pending}</td>
                          <td className="px-4 py-3">
                            {isSplit ? (
                              <p className="text-sm font-medium text-slate-900 dark:text-white">
                                {formatQuantity(prepared)} en {itemEntries.length} lotes
                              </p>
                            ) : itemEntries[0] ? (
                              renderQuantityInput(itemEntries[0], pending)
                            ) : null}
                          </td>
                        </tr>
                        {showLotFields ? (
                          <tr className="bg-blue-50/40">
                            <td colSpan={5} className="px-4 py-4">
                              <div className="space-y-3">
                                <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
                                  Este producto requiere lote para recibir inventario.
                                  {requiresExpiration
                                    ? " Tambien requiere fecha de vencimiento."
                                    : ""}
                                </p>
                                {itemEntries.map((entry, entryIndex) => (
                                  <div
                                    key={entry.key}
                                    className={`grid gap-3 ${
                                      isSplit
                                        ? "grid-cols-[minmax(110px,0.6fr)_minmax(170px,1fr)_minmax(190px,1fr)_minmax(230px,1.2fr)_minmax(150px,1fr)_auto]"
                                        : "grid-cols-[minmax(170px,1fr)_minmax(190px,1fr)_minmax(250px,1.2fr)_minmax(170px,1fr)]"
                                    } items-end`}
                                  >
                                    {isSplit ? renderQuantityInput(entry, pending, `Cantidad lote ${entryIndex + 1}`) : null}
                                    <Input
                                      label={isSplit ? `Lote ${entryIndex + 1}` : "Lote"}
                                      required
                                      value={entry.lotCode}
                                      onChange={(event) =>
                                        updateEntry(entry.key, { lotCode: event.target.value.toUpperCase() })
                                      }
                                    />
                                    <Input
                                      label="Fecha de vencimiento"
                                      type="date"
                                      required={requiresExpiration}
                                      min={today}
                                      value={entry.expirationDate}
                                      onChange={(event) =>
                                        updateEntry(entry.key, { expirationDate: event.target.value })
                                      }
                                    />
                                    <Select
                                      label="Ubicacion"
                                      value={entry.locationId}
                                      onChange={(event) =>
                                        updateEntry(entry.key, { locationId: event.target.value })
                                      }
                                    >
                                      <option value="">Sin ubicacion</option>
                                      {locations.map((location) => (
                                        <option key={location.id} value={location.id}>
                                          {location.code} - {location.name}
                                        </option>
                                      ))}
                                    </Select>
                                    <Input
                                      label="Costo unitario"
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={entry.unitCost}
                                      onChange={(event) =>
                                        updateEntry(entry.key, { unitCost: event.target.value })
                                      }
                                    />
                                    {isSplit ? (
                                      <button
                                        type="button"
                                        aria-label={`Quitar lote ${entryIndex + 1} de ${productLabel}`}
                                        className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50"
                                        onClick={() => setEntries(removeReceiveEntry(entriesRef.current, entry.key))}
                                      >
                                        <X className="h-4 w-4" aria-hidden="true" />
                                      </button>
                                    ) : null}
                                  </div>
                                ))}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setEntries(splitReceiveItem(entriesRef.current, item.id, nextEntryKey()))
                                  }
                                >
                                  <Plus className="h-4 w-4" aria-hidden="true" />
                                  Dividir en otro lote
                                </Button>
                                <p className="text-xs text-slate-500">
                                  Los escaneos suman al último lote de la línea.
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </section>
          ) : receiveStep !== "information" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
              Esta compra no tiene productos pendientes por recibir.
            </div>
          ) : null}

          {receiveStep === "confirmation" ? (
            <section className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-900">
              <p className="font-semibold">Revisa antes de confirmar</p>
              <p className="mt-1">Proveedor: {purchase.supplierName || purchase.supplierId}</p>
              <p>Factura: {supplierInvoiceNumber} · Fecha: {supplierInvoiceDate || "Sin fecha"}</p>
              <p>
                Productos a recibir: {new Set(receivableEntries.map((entry) => entry.purchaseItemId)).size}
                {receivableEntries.length > new Set(receivableEntries.map((entry) => entry.purchaseItemId)).size
                  ? ` · Entradas por lote: ${receivableEntries.length}`
                  : ""}
              </p>
              <p>Valor de compra: {formatCurrency(Number(purchase.total))}</p>
            </section>
          ) : null}

          {errors.items ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {errors.items}
            </div>
          ) : null}

          {isBlockedStatus ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              No se puede recibir esta compra porque esta cancelada, recibida o cerrada parcial.
            </div>
          ) : null}

          {errors.submit ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errors.submit}
            </div>
          ) : null}

          {receiveStep === "confirmation" ? (
            <section className="w-full min-w-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 sm:px-5">
              <p className="font-medium text-amber-950">Confirmar recepción</p>
              <p className="mt-1">Al guardar, se registrará la recepción y se actualizará el inventario en una sola operación.</p>
            </section>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={isBlockedStatus || rows.length === 0}
              className="w-full sm:w-auto"
            >
              {receiveStep === "information"
                ? "Continuar a productos"
                : receiveStep === "products"
                  ? "Revisar recepción"
                  : "Confirmar recepción"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              Volver
            </Button>
          </div>
        </form>
      ) : null}

      {quantityDialog ? (
        <InventoryQuantityDialog
          title="Cantidad recibida"
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
            applyReceiptQuantity(product, quantity);
            capture.focusScanInput();
          }}
        />
      ) : null}
    </section>
  );
};
