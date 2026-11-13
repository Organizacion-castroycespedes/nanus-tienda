"use client";

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
import { buildConfirmFromApiError } from "../../../lib/api-messages";
import { useAppSelector } from "../../../store/hooks";
import { getCustomers, type CustomerResponse } from "../services/customer.service";
import {
  createOrder,
  updateOrder,
  type OrderDetailResponse,
  type OrderResponse,
} from "../services/order.service";
import { getProducts } from "../services/product.service";
import type { OrderPeripheralContext } from "../../../domains/peripherals/order-integration";
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
  buildOrderItemsPayload,
  buildOrderLinePricingKey,
  createOrderCaptureLine,
  getOrderLineAmounts,
  getOrderLineStockWarning,
  mapOrderItemsToCaptureLines,
  type OrderCaptureLine,
  type OrderLineAmounts,
} from "../order-capture/order-capture-lines";
import { OrderCaptureTicket, type OrderTicketRow } from "../order-capture/OrderCaptureTicket";
import { useOrderLinePricing } from "../order-capture/use-order-line-pricing";

type OrderFormValues = {
  customerId: string;
  branchId: string;
  type: "CASH" | "CREDIT";
};

type OrderFormErrors = {
  customerId?: string;
  branchId?: string;
  terminalId?: string;
  items?: string;
  submit?: string;
};

