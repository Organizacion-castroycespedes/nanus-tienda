"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
import { getProducts } from "../services/product.service";
import { createPurchase, type PurchaseResponse } from "../services/purchase.service";
import { getSuppliers, type SupplierResponse } from "../services/supplier.service";
import { buildTenantPath, resolveTenantSlug } from "../../../domains/auth/tenant-path";
import { useAppSelector } from "../../../store/hooks";
import type { PurchasePeripheralContext } from "../../../domains/peripherals/purchase-integration";
import {
  addInventoryCaptureQuantity,
  removeInventoryCaptureLine,
  resolveInventoryProductSaleType,
  setInventoryCaptureQuantity,
  type InventoryCaptureMode,
} from "../barcode/barcode-lines";
import { resolveInventoryBarcode } from "../barcode/barcode-resolver";
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
import { InventorySaleModeDialog } from "../barcode/InventorySaleModeDialog";
import { InventoryScanBar } from "../barcode/InventoryScanBar";
import { useInventoryBarcodeCapture } from "../barcode/use-inventory-barcode-capture";
import {
  buildPurchaseItemsPayload,
  countPurchaseLinesWithoutCost,
  createPurchaseCaptureLine,
  getPurchaseLineSubtotal,
  setPurchaseLineCost,
  type PurchaseCaptureLine,
} from "../purchase-capture/purchase-capture-lines";
import { PurchaseInvoiceTable, type PurchaseInvoiceRow } from "../purchase-capture/PurchaseInvoiceTable";

type PurchaseFormValues = {
  supplierId: string;
  branchId: string;
  type: "CASH" | "CREDIT";
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

type PendingDialog =
  | { kind: "sale-mode"; product: ProductResponse }
  | { kind: "weight"; product: ProductResponse };

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

const todayLabel = () =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" }).format(
    new Date()
  );

