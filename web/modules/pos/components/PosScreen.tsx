"use client";

import {
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Grid3X3,
  List,
  Loader2,
  Minus,
  Package,
  Plus,
  Scale,
  Search,
  SlidersHorizontal,
  ShoppingCart,
  Trash2,
  UserRound,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import { Select } from "../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../components/design-system/Toast";
import { usePosCartStore } from "../hooks/usePosCartStore";
import { usePosUiStore } from "../hooks/usePosUiStore";
import { useRequirePosSession } from "../../../domains/pos/hooks/useRequirePosSession";
import { useAppSelector } from "../../../store/hooks";
import { useAutoClearState } from "../../../lib/useAutoClearState";
import { hasMenuAccess } from "../../../lib/permissions";
import { fetchSystemVersion } from "../../../domains/system/api";
import {
  getCurrentCashSession,
  listPaymentMethods,
} from "../../finance/services/finance.service";
import type {
  CashSession,
  PaymentMethod as FinancePaymentMethod,
} from "../../finance/types";
import {
  createSale,
  getPosCustomers,
  getPosProducts,
  getPosTaxes,
  previewPosLinePrice,
  type PosLinePricePreviewResponse,
  type PosSalePayload,
} from "../services/pos.service";
import {
  buildDefaultPayments,
  buildPaymentId,
  type PaymentDraft,
  type PosCartAppliedTax,
  type PosCartItem,
} from "../../../store/posCart";
import type { ProductResponse } from "../../../domains/products/dtos";
import type { CustomerResponse } from "../../inventory/services/customer.service";
import type { TaxResponse } from "../../inventory/services/tax.service";
import { QuickFiscalCustomerModal } from "./QuickFiscalCustomerModal";
import type { ElectronicInvoicingCustomer } from "../../electronic-invoicing/services/customer.service";
import {
  createDefaultCashPayment,
  findCashPaymentMethod,
  isCashPaymentMethod,
  parsePaymentAmount,
  rebalanceCashPayment,
} from "../../shared/payments/payment-allocation.helper";
import {
  buildSalePeripheralFeedbackMessage,
  runSalePeripheralOperations,
  type PosSalePeripheralContext,
} from "../../../domains/peripherals/pos-sale-integration";
import {
  getPeripheralFeatureFlags,
  readCurrentWeight,
  simulateScannerRead,
  subscribeScannerEvents,
} from "../../../domains/peripherals/contracts";
import type {
  PeripheralOperationError,
  ScannerReadResult,
} from "../../../domains/peripherals/types";
import {
  collectPosScannerProductCodes,
  findUniquePosScannerProduct,
  normalizePosScannerCode,
} from "../utils/pos-scanner";
import {
  createPosScannerWedgeState,
  handlePosScannerKeyboardEvent,
  isPosScannerTerminatorKey,
  resolvePosScannerWedgeOptions,
} from "../utils/pos-scanner-wedge";
import {
  createPosScannerHidLogger,
  describePosScannerWedgeIgnoredSequence,
} from "../utils/pos-scanner-hid";
import { buildPosCartDiscountDisplay } from "./pos-discount-display";
import { InventoryImagePreview } from "../../inventory/components/InventoryImagePreview";
import {
  listProductCategories,
  listProductSubcategories,
  type ProductCategoryResponse,
  type ProductSubcategoryResponse,
} from "../../inventory/services/product-classification.service";
import {
  buildClearedPosProductCatalogFilters,
  filterPosProductsForCatalog,
  normalizePosClassificationId,
  resolveEffectivePosProductImage,
  resolvePosSubcategoryFilterForCategory,
  sortPosClassificationOptions,
  type PosStockFilterKey,
} from "../utils/product-classification";
import { createProductAddedSoundPlayer } from "../utils/product-added-sound";
import {
  FLOATING_CART_STORAGE_KEY,
  FLOATING_POS_STORAGE_KEY,
  FLOATING_CHARGE_STORAGE_KEY,
} from "../utils/floating-control-position";
import { useDraggableFloatingControl } from "../hooks/useDraggableFloatingControl";
import { usePosFiltersStorage } from "../hooks/usePosFiltersStorage";

type StockFilterKey = PosStockFilterKey;
type ProductViewMode = "grid" | "list";
type ScannerMockStatus = "disabled" | "connected" | "error";
type ScaleMockStatus = "disabled" | "ready" | "reading" | "error";

type ProductUnitCandidate =
  | string
  | {
      code?: string | null;
      name?: string | null;
      symbol?: string | null;
      abbreviation?: string | null;
      codigo?: string | null;
      nombre?: string | null;
      abreviatura?: string | null;
    };

type WeighableProductCandidate = ProductResponse & {
  saleType?: "UNIT" | "WEIGHT" | "BOTH" | null;
  isWeighable?: boolean;
  weighable?: boolean;
  soldByWeight?: boolean;
  measurementUnit?: ProductUnitCandidate | null;
  unit?: ProductUnitCandidate | null;
  unidad?: ProductUnitCandidate | null;
  unitCode?: string | null;
  unitName?: string | null;
  unitSymbol?: string | null;
  unitAbbreviation?: string | null;
  productType?: string | null;
  type?: string | null;
  tipo?: string | null;
};
type PosItemTax = PosCartAppliedTax;
const stockFilterLabels: Record<StockFilterKey, string> = {
  available: "Con stock",
  low: "Stock bajo",
  out: "Sin stock",
  all: "Todos",
};

const productViewModeOptions: Array<{
  value: ProductViewMode;
  label: string;
  icon: typeof Grid3X3;
}> = [
  {
    value: "grid",
    label: "Cuadricula",
    icon: Grid3X3,
  },
  {
    value: "list",
    label: "Lista",
    icon: List,
  },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const weighableUnitCodes = new Set([
  "kg",
  "lb",
  "g",
  "oz",
  "kilo",
  "kilos",
  "kilogram",
  "kilograms",
  "kilogramo",
  "kilogramos",
  "libra",
  "libras",
  "gramo",
  "gramos",
  "onza",
  "onzas",
]);

const weighableProductTypes = new Set([
  "weighable",
  "soldbyweight",
  "byweight",
  "pesable",
  "porpeso",
  "peso",
]);

const normalizeProductUnitValue = (value: unknown) =>
  typeof value === "string"
    ? normalizePosScannerCode(value).replace(/\s+/g, "")
    : "";

const collectUnitCandidateValues = (unit: ProductUnitCandidate | null | undefined) => {
  if (!unit) {
    return [];
  }

  if (typeof unit === "string") {
    return [unit];
  }

  return [
    unit.code,
    unit.name,
    unit.symbol,
    unit.abbreviation,
    unit.codigo,
    unit.nombre,
    unit.abreviatura,
  ].filter((value): value is string => typeof value === "string" && value.trim() !== "");
};

const isWeighableProduct = (product: ProductResponse) => {
  const candidate = product as WeighableProductCandidate;

  if (candidate.saleType === "WEIGHT" || candidate.saleType === "BOTH") {
    return true;
  }

  if (candidate.saleType === "UNIT") {
    return false;
  }

  if (
    candidate.isWeighable === true ||
    candidate.weighable === true ||
    candidate.soldByWeight === true
  ) {
    return true;
  }

  const unitValues = [
    candidate.measurementUnit,
    candidate.unit,
    candidate.unidad,
  ].flatMap(collectUnitCandidateValues);
  const directUnitValues = [
    candidate.unitCode,
    candidate.unitName,
    candidate.unitSymbol,
    candidate.unitAbbreviation,
  ];
  const typeValues = [candidate.productType, candidate.type, candidate.tipo];

  return (
    [...unitValues, ...directUnitValues]
      .map(normalizeProductUnitValue)
      .some((value) => weighableUnitCodes.has(value)) ||
    typeValues
      .map(normalizeProductUnitValue)
      .some((value) => weighableProductTypes.has(value))
  );
};

const formatScaleQuantity = (value: number) =>
  value.toFixed(3).replace(/\.?0+$/, "");

const getProductSaleType = (product: ProductResponse) =>
  product.saleType ?? (isWeighableProduct(product) ? "WEIGHT" : "UNIT");

const productSaleTypeLabels: Record<"UNIT" | "WEIGHT" | "BOTH", string> = {
  UNIT: "Unidad",
  WEIGHT: "Peso",
  BOTH: "Unidad/peso",
};

const parseQuantityInput = (value: string) => {
  const normalized = value.replace(",", ".").replace(/[^0-9.]/g, "");
  const [whole, ...decimalParts] = normalized.split(".");
  const quantity =
    decimalParts.length > 0 ? `${whole}.${decimalParts.join("")}` : whole;
  return Number(quantity || 0);
};

const round = (value: number) => Number(value.toFixed(2));

const arePaymentsEqual = (
  first: PaymentDraft[],
  second: PaymentDraft[]
) =>
  first.length === second.length &&
  first.every((payment, index) => {
    const other = second[index];
    return (
      other &&
      payment.id === other.id &&
      payment.paymentMethodId === other.paymentMethodId &&
      payment.amount === other.amount &&
      payment.reference === other.reference
    );
  });

const isLowStock = (stock: number) => stock > 0 && stock <= 5;

const isEditableShortcutTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
};

const getProductStockTone = (stock: number) => {
  if (stock <= 0) {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200";
  }
  if (isLowStock(stock)) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100";
};

const buildImageLabel = (name: string) => {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "PR";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
};

const buildPricingRequestKey = (
  branchId: string,
  customerId: string | null,
  productId: string,
  quantity: number
) => `${branchId}:${customerId ?? "default"}:${productId}:${quantity}`;

const mapFiscalCustomerToPosCustomer = (
  customer: ElectronicInvoicingCustomer
): CustomerResponse => ({
  id: customer.id,
  tenantId: customer.tenantId,
  name: customer.name,
  documentNumber:
    customer.identificationNumber ??
    customer.documentNumberNormalized ??
    customer.documentNumber,
  phone: customer.phone,
  email: customer.fiscalEmail ?? customer.invoiceEmail,
  address: customer.address,
  departamentoId: null,
  municipioId: null,
  ciudad: customer.municipalityCode,
  departamento: customer.departmentCode,
  isActive: customer.isActive,
  createdAt: customer.createdAt,
  updatedAt: customer.updatedAt,
});

const upsertCustomer = (
  current: CustomerResponse[],
  customer: CustomerResponse
) => {
  const next = current.filter((item) => item.id !== customer.id);
  return customer.isActive ? [customer, ...next] : next;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "No se pudo calcular precio/promocion.";
};

const markPricingPending = (
  item: PosCartItem,
  quantity: number,
  pricingRequestKey: string
): PosCartItem => ({
  ...item,
  quantity,
  price: item.baseUnitPrice ?? item.price,
  priceWithoutTax: item.basePriceWithoutTax ?? item.priceWithoutTax,
  pricingStatus: "PENDING",
  pricingRequestKey,
  pricingError: null,
  finalUnitPrice: undefined,
  discountAmount: 0,
  discountPercent: 0,
  appliedPromotionId: null,
  appliedPromotionName: null,
  taxBase: undefined,
  taxAmount: undefined,
  lineSubtotal: undefined,
  lineTotal: undefined,
  taxes: [],
});

const applyPricingPreview = (
  item: PosCartItem,
  preview: PosLinePricePreviewResponse,
  pricingRequestKey: string
): PosCartItem => ({
  ...item,
  quantity: preview.quantity,
  price: preview.finalUnitPrice,
  priceWithoutTax:
    preview.quantity > 0 ? round(preview.taxBase / preview.quantity) : item.priceWithoutTax,
  taxId: preview.taxId,
  pricingStatus: "READY",
  pricingRequestKey,
  pricingError: null,
  baseUnitPrice: preview.baseUnitPrice,
  finalUnitPrice: preview.finalUnitPrice,
  discountAmount: preview.discountAmount,
  discountPercent: preview.discountPercent,
  appliedPromotionId: preview.appliedPromotionId,
  appliedPromotionName: preview.appliedPromotionName,
  taxRate: preview.taxRate,
  taxBase: preview.taxBase,
  taxAmount: preview.taxAmount,
  lineSubtotal: preview.lineSubtotal,
  lineTotal: preview.lineTotal,
  taxes: preview.taxes,
});

const applyPricingError = (
  item: PosCartItem,
  pricingRequestKey: string,
  pricingError: string
): PosCartItem => ({
  ...item,
  price: item.baseUnitPrice ?? item.price,
  priceWithoutTax: item.basePriceWithoutTax ?? item.priceWithoutTax,
  pricingStatus: "ERROR",
  pricingRequestKey,
  pricingError,
  finalUnitPrice: undefined,
  discountAmount: 0,
  discountPercent: 0,
  appliedPromotionId: null,
  appliedPromotionName: null,
  taxBase: undefined,
  taxAmount: undefined,
  lineSubtotal: undefined,
  lineTotal: undefined,
  taxes: [],
});

export const PosScreen = () => {
  const { hasSession } = useRequirePosSession();
  const authUser = useAppSelector((state) => state.auth.user);
  const posBranchId = useAppSelector((state) => state.pos.branchId);
  const posTerminalId = useAppSelector((state) => state.pos.terminalId);
  const {
    items: cart,
    payments,
    saleStatus,
    selectedCustomerId,
    setCartItems,
    setPayments,
    setSaleStatus,
    setSelectedCustomerId,
  } = usePosCartStore();
  const { cartSheetOpen, setCartSheetOpen } = usePosUiStore();
  const canRead = hasMenuAccess("POS", "READ");
  const canCreate = hasMenuAccess("POS", "WRITE");

  if (!hasSession) {
    return null;
  }

  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [customers, setCustomers] = useState<CustomerResponse[]>([]);
  const [taxes, setTaxes] = useState<TaxResponse[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategoryResponse[]>([]);
  const [productSubcategories, setProductSubcategories] = useState<ProductSubcategoryResponse[]>([]);
  const [query, setQuery] = useState("");
  const { filters, updateFilters } = usePosFiltersStorage();
  const activeStockFilter = filters.activeStockFilter;
  const setActiveStockFilter = (filter: StockFilterKey) => updateFilters({ activeStockFilter: filter });
  const selectedProductCategoryId = filters.selectedProductCategoryId;
  const setSelectedProductCategoryId = (id: string) => updateFilters({ selectedProductCategoryId: id });
  const selectedProductSubcategoryId = filters.selectedProductSubcategoryId;
  const setSelectedProductSubcategoryId = (id: string) => updateFilters({ selectedProductSubcategoryId: id });
  const productViewMode = filters.productViewMode;
  const setProductViewMode = (mode: ProductViewMode) => updateFilters({ productViewMode: mode });
  const [productToolsOpen, setProductToolsOpen] = useState(false);
  const [quickFiscalCustomerOpen, setQuickFiscalCustomerOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [expandedTaxItems, setExpandedTaxItems] = useState<Record<string, boolean>>({});
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogWarnings, setCatalogWarnings] = useState<string[]>([]);
  const [paymentMethodsCatalog, setPaymentMethodsCatalog] = useState<FinancePaymentMethod[]>([]);
  const [currentCashSession, setCurrentCashSession] = useState<CashSession | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [processingSale, setProcessingSale] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [paymentWarning, setPaymentWarning] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState("");
  const [scannerMockCode, setScannerMockCode] = useState("46564567");
  const [scannerMockStatus, setScannerMockStatus] =
    useState<ScannerMockStatus>("disabled");
  const [scannerLastCode, setScannerLastCode] = useState<string | null>(null);
  const [scannerLastResult, setScannerLastResult] = useState<string | null>(null);
  const [scannerSimulating, setScannerSimulating] = useState(false);
  const [scaleMockStatus, setScaleMockStatus] =
    useState<ScaleMockStatus>("disabled");
  const [scaleLastWeight, setScaleLastWeight] = useState<string | null>(null);
  const [scaleLastResult, setScaleLastResult] = useState<string | null>(null);
  const [scaleReading, setScaleReading] = useState(false);
  const [peripheralDiagnosticsOpen, setPeripheralDiagnosticsOpen] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const activeBranchId = posBranchId ?? authUser?.branchId ?? null;
  const peripheralFeatureFlags = useMemo(() => getPeripheralFeatureFlags(), []);
  const scannerHidEnabled =
    peripheralFeatureFlags.peripheralsEnabled &&
    peripheralFeatureFlags.scannerEnabled;
  const scannerMockEnabled = scannerHidEnabled;
  const scaleMockEnabled =
    peripheralFeatureFlags.peripheralsEnabled &&
    peripheralFeatureFlags.scaleEnabled;
  const mockDeviceControlsEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_POS_MOCK_DEVICES === "true";
  const canShowPeripheralDiagnostics =
    mockDeviceControlsEnabled || scannerMockEnabled || scaleMockEnabled;
  const cartRef = useRef(cart);
  const productsRef = useRef(products);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scannerErrorToastShownRef = useRef(false);
  const scannerWedgeStateRef = useRef(createPosScannerWedgeState());
  const scannerWedgeOptions = useMemo(() => resolvePosScannerWedgeOptions(), []);
  const scannerHidLogger = useMemo(
    () => createPosScannerHidLogger(process.env.NEXT_PUBLIC_POS_SCANNER_DEBUG === "true"),
    []
  );
  const playProductAddedSound = useMemo(() => createProductAddedSoundPlayer(), []);
  const shouldFocusProductSearchRef = useRef(false);

  useAutoClearState(toastMessage, setToastMessage);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  const setCartItemsAndRef = useCallback(
    (items: PosCartItem[]) => {
      cartRef.current = items;
      setCartItems(items);
    },
    [setCartItems]
  );

  const openProductTools = useCallback(() => {
    shouldFocusProductSearchRef.current = true;
    setProductToolsOpen(true);
  }, []);

  const posFloatingControl = useDraggableFloatingControl({
    storageKey: FLOATING_POS_STORAGE_KEY,
    defaultAnchor: "top-right",
    defaultSize: {
      width: 176,
      height: 56,
    },
    minTop: 96,
    onActivate: openProductTools,
  });
  const cartFloatingControl = useDraggableFloatingControl({
    storageKey: FLOATING_CART_STORAGE_KEY,
    defaultAnchor: "bottom-right",
    defaultSize: {
      width: 272,
      height: 56,
    },
    minTop: 96,
    onActivate: () => setCartSheetOpen(true),
  });

  const focusProductSearch = useCallback(() => {
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }, []);

  useEffect(() => {
    if (!productToolsOpen || !shouldFocusProductSearchRef.current) {
      return;
    }

    shouldFocusProductSearchRef.current = false;
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }, [productToolsOpen]);

  // Detect mobile/tablet viewport
  useEffect(() => {
    const checkViewport = () => {
      const mobile = window.innerWidth < 1280;
    setIsMobile(mobile);
    // On mobile, cart is closed by default
    if (mobile) {
      setCartSheetOpen(false);
    } else {
      setCartSheetOpen(true);
    }
  };

    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  useEffect(() => {
    if (isMobile && cart.length === 0 && cartSheetOpen) {
      setCartSheetOpen(false);
    }
  }, [cart.length, cartSheetOpen, isMobile, setCartSheetOpen]);

  useEffect(() => {
    if (paymentModalOpen || quickFiscalCustomerOpen) {
      return;
    }

    focusProductSearch();
  }, [focusProductSearch, paymentModalOpen, quickFiscalCustomerOpen]);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  const handleSalePeripheralFeedback = useCallback(
    async (context: PosSalePeripheralContext) => {
      const feedback = await runSalePeripheralOperations(context);
      const toast = buildSalePeripheralFeedbackMessage(feedback);

      if (toast) {
        showToast(toast.message, toast.variant);
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (!activeBranchId) {
      setCatalogLoading(false);
      setCatalogError("No hay una sucursal POS activa para cargar inventario.");
      setProducts([]);
      setProductCategories([]);
      setProductSubcategories([]);
      return;
    }

    let active = true;

    const loadCatalog = async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      setCatalogWarnings([]);

      try {
        const [
          productsResult,
          customersResult,
          taxesResult,
          categoriesResult,
          subcategoriesResult,
        ] = await Promise.allSettled([
          getPosProducts(activeBranchId),
          getPosCustomers(),
          getPosTaxes(),
          listProductCategories({ isActive: true }),
          listProductSubcategories({ isActive: true }),
        ]);

        if (!active) {
          return;
        }

        const warnings: string[] = [];
        const activeProducts =
          productsResult.status === "fulfilled"
            ? productsResult.value.filter((product) => product.isActive)
            : [];
        const activeCustomers =
          customersResult.status === "fulfilled"
            ? customersResult.value.filter((customer) => customer.isActive)
            : [];
        const activeTaxes =
          taxesResult.status === "fulfilled"
            ? taxesResult.value.filter((tax) => tax.isActive)
            : [];
        const activeProductCategories =
          categoriesResult.status === "fulfilled"
            ? categoriesResult.value.filter((category) => category.isActive)
            : [];
        const activeProductSubcategories =
          subcategoriesResult.status === "fulfilled"
            ? subcategoriesResult.value.filter((subcategory) => subcategory.isActive)
            : [];

        if (productsResult.status === "rejected") {
          console.error("POS products catalog failed", productsResult.reason);
          warnings.push("No se pudieron cargar los productos del POS.");
        }
        if (customersResult.status === "rejected") {
          console.error("POS customers catalog failed", customersResult.reason);
          warnings.push("No se pudieron cargar los clientes del POS.");
        }
        if (taxesResult.status === "rejected") {
          console.error("POS taxes catalog failed", taxesResult.reason);
          warnings.push("No se pudieron cargar los impuestos del POS.");
        }
        if (categoriesResult.status === "rejected") {
          console.error("POS product categories failed", categoriesResult.reason);
          warnings.push("No se pudieron cargar las categorias del POS.");
        }
        if (subcategoriesResult.status === "rejected") {
          console.error(
            "POS product subcategories failed",
            subcategoriesResult.reason
          );
          warnings.push("No se pudieron cargar las subcategorias del POS.");
        }

        setProducts(activeProducts);
        setCustomers(activeCustomers);
        setTaxes(activeTaxes);
        setProductCategories(activeProductCategories);
        setProductSubcategories(activeProductSubcategories);
        setCatalogWarnings(warnings);

        if (activeProducts.length === 0) {
          setCatalogError(
            warnings.length > 0
              ? warnings.join(" ")
              : "No hay productos disponibles para operar el POS."
          );
        }
      } catch {
        if (!active) {
          return;
        }
        console.error("POS catalog loading failed");
        setCatalogError("No se pudo cargar el catalogo de POS.");
      } finally {
        if (active) {
          setCatalogLoading(false);
        }
      }
    };

    void loadCatalog();

    return () => {
      active = false;
    };
  }, [activeBranchId]);

  useEffect(() => {
    const defaultCustomer =
      customers.find((customer) => normalizeText(customer.name).includes("consumidor final")) ??
      customers[0] ??
      null;

    const hasValidSelectedCustomer = customers.some(
      (customer) => customer.id === selectedCustomerId
    );

    if (!hasValidSelectedCustomer) {
      setSelectedCustomerId(defaultCustomer?.id ?? null);
    }
  }, [customers, selectedCustomerId, setSelectedCustomerId]);

  useEffect(() => {
    let active = true;

    const loadFinanceCatalog = async () => {
      try {
        const [methods, session] = await Promise.all([
          listPaymentMethods({ active: true }),
          getCurrentCashSession(),
        ]);

        if (!active) {
          return;
        }

        setPaymentMethodsCatalog(methods.filter((method) => method.active));
        setCurrentCashSession(session);
      } catch {
        if (!active) {
          return;
        }
        setCatalogWarnings((current) =>
          current.includes("No se pudieron cargar los metodos de pago del POS.")
            ? current
            : [...current, "No se pudieron cargar los metodos de pago del POS."]
        );
      }
    };

    void loadFinanceCatalog();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadVersion = async () => {
      try {
        const response = await fetchSystemVersion();
        if (active) {
          setAppVersion(response.version ?? "");
        }
      } catch {
        if (active) {
          setAppVersion("");
        }
      }
    };

    void loadVersion();

    return () => {
      active = false;
    };
  }, []);

  const taxById = useMemo(
    () =>
      taxes.reduce<Record<string, TaxResponse>>((acc, tax) => {
        acc[tax.id] = tax;
        return acc;
      }, {}),
    [taxes]
  );

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );
  const finalConsumerCustomer = useMemo(
    () =>
      customers.find((customer) =>
        normalizeText(customer.name).includes("consumidor final")
      ) ?? null,
    [customers]
  );

  useEffect(() => {
    if (!customerDropdownOpen) {
      setCustomerSearchQuery(selectedCustomer?.name || "");
    }
  }, [selectedCustomer, customerDropdownOpen]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) {
      return customers;
    }
    const lower = normalizeText(customerSearchQuery);
    return customers.filter((c) => {
      const matchName = normalizeText(c.name).includes(lower);
      const matchDoc = c.documentNumber ? c.documentNumber.includes(lower) : false;
      return matchName || matchDoc;
    });
  }, [customers, customerSearchQuery]);

  const handleSelectPosCustomer = useCallback(
    (customer: CustomerResponse) => {
      setCustomers((current) => upsertCustomer(current, customer));
      setSelectedCustomerId(customer.id);
      setProductToolsOpen(false);
      showToast("Cliente seleccionado.", "success");
    },
    [setSelectedCustomerId, showToast]
  );

  const handleFiscalCustomerSaved = useCallback(
    async (customer: ElectronicInvoicingCustomer) => {
      const mappedCustomer = mapFiscalCustomerToPosCustomer(customer);
      try {
        const refreshedCustomers = await getPosCustomers();
        setCustomers(refreshedCustomers.filter((item) => item.isActive));
      } catch {
        setCustomers((current) => upsertCustomer(current, mappedCustomer));
      }
      setSelectedCustomerId(customer.id);
      setProductToolsOpen(false);
      showToast("Cliente fiscal listo.", "success");
    },
    [setSelectedCustomerId, showToast]
  );

  const handleUseFinalConsumer = useCallback(() => {
    if (!finalConsumerCustomer) {
      showToast("Consumidor Final no esta disponible.", "warning");
      return;
    }
    setSelectedCustomerId(finalConsumerCustomer.id);
    setProductToolsOpen(false);
  }, [finalConsumerCustomer, setSelectedCustomerId, showToast]);

  const paymentMethodById = useMemo(
    () =>
      paymentMethodsCatalog.reduce<Record<string, FinancePaymentMethod>>((acc, method) => {
        acc[method.id] = method;
        return acc;
      }, {}),
    [paymentMethodsCatalog]
  );

  const paymentMethodOptions = useMemo(
    () =>
      paymentMethodsCatalog.map((method) => ({
        value: method.id,
        label: method.nombre,
      })),
    [paymentMethodsCatalog]
  );

  const cashPaymentMethod = useMemo(
    () => findCashPaymentMethod(paymentMethodsCatalog),
    [paymentMethodsCatalog]
  );

  const productCategoryOptions = useMemo(
    () => sortPosClassificationOptions(productCategories),
    [productCategories]
  );

  const productSubcategoryOptions = useMemo(
    () =>
      sortPosClassificationOptions(
        selectedProductCategoryId
          ? productSubcategories.filter(
              (subcategory) =>
                normalizePosClassificationId(subcategory.categoryId) ===
                normalizePosClassificationId(selectedProductCategoryId)
            )
          : []
      ),
    [productSubcategories, selectedProductCategoryId]
  );

  const productCategoryById = useMemo(
    () =>
      productCategories.reduce<Map<string, ProductCategoryResponse>>(
        (acc, category) => acc.set(category.id, category),
        new Map()
      ),
    [productCategories]
  );

  const productSubcategoryById = useMemo(
    () =>
      productSubcategories.reduce<Map<string, ProductSubcategoryResponse>>(
        (acc, subcategory) => acc.set(subcategory.id, subcategory),
        new Map()
      ),
    [productSubcategories]
  );

  const selectedProductCategory = selectedProductCategoryId
    ? productCategoryById.get(selectedProductCategoryId) ?? null
    : null;
  const selectedProductSubcategory = selectedProductSubcategoryId
    ? productSubcategoryById.get(selectedProductSubcategoryId) ?? null
    : null;
  const hasSelectedCategoryWithoutSubcategories =
    Boolean(selectedProductCategoryId) &&
    !catalogLoading &&
    productSubcategoryOptions.length === 0;
  const activeProductFilterLabels = [
    query.trim() ? `Busqueda: ${query.trim()}` : null,
    selectedProductCategory ? `Categoria: ${selectedProductCategory.name}` : null,
    selectedProductSubcategory
      ? `Subcategoria: ${selectedProductSubcategory.name}`
      : null,
  ].filter((label): label is string => Boolean(label));
  const hasProductCatalogFilters = activeProductFilterLabels.length > 0;

  useEffect(() => {
    const nextSubcategoryId = resolvePosSubcategoryFilterForCategory(
      selectedProductSubcategoryId,
      selectedProductCategoryId,
      productSubcategoryOptions
    );

    if (
      selectedProductSubcategoryId &&
      selectedProductSubcategoryId !== nextSubcategoryId
    ) {
      setSelectedProductSubcategoryId(nextSubcategoryId);
    }
  }, [
    productSubcategoryOptions,
    selectedProductCategoryId,
    selectedProductSubcategoryId,
  ]);

  const handleStockFilterChange = useCallback(
    (filter: StockFilterKey) => {
      setActiveStockFilter(filter);
      focusProductSearch();
    },
    [focusProductSearch]
  );

  const handleProductCategoryFilterChange = useCallback(
    (categoryId: string) => {
      setSelectedProductCategoryId(categoryId);
      setSelectedProductSubcategoryId("");
      focusProductSearch();
    },
    [focusProductSearch]
  );

  const handleProductSubcategoryFilterChange = useCallback(
    (subcategoryId: string) => {
      setSelectedProductSubcategoryId(subcategoryId);
      focusProductSearch();
    },
    [focusProductSearch]
  );

  const clearProductCatalogFilters = useCallback(() => {
    const clearedFilters = buildClearedPosProductCatalogFilters();

    setQuery(clearedFilters.query);
    setSelectedProductCategoryId(clearedFilters.categoryId);
    setSelectedProductSubcategoryId(clearedFilters.subcategoryId);
    focusProductSearch();
  }, [focusProductSearch]);

  const createPaymentDraft = useCallback(
    (paymentMethodId: string, amount: string): PaymentDraft => ({
      id: buildPaymentId(),
      paymentMethodId,
      amount,
      reference: "",
    }),
    []
  );

  const stockFilterCounts = useMemo(() => {
    return {
      all: products.length,
      available: products.filter((product) => Number(product.stock ?? 0) > 0).length,
      low: products.filter((product) => isLowStock(Number(product.stock ?? 0))).length,
      out: products.filter((product) => Number(product.stock ?? 0) <= 0).length,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    return filterPosProductsForCatalog(products, {
      query,
      stockFilter: activeStockFilter,
      categoryId: selectedProductCategoryId,
      subcategoryId: selectedProductSubcategoryId,
      isLowStock,
      getSearchText: (product) =>
        `${product.name} ${product.description ?? ""} ${collectPosScannerProductCodes(
          product
        ).join(" ")}`,
    });
  }, [
    activeStockFilter,
    products,
    query,
    selectedProductCategoryId,
    selectedProductSubcategoryId,
  ]);

  const productById = useMemo(
    () =>
      products.reduce<Record<string, ProductResponse>>((acc, product) => {
        acc[product.id] = product;
        return acc;
      }, {}),
    [products]
  );

  const cartWithDerivedValues = useMemo(() => {
    return cart.map((item) => {
      const unitPrice = item.finalUnitPrice ?? item.price;
      const subtotal =
        typeof item.lineTotal === "number"
          ? round(item.lineTotal)
          : round(unitPrice * item.quantity);
      const tax = item.taxId ? taxById[item.taxId] : null;
      const fallbackTaxAmount = round(
        Math.max(unitPrice - item.priceWithoutTax, 0) * item.quantity
      );
      const previewTaxAmount =
        typeof item.taxAmount === "number" ? round(item.taxAmount) : undefined;
      const itemTaxes: PosItemTax[] =
        Array.isArray(item.taxes) && item.taxes.length > 0
          ? item.taxes.map((itemTax) => ({
              ...itemTax,
              taxBase: round(itemTax.taxBase),
              taxAmount: round(itemTax.taxAmount),
            }))
          : item.taxId
            ? [
                {
                  taxId: item.taxId,
                  taxName: tax?.name ?? "Impuesto",
                  dianCode: tax?.taxTypeDianCode ?? null,
                  taxTypeCode: tax?.taxTypeCode ?? null,
                  calculationMethodCode: tax?.calculationMethodCode ?? null,
                  taxRate: tax?.rate ?? item.taxRate ?? 0,
                  taxBase: item.taxBase ?? round(item.priceWithoutTax * item.quantity),
                  taxAmount: previewTaxAmount ?? fallbackTaxAmount,
                  isIncluded: tax?.isIncluded ?? true,
                },
              ]
            : [];

      const taxTotal = round(
        itemTaxes.reduce((sum, current) => sum + current.taxAmount, 0)
      );
      const discountTotal = round((item.discountAmount ?? 0) * item.quantity);

      return {
        ...item,
        unitPrice,
        subtotal,
        taxes: itemTaxes,
        taxTotal,
        discountTotal,
      };
    });
  }, [cart, taxById]);

  const summary = useMemo(() => {
    const subtotal = round(
      cartWithDerivedValues.reduce((sum, item) => sum + item.subtotal, 0)
    );
    const taxesTotal = round(
      cartWithDerivedValues.reduce((sum, item) => sum + item.taxTotal, 0)
    );
    const discountTotal = round(
      cartWithDerivedValues.reduce((sum, item) => sum + item.discountTotal, 0)
    );
    const taxBreakdown = Object.entries(
      cartWithDerivedValues.reduce<Record<string, number>>((acc, item) => {
        item.taxes.forEach((tax) => {
          acc[tax.taxName] = round((acc[tax.taxName] ?? 0) + tax.taxAmount);
        });
        return acc;
      }, {})
    );

    return {
      subtotal,
      taxesTotal,
      discountTotal,
      total: subtotal,
      taxBreakdown,
    };
  }, [cartWithDerivedValues]);

  const firstWeighableCartProduct = useMemo(
    () =>
      cart
        .map((item) => productById[item.productId])
        .find((product) => product && isWeighableProduct(product)) ?? null,
    [cart, productById]
  );

  const rebalancePaymentsForTotal = useCallback(
    (nextPayments: PaymentDraft[]) => {
      const result = rebalanceCashPayment(
        summary.total,
        nextPayments,
        cashPaymentMethod,
        createPaymentDraft
      );
      setPaymentWarning(result.error);
      return result.payments;
    },
    [cashPaymentMethod, createPaymentDraft, summary.total]
  );

  const parsedPayments = useMemo(
    () =>
      payments.map((payment) => ({
        ...payment,
        numericAmount: parsePaymentAmount(payment.amount),
        method: paymentMethodById[payment.paymentMethodId] ?? null,
      })),
    [paymentMethodById, payments]
  );

  const totalPaid = useMemo(
    () => round(parsedPayments.reduce((sum, payment) => sum + payment.numericAmount, 0)),
    [parsedPayments]
  );

  const totalCashEntered = useMemo(
    () =>
      round(
        parsedPayments
          .filter((payment) => payment.method && isCashPaymentMethod(payment.method))
          .reduce((sum, payment) => sum + payment.numericAmount, 0)
      ),
    [parsedPayments]
  );

  const totalNonCashPaid = useMemo(
    () =>
      round(
        parsedPayments
          .filter((payment) => !payment.method || !isCashPaymentMethod(payment.method))
          .reduce((sum, payment) => sum + payment.numericAmount, 0)
      ),
    [parsedPayments]
  );

  const paymentDerivedState = useMemo(() => {
    const pending = round(Math.max(summary.total - totalPaid, 0));
    const overpayment = round(Math.max(totalPaid - summary.total, 0));
    const change = totalCashEntered > 0 ? overpayment : 0;
    const effectiveCashApplied = round(Math.max(totalCashEntered - change, 0));

    return {
      pending,
      overpayment,
      change,
      effectiveCashApplied,
    };
  }, [summary.total, totalPaid, totalCashEntered]);

  const hasPricingPending = cartWithDerivedValues.some(
    (item) => item.pricingStatus === "PENDING"
  );
  const pricingErrorItem = cartWithDerivedValues.find(
    (item) => item.pricingStatus === "ERROR"
  );
  const canCharge =
    canRead &&
    canCreate &&
    cartWithDerivedValues.length > 0 &&
    !hasPricingPending &&
    !pricingErrorItem;

  useEffect(() => {
    if (!paymentModalOpen || paymentMethodsCatalog.length === 0) {
      return;
    }

    const nextPayments = rebalancePaymentsForTotal(payments);
    if (!arePaymentsEqual(payments, nextPayments)) {
      setPayments(nextPayments);
    }
  }, [
    paymentMethodsCatalog.length,
    paymentModalOpen,
    payments,
    rebalancePaymentsForTotal,
    setPayments,
  ]);

  // Cart item count for floating button
  const cartItemCount = cartWithDerivedValues.reduce((sum, item) => sum + item.quantity, 0);
  const cartQuantityByProductId = useMemo(
    () =>
      cartWithDerivedValues.reduce<Record<string, number>>((acc, item) => {
        acc[item.productId] = item.quantity;
        return acc;
      }, {}),
    [cartWithDerivedValues]
  );
  const scaleStatusLabel = scaleMockEnabled
    ? scaleMockStatus === "reading"
      ? "Leyendo"
      : scaleMockStatus === "error"
        ? "Error"
        : "Lista"
    : "Desactivada";
  const scaleStatusTone =
    scaleMockStatus === "error" || !scaleMockEnabled
      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
      : scaleMockStatus === "reading"
        ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100"
        : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100";

  const refreshCartItemPricing = useCallback(
    async (productId: string, quantity: number, pricingRequestKey: string) => {
      if (!activeBranchId) {
        return;
      }

      try {
        const preview = await previewPosLinePrice({
          branchId: activeBranchId,
          productId,
          quantity,
          channel: "POS",
          customerId: selectedCustomerId ?? undefined,
        });
        const currentCart = cartRef.current;
        const target = currentCart.find(
          (item) =>
            item.productId === productId &&
            item.quantity === quantity &&
            item.pricingRequestKey === pricingRequestKey
        );

        if (!target) {
          return;
        }

        setCartItemsAndRef(
          currentCart.map((item) =>
            item.productId === productId && item.pricingRequestKey === pricingRequestKey
              ? applyPricingPreview(item, preview, pricingRequestKey)
              : item
          )
        );
      } catch (error) {
        const currentCart = cartRef.current;
        const target = currentCart.find(
          (item) =>
            item.productId === productId &&
            item.quantity === quantity &&
            item.pricingRequestKey === pricingRequestKey
        );

        if (!target) {
          return;
        }

        const isNetworkError =
          (typeof navigator !== "undefined" && !navigator.onLine) ||
          (error instanceof TypeError && error.message.toLowerCase().includes("fetch")) ||
          error?.toString().toLowerCase().includes("failed to fetch");

        if (isNetworkError) {
          setCartItemsAndRef(
            currentCart.map((item) =>
              item.productId === productId && item.pricingRequestKey === pricingRequestKey
                ? {
                    ...item,
                    pricingStatus: "PENDING",
                    pricingError: "Precio pendiente de actualización",
                  }
                : item
            )
          );
          return;
        }

        const message = `No se pudo calcular precio/promocion para ${target.name}. ${getErrorMessage(
          error
        )}`;
        setCartItemsAndRef(
          currentCart.map((item) =>
            item.productId === productId && item.pricingRequestKey === pricingRequestKey
              ? applyPricingError(item, pricingRequestKey, message)
              : item
          )
        );
        showToast(message, "error");
      }
    },
    [activeBranchId, selectedCustomerId, setCartItemsAndRef, showToast]
  );

  const queueCartItemPricing = useCallback(
    (items: PosCartItem[], productId: string, quantity: number) => {
      if (!activeBranchId) {
        const message = "No hay una sucursal POS activa para calcular precio.";
        setCartItemsAndRef(
          items.map((item) =>
            item.productId === productId
              ? applyPricingError(item, "missing-branch", message)
              : item
          )
        );
        showToast(message, "error");
        return;
      }

      const pricingRequestKey = buildPricingRequestKey(
        activeBranchId,
        selectedCustomerId,
        productId,
        quantity
      );
      const nextItems = items.map((item) =>
        item.productId === productId
          ? markPricingPending(item, quantity, pricingRequestKey)
          : item
      );

      setCartItemsAndRef(nextItems);
      void refreshCartItemPricing(productId, quantity, pricingRequestKey);
    },
    [
      activeBranchId,
      refreshCartItemPricing,
      selectedCustomerId,
      setCartItemsAndRef,
      showToast,
    ]
  );

  useEffect(() => {
    if (!activeBranchId || cartRef.current.length === 0) {
      return;
    }

    const currentCart = cartRef.current;
    const staleItems = currentCart.filter((item) => {
      const pricingRequestKey = buildPricingRequestKey(
        activeBranchId,
        selectedCustomerId,
        item.productId,
        item.quantity
      );
      return !item.pricingStatus || item.pricingRequestKey !== pricingRequestKey;
    });

    if (staleItems.length === 0) {
      return;
    }

    const nextItems = currentCart.map((item) => {
      const pricingRequestKey = buildPricingRequestKey(
        activeBranchId,
        selectedCustomerId,
        item.productId,
        item.quantity
      );

      if (item.pricingStatus && item.pricingRequestKey === pricingRequestKey) {
        return item;
      }

      return markPricingPending(item, item.quantity, pricingRequestKey);
    });

    setCartItemsAndRef(nextItems);
    staleItems.forEach((item) => {
      const pricingRequestKey = buildPricingRequestKey(
        activeBranchId,
        selectedCustomerId,
        item.productId,
        item.quantity
      );
      void refreshCartItemPricing(item.productId, item.quantity, pricingRequestKey);
    });
  }, [
    activeBranchId,
    cart.length,
    refreshCartItemPricing,
    selectedCustomerId,
    setCartItemsAndRef,
  ]);

  useEffect(() => {
    const handleOnline = () => {
      const currentCart = cartRef.current;
      const pendingItems = currentCart.filter(
        (item) => item.pricingStatus === "PENDING" || item.pricingError === "Precio pendiente de actualización"
      );
      if (pendingItems.length > 0) {
        pendingItems.forEach((item) => {
          void refreshCartItemPricing(item.productId, item.quantity, item.pricingRequestKey);
        });
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("manus:backend-restored", handleOnline as EventListener);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("manus:backend-restored", handleOnline as EventListener);
    };
  }, [refreshCartItemPricing]);

  const setProductQuantityInCart = useCallback(
    (product: ProductResponse, quantity: number) => {
      setSaleStatus("DRAFT");
      setSubmitError(null);

      const currentCart = cartRef.current;
      const existing = currentCart.find((item) => item.productId === product.id);
      const stock = Number(product.stock ?? 0);

      if (stock <= 0) {
        showToast("El producto no tiene stock disponible.", "warning");
        return false;
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        showToast("La cantidad debe ser mayor a cero.", "warning");
        return false;
      }

      if (quantity > stock) {
        showToast("No puedes superar el stock disponible.", "warning");
        return false;
      }

      if (existing) {
        queueCartItemPricing(
          currentCart.map((item) =>
            item.productId === product.id ? { ...item, quantity } : item
          ),
          product.id,
          quantity
        );
        return true;
      }

      const nextItem: PosCartItem = {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity,
        price: Number(product.price),
        stock,
        taxId: product.taxId ?? null,
        priceWithoutTax: Number(product.priceWithoutTax ?? product.price),
        baseUnitPrice: Number(product.price),
        basePriceWithoutTax: Number(product.priceWithoutTax ?? product.price),
      };
      queueCartItemPricing([...currentCart, nextItem], product.id, quantity);
      return true;
    },
    [queueCartItemPricing, setSaleStatus, showToast]
  );

  const addToCart = useCallback(
    (product: ProductResponse) => {
      const currentCart = cartRef.current;
      const existing = currentCart.find((item) => item.productId === product.id);
      const nextQuantity = existing ? existing.quantity + 1 : 1;
      const added = setProductQuantityInCart(product, nextQuantity);
      if (added) {
        focusProductSearch();
        void playProductAddedSound();
      }
      return added;
    },
    [focusProductSearch, playProductAddedSound, setProductQuantityInCart]
  );

  const handleScannerCodeRead = useCallback(
    (result: ScannerReadResult) => {
      const code = result.code.trim();
      if (!code) {
        return;
      }

      scannerHidLogger.processingCode(code);
      setScannerMockStatus("connected");
      setQuery("");
      scannerWedgeStateRef.current = createPosScannerWedgeState();
      setScannerLastCode(code);
      const product = findUniquePosScannerProduct(code, productsRef.current);

      if (!product) {
        const message = `CÃ³digo no encontrado: ${code}`;
        scannerHidLogger.productNotFound(code);
        setScannerLastResult(message);
        showToast(message, "warning");
        return;
      }

      scannerHidLogger.productMatched({
        id: product.id,
        name: product.name,
      });
      const added = addToCart(product);
      if (!added) {
        setScannerLastResult(`Producto no agregado por scanner: ${product.name}`);
        return;
      }

      const message = `Producto agregado por scanner: ${code}`;
      setScannerLastResult(message);
      showToast(message, "success");
    },
    [addToCart, scannerHidLogger, showToast]
  );

  const handleScannerConnectionError = useCallback(
    (error: PeripheralOperationError) => {
      setScannerMockStatus("error");
      setScannerLastResult("Scanner MOCK desconectado");

      if (!scannerErrorToastShownRef.current) {
        scannerErrorToastShownRef.current = true;
        showToast(error.message || "Scanner MOCK desconectado", "warning");
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (!scannerHidEnabled) {
      setScannerMockStatus("disabled");
      return undefined;
    }

    scannerErrorToastShownRef.current = false;
    setScannerMockStatus("connected");
    scannerHidLogger.captureEnabled();
    const unsubscribe = subscribeScannerEvents(
      handleScannerCodeRead,
      handleScannerConnectionError,
      {
        tenantId: authUser?.tenantId,
        branchId: activeBranchId ?? undefined,
        terminalId: posTerminalId ?? "local-terminal",
      }
    );

    return () => {
      unsubscribe();
    };
  }, [
    activeBranchId,
    authUser?.tenantId,
    handleScannerCodeRead,
    handleScannerConnectionError,
    posTerminalId,
    scannerHidEnabled,
    scannerHidLogger,
  ]);

  const handleSimulateScannerRead = useCallback(async () => {
    const code = scannerMockCode.trim();
    if (!code) {
      showToast("Ingresa un codigo para simular scanner MOCK.", "warning");
      return;
    }

    if (!scannerHidEnabled) {
      return;
    }

    setScannerSimulating(true);
    try {
      const result = await simulateScannerRead({
        tenantId: authUser?.tenantId,
        branchId: activeBranchId ?? undefined,
        terminalId: posTerminalId ?? "local-terminal",
        deviceId: "mock-scanner-001",
        code,
        format: "CODE128",
      });

      if (!result.success) {
        const message =
          result.error.code === "AGENT_OFFLINE"
            ? "Scanner MOCK desconectado. El POS sigue funcionando."
            : result.error.message;
        if (result.error.code === "AGENT_OFFLINE") {
          setScannerMockStatus("error");
        }
        setScannerLastResult(message);
        showToast(message, "warning");
        return;
      }

      setScannerLastCode(result.data.code);
      setScannerLastResult("Scan MOCK enviado al agent");
    } finally {
      setScannerSimulating(false);
    }
  }, [
    activeBranchId,
    authUser?.tenantId,
    posTerminalId,
    scannerMockCode,
    scannerHidEnabled,
    showToast,
  ]);

  useEffect(() => {
    if (!scaleMockEnabled) {
      setScaleMockStatus("disabled");
      return;
    }

    setScaleMockStatus((current) => (current === "disabled" ? "ready" : current));
  }, [scaleMockEnabled]);

  const handleReadScaleForProduct = useCallback(
    async (product: ProductResponse) => {
      if (!scaleMockEnabled) {
        return;
      }

      if (!isWeighableProduct(product)) {
        const message = "Selecciona un producto pesable antes de leer la balanza";
        setScaleLastResult(message);
        showToast(message, "warning");
        return;
      }

      setScaleReading(true);
      setScaleMockStatus("reading");
      try {
        const result = await readCurrentWeight({
          tenantId: authUser?.tenantId,
          branchId: activeBranchId ?? undefined,
          terminalId: posTerminalId ?? "local-terminal",
          deviceId: "mock-scale-001",
        });

        if (!result.success) {
          const message =
            result.error.code === "AGENT_OFFLINE"
              ? "No se pudo leer la balanza MOCK"
              : result.error.message;
          setScaleMockStatus("error");
          setScaleLastResult(message);
          showToast(message, "warning");
          return;
        }

        const weight = Number(result.data.weight);
        const unit = result.data.unit || "kg";

        if (!result.data.stable) {
          const message = "Peso inestable, intenta nuevamente";
          setScaleMockStatus("error");
          setScaleLastResult(message);
          showToast(message, "warning");
          return;
        }

        if (!Number.isFinite(weight) || weight <= 0) {
          const message = "Peso invalido, intenta nuevamente";
          setScaleMockStatus("error");
          setScaleLastResult(message);
          showToast(message, "warning");
          return;
        }

        const reading = `${formatScaleQuantity(weight)} ${unit}`;
        setScaleLastWeight(reading);

        const applied = setProductQuantityInCart(product, weight);
        if (!applied) {
          setScaleMockStatus("error");
          setScaleLastResult(`Peso no aplicado: ${reading}`);
          return;
        }

        const message = `Peso leÃ­do: ${reading}`;
        setScaleMockStatus("ready");
        setScaleLastResult(message);
        void playProductAddedSound();
        showToast(message, "success");
        focusProductSearch();
      } finally {
        setScaleReading(false);
      }
    },
    [
      activeBranchId,
      authUser?.tenantId,
      focusProductSearch,
      playProductAddedSound,
      posTerminalId,
      scaleMockEnabled,
      setProductQuantityInCart,
      showToast,
    ]
  );

  const handleReadScaleFromCart = useCallback(async () => {
    if (!scaleMockEnabled) {
      return;
    }

    if (!firstWeighableCartProduct) {
      const message = "Selecciona un producto pesable antes de leer la balanza";
      setScaleLastResult(message);
      showToast(message, "warning");
      return;
    }

    await handleReadScaleForProduct(firstWeighableCartProduct);
  }, [
    firstWeighableCartProduct,
    handleReadScaleForProduct,
    scaleMockEnabled,
    showToast,
  ]);

  const handleProductCardAction = useCallback(
    (product: ProductResponse) => {
      if (getProductSaleType(product) === "WEIGHT") {
        void handleReadScaleForProduct(product);
        return;
      }

      addToCart(product);
    },
    [addToCart, handleReadScaleForProduct]
  );

  const handleSearchKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        if (query.trim()) {
          event.preventDefault();
          setQuery("");
          scannerWedgeStateRef.current = createPosScannerWedgeState();
        }
        return;
      }

      if (scannerHidEnabled) {
        const previousState = scannerWedgeStateRef.current;
        const scannerEvent = handlePosScannerKeyboardEvent(
          scannerWedgeStateRef.current,
          event.key,
          event.timeStamp,
          scannerHidEnabled,
          scannerWedgeOptions
        );
        scannerWedgeStateRef.current = scannerEvent.nextState;
        if (scannerEvent.committedCode) {
          event.preventDefault();
          scannerHidLogger.scanDetected({
            code: scannerEvent.committedCode,
            length: scannerEvent.committedCode.length,
            durationMs:
              previousState.startedAt === null
                ? 0
                : Math.max(0, event.timeStamp - previousState.startedAt),
          });
          handleScannerCodeRead({
            success: true,
            code: scannerEvent.committedCode,
            format: "CODE128",
            timestamp: new Date().toISOString(),
          });
          return;
        }

        if (isPosScannerTerminatorKey(event.key)) {
          const ignoredSequence = describePosScannerWedgeIgnoredSequence(
            previousState,
            event.timeStamp,
            scannerWedgeOptions
          );

          if (ignoredSequence) {
            scannerHidLogger.sequenceIgnored(ignoredSequence);
          }
        }

        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          return;
        }
      }

      if (!["Enter", "Return", "CR", "LF", "LineFeed", "\r", "\n"].includes(event.key)) {
        return;
      }

      const exactMatch = findUniquePosScannerProduct(query, filteredProducts);
      if (!exactMatch) {
        return;
      }

      event.preventDefault();
      handleProductCardAction(exactMatch);
    },
    [
      filteredProducts,
      handleProductCardAction,
      handleScannerCodeRead,
      query,
      scannerHidEnabled,
      scannerHidLogger,
      scannerWedgeOptions,
    ]
  );

  const updateQuantity = (productId: string, nextQuantity: number) => {
    setSaleStatus("DRAFT");
    setSubmitError(null);

    const currentCart = cartRef.current;
    const target = currentCart.find((item) => item.productId === productId);
    if (!target) {
      return;
    }

    if (nextQuantity <= 0) {
      setCartItemsAndRef(currentCart.filter((item) => item.productId !== productId));
      return;
    }

    const safeQuantity = Math.min(nextQuantity, target.stock);
    if (safeQuantity === target.quantity && target.pricingStatus !== "ERROR") {
      return;
    }

    queueCartItemPricing(
      currentCart.flatMap((item) => {
        if (item.productId !== productId) {
          return [item];
        }
        return [{ ...item, quantity: safeQuantity }];
      }),
      productId,
      safeQuantity
    );
  };

  const removeCartItem = (productId: string) => {
    setSaleStatus("DRAFT");
    setSubmitError(null);
    setCartItemsAndRef(cartRef.current.filter((item) => item.productId !== productId));
  };

  const toggleTaxBreakdown = (productId: string) => {
    setExpandedTaxItems((current) => ({
      ...current,
      [productId]: !current[productId],
    }));
  };

  const resetPayments = () => {
    const result = createDefaultCashPayment(
      summary.total,
      paymentMethodsCatalog,
      createPaymentDraft
    );
    setPaymentWarning(result.error);
    setPayments(result.payments.length > 0 ? result.payments : buildDefaultPayments());
  };

  const openChargeModal = useCallback(() => {
    setSubmitError(null);
    const result = createDefaultCashPayment(
      summary.total,
      paymentMethodsCatalog,
      createPaymentDraft
    );
    setPaymentWarning(result.error);
    setPayments(result.payments.length > 0 ? result.payments : buildDefaultPayments());
    setPaymentModalOpen(true);
  }, [createPaymentDraft, paymentMethodsCatalog, setPayments, summary.total]);

  const closeChargeModal = () => {
    if (processingSale) {
      return;
    }
    setPaymentModalOpen(false);
    setSubmitError(null);
  };

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const editableTarget = isEditableShortcutTarget(event.target);

      if (event.key === "/" && !editableTarget && !paymentModalOpen) {
        event.preventDefault();
        openProductTools();
        return;
      }

      if (event.key === "Escape") {
        if (paymentModalOpen || quickFiscalCustomerOpen) {
          return;
        }
        if (productToolsOpen) {
          event.preventDefault();
          setProductToolsOpen(false);
          return;
        }
        if (cartSheetOpen && isMobile) {
          event.preventDefault();
          setCartSheetOpen(false);
          return;
        }
        if (query.trim()) {
          event.preventDefault();
          setQuery("");
          focusProductSearch();
        }
        return;
      }

      if (editableTarget || paymentModalOpen || quickFiscalCustomerOpen) {
        return;
      }

      if (event.key === "F2") {
        event.preventDefault();
        if (productToolsOpen) {
          setProductToolsOpen(false);
        } else {
          openProductTools();
        }
        return;
      }

      if (event.key === "F4" && canCharge) {
        event.preventDefault();
        openChargeModal();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    canCharge,
    focusProductSearch,
    cartSheetOpen,
    isMobile,
    openChargeModal,
    openProductTools,
    paymentModalOpen,
    query,
    productToolsOpen,
    quickFiscalCustomerOpen,
  ]);

  useEffect(() => {
    if (paymentModalOpen && payments.length > 0) {
      setTimeout(() => {
        const firstInput = document.getElementById(`payment-amount-${payments[0]?.id}`);
        if (firstInput) {
          firstInput.focus();
          if (firstInput instanceof HTMLInputElement) firstInput.select();
        }
      }, 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentModalOpen]);

  const updatePayment = (
    id: string,
    field: "paymentMethodId" | "amount" | "reference",
    value: string
  ) => {
    setSubmitError(null);
    setPayments(
      rebalancePaymentsForTotal(
        payments.map((payment) =>
          payment.id === id ? { ...payment, [field]: value } : payment
        )
      )
    );
  };

  const addPaymentRow = () => {
    const firstNonCashMethod =
      paymentMethodsCatalog.find((method) => method.id !== cashPaymentMethod?.id) ??
      paymentMethodsCatalog[0] ??
      null;
    setSubmitError(null);
    const newDraft = createPaymentDraft(firstNonCashMethod?.id ?? "", "");
    setPayments(
      rebalancePaymentsForTotal([
        ...payments,
        newDraft,
      ])
    );
    setTimeout(() => {
      const input = document.getElementById(`payment-amount-${newDraft.id}`);
      if (input) {
        input.focus();
        if (input instanceof HTMLInputElement) input.select();
      }
    }, 100);
  };

  const handlePaymentMethodSelect = (paymentId: string, methodId: string) => {
    updatePayment(paymentId, "paymentMethodId", methodId);
    setTimeout(() => {
      const input = document.getElementById(`payment-amount-${paymentId}`);
      if (input) {
        input.focus();
        if (input instanceof HTMLInputElement) input.select();
      }
    }, 50);
  };

  const removePaymentRow = (id: string) => {
    setPayments(
      payments.length === 1
        ? payments
        : rebalancePaymentsForTotal(payments.filter((payment) => payment.id !== id))
    );
  };

  const buildEffectivePayments = () => {
    const basePayments = parsedPayments.filter((payment) => payment.numericAmount > 0);

    if (paymentDerivedState.overpayment <= 0) {
      return basePayments.map((payment) => ({
        paymentMethodId: payment.paymentMethodId,
        amount: payment.numericAmount,
        cashSessionId: currentCashSession?.id ?? null,
        referenceNumber: payment.reference.trim() || null,
        notes: null,
      }));
    }

    let remainingChange = paymentDerivedState.overpayment;

    return basePayments
      .map((payment) => {
        if (!payment.method || !isCashPaymentMethod(payment.method) || remainingChange <= 0) {
          return {
            paymentMethodId: payment.paymentMethodId,
            amount: payment.numericAmount,
            cashSessionId: currentCashSession?.id ?? null,
            referenceNumber: payment.reference.trim() || null,
            notes: null,
          };
        }

        const adjustedAmount = round(Math.max(payment.numericAmount - remainingChange, 0));
        remainingChange = round(Math.max(remainingChange - payment.numericAmount, 0));

        return {
          paymentMethodId: payment.paymentMethodId,
          amount: adjustedAmount,
          cashSessionId: currentCashSession?.id ?? null,
          referenceNumber: payment.reference.trim() || null,
          notes: null,
        };
      })
      .filter((payment) => payment.amount > 0);
  };

  const validateBeforeSubmit = () => {
    if (!selectedCustomerId) {
      return "Selecciona un cliente para continuar.";
    }

    if (cartWithDerivedValues.length === 0) {
      return "Agrega al menos un producto al carrito.";
    }

    const hasExceededStock = cartWithDerivedValues.some(
      (item) => item.quantity > item.stock
    );
    if (hasExceededStock) {
      return "Hay items que superan el stock disponible.";
    }

    if (hasPricingPending) {
      return "Espera el calculo de precio/promocion antes de vender.";
    }

    if (pricingErrorItem) {
      return (
        pricingErrorItem.pricingError ??
        `No se pudo calcular precio/promocion para ${pricingErrorItem.name}.`
      );
    }

    if (paymentWarning) {
      return paymentWarning;
    }

    if (paymentDerivedState.overpayment > 0 && totalNonCashPaid > summary.total) {
      return "Los pagos no en efectivo no pueden exceder el total de la venta.";
    }

    if (paymentDerivedState.overpayment > 0 && totalCashEntered <= 0) {
      return "El cambio solo puede calcularse cuando existe un pago en efectivo.";
    }

    const hasInvalidPayments = parsedPayments.some(
      (payment) => payment.amount.trim() !== "" && payment.numericAmount <= 0
    );
    if (hasInvalidPayments) {
      return "Los metodos de pago deben tener montos mayores a cero.";
    }

    const hasMissingPaymentMethod = parsedPayments.some(
      (payment) => payment.amount.trim() !== "" && !payment.method
    );
    if (hasMissingPaymentMethod) {
      return "Selecciona un metodo de pago valido en cada linea.";
    }

    const hasMissingReference = parsedPayments.some(
      (payment) =>
        payment.numericAmount > 0 &&
        payment.method?.requiresReference &&
        payment.reference.trim().length === 0
    );
    if (hasMissingReference) {
      return "Los metodos que exigen referencia deben incluirla.";
    }

    const duplicateMethods = parsedPayments
      .filter((payment) => payment.numericAmount > 0 && payment.paymentMethodId)
      .map((payment) => payment.paymentMethodId);
    if (new Set(duplicateMethods).size !== duplicateMethods.length) {
      return "No repitas el mismo metodo de pago en varias lineas.";
    }

    const hasCashWithoutSession = parsedPayments.some(
      (payment) =>
        payment.numericAmount > 0 &&
        payment.method &&
        isCashPaymentMethod(payment.method) &&
        !currentCashSession
    );
    if (hasCashWithoutSession) {
      return "Abre una caja antes de registrar efectivo en el POS.";
    }

    if (paymentDerivedState.pending === 0 && totalPaid === 0) {
      return "Registra al menos un metodo de pago para una venta al contado.";
    }

    if (paymentDerivedState.pending > 0) {
      return "El total pagado debe ser igual al total de la venta.";
    }

    return null;
  };

  const submitSale = async () => {
    const validationError = validateBeforeSubmit();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    const effectivePayments = buildEffectivePayments();
    const paymentTotal = round(
      effectivePayments.reduce((sum, payment) => sum + payment.amount, 0)
    );
    const saleType: PosSalePayload["type"] =
      paymentTotal >= summary.total ? "CASH" : "CREDIT";

    setProcessingSale(true);
    setSubmitError(null);

    try {
      const sale = await createSale({
        customerId: selectedCustomerId!,
        type: saleType,
        items: cartWithDerivedValues.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.finalUnitPrice ?? item.price,
          taxes: item.taxes.map((tax) => ({
            taxId: tax.taxId,
            taxName: tax.taxName,
            dianCode: tax.dianCode,
            taxTypeCode: tax.taxTypeCode,
            calculationMethodCode: tax.calculationMethodCode,
            taxRate: tax.taxRate,
            taxBase: tax.taxBase,
            taxAmount: tax.taxAmount,
            isIncluded: tax.isIncluded,
          })),
        })),
        payments: effectivePayments.map((payment) => ({
          paymentMethodId: payment.paymentMethodId,
          amount: payment.amount,
          cashSessionId: payment.cashSessionId ?? undefined,
          referenceNumber: payment.referenceNumber,
          notes: payment.notes,
        })),
      });

      setSaleStatus("CONFIRMED");
      // Successful checkout clears the persisted sale for this POS context.
      setCartItemsAndRef([]);
      setExpandedTaxItems({});
      setPaymentModalOpen(false);
      resetPayments();
      showToast("Venta confirmada correctamente.", "success");

      const salePeripheralContext: PosSalePeripheralContext = {
        saleId: sale.id,
        saleNumber: sale.id,
        documentNumber: sale.id,
        date: sale.createdAt,
        tenantId: authUser?.tenantId,
        branchId: activeBranchId ?? undefined,
        terminalId: posTerminalId ?? "local-terminal",
        businessName: authUser?.tenantName ?? "Manus POS",
        branchName: authUser?.branchName ?? undefined,
        cashier: authUser?.name ?? authUser?.email ?? undefined,
        customerName: selectedCustomer?.name ?? "Consumidor final",
        items: cartWithDerivedValues.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.finalUnitPrice ?? item.price,
          total: item.subtotal,
        })),
        subtotal: round(Math.max(summary.subtotal - summary.taxesTotal, 0)),
        taxes: summary.taxesTotal,
        discounts: summary.discountTotal,
        total: sale.total ?? summary.total,
        payments: effectivePayments.map((payment) => {
          const method = paymentMethodById[payment.paymentMethodId];

          return {
            paymentMethodId: payment.paymentMethodId,
            methodName: method?.nombre,
            methodType: method?.tipo,
            methodCode: method?.codigo,
            amount: payment.amount,
          };
        }),
      };
      void handleSalePeripheralFeedback(salePeripheralContext);

      try {
        if (!activeBranchId) {
          throw new Error("missing branch");
        }
        const productsResult = await getPosProducts(activeBranchId);
        setProducts(productsResult.filter((product) => product.isActive));
      } catch {
        // ignore background refresh issues
      }
    } catch {
      setSubmitError("No se pudo confirmar la venta. Revisa stock, pagos y permisos.");
      showToast("No se pudo confirmar la venta.", "error");
    } finally {
      setProcessingSale(false);
    }
  };

  const renderedStatus =
    saleStatus === "CONFIRMED" && cartWithDerivedValues.length === 0 ? "CONFIRMED" : "DRAFT";

  if (!canRead) {
    return (
      <section className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700 shadow-sm">
        No tienes permisos para visualizar el modulo POS.
      </section>
    );
  }

  // Cart Panel Component (internal)
  const CartPanel = () => (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-700">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Carrito
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
            Venta actual
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
            {cartWithDerivedValues.length} items
          </div>
          <button
            type="button"
            onClick={() => setCartSheetOpen(false)}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 xl:hidden dark:text-slate-200"
            aria-label="Cerrar carrito"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-1 min-h-0 flex-col overflow-hidden">
        {cartWithDerivedValues.length === 0 ? (
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pb-4">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-6 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <ShoppingCart className="h-8 w-8 text-slate-300 dark:text-slate-500" />
              <p className="mt-3 text-base font-semibold text-slate-700 dark:text-slate-100">
                Tu carrito esta vacio
              </p>
              <p className="mt-2 max-w-[18rem] text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Agrega productos para iniciar una venta.
              </p>
            </div>

            <div className="shrink-0 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/80">
              <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                <span>Subtotal</span>
                <span>{formatCurrency(0)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                <span>Impuestos</span>
                <span>{formatCurrency(0)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                <span>Descuentos</span>
                <span>{formatCurrency(0)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-950 dark:border-slate-700 dark:text-white">
                <span>TOTAL</span>
                <span>{formatCurrency(0)}</span>
              </div>
            </div>

            <Button
              className="min-h-12 w-full shrink-0 rounded-2xl text-base font-bold shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
              size="lg"
              onClick={openChargeModal}
              disabled={!canCharge}
            >
              <Wallet className="h-5 w-5" />
              COBRAR {formatCurrency(0)}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <div className="space-y-0 divide-y divide-slate-200/80 dark:divide-slate-800">
                {cartWithDerivedValues.map((item) => {
                  const product = productById[item.productId];
                  const isCartItemWeighable = Boolean(product && isWeighableProduct(product));
                  const productSaleType = product ? getProductSaleType(product) : "UNIT";
                  const unitLabel = product?.measurementUnit ?? (productSaleType === "WEIGHT" ? "KG" : "UND");
                  const quantityIsPlural = Number(item.quantity) > 1;
                  const discountDisplay = buildPosCartDiscountDisplay({
                    baseUnitPrice: item.baseUnitPrice,
                    finalUnitPrice: item.finalUnitPrice,
                    unitPrice: item.unitPrice,
                    quantity: item.quantity,
                    discountAmount: item.discountAmount,
                    discountTotal: item.discountTotal,
                    discountPercent: item.discountPercent,
                    isWeighable: isCartItemWeighable,
                  });
                  const effectiveImage = product
                    ? resolveEffectivePosProductImage(product, {
                        categoryById: productCategoryById,
                        subcategoryById: productSubcategoryById,
                      })
                    : null;

                  return (
                    <article key={item.productId} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
                          <InventoryImagePreview
                            imageUrl={effectiveImage?.imageUrl ?? null}
                            altText={effectiveImage?.altText ?? item.name}
                            lazy
                            className="flex h-full w-full items-center justify-center overflow-hidden bg-white bg-contain bg-center bg-no-repeat p-1.5 text-[10px] font-semibold text-slate-900 dark:bg-slate-950 dark:text-white"
                            fallback={<span>{buildImageLabel(item.name)}</span>}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-slate-950 dark:text-white">
                                {item.name}
                              </h3>
                              <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                {item.sku} {product ? `• ${productSaleTypeLabels[productSaleType]} / ${unitLabel}` : ""}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeCartItem(item.productId)}
                              className="rounded-full p-1.5 text-slate-400 transition hover:bg-white hover:text-rose-600 dark:hover:bg-slate-800"
                              aria-label={`Eliminar ${item.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <div className="inline-flex items-center overflow-hidden rounded-full border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                className="inline-flex h-8 w-8 items-center justify-center text-slate-600 transition hover:bg-slate-50 active:scale-95 dark:text-slate-300 dark:hover:bg-slate-900"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <input
                                value={item.quantity}
                                onChange={(event) =>
                                  updateQuantity(
                                    item.productId,
                                    parseQuantityInput(event.target.value)
                                  )
                                }
                                className="w-12 border-x border-slate-200 bg-transparent px-1 py-1.5 text-center text-sm font-semibold text-slate-900 focus:outline-none dark:border-slate-700 dark:text-white"
                                inputMode={isCartItemWeighable ? "decimal" : "numeric"}
                                aria-label={`Cantidad de ${item.name}`}
                              />
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                className="inline-flex h-8 w-8 items-center justify-center text-slate-600 transition hover:bg-slate-50 active:scale-95 dark:text-slate-300 dark:hover:bg-slate-900"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>

                            {isCartItemWeighable && product ? (
                              <button
                                type="button"
                                onClick={() => void handleReadScaleForProduct(product)}
                                disabled={!scaleMockEnabled || scaleReading}
                                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 text-[11px] font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100 dark:hover:bg-sky-500/20"
                              >
                                {scaleReading ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Scale className="h-3.5 w-3.5" />
                                )}
                                Leer balanza
                              </button>
                            ) : null}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                            {item.pricingStatus === "PENDING" ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-semibold text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {item.pricingError === "Precio pendiente de actualización" ? "Precio pendiente de actualización" : "Calculando precio"}
                              </span>
                            ) : null}

                            {item.pricingStatus === "ERROR" ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
                                Error: {item.pricingError}
                              </span>
                            ) : null}

                            {item.appliedPromotionName ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                                Promo: {item.appliedPromotionName}
                              </span>
                            ) : null}

                            {discountDisplay ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                                Ahorro {formatCurrency(discountDisplay.totalDiscount)}
                              </span>
                            ) : null}

                            <span className="text-slate-500 dark:text-slate-400">Stock {item.stock}</span>
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => toggleTaxBreakdown(item.productId)}
                              className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-700 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                            >
                              <span>Impuestos</span>
                              <span className="text-slate-500 dark:text-slate-400">
                                {formatCurrency(item.taxTotal)}
                              </span>
                              <ChevronDown
                                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                                  expandedTaxItems[item.productId] ? "rotate-180" : ""
                                }`}
                              />
                            </button>

                            <div className="shrink-0 text-right">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                {quantityIsPlural ? "Total" : "Precio"}
                              </p>
                              <p className="mt-0.5 text-base font-semibold text-slate-950 dark:text-white">
                                {formatCurrency(item.subtotal)}
                              </p>
                              {quantityIsPlural ? (
                                <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                                  {formatCurrency(item.unitPrice)} c/u
                                </p>
                              ) : null}
                            </div>
                          </div>

                          {expandedTaxItems[item.productId] ? (
                            <div className="mt-2 space-y-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] dark:border-slate-700 dark:bg-slate-950/80">
                              {item.taxes.length === 0 ? (
                                <p className="text-slate-500 dark:text-slate-400">
                                  Este producto no tiene impuestos asociados.
                                </p>
                              ) : (
                                item.taxes.map((tax) => (
                                  <div
                                    key={tax.taxId}
                                    className="flex items-center justify-between gap-3"
                                  >
                                    <span className="truncate text-slate-700 dark:text-slate-200">
                                      {tax.taxName}
                                    </span>
                                    <span className="shrink-0 text-slate-600 dark:text-slate-300">
                                      {formatCurrency(tax.taxAmount)}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 flex shrink-0 flex-col gap-3">
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/80">
                <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                  <span>Subtotal</span>
                  <span>{formatCurrency(summary.subtotal - summary.taxesTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                  <span>Impuestos</span>
                  <span>{formatCurrency(summary.taxesTotal)}</span>
                </div>
                {summary.taxBreakdown.map(([taxName, amount]) => (
                  <div
                    key={taxName}
                    className="flex items-center justify-between pl-3 text-xs text-slate-500 dark:text-slate-400"
                  >
                    <span>{taxName}</span>
                    <span>{formatCurrency(amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                  <span>Descuentos</span>
                  <span>{formatCurrency(summary.discountTotal)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-950 dark:border-slate-700 dark:text-white">
                  <span>TOTAL</span>
                  <span>{formatCurrency(summary.total)}</span>
                </div>
              </div>

              {hasPricingPending ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
                  Calculando precio/promocion antes de cobrar.
                </div>
              ) : null}

              {pricingErrorItem ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
                  {pricingErrorItem.pricingError ??
                    `No se pudo calcular precio/promocion para ${pricingErrorItem.name}.`}
                </div>
              ) : null}

              <Button
                className="min-h-12 w-full shrink-0 rounded-2xl text-base font-bold shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
                size="lg"
                onClick={openChargeModal}
                disabled={!canCharge}
              >
                <Wallet className="h-5 w-5" />
                COBRAR {formatCurrency(summary.total)}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen">
      {toastMessage ? (
        <Toast
          message={toastMessage}
          variant={toastVariant}
          onClose={() => setToastMessage(null)}
        />
      ) : null}

      {/* POS operational panel trigger */}
      <div className="relative">
        <button
          type="button"
          ref={posFloatingControl.buttonRef}
          onPointerDown={posFloatingControl.buttonProps.onPointerDown}
          onPointerMove={posFloatingControl.buttonProps.onPointerMove}
          onPointerUp={posFloatingControl.buttonProps.onPointerUp}
          onPointerCancel={posFloatingControl.buttonProps.onPointerCancel}
          onClick={posFloatingControl.buttonProps.onClick}
          style={posFloatingControl.buttonStyle}
          className={`fixed z-20 inline-flex cursor-grab select-none items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-800 shadow-lg shadow-slate-900/10 backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-950/95 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-900 ${posFloatingControl.isDragging ? "scale-[1.02] shadow-2xl" : ""}`}
          aria-label="Abrir panel operativo POS"
          title="Abrir panel operativo POS. Arrastra para mover."
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>POS</span>
          {hasProductCatalogFilters ? (
            <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-slate-900 px-2 py-0.5 text-xs font-bold text-white dark:bg-white dark:text-slate-950">
              {activeProductFilterLabels.length}
            </span>
          ) : null}
          {selectedCustomerId && selectedCustomerId !== finalConsumerCustomer?.id ? (
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          ) : null}
        </button>

        {productToolsOpen ? (
          <Modal
            title="Panel operativo POS"
            description="Ajustar filtros de producto sin reservar espacio permanente."
            size="xl"
            onClose={() => setProductToolsOpen(false)}
            className="max-h-[calc(100vh-2rem)] overflow-y-auto dark:bg-slate-950"
          >
            <div className="space-y-5">
              <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <SlidersHorizontal className="h-4 w-4" />
                    Filtros de producto
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearProductCatalogFilters}
                    disabled={!hasProductCatalogFilters}
                  >
                    <X className="h-4 w-4" />
                    Limpiar filtros
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Select
                    label="Categoria"
                    value={selectedProductCategoryId}
                    onChange={(event) => handleProductCategoryFilterChange(event.target.value)}
                  >
                    <option value="">Todas las categorias</option>
                    {productCategoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="Subcategoria"
                    value={selectedProductSubcategoryId}
                    onChange={(event) => handleProductSubcategoryFilterChange(event.target.value)}
                    disabled={!productSubcategoryOptions.length}
                  >
                    <option value="">Todas las subcategorias</option>
                    {productSubcategoryOptions.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>
                        {subcategory.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(stockFilterLabels) as StockFilterKey[]).map((filter) => {
                    const isActive = activeStockFilter === filter;
                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => handleStockFilterChange(filter)}
                        className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                          isActive
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                        }`}
                      >
                        <span>{stockFilterLabels[filter]}</span>
                        <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-[11px] dark:bg-white/10">
                          {stockFilterCounts[filter]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={productViewMode === "grid" ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setProductViewMode("grid")}
                  >
                    <Grid3X3 className="h-4 w-4" />
                    Cuadricula
                  </Button>
                  <Button
                    variant={productViewMode === "list" ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setProductViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                    Lista
                  </Button>
                </div>
                {hasSelectedCategoryWithoutSubcategories ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedProductCategory?.name ?? "CategorÃ­a"} sin subcategorÃ­as.
                  </p>
                ) : null}
              </section>


            </div>
          </Modal>
        ) : null}
      </div>

      {catalogError ? (
        <section className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
          {catalogError}
        </section>
      ) : null}
      {catalogWarnings.length > 0 && !catalogError ? (
        <section className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          {catalogWarnings.join(" ")}
        </section>
      ) : null}

      {/* Main Layout - Sale-first workspace */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Products Panel - Always visible */}
        <div className="min-w-0">
          <div className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] dark:border-slate-700 dark:bg-slate-950/80">
            <div className="flex flex-col gap-4">
              <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Search className="h-4 w-4" />
                  Buscar productos
                </div>
                <Input
                  ref={searchInputRef}
                  label="Buscador POS principal"
                  placeholder="Buscar productos por nombre, SKU o codigo"
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="min-h-12 pl-10 text-base dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Usa nombre, SKU o codigo. Escape limpia la busqueda.
                </p>
              </section>

              {peripheralDiagnosticsOpen && canShowPeripheralDiagnostics ? (
              <>
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/70">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Scanner
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          scannerMockStatus === "connected"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
                            : scannerMockStatus === "error"
                              ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
                              : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                        }`}
                      >
                        {scannerMockEnabled
                          ? scannerMockStatus === "error"
                            ? "Desconectado"
                            : "Escuchando scanner.code.read"
                          : "Desactivado por feature flag"}
                      </span>
                    </div>
                    <Input
                      label="Código scanner"
                      placeholder="SKU, codigo de barras o referencia"
                      value={scannerMockCode}
                      onChange={(event) => setScannerMockCode(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleSimulateScannerRead();
                        }
                      }}
                      disabled={!scannerMockEnabled}
                      className="dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="md"
                    isLoading={scannerSimulating}
                    disabled={!scannerMockEnabled || !scannerMockCode.trim()}
                    onClick={() => void handleSimulateScannerRead()}
                    className="xl:mb-0.5"
                  >
                    <Search className="h-4 w-4" />
                    Simular scanner
                  </Button>
                </div>
                {scannerLastCode || scannerLastResult ? (
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
                    {scannerLastCode ? <span>Ultimo codigo: {scannerLastCode}</span> : null}
                    {scannerLastResult ? <span>{scannerLastResult}</span> : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/70">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        <Scale className="h-4 w-4" />
                        Balanza MOCK
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          scaleMockStatus === "ready"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
                            : scaleMockStatus === "reading"
                              ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100"
                              : scaleMockStatus === "error"
                                ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
                                : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                        }`}
                      >
                        {scaleMockEnabled
                          ? scaleMockStatus === "reading"
                            ? "Leyendo"
                            : scaleMockStatus === "error"
                              ? "Error"
                              : "Listo"
                          : "Desactivado por feature flag"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
                      <span>
                        Producto pesable:{" "}
                        {firstWeighableCartProduct?.name ?? "ninguno en carrito"}
                      </span>
                      {scaleLastWeight ? <span>Ultimo peso: {scaleLastWeight}</span> : null}
                      {scaleLastResult ? <span>{scaleLastResult}</span> : null}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="md"
                    isLoading={scaleReading}
                    disabled={!scaleMockEnabled || scaleReading}
                    onClick={() => void handleReadScaleFromCart()}
                    className="xl:mb-0.5"
                  >
                    <Scale className="h-4 w-4" />
                    Leer balanza MOCK
                  </Button>
                </div>
              </div>
              </>
              ) : null}

              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/70 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${scaleStatusTone}`}
                  >
                    Balanza {scaleStatusLabel}
                    {scaleMockStatus === "ready" ? (
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    ) : null}
                  </span>
                </div>
                {scaleMockStatus === "error" ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
                    Balanza no disponible
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPeripheralDiagnosticsOpen((current) => !current)}
                    className="inline-flex min-h-7 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Periféricos OK
                  </button>
                )}
                {canShowPeripheralDiagnostics ? (
                  <button
                    type="button"
                    onClick={() => setPeripheralDiagnosticsOpen((current) => !current)}
                    className="inline-flex min-h-7 items-center justify-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Diagnóstico
                  </button>
                ) : null}

                <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  Sync {appVersion || "sin version"}
                </span>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {filteredProducts.length} productos disponibles
                  </span>
                  <div
                    className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800"
                    role="group"
                    aria-label="Vista de productos"
                  >
                    {productViewModeOptions.map((option) => {
                      const Icon = option.icon;
                      const isActive = productViewMode === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setProductViewMode(option.value)}
                          aria-pressed={isActive}
                          className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
                            isActive
                              ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(stockFilterLabels) as StockFilterKey[]).map((filter) => {
                    const isActive = activeStockFilter === filter;
                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => handleStockFilterChange(filter)}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none transition-all duration-200 active:scale-95 ${
                          isActive
                            ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
                        }`}
                      >
                        <span>{stockFilterLabels[filter]}</span>
                        <span className="rounded-full bg-black/10 px-1 py-0.5 text-[9px] leading-none dark:bg-white/10">
                          {stockFilterCounts[filter]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {activeProductFilterLabels.length > 0 ? (
                    <>
                      {activeProductFilterLabels.map((label) => (
                        <span
                          key={label}
                          className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold leading-none text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100"
                        >
                          {label}
                        </span>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearProductCatalogFilters}
                        disabled={!hasProductCatalogFilters}
                        className="min-h-7 px-2 py-0.5 text-[10px] leading-none"
                      >
                        <X className="h-3 w-3" />
                        Limpiar
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Products Catalog */}
            <div className="mt-3">
              {catalogLoading ? (
                <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                  Cargando productos...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <Package className="mb-3 h-8 w-8" />
                  No hay productos que coincidan con la busqueda actual.
                </div>
              ) : (
                <div
                  className={
                    productViewMode === "grid"
                      ? "grid grid-cols-1 gap-2.5 min-[520px]:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3"
                      : "grid gap-2.5"
                  }
                >
                  {filteredProducts.map((product) => {
                    const stock = Number(product.stock ?? 0);
                    const productSaleType = getProductSaleType(product);
                    const requiresScale = productSaleType === "WEIGHT";
                    const quantityInCart = cartQuantityByProductId[product.id] ?? 0;
                    const hasProductInCart = quantityInCart > 0;
                    const actionLabel = requiresScale
                      ? scaleMockEnabled
                        ? "Leer balanza"
                        : "Sin balanza"
                      : "Agregar";
                    const actionTone = requiresScale
                      ? scaleMockEnabled
                        ? "bg-sky-600 text-white shadow-sm ring-1 ring-sky-500/20 group-hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:group-hover:bg-sky-400"
                        : "bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                      : "bg-blue-600 text-white shadow-sm ring-1 ring-blue-500/20 group-hover:bg-blue-700 dark:bg-blue-500 dark:text-slate-950 dark:group-hover:bg-blue-400";
                    const effectiveImage = resolveEffectivePosProductImage(product, {
                      categoryById: productCategoryById,
                      subcategoryById: productSubcategoryById,
                    });
                    const isProductActionDisabled =
                      stock <= 0 ||
                      !canCreate ||
                      (requiresScale && (!scaleMockEnabled || scaleReading));

                    if (productViewMode === "list") {
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleProductCardAction(product)}
                          disabled={isProductActionDisabled}
                          className={`group w-full overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:border-slate-200 disabled:hover:shadow-sm dark:bg-slate-800 dark:hover:border-slate-700 ${
                            hasProductInCart
                              ? "border-blue-200 ring-2 ring-blue-100 dark:border-blue-500/40 dark:ring-blue-500/10"
                              : "border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <div className="grid min-h-[88px] grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-2.5 sm:min-h-[92px] sm:grid-cols-[80px_minmax(0,1fr)_auto] md:min-h-[96px] lg:min-h-[100px]">
                            <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 sm:h-20 sm:w-20 md:h-[78px] md:w-[78px] lg:h-20 lg:w-20">
                              <InventoryImagePreview
                                imageUrl={effectiveImage.imageUrl}
                                altText={effectiveImage.altText}
                                lazy
                                className="flex h-full w-full items-center justify-center overflow-hidden bg-white bg-contain bg-center bg-no-repeat p-2 text-sm font-semibold text-slate-900 dark:bg-slate-950 dark:text-white"
                                fallback={<span>{buildImageLabel(product.name)}</span>}
                              />
                            </div>

                            <div className="min-w-0 py-0.5">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="line-clamp-2 text-[0.98rem] font-semibold leading-tight text-slate-950 dark:text-white sm:text-[1rem]">
                                  {product.name}
                                </h3>
                                <span
                                  className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none ${getProductStockTone(
                                    stock
                                  )}`}
                                >
                                  {stock <= 0
                                    ? "Sin stock"
                                    : isLowStock(stock)
                                      ? `Stock bajo ${stock}`
                                      : `Stock ${stock}`}
                                </span>
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                <span className="max-w-full truncate">{product.sku}</span>
                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                <span className="text-slate-600 dark:text-slate-300">
                                  {productSaleTypeLabels[productSaleType]} /{" "}
                                  {product.measurementUnit ??
                                    (productSaleType === "UNIT" ? "UND" : "KG")}
                                </span>
                              </div>

                              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <div className="min-w-0">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                                    Precio final
                                  </p>
                                  <p className="mt-0.5 text-[1.1rem] font-semibold leading-none text-slate-950 dark:text-white">
                                    {formatCurrency(Number(product.price))}
                                  </p>
                                </div>
                                {hasProductInCart ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold leading-none text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
                                    En carrito {quantityInCart}
                                  </span>
                                ) : null}
                                {requiresScale ? (
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${actionTone}`}
                                  >
                                    {scaleMockEnabled ? (
                                      <>
                                        <Scale className="h-3.5 w-3.5" />
                                        Leer balanza
                                      </>
                                    ) : (
                                      actionLabel
                                    )}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex items-center justify-end">
                              <span
                                className={`inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-2xl px-3 text-sm font-bold transition-colors ${actionTone}`}
                              >
                                {requiresScale ? (
                                  scaleMockEnabled ? (
                                    <Scale className="h-4 w-4" />
                                  ) : (
                                    actionLabel
                                  )
                                ) : (
                                  <Plus className="h-5 w-5" />
                                )}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    }

                    return (
                      <button
                        key={product.id}
                          type="button"
                          onClick={() => handleProductCardAction(product)}
                          disabled={isProductActionDisabled}
                          className={`group min-h-[220px] overflow-hidden rounded-[24px] border bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm dark:bg-slate-800 ${
                            hasProductInCart
                              ? "border-blue-200 ring-2 ring-blue-100 dark:border-blue-500/40 dark:ring-blue-500/10"
                              : "border-slate-200 dark:border-slate-700"
                          }`}
                      >
                        <div className="flex h-full flex-col">
                          <div className="relative">
                            <div className="relative aspect-[4/3] w-full overflow-hidden bg-white">
                              <InventoryImagePreview
                                imageUrl={effectiveImage.imageUrl}
                                altText={effectiveImage.altText}
                                lazy
                                className="flex h-full w-full items-center justify-center overflow-hidden bg-white bg-contain bg-center bg-no-repeat p-2 text-sm font-semibold text-slate-900 dark:bg-slate-950 dark:text-white"
                                fallback={<span>{buildImageLabel(product.name)}</span>}
                              />
                            </div>
                            <div className="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2">
                              {hasProductInCart ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
                                  En carrito {quantityInCart}
                                </span>
                              ) : null}
                            </div>
                            <div className="absolute right-3 top-3">
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold shadow-sm ${getProductStockTone(
                                  stock
                                )}`}
                              >
                                {stock <= 0
                                  ? "Sin stock"
                                  : isLowStock(stock)
                                    ? `Stock bajo ${stock}`
                                    : `Stock ${stock}`}
                              </span>
                            </div>
                          </div>

                          <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
                            <div className="min-w-0">
                              <h3 className="line-clamp-2 text-[0.95rem] font-semibold leading-tight text-slate-950 dark:text-white">
                                {product.name}
                              </h3>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                <span className="max-w-full truncate">{product.sku}</span>
                                <span className="text-slate-300 dark:text-slate-600">â€¢</span>
                                <span className="text-slate-600 dark:text-slate-300">
                                  {productSaleTypeLabels[productSaleType]} /{" "}
                                  {product.measurementUnit ??
                                    (productSaleType === "UNIT" ? "UND" : "KG")}
                                </span>
                              </div>
                            </div>

                            <div className="mt-auto flex items-end justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-700">
                              <div>
                                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                  Precio final
                                </p>
                                <p className="mt-0.5 text-[1.1rem] font-semibold leading-none text-slate-950 dark:text-white">
                                  {formatCurrency(Number(product.price))}
                                </p>
                              </div>
                              <span
                                className={`inline-flex h-10 min-w-10 items-center justify-center rounded-2xl px-3 text-sm font-bold transition-colors ${actionTone}`}
                              >
                                {requiresScale ? (
                                  scaleMockEnabled ? (
                                    <span className="inline-flex items-center gap-1.5">
                                      <Scale className="h-4 w-4" />
                                      Leer
                                    </span>
                          ) : (
                                    actionLabel
                                  )
                                ) : (
                                  <Plus className="h-5 w-5" />
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cart Panel - Desktop: sticky sidebar, Mobile: centered modal */}
        {/* Desktop Cart */}
        <aside
          className="sticky top-3 hidden max-h-[calc(100vh-8.5rem)] min-h-0 rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-950/95 xl:block"
        >
          <div className="flex max-h-full flex-col overflow-hidden pt-2">
            <CartPanel />
          </div>
        </aside>

        {/* Mobile Cart Modal */}
        {isMobile && cartSheetOpen ? (
          <Modal
            title="Carrito de venta"
            description="Revisa productos, totales y cobro sin perder contexto."
            size="xl"
            onClose={() => setCartSheetOpen(false)}
            className="max-h-[calc(100vh-2rem)] overflow-y-auto dark:bg-slate-950"
          >
            <div className="max-h-[calc(100vh-8rem)] overflow-y-auto">
              <CartPanel />
            </div>
          </Modal>
        ) : null}
      </div>

      {/* Floating Cart Button - visible when cart is closed and has items */}
      {!cartSheetOpen && cartItemCount > 0 ? (
        <button
          type="button"
          ref={cartFloatingControl.buttonRef}
          onPointerDown={cartFloatingControl.buttonProps.onPointerDown}
          onPointerMove={cartFloatingControl.buttonProps.onPointerMove}
          onPointerUp={cartFloatingControl.buttonProps.onPointerUp}
          onPointerCancel={cartFloatingControl.buttonProps.onPointerCancel}
          onClick={cartFloatingControl.buttonProps.onClick}
          style={{
            ...cartFloatingControl.buttonStyle,
          }}
          className={`fixed z-30 flex cursor-grab select-none items-center gap-3 rounded-full bg-slate-900 px-5 py-3 text-white shadow-2xl transition hover:scale-105 hover:bg-slate-800 active:cursor-grabbing active:scale-95 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 sm:px-6 sm:py-4 ${cartFloatingControl.isDragging ? "scale-[1.02] shadow-[0_24px_60px_-24px_rgba(15,23,42,0.65)]" : ""}`}
          aria-label={`Abrir carrito con ${cartItemCount} productos`}
          title="Abrir carrito. Arrastra para mover."
        >
          <ShoppingCart className="h-5 w-5" />
          <span className="font-semibold">
            {cartItemCount} <span className="mx-1">-</span> {formatCurrency(summary.total)}
          </span>
        </button>
      ) : null}


      {/* Payment Modal */}
      {paymentModalOpen ? (
        <Modal
          title="Cobrar venta"
          size="xl"
          onClose={closeChargeModal}
          className="dark:bg-slate-950"
        >
          <div className="flex max-h-[calc(90vh-120px)] flex-col">
            <div className="mb-5 flex-shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <UserRound className="h-4 w-4" />
                    Cliente de la venta
                  </div>
                  <div className="relative z-50">
                    <div className="relative flex items-center">
                      <input
                        placeholder="Buscar por nombre o doc..."
                        value={customerSearchQuery}
                        onChange={(e) => {
                          setCustomerSearchQuery(e.target.value);
                          setCustomerDropdownOpen(true);
                        }}
                        onFocus={() => {
                          setCustomerSearchQuery("");
                          setCustomerDropdownOpen(true);
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setCustomerDropdownOpen(false);
                          }, 200);
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <Search className="h-4 w-4" />
                      </div>
                      {customerSearchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerSearchQuery("");
                            setCustomerDropdownOpen(true);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {customerDropdownOpen && (
                      <div className="absolute left-0 top-full mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                        {filteredCustomers.length === 0 ? (
                          <div className="px-3 py-4 text-center text-sm text-slate-500">
                            No hay clientes encontrados
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {filteredCustomers.map((customer) => {
                              const isSelected = selectedCustomerId === customer.id;
                              return (
                                <button
                                  key={customer.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCustomerId(customer.id);
                                    setCustomerDropdownOpen(false);
                                  }}
                                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                    isSelected
                                      ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 font-medium"
                                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/50"
                                  }`}
                                >
                                  <span className="truncate">
                                    {customer.name}
                                    {customer.documentNumber && (
                                      <span className="ml-1 text-xs opacity-70">
                                        ({customer.documentNumber})
                                      </span>
                                    )}
                                  </span>
                                  {isSelected && <CheckCircle2 className="h-4 w-4 flex-shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickFiscalCustomerOpen(true)}
                    >
                      <UserPlus className="h-4 w-4" />
                      Cliente fiscal
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleUseFinalConsumer}
                      disabled={!finalConsumerCustomer}
                    >
                      <UserRound className="h-4 w-4" />
                      Consumidor Final
                    </Button>
                  </div>
                </div>
                <div className="text-right border-t border-slate-200 pt-3 dark:border-slate-700 md:border-t-0 md:pt-0">
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Total
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                    {formatCurrency(summary.total)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-2">
              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-4">
                  {payments.map((payment, index) => (
                    <div
                      key={payment.id}
                      className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                          <CreditCard className="h-4 w-4" />
                          Metodo #{index + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => removePaymentRow(payment.id)}
                          className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200 dark:text-slate-200"
                          disabled={payments.length === 1}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div
                            className="grid gap-2"
                            style={{ gridTemplateColumns: `repeat(${Math.min(paymentMethodOptions.length, 4)}, minmax(0, 1fr))` }}
                          >
                            {paymentMethodOptions.map((option) => {
                              const labelLower = option.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                              let icon = "💲";
                              if (labelLower.includes("efectivo") || labelLower.includes("cash")) icon = "💵";
                              else if (labelLower.includes("debito") || labelLower.includes("debit")) icon = "💳";
                              else if (labelLower.includes("credito") || labelLower.includes("credit")) icon = "💳";
                              else if (labelLower.includes("transferencia") || labelLower.includes("transfer")) icon = "🏦";
                              else if (labelLower.includes("nequi") || labelLower.includes("daviplata") || labelLower.includes("app")) icon = "📱";

                              const isSelected = payment.paymentMethodId === option.value;

                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() =>
                                    handlePaymentMethodSelect(payment.id, option.value)
                                  }
                                  className={`flex min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl border px-2 py-2 text-center transition-all ${
                                    isSelected
                                      ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-600 dark:border-blue-500 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500"
                                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                                  }`}
                                  title={option.label}
                                >
                                  <span className="text-xl flex-shrink-0">{icon}</span>
                                  <span className="truncate text-sm font-medium leading-tight">
                                    {option.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input
                            id={`payment-amount-${payment.id}`}
                            label="Monto"
                            inputMode="decimal"
                            value={payment.amount}
                            onChange={(event) =>
                              updatePayment(payment.id, "amount", event.target.value)
                            }
                            placeholder="0"
                          />

                          <Input
                            label={
                              paymentMethodById[payment.paymentMethodId]?.requiresReference
                                ? "Referencia obligatoria"
                                : "Referencia"
                            }
                            value={payment.reference}
                            onChange={(event) =>
                              updatePayment(payment.id, "reference", event.target.value)
                            }
                            placeholder="Opcional"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button variant="outline" onClick={addPaymentRow} className="w-full">
                    <Plus className="h-4 w-4" />
                    Agregar metodo de pago
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="sticky top-0 space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-600 dark:text-slate-300">Total pagado</span>
                        <span className="font-semibold text-slate-950 dark:text-white">
                          {formatCurrency(totalPaid)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-slate-600 dark:text-slate-300">Cambio</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                          {formatCurrency(paymentDerivedState.change)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-slate-600 dark:text-slate-300">Saldo pendiente</span>
                        <span className="font-semibold text-amber-700 dark:text-amber-300">
                          {formatCurrency(paymentDerivedState.pending)}
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                        Si el total pagado no cubre la venta completa, se registrara como venta a credito.
                      </p>
                      {currentCashSession ? (
                        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                          Caja activa: {currentCashSession.cashRegisterNombre ?? "Caja actual"}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                          No hay caja abierta para este usuario. El efectivo quedara bloqueado.
                        </p>
                      )}
                    </div>

                    {paymentWarning ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                        {paymentWarning}
                      </div>
                    ) : null}

                    {submitError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
                        {submitError}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex-shrink-0 border-t border-slate-200 pt-5 dark:border-slate-800">
              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="ghost" onClick={closeChargeModal} disabled={processingSale}>
                  Cancelar
                </Button>
                <Button isLoading={processingSale} onClick={() => void submitSale()}>
                  Confirmar venta
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      ) : null}

      {quickFiscalCustomerOpen ? (
        <QuickFiscalCustomerModal
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          onClose={() => setQuickFiscalCustomerOpen(false)}
          onCustomerSelected={handleSelectPosCustomer}
          onCustomerSaved={handleFiscalCustomerSaved}
        />
      ) : null}
    </div>
  );
};