type OrderFormProps = {
  mode?: "create" | "edit";
  order?: OrderDetailResponse | null;
  onCancel: () => void;
  onSuccess: (
    response?: OrderResponse,
    peripheralContext?: OrderPeripheralContext
  ) => void;
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

const mapOrderToValues = (
  order: OrderDetailResponse | null | undefined,
  fallbackBranchId: string
): OrderFormValues => ({
  customerId: order?.customerId ?? "",
  branchId: order?.branchId ?? fallbackBranchId,
  type: order?.type ?? "CASH",
});

export const OrderForm = ({
  mode = "create",
  order,
  onCancel,
  onSuccess,
}: OrderFormProps) => {
  const { currentBranch, currentTenant } = useInventoryScope();
  const confirm = useConfirm();
  const authUser = useAppSelector((state) => state.auth.user);
  const authRole = useAppSelector((state) => state.auth.role ?? null);
  const currentPosBranchId = useAppSelector((state) => state.pos.branchId);
  const currentPosTerminalId = useAppSelector((state) => state.pos.terminalId);
  const role = authUser?.role ?? authRole;
  const authBranchName = authUser?.branchName ?? null;
  const [values, setValues] = useState<OrderFormValues>(() =>
    mapOrderToValues(order, currentBranch ?? "")
  );
  const [lines, setLinesState] = useState<OrderCaptureLine[]>([]);
  // Fuente sincrónica para escaneos consecutivos antes del siguiente render.
  const linesRef = useRef<OrderCaptureLine[]>([]);
  const setLines = useCallback((next: OrderCaptureLine[]) => {
    linesRef.current = next;
    setLinesState(next);
  }, []);
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customers, setCustomers] = useState<CustomerResponse[]>([]);
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
  const linesLoadedForOrderRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const sounds = useMemo(() => createInventoryScanSoundPlayer(), []);
  const canSelectBranch =
    role === "SUPER_ADMIN" || role === "SUPER_USER" || role === "ADMIN" || role === "USER";
  const captureLocked = mode === "edit" && Boolean(order) && order?.status !== "DRAFT";

  useEffect(() => {
    setValues(mapOrderToValues(order, currentBranch ?? ""));
  }, [currentBranch, order]);

  useEffect(() => {
    if (mode === "edit" || !currentBranch) {
      return;
    }
    setValues((prev) =>
      prev.branchId === currentBranch ? prev : { ...prev, branchId: currentBranch }
    );
  }, [currentBranch, mode]);

  useEffect(() => {
    let mounted = true;

    const loadCatalogs = async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const branchPromise =
          canSelectBranch && currentTenant
            ? listBranches({ tenantId: currentTenant })
            : Promise.resolve<BranchResponse[]>([]);
        const [customersResult, productsResult, branchesResult] = await Promise.all([
          getCustomers(),
          getProducts({ branchId: values.branchId || currentBranch || undefined }),
          branchPromise,
        ]);

        if (!mounted) {
          return;
        }

        setCustomers(customersResult.filter((customer) => customer.isActive));
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

    void loadCatalogs();

    return () => {
      mounted = false;
    };
  }, [canSelectBranch, currentTenant, currentBranch, values.branchId]);

  // Al editar un pedido DRAFT, las líneas se arman una vez que el catálogo está listo.
  useEffect(() => {
    if (!order || catalogLoading || linesLoadedForOrderRef.current === order.id) {
      return;
    }
    linesLoadedForOrderRef.current = order.id;
    setLines(mapOrderItemsToCaptureLines(order.items, products));
  }, [catalogLoading, order, products, setLines]);

  // Si la sucursal cambia desde el selector global de alcance, las líneas ya no aplican.
  const previousBranchRef = useRef(values.branchId);
  useEffect(() => {
    if (previousBranchRef.current !== values.branchId) {
      previousBranchRef.current = values.branchId;
      if (mode === "create" && linesRef.current.length > 0) {
        setLines([]);
        setCandidates(null);
      }
    }
  }, [mode, setLines, values.branchId]);

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
    if (canSelectBranch) {
      return branches.find((branch) => branch.id === values.branchId)?.nombre ?? "";
    }
    return authBranchName ?? values.branchId;
  }, [authBranchName, branches, canSelectBranch, values.branchId]);

  const selectedBranchTerminals = useMemo(
    () =>
      contextBranches.find((branch) => branch.id === values.branchId)?.terminals ?? [],
    [contextBranches, values.branchId]
  );

  useEffect(() => {
    if (mode !== "create") {
      return;
    }
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
    mode,
    selectedBranchTerminals,
    selectedTerminalId,
    values.branchId,
  ]);

  const resolvedTerminalId = useMemo(() => {
    if (mode !== "create") {
      return undefined;
    }
    if (currentPosBranchId === values.branchId && currentPosTerminalId) {
      return currentPosTerminalId;
    }
    return selectedTerminalId || undefined;
  }, [currentPosBranchId, currentPosTerminalId, mode, selectedTerminalId, values.branchId]);

  const resolvedTerminalName = useMemo(
    () =>
      selectedBranchTerminals.find((terminal) => terminal.id === resolvedTerminalId)
        ?.name ?? "",
    [resolvedTerminalId, selectedBranchTerminals]
  );

  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  const { pricing } = useOrderLinePricing({
    lines,
    branchId: values.branchId,
    customerId: values.customerId,
    enabled: !captureLocked,
  });

  const amountsByProductId = useMemo(() => {
    const map = new Map<string, OrderLineAmounts>();
    for (const line of lines) {
      const key = buildOrderLinePricingKey({
        branchId: values.branchId,
        customerId: values.customerId,
        productId: line.productId,
        quantity: line.quantity,
      });
      map.set(line.productId, getOrderLineAmounts(line, pricing[line.productId], key));
    }
    return map;
  }, [lines, pricing, values.branchId, values.customerId]);

  const ticketRows: OrderTicketRow[] = useMemo(
    () =>
      lines.map((line) => {
        const product = productsById.get(line.productId);
        const existingItem = order?.items.find((item) => item.productId === line.productId);
        return {
          line,
          name: product?.name ?? existingItem?.productName ?? line.productId,
          sku: product?.sku ?? null,
          amounts: amountsByProductId.get(line.productId) as OrderLineAmounts,
          pricing: pricing[line.productId],
          stockWarning: getOrderLineStockWarning(line, product),
        };
      }),
    [amountsByProductId, lines, order?.items, pricing, productsById]
  );

  const { items: payloadItems, total } = useMemo(
    () => buildOrderItemsPayload(lines, amountsByProductId),
    [amountsByProductId, lines]
  );
  const isEstimatedTotal = ticketRows.some((row) => !row.amounts.fromBackend);
  const stockWarningCount = ticketRows.filter((row) => row.stockWarning).length;
  const totalUnits = lines.reduce((sum, line) => sum + (line.mode === "UNIT" ? line.quantity : 0), 0);

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
        createOrderCaptureLine(product)
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
    enabled: !captureLocked && !catalogLoading && !isSubmitting,
    focusReleased: pendingDialog !== null,
    onScan: handleScan,
    onDuplicateIgnored: (code) => notify("info", inventoryScanMessages.duplicateIgnored(code)),
    // Un código leído con el foco en cantidad u otro campo se procesa como escaneo.
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

  const updateLineQuantity = (line: OrderCaptureLine, quantity: number) => {
    const result = setInventoryCaptureQuantity(linesRef.current, line.productId, quantity);
    if (result.ok) {
      setLines(result.lines);
      setHighlightedProductId(line.productId);
    }
  };

  const removeLine = async (line: OrderCaptureLine) => {
    const name = productsById.get(line.productId)?.name ?? "este producto";
    try {
      await confirm({
        title: "Eliminar producto",
        description: `Se quitará ${name} del pedido.`,
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

  const decrementLine = (line: OrderCaptureLine) => {
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
    if (lines.length > 0) {
      try {
        await confirm({
          title: "Cambiar sucursal",
          description:
            "El catálogo, el stock y los precios cambian con la sucursal. Se quitarán los productos capturados.",
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
    const nextErrors: OrderFormErrors = {};

    if (!values.customerId) {
      nextErrors.customerId = "Debes seleccionar un cliente.";
    }

    if (!values.branchId) {
      nextErrors.branchId = "Debes seleccionar una sucursal.";
    }

    if (mode === "create" && !resolvedTerminalId) {
      nextErrors.terminalId =
        values.branchId && !terminalLoading
          ? "La sucursal seleccionada no tiene terminal activa disponible."
          : "Selecciona una terminal antes de crear el pedido.";
    }

    if (
      mode === "create" &&
      resolvedTerminalId === currentPosTerminalId &&
      currentPosBranchId &&
      values.branchId &&
      currentPosBranchId !== values.branchId
    ) {
      nextErrors.terminalId =
        "La terminal seleccionada no pertenece a la sucursal del pedido.";
    }

    if (lines.length === 0) {
      nextErrors.items = "Agrega al menos un producto al pedido.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (captureLocked || !validate()) {
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const payload = {
        customerId: values.customerId,
        branchId: values.branchId,
        type: values.type,
        total,
        items: payloadItems,
      };

      const response =
        mode === "edit" && order
          ? await updateOrder(order.id, payload)
          : await createOrder({
              ...payload,
              terminalId: resolvedTerminalId,
            });
      const selectedCustomer = customers.find(
        (customer) => customer.id === values.customerId
      );
      const peripheralContext: OrderPeripheralContext = {
        orderId: response.id,
        orderNumber: response.id,
        documentNumber: response.id,
        date: response.createdAt,
        businessName: response.tenantName ?? authUser?.tenantName ?? "Manus POS",
        branchName: response.branchName ?? selectedBranchName,
        cashier: authUser?.name ?? authUser?.email ?? undefined,
        customerName: response.customerName ?? selectedCustomer?.name ?? "Cliente",
        status: response.status,
        items: ticketRows.map((row) => ({
          name: row.name,
          quantity: row.line.quantity,
          unitPrice: row.amounts.unitPrice,
          total: row.amounts.lineTotal,
        })),
        subtotal: total,
        taxes: 0,
        discounts: 0,
        total: response.total ?? total,
        balanceDue: response.balanceDue,
        payments: [],
      };

      onSuccess(response, peripheralContext);
    } catch (error) {
      const fallback =
        mode === "edit" ? "No se pudo actualizar el pedido." : "No se pudo guardar el pedido.";
      setErrors({
        submit: fallback,
      });
      const dialog = buildConfirmFromApiError(error, fallback);
      await confirm({
        ...dialog,
        confirmText: "Entendido",
        hideCancel: true,
      }).catch(() => undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = mode === "edit" ? "Editar pedido" : "Crear pedido";
  const submitLabel = mode === "edit" ? "Guardar cambios" : "Guardar pedido";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-800 dark:border-slate-700">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Orders</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Escanea o busca productos; el precio final lo calcula el sistema al guardar.
          </p>
        </div>
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
      </div>

      <form ref={formRef} className="grid gap-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <Select
              label="Cliente"
              required
              value={values.customerId}
              disabled={catalogLoading || customers.length === 0}
              onChange={(event) => {
                setValues((prev) => ({ ...prev, customerId: event.target.value }));
                setErrors((prev) => ({ ...prev, customerId: undefined, submit: undefined }));
              }}
            >
              <option value="">
                {catalogLoading ? "Cargando..." : "Selecciona un cliente"}
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
            {errors.customerId ? <p className="text-xs text-rose-600">{errors.customerId}</p> : null}
          </div>

          {canSelectBranch ? (
            <div className="space-y-1">
              <Select
                label="Sucursal"
                required
                value={values.branchId}
                disabled={catalogLoading || branches.length === 0 || mode === "edit"}
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

          {mode === "create" ? (
            <div className="space-y-1">
              {selectedBranchTerminals.length > 1 ? (
                <Select
                  label="Terminal"
                  required
                  value={resolvedTerminalId ?? ""}
                  disabled={terminalLoading}
                  onChange={(event) => {
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
                <Input
                  label="Terminal"
                  value={
                    terminalLoading
                      ? "Cargando..."
                      : resolvedTerminalName || "Sin terminal activa"
                  }
                  disabled
                  readOnly
                />
              )}
              {terminalError ? (
                <p className="text-xs text-amber-700">{terminalError}</p>
              ) : null}
              {errors.terminalId ? (
                <p className="text-xs text-rose-600">{errors.terminalId}</p>
              ) : null}
            </div>
          ) : null}

          <Select
            label="Tipo"
            value={values.type}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                type: event.target.value as "CASH" | "CREDIT",
              }))
            }
          >
            <option value="CASH">CASH</option>
            <option value="CREDIT">CREDIT</option>
          </Select>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <div className="grid min-w-0 gap-4">
            {captureLocked ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Solo los pedidos en borrador permiten editar productos.
              </p>
            ) : (
              <InventoryScanBar
                id="order-scan"
                capture={capture}
                feedback={scanFeedback}
                disabled={catalogLoading || isSubmitting}
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
                    renderMeta={(product) =>
                      product.isInventoryable === false || product.stock === undefined
                        ? null
                        : `Stock ${product.stock}`
                    }
                  />
                ) : null}
              </InventoryScanBar>
            )}

            <OrderCaptureTicket
              rows={ticketRows}
              highlightedProductId={highlightedProductId}
              disabled={captureLocked || isSubmitting}
              onIncrement={(line) => updateLineQuantity(line, line.quantity + 1)}
              onDecrement={decrementLine}
              onSetQuantity={updateLineQuantity}
              onInvalidQuantity={() => notify("error", inventoryScanMessages.invalidQuantity())}
              onRemove={(line) => void removeLine(line)}
            />
            {errors.items ? <p className="text-xs text-rose-600">{errors.items}</p> : null}
          </div>

          <aside
            aria-label="Resumen del pedido"
            className="sticky bottom-0 z-10 grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-lg xl:top-4 xl:bottom-auto xl:shadow-none dark:border-emerald-500/30 dark:bg-emerald-950"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                {isEstimatedTotal ? "Total estimado" : "Total"}
              </p>
              <p className="text-2xl font-semibold tabular-nums text-emerald-950 dark:text-white">
                {formatCurrency(total)}
              </p>
            </div>
            <p className="text-xs text-emerald-900/80 dark:text-emerald-100/80">
              {lines.length} producto(s){totalUnits > 0 ? ` · ${totalUnits} unidad(es)` : ""}. El
              sistema recalcula precios e impuestos al guardar.
            </p>
            {stockWarningCount > 0 ? (
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                {stockWarningCount} producto(s) superan el stock disponible.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" isLoading={isSubmitting} disabled={captureLocked} className="flex-1">
                {submitLabel}
              </Button>
              <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
                Cancelar
              </Button>
            </div>
          </aside>
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