export const PurchaseForm = ({
  onCancel,
  onSuccess,
  onError,
  onDirtyChange,
}: PurchaseFormProps) => {
  const router = useRouter();
  const confirm = useConfirm();
  const { currentBranch, currentTenant, isSuperRole } = useInventoryScope();
  const authUser = useAppSelector((state) => state.auth.user);
  const currentPosBranchId = useAppSelector((state) => state.pos.branchId);
  const currentPosTerminalId = useAppSelector((state) => state.pos.terminalId);
  const authBranchName = authUser?.branchName ?? null;
  const [values, setValues] = useState<PurchaseFormValues>({
    supplierId: "",
    branchId: currentBranch ?? "",
    type: "CASH",
  });
  const [lines, setLinesState] = useState<PurchaseCaptureLine[]>([]);
  // Fuente sincrónica para escaneos consecutivos antes del siguiente render.
  const linesRef = useRef<PurchaseCaptureLine[]>([]);
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
  const [scanFeedback, setScanFeedback] = useState<InventoryScanFeedback | null>(null);
  const [candidates, setCandidates] = useState<ProductResponse[] | null>(null);
  const [pendingDialog, setPendingDialog] = useState<PendingDialog | null>(null);
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
  const sounds = useMemo(() => createInventoryScanSoundPlayer(), []);
  const formRef = useRef<HTMLFormElement>(null);

  const markDirty = useCallback(() => {
    onDirtyChange?.(true);
  }, [onDirtyChange]);

  const setLines = useCallback(
    (next: PurchaseCaptureLine[]) => {
      linesRef.current = next;
      setLinesState(next);
      markDirty();
    },
    [markDirty]
  );

  useEffect(() => {
    if (!currentBranch) {
      return;
    }
    setValues((prev) =>
      prev.branchId === currentBranch ? prev : { ...prev, branchId: currentBranch }
    );
  }, [currentBranch]);

  // Si la sucursal cambia desde el selector global de alcance, las líneas ya no aplican.
  const previousBranchRef = useRef(values.branchId);
  useEffect(() => {
    if (previousBranchRef.current !== values.branchId) {
      previousBranchRef.current = values.branchId;
      if (linesRef.current.length > 0) {
        linesRef.current = [];
        setLinesState([]);
        setCandidates(null);
      }
    }
  }, [values.branchId]);

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

  const contextTarget = buildTenantPath(
    resolveTenantSlug({
      tenantSlug: authUser?.tenantSlug,
      tenantId: currentTenant ?? authUser?.tenantId,
    }),
    "pos/select-context"
  );

  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );
  const selectedSupplier = suppliers.find((supplier) => supplier.id === values.supplierId);

  const invoiceRows: PurchaseInvoiceRow[] = useMemo(
    () =>
      lines.map((line) => {
        const product = productsById.get(line.productId);
        return {
          line,
          name: product?.name ?? line.productId,
          code: product?.primaryBarcode ?? product?.sku ?? null,
        };
      }),
    [lines, productsById]
  );

  const { items: payloadItems, total } = useMemo(() => buildPurchaseItemsPayload(lines), [lines]);
  const linesWithoutCost = countPurchaseLinesWithoutCost(lines);

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

  const addQuantity = useCallback(
    (product: ProductResponse, captureMode: InventoryCaptureMode, quantity: number) => {
      const result = addInventoryCaptureQuantity(
        linesRef.current,
        { productId: product.id, mode: captureMode, quantity },
        createPurchaseCaptureLine(product)
      );
      if (result.ok) {
        setLines(result.lines);
        setCandidates(null);
        setHighlightedProductId(product.id);
        setErrors((prev) => ({ ...prev, items: undefined, submit: undefined }));
        notify("success", inventoryScanMessages.added(product.name, result.line.quantity));
        return;
      }
      if (result.reason === "MODE_MISMATCH") {
        notify("error", inventoryScanMessages.modeMismatch(product.name, result.existingMode));
        return;
      }
      notify("error", inventoryScanMessages.invalidQuantity());
    },
    [notify, setLines]
  );

  const addProduct = useCallback(
    (product: ProductResponse) => {
      setCandidates(null);
      const saleType = resolveInventoryProductSaleType(product);
      const existing = linesRef.current.find((line) => line.productId === product.id);
      if (saleType === "UNIT" || (saleType === "BOTH" && existing?.mode === "UNIT")) {
        addQuantity(product, "UNIT", 1);
        return;
      }
      if (saleType === "BOTH" && !existing) {
        setPendingDialog({ kind: "sale-mode", product });
        return;
      }
      setPendingDialog({ kind: "weight", product });
    },
    [addQuantity]
  );

  const handleScan = useCallback(
    (code: string) => {
      const resolution = resolveInventoryBarcode(code, products);
      switch (resolution.kind) {
        case "MATCH":
          addProduct(resolution.product);
          return;
        case "AMBIGUOUS":
          setCandidates(resolution.candidates);
          notify("warning", inventoryScanMessages.ambiguous(resolution.code, resolution.candidates.length));
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
    [addProduct, notify, products]
  );

  const capture = useInventoryBarcodeCapture({
    enabled: !catalogLoading && !isSubmitting,
    focusReleased: pendingDialog !== null,
    onScan: handleScan,
    onDuplicateIgnored: (code) => notify("info", inventoryScanMessages.duplicateIgnored(code)),
    // Un código leído con el foco en cantidad o costo se procesa como escaneo.
    fieldScanScope: formRef,
    onFieldScan: (code) => {
      handleScan(code);
      return true;
    },
    onManualSubmit: (query) => {
      const exact = resolveInventoryBarcode(query, products);
      if (exact.kind !== "NOT_FOUND") {
        handleScan(query);
        capture.clear();
        return;
      }
      const results = searchInventoryProducts(products, query);
      if (results.length === 1) {
        addProduct(results[0]);
        capture.clear();
        return;
      }
      if (results.length === 0) {
        notify("warning", `Sin resultados para "${query}".`);
      }
    },
  });

  const searchResults = useMemo(
    () => (candidates ? [] : searchInventoryProducts(products, capture.query)),
    [candidates, capture.query, products]
  );

  const selectFromList = (product: ProductResponse) => {
    capture.clear();
    addProduct(product);
    capture.focusScanInput();
  };

  const closeDialog = () => {
    setPendingDialog(null);
    capture.focusScanInput();
  };

  const updateLineQuantity = (line: PurchaseCaptureLine, quantity: number) => {
    const result = setInventoryCaptureQuantity(linesRef.current, line.productId, quantity);
    if (result.ok) {
      setLines(result.lines);
      setHighlightedProductId(line.productId);
    }
  };

  const updateLineCost = (line: PurchaseCaptureLine, cost: number) => {
    const next = setPurchaseLineCost(linesRef.current, line.productId, cost);
    if (next) {
      setLines(next);
      setHighlightedProductId(line.productId);
    }
  };

  const removeLine = async (line: PurchaseCaptureLine) => {
    const name = productsById.get(line.productId)?.name ?? "este producto";
    try {
      await confirm({
        title: "Eliminar producto",
        description: `Se quitará ${name} de la compra.`,
        confirmText: "Eliminar",
        cancelText: "Volver",
        variant: "danger",
      });
    } catch {
      capture.focusScanInput();
      return;
    }
    setLines(removeInventoryCaptureLine(linesRef.current, line.productId));
    capture.focusScanInput();
  };

  const decrementLine = (line: PurchaseCaptureLine) => {
    if (line.quantity - 1 <= 0) {
      void removeLine(line);
      return;
    }
    updateLineQuantity(line, line.quantity - 1);
  };

  const changeBranch = async (branchId: string) => {
    if (branchId === values.branchId) {
      return;
    }
    if (linesRef.current.length > 0) {
      try {
        await confirm({
          title: "Cambiar sucursal",
          description:
            "El catálogo cambia con la sucursal. Se quitarán los productos capturados.",
          confirmText: "Cambiar y limpiar",
          cancelText: "Volver",
          variant: "warning",
        });
      } catch {
        return;
      }
      setLines([]);
      setCandidates(null);
    }
    markDirty();
    setValues((prev) => ({ ...prev, branchId }));
    setSelectedTerminalId("");
    setErrors((prev) => ({
      ...prev,
      branchId: undefined,
      terminalId: undefined,
      submit: undefined,
    }));
  };

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

    if (lines.length === 0) {
      nextErrors.items = "Agrega al menos un producto a la compra.";
    } else if (lines.some((line) => !(line.quantity > 0) || !(line.cost >= 0))) {
      nextErrors.items = "Todos los productos deben tener cantidad mayor a 0 y costo válido.";
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
      const response = await createPurchase({
        supplierId: values.supplierId,
        branchId: values.branchId,
        terminalId: resolvedTerminalId ?? "",
        type: values.type,
        total,
        items: payloadItems,
      });

      const peripheralContext: PurchasePeripheralContext = {
        purchaseId: response.id,
        purchaseNumber: response.id,
        documentNumber: response.id,
        date: response.createdAt,
        businessName: response.tenantName ?? authUser?.tenantName ?? "Manus POS",
        branchName: response.branchName ?? selectedBranchName,
        cashier: authUser?.name ?? authUser?.email ?? undefined,
        supplierName: response.supplierName ?? selectedSupplier?.name ?? "Proveedor",
        items: invoiceRows.map((row) => ({
          name: row.name,
          quantity: row.line.quantity,
          unitPrice: row.line.cost,
          total: getPurchaseLineSubtotal(row.line),
        })),
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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-800 dark:border-slate-700">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Purchases</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Crear compra</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Registra la factura del proveedor escaneando los productos. Guardar la compra no
            mueve inventario; el stock entra al confirmar la recepción.
          </p>
        </div>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>

      <form ref={formRef} className="grid gap-5" onSubmit={handleSubmit}>
        <div
          aria-label="Encabezado de la factura de proveedor"
          className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)] dark:border-slate-700 dark:bg-slate-900/40"
        >
          <div className="space-y-2">
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
            {selectedSupplier ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {[
                  selectedSupplier.legalName && selectedSupplier.legalName !== selectedSupplier.name
                    ? selectedSupplier.legalName
                    : null,
                  selectedSupplier.documentNumber ? `Documento ${selectedSupplier.documentNumber}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
            {errors.supplierId ? (
              <p className="text-xs text-rose-600">{errors.supplierId}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {isSuperRole ? (
              <div className="space-y-1">
                <Select
                  label="Sucursal"
                  required
                  value={values.branchId}
                  disabled={catalogLoading || branches.length === 0}
                  onChange={(event) => void changeBranch(event.target.value)}
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

            <Input label="Fecha" value={todayLabel()} disabled readOnly />
          </div>
        </div>

        <InventoryScanBar
          id="purchase-scan"
          capture={capture}
          feedback={scanFeedback}
          disabled={catalogLoading || isSubmitting}
          placeholder="Escanea los productos de la factura o escribe nombre, SKU o código"
        >
          {candidates ? (
            <InventoryProductSearchResults
              title="Elige el producto del código ambiguo"
              products={candidates}
              onSelect={selectFromList}
            />
          ) : capture.query.trim().length >= 2 ? (
            <InventoryProductSearchResults
              title="Resultados de búsqueda"
              products={searchResults}
              emptyMessage="Sin resultados. Revisa el nombre, SKU o código."
              onSelect={selectFromList}
            />
          ) : null}
        </InventoryScanBar>

        <PurchaseInvoiceTable
          rows={invoiceRows}
          highlightedProductId={highlightedProductId}
          disabled={isSubmitting}
          onIncrement={(line) => updateLineQuantity(line, line.quantity + 1)}
          onDecrement={decrementLine}
          onSetQuantity={updateLineQuantity}
          onSetCost={updateLineCost}
          onInvalidQuantity={() => notify("error", inventoryScanMessages.invalidQuantity())}
          onInvalidCost={() =>
            notify("error", "Costo inválido: debe ser mayor o igual a 0 con máximo 2 decimales.")
          }
          onRemove={(line) => void removeLine(line)}
        />
        {errors.items ? <p className="text-xs text-rose-600">{errors.items}</p> : null}

        <div
          aria-label="Totales de la compra"
          className="sticky bottom-0 z-10 grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-lg sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center lg:static lg:shadow-none dark:border-emerald-500/30 dark:bg-emerald-950"
        >
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3 sm:justify-start">
              <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Total compra
              </p>
              <p className="text-2xl font-semibold tabular-nums text-emerald-950 dark:text-white">
                {formatCurrency(total)}
              </p>
            </div>
            <p className="text-xs text-emerald-900/80 dark:text-emerald-100/80">
              {lines.length} producto(s) en la factura.
            </p>
            {linesWithoutCost > 0 ? (
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                {linesWithoutCost} producto(s) sin costo.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" isLoading={isSubmitting} className="flex-1 sm:flex-none">
              Guardar compra
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              Cancelar
            </Button>
          </div>
        </div>

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
      </form>

      {pendingDialog?.kind === "sale-mode" ? (
        <InventorySaleModeDialog
          productName={pendingDialog.product.name}
          onCancel={closeDialog}
          onSelect={(captureMode) => {
            const product = pendingDialog.product;
            if (captureMode === "UNIT") {
              setPendingDialog(null);
              addQuantity(product, "UNIT", 1);
              capture.focusScanInput();
              return;
            }
            setPendingDialog({ kind: "weight", product });
          }}
        />
      ) : null}

      {pendingDialog?.kind === "weight" ? (
        <InventoryQuantityDialog
          title="Peso del producto"
          productName={pendingDialog.product.name}
          onCancel={closeDialog}
          onConfirm={(quantity) => {
            const product = pendingDialog.product;
            setPendingDialog(null);
            addQuantity(product, "WEIGHT", quantity);
            capture.focusScanInput();
          }}
        />
      ) : null}
    </section>
  );
};
