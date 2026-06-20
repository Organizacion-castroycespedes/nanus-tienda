"use client";

import {
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

type StockFilterKey = PosStockFilterKey;
type ProductViewMode = "grid" | "list";
type ScannerMockStatus = "disabled" | "connected" | "error";
type ScaleMockStatus = "disabled" | "ready" | "reading" | "error";

type ProductBarcodeCandidate =
  | string
  | {
      barcode?: string | null;
      codigo?: string | null;
      codigoBarras?: string | null;
      codigo_barras?: string | null;
      code?: string | null;
      value?: string | null;
      isActive?: boolean;
      active?: boolean;
    };

type ScannerProductCandidate = Omit<ProductResponse, "barcodes"> & {
  primaryBarcode?: string | null;
  barcodeCodes?: string[];
  barcode?: string | null;
  codigoBarras?: string | null;
  codigo_barras?: string | null;
  reference?: string | null;
  referencia?: string | null;
  code?: string | null;
  codigo?: string | null;
  barcodes?: ProductBarcodeCandidate[];
};

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

type PosItemTax = {
  id: string;
  name: string;
  rate: number;
  amount: number;
  isIncluded: boolean;
};

const stockFilterLabels: Record<StockFilterKey, string> = {
  all: "Todos",
  available: "Con stock",
  low: "Stock bajo",
  out: "Sin stock",
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

const normalizeScannerCode = (value?: string | null) =>
  typeof value === "string" ? normalizeText(value) : "";

const collectProductScannerCodes = (product: ProductResponse) => {
  const candidate = product as unknown as ScannerProductCandidate;
  const directCodes = [
    candidate.primaryBarcode,
    candidate.barcode,
    candidate.codigoBarras,
    candidate.codigo_barras,
    candidate.sku,
    candidate.reference,
    candidate.referencia,
    candidate.code,
    candidate.codigo,
    candidate.id,
  ];
  const barcodeCodes = (candidate.barcodes ?? [])
    .filter((barcode) =>
      typeof barcode === "string"
        ? true
        : barcode.isActive !== false && barcode.active !== false
    )
    .flatMap((barcode) => {
      if (typeof barcode === "string") {
        return [barcode];
      }

      return [
        barcode.barcode,
        barcode.codigoBarras,
        barcode.codigo_barras,
        barcode.code,
        barcode.codigo,
        barcode.value,
      ];
    });

  return [...directCodes, ...(candidate.barcodeCodes ?? []), ...barcodeCodes]
    .map(normalizeScannerCode)
    .filter(Boolean);
};

const findProductByScannerCode = (
  code: string,
  products: ProductResponse[]
) => {
  const normalizedCode = normalizeScannerCode(code);
  if (!normalizedCode) {
    return null;
  }

  return (
    products.find((product) =>
      collectProductScannerCodes(product).some(
        (candidateCode) => candidateCode === normalizedCode
      )
    ) ?? null
  );
};

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
  typeof value === "string" ? normalizeText(value).replace(/\s+/g, "") : "";

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
  const [activeStockFilter, setActiveStockFilter] = useState<StockFilterKey>("all");
  const [selectedProductCategoryId, setSelectedProductCategoryId] = useState("");
  const [selectedProductSubcategoryId, setSelectedProductSubcategoryId] = useState("");
  const [productFiltersOpen, setProductFiltersOpen] = useState(false);
  const [productViewMode, setProductViewMode] =
    useState<ProductViewMode>("grid");
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [quickFiscalCustomerOpen, setQuickFiscalCustomerOpen] = useState(false);
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

  // New state for cart drawer visibility
  const [isCartOpen, setIsCartOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const activeBranchId = posBranchId ?? authUser?.branchId ?? null;
  const peripheralFeatureFlags = useMemo(() => getPeripheralFeatureFlags(), []);
  const scannerMockEnabled =
    peripheralFeatureFlags.peripheralsEnabled &&
    peripheralFeatureFlags.scannerEnabled;
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

  const focusProductSearch = useCallback(() => {
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }, []);

  // Detect mobile/tablet viewport
  useEffect(() => {
    const checkViewport = () => {
      const mobile = window.innerWidth < 1280;
      setIsMobile(mobile);
      // On mobile, cart is closed by default
      if (mobile) {
        setIsCartOpen(false);
      } else {
        setIsCartOpen(true);
      }
    };

    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

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

  const handleSelectPosCustomer = useCallback(
    (customer: CustomerResponse) => {
      setCustomers((current) => upsertCustomer(current, customer));
      setSelectedCustomerId(customer.id);
      setCustomerPickerOpen(false);
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
      setCustomerPickerOpen(false);
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
    setCustomerPickerOpen(false);
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
        `${product.name} ${product.description ?? ""} ${collectProductScannerCodes(
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
      const itemTaxes: PosItemTax[] = item.taxId
        ? [
            {
              id: item.taxId,
              name: tax?.name ?? "Impuesto",
              rate: tax?.rate ?? item.taxRate ?? 0,
              amount: previewTaxAmount ?? fallbackTaxAmount,
              isIncluded: tax?.isIncluded ?? true,
            },
          ]
        : [];

      const taxTotal = round(itemTaxes.reduce((sum, current) => sum + current.amount, 0));
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

    return {
      subtotal,
      taxesTotal,
      discountTotal,
      total: subtotal,
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
          .filter((payment) => payment.method?.tipo === "CASH")
          .reduce((sum, payment) => sum + payment.numericAmount, 0)
      ),
    [parsedPayments]
  );

  const totalNonCashPaid = useMemo(
    () =>
      round(
        parsedPayments
          .filter((payment) => payment.method?.tipo !== "CASH")
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
  const scannerStatusLabel = scannerMockEnabled
    ? scannerMockStatus === "error"
      ? "Desconectado"
      : "Conectado"
    : "Desactivado";
  const scaleStatusLabel = scaleMockEnabled
    ? scaleMockStatus === "reading"
      ? "Leyendo"
      : scaleMockStatus === "error"
        ? "Error"
        : "Lista"
    : "Desactivada";
  const scannerStatusTone =
    scannerMockStatus === "error" || !scannerMockEnabled
      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
      : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100";
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
      }
      return added;
    },
    [focusProductSearch, setProductQuantityInCart]
  );

  const handleScannerCodeRead = useCallback(
    (result: ScannerReadResult) => {
      const code = result.code.trim();
      if (!code) {
        return;
      }

      setScannerMockStatus("connected");
      setScannerLastCode(code);
      const product = findProductByScannerCode(code, productsRef.current);

      if (!product) {
        const message = `Código no encontrado: ${code}`;
        setScannerLastResult(message);
        showToast(message, "warning");
        return;
      }

      const added = addToCart(product);
      if (!added) {
        setScannerLastResult(`Producto no agregado por scanner: ${product.name}`);
        return;
      }

      const message = `Producto agregado por scanner: ${code}`;
      setScannerLastResult(message);
      showToast(message, "success");
    },
    [addToCart, showToast]
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
    if (!scannerMockEnabled) {
      setScannerMockStatus("disabled");
      return undefined;
    }

    scannerErrorToastShownRef.current = false;
    setScannerMockStatus("connected");
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
    scannerMockEnabled,
  ]);

  const handleSimulateScannerRead = useCallback(async () => {
    const code = scannerMockCode.trim();
    if (!code) {
      showToast("Ingresa un codigo para simular scanner MOCK.", "warning");
      return;
    }

    if (!scannerMockEnabled) {
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
    scannerMockEnabled,
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

        const message = `Peso leído: ${reading}`;
        setScaleMockStatus("ready");
        setScaleLastResult(message);
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
        }
        return;
      }

      if (event.key !== "Enter") {
        return;
      }

      const firstProduct = filteredProducts[0];
      if (!firstProduct) {
        return;
      }

      event.preventDefault();
      handleProductCardAction(firstProduct);
    },
    [filteredProducts, handleProductCardAction, query]
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
        focusProductSearch();
        return;
      }

      if (event.key === "Escape") {
        if (paymentModalOpen || quickFiscalCustomerOpen) {
          return;
        }
        if (isCartOpen && isMobile) {
          event.preventDefault();
          setIsCartOpen(false);
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
        setCustomerPickerOpen((current) => !current);
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
    isCartOpen,
    isMobile,
    openChargeModal,
    paymentModalOpen,
    query,
    quickFiscalCustomerOpen,
  ]);

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
    setPayments(
      rebalancePaymentsForTotal([
        ...payments,
        createPaymentDraft(firstNonCashMethod?.id ?? "", ""),
      ])
    );
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
        if (payment.method?.tipo !== "CASH" || remainingChange <= 0) {
          return {
            paymentMethodId: payment.paymentMethodId,
            amount: payment.numericAmount,
            cashSessionId: currentCashSession?.id ?? null,
            referenceNumber: payment.reference.trim() || null,
            notes: null,
          };
        }

        const adjustedAmount = round(
          Math.max(payment.numericAmount - remainingChange, 0)
        );
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
      (payment) => payment.numericAmount > 0 && payment.method?.tipo === "CASH" && !currentCashSession
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
    <div className="flex h-full flex-col">
      {/* Cart Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Carrito
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
            Venta actual
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
            {cartWithDerivedValues.length} items
          </div>
          {/* Close button - visible on mobile or when cart can be collapsed */}
          <button
            type="button"
            onClick={() => setIsCartOpen(false)}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 xl:hidden"
            aria-label="Cerrar carrito"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Cart Content */}
      <div className="mt-4 flex flex-1 flex-col overflow-hidden">
        {cartWithDerivedValues.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <ShoppingCart className="mb-3 h-8 w-8" />
            <p className="font-semibold text-slate-700 dark:text-slate-100">
              No hay productos en la venta actual.
            </p>
            <p className="mt-2 text-sm">
              Busca, escanea o selecciona un producto para iniciar.
            </p>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {cartWithDerivedValues.map((item) => {
                const product = productById[item.productId];
                const isCartItemWeighable = Boolean(
                  product && isWeighableProduct(product)
                );
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
                const discountPercentLabel =
                  discountDisplay?.percent !== null && discountDisplay?.percent !== undefined
                    ? ` (${discountDisplay.percent}%)`
                    : "";

                return (
                  <article
                    key={item.productId}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/80"
                  >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                        {item.name}
                      </h3>
                      <p className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {item.sku}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCartItem(item.productId)}
                      className="rounded-full p-2 text-slate-400 transition hover:bg-white hover:text-rose-600 dark:hover:bg-slate-800"
                      aria-label={`Eliminar ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                    <div className="inline-flex items-center rounded-full border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="rounded-l-full px-3 py-2 text-slate-600 transition hover:bg-slate-50 active:scale-95 dark:text-slate-300 dark:hover:bg-slate-900"
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
                        className="w-14 border-x border-slate-200 bg-transparent px-2 py-2 text-center text-sm font-semibold text-slate-900 focus:outline-none dark:border-slate-700 dark:text-white"
                        inputMode={isCartItemWeighable ? "decimal" : "numeric"}
                        aria-label={`Cantidad de ${item.name}`}
                      />
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="rounded-r-full px-3 py-2 text-slate-600 transition hover:bg-slate-50 active:scale-95 dark:text-slate-300 dark:hover:bg-slate-900"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      {item.discountTotal > 0 ? (
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="text-xs line-through">
                            {formatCurrency(item.baseUnitPrice ?? item.unitPrice)}
                          </span>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                            {formatCurrency(item.unitPrice)} c/u
                          </span>
                        </p>
                      ) : (
                        <p>{formatCurrency(item.unitPrice)} c/u</p>
                      )}
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Stock disponible: {item.stock}
                      </p>
                      {isCartItemWeighable && product ? (
                        <button
                          type="button"
                          onClick={() => void handleReadScaleForProduct(product)}
                          disabled={!scaleMockEnabled || scaleReading}
                          className="mt-2 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100 dark:hover:bg-sky-500/20"
                        >
                          {scaleReading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Scale className="h-3.5 w-3.5" />
                          )}
                          Leer balanza MOCK
                        </button>
                      ) : null}
                      {item.pricingStatus === "PENDING" ? (
                        <p className="mt-2 flex items-center gap-2 text-xs text-sky-700 dark:text-sky-300">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Calculando precio/promocion...
                        </p>
                      ) : null}
                      {item.pricingStatus === "ERROR" ? (
                        <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">
                          {item.pricingError}
                        </p>
                      ) : null}
                      {item.appliedPromotionName ? (
                        <p className="mt-2 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                          {item.appliedPromotionName}
                        </p>
                      ) : null}
                      {discountDisplay ? (
                        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                          {discountDisplay.showLineTotal ? (
                            <>
                              Descuento {formatCurrency(discountDisplay.unitDiscount)} c/u{" "}
                              <span className="font-semibold">
                                Ahorro total{" "}
                                {formatCurrency(discountDisplay.totalDiscount)}
                                {discountPercentLabel}
                              </span>
                            </>
                          ) : (
                            <>
                              Descuento {formatCurrency(discountDisplay.unitDiscount)}
                              {discountPercentLabel}
                            </>
                          )}
                        </p>
                      ) : null}
                    </div>

                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Total linea
                      </p>
                      <p className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
                        {formatCurrency(item.subtotal)}
                      </p>
                    </div>
                  </div>

                  {/* Tax Breakdown */}
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/80">
                    <button
                      type="button"
                      onClick={() => toggleTaxBreakdown(item.productId)}
                      className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-slate-800 dark:text-slate-100"
                    >
                      <span>Impuestos del item</span>
                      <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {formatCurrency(item.taxTotal)}
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${
                            expandedTaxItems[item.productId] ? "rotate-180" : ""
                          }`}
                        />
                      </span>
                    </button>

                    {expandedTaxItems[item.productId] ? (
                      <div className="mt-3 space-y-2 text-sm">
                        {item.taxes.length === 0 ? (
                          <p className="text-slate-500 dark:text-slate-400">
                            Este producto no tiene impuestos asociados.
                          </p>
                        ) : (
                          item.taxes.map((tax) => (
                            <div
                              key={tax.id}
                              className="rounded-2xl bg-slate-50 px-3 py-2 text-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium">{tax.name}</span>
                                <span>{formatCurrency(tax.amount)}</span>
                              </div>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {round(tax.rate * 100)}%{" "}
                                {tax.isIncluded ? "- incluido en el precio" : "- adicional"}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                  </article>
                );
              })}
            </div>

            {/* Summary */}
            <div className="mt-4 space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                <span>Subtotal</span>
                <span>{formatCurrency(summary.subtotal - summary.taxesTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                <span>Impuestos</span>
                <span>{formatCurrency(summary.taxesTotal)}</span>
              </div>
              {summary.discountTotal > 0 ? (
                <div className="flex items-center justify-between text-sm text-emerald-700 dark:text-emerald-300">
                  <span>Descuentos aplicados</span>
                  <span>{formatCurrency(summary.discountTotal)}</span>
                </div>
              ) : null}
              {/* Inline tax summary */}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Incluye impuestos: {formatCurrency(summary.taxesTotal)}
              </p>
              <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-lg font-semibold text-slate-950 dark:border-slate-800 dark:text-white">
                <span>Total final</span>
                <span>{formatCurrency(summary.total)}</span>
              </div>
            </div>

            {hasPricingPending ? (
              <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
                Calculando precio/promocion antes de cobrar.
              </div>
            ) : null}

            {pricingErrorItem ? (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
                {pricingErrorItem.pricingError ??
                  `No se pudo calcular precio/promocion para ${pricingErrorItem.name}.`}
              </div>
            ) : null}

            {/* Charge Button */}
            <div className="mt-4">
              <Button
                className="min-h-14 w-full rounded-2xl text-base font-bold shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
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

      {/* Top Bar */}
      <section className="mb-5 rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-950/80">
        <div className="grid gap-4 xl:grid-cols-[auto_minmax(320px,1fr)_minmax(420px,520px)] xl:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                POS
              </p>
              <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">
                Punto de venta
              </h1>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Version: {appVersion || "No disponible"}
              </p>
            </div>
          </div>

          <div className="min-w-0">
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div className="relative min-w-0">
                <Input
                  ref={searchInputRef}
                  label="Buscador POS principal"
                  placeholder="Buscar productos por nombre, SKU o codigo"
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="min-h-12 pl-10 text-base dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <Search className="pointer-events-none absolute left-3 top-[42px] h-5 w-5 text-slate-400" />
              </div>

              <Button
                variant={hasProductCatalogFilters ? "primary" : "outline"}
                size="md"
                onClick={() => setProductFiltersOpen((current) => !current)}
                aria-expanded={productFiltersOpen}
                aria-controls="pos-product-filter-panel"
                className={`min-h-12 rounded-xl whitespace-nowrap ${
                  hasProductCatalogFilters
                    ? "border border-blue-600 shadow-sm focus-visible:ring-blue-600 dark:border-blue-400"
                    : "dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeProductFilterLabels.length > 0 ? (
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs dark:bg-slate-950/10">
                    {activeProductFilterLabels.length}
                  </span>
                ) : null}
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${
                    productFiltersOpen ? "rotate-180" : ""
                  }`}
                />
              </Button>
            </div>

            <div className="mt-2 flex min-h-7 flex-wrap items-center gap-2 text-xs">
              {hasProductCatalogFilters ? (
                <>
                  {activeProductFilterLabels.map((label) => (
                    <span
                      key={label}
                      className="inline-flex max-w-full items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100"
                    >
                      <span className="truncate">{label}</span>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={clearProductCatalogFilters}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                    Limpiar filtros
                  </button>
                </>
              ) : (
                <span className="text-slate-500 dark:text-slate-400">
                  Sin filtros activos
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Usuario actual
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
                {authUser?.name || "Usuario"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Estado venta
              </p>
              <div className="mt-1 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                {renderedStatus}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Cliente
              </p>
              <button
                type="button"
                onClick={() => setCustomerPickerOpen((current) => !current)}
                className="mt-1 flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-slate-900 transition hover:text-slate-700 dark:text-white dark:hover:text-slate-300"
              >
                <span className="truncate">
                  {customerPickerOpen ? "Ocultar selector" : "Seleccionar cliente"}
                </span>
                <span className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                  {selectedCustomer?.name ?? "Consumidor final"}
                </span>
                <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${customerPickerOpen ? "rotate-180" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {customerPickerOpen ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <UserRound className="h-4 w-4" />
              Seleccionar cliente
            </div>
            <Select
              label="Cliente"
              value={selectedCustomerId ?? ""}
              onChange={(event) => setSelectedCustomerId(event.target.value || null)}
            >
              {customers.length === 0 ? (
                <option value="">No hay clientes disponibles</option>
              ) : null}
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
            <div className="mt-3 flex flex-wrap gap-2">
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
        ) : null}
      </section>

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
          <div className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-950/80">
            <div className="flex flex-col gap-4">
              {peripheralDiagnosticsOpen && canShowPeripheralDiagnostics ? (
              <>
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/70">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Scanner MOCK/SIMULATOR
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
                      label="Código scanner MOCK"
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

              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/70">
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

              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/70 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${scannerStatusTone}`}
                  >
                    Scanner {scannerStatusLabel}
                    {scannerMockStatus === "connected" ? (
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    ) : null}
                  </span>
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${scaleStatusTone}`}
                  >
                    Balanza {scaleStatusLabel}
                    {scaleMockStatus === "ready" ? (
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    ) : null}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    Sync {appVersion || "sin version"}
                  </span>
                </div>
                {canShowPeripheralDiagnostics ? (
                  <button
                    type="button"
                    onClick={() =>
                      setPeripheralDiagnosticsOpen((current) => !current)
                    }
                    className="inline-flex min-h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {peripheralDiagnosticsOpen ? "Ocultar diagnostico" : "Ver diagnostico"}
                  </button>
                ) : null}
              </div>

              {productFiltersOpen ? (
                <div
                  id="pos-product-filter-panel"
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/70"
                >
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        Filtros de productos
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Categoria y subcategoria del catalogo POS.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearProductCatalogFilters}
                      disabled={!hasProductCatalogFilters}
                      className="justify-center dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800"
                    >
                      <X className="h-4 w-4" />
                      Limpiar filtros
                    </Button>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <Select
                      label="Categoria"
                      value={selectedProductCategoryId}
                      onChange={(event) =>
                        handleProductCategoryFilterChange(event.target.value)
                      }
                      className="dark:border-slate-700 dark:bg-slate-950 dark:text-white"
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
                      onChange={(event) =>
                        handleProductSubcategoryFilterChange(event.target.value)
                      }
                      disabled={
                        !selectedProductCategoryId ||
                        productSubcategoryOptions.length === 0
                      }
                      className="dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    >
                      <option value="">
                        {!selectedProductCategoryId
                          ? "Selecciona categoria"
                          : productSubcategoryOptions.length === 0
                            ? "Sin subcategorias"
                            : "Todas las subcategorias"}
                      </option>
                      {productSubcategoryOptions.map((subcategory) => (
                        <option key={subcategory.id} value={subcategory.id}>
                          {subcategory.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {hasSelectedCategoryWithoutSubcategories ? (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {selectedProductCategory?.name ?? "Categoria"} sin subcategorias.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Filter Chips */}
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(stockFilterLabels) as StockFilterKey[]).map((filter) => {
                    const isActive = activeStockFilter === filter;
                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => handleStockFilterChange(filter)}
                        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 active:scale-95 ${
                          isActive
                            ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        }`}
                      >
                        <span>{stockFilterLabels[filter]}</span>
                        <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs dark:bg-white/10">
                          {stockFilterCounts[filter]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Vista productos
                  </span>
                  <div
                    className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900"
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
                          className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
                            isActive
                              ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Products Catalog */}
            <div className="mt-5">
              {catalogLoading ? (
                <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                  Cargando productos...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <Package className="mb-3 h-8 w-8" />
                  No hay productos que coincidan con la busqueda actual.
                </div>
              ) : (
                <div
                  className={
                    productViewMode === "grid"
                      ? "grid gap-4 sm:grid-cols-2 2xl:grid-cols-3 min-[1800px]:grid-cols-4"
                      : "grid gap-3"
                  }
                >
                  {filteredProducts.map((product) => {
                    const stock = Number(product.stock ?? 0);
                    const productSaleType = getProductSaleType(product);
                    const requiresScale = productSaleType === "WEIGHT";
                    const quantityInCart = cartQuantityByProductId[product.id] ?? 0;
                    const hasProductInCart = quantityInCart > 0;
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
                          className={`group w-full overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-slate-200 disabled:hover:shadow-sm dark:bg-slate-900 dark:hover:border-slate-700 ${
                            hasProductInCart
                              ? "border-blue-200 ring-2 ring-blue-100 dark:border-blue-500/40 dark:ring-blue-500/10"
                              : "border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          <div className="flex min-w-0 flex-col gap-4 p-4 sm:flex-row sm:items-center">
                            <InventoryImagePreview
                              imageUrl={effectiveImage.imageUrl}
                              altText={effectiveImage.altText}
                              lazy
                              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 bg-cover bg-center text-sm font-semibold text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                              fallback={<span>{buildImageLabel(product.name)}</span>}
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getProductStockTone(
                                    stock
                                  )}`}
                                >
                                  {stock <= 0
                                    ? "Sin stock"
                                    : isLowStock(stock)
                                      ? `Stock bajo ${stock}`
                                      : `Stock ${stock}`}
                                </span>
                                {hasProductInCart ? (
                                  <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
                                    En carrito {quantityInCart}
                                  </span>
                                ) : null}
                              </div>

                              <h3 className="mt-2 line-clamp-2 text-base font-semibold text-slate-950 dark:text-white">
                                {product.name}
                              </h3>
                              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                                <span className="max-w-full truncate text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  {product.sku}
                                </span>
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                    productSaleType === "UNIT"
                                      ? "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                      : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100"
                                  }`}
                                >
                                  {productSaleTypeLabels[productSaleType]} /{" "}
                                  {product.measurementUnit ??
                                    (productSaleType === "UNIT" ? "UND" : "KG")}
                                </span>
                              </div>
                            </div>

                            <div className="flex w-full min-w-0 items-end justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:w-auto sm:min-w-[180px] sm:flex-col sm:border-t-0 sm:pt-0">
                              <div className="min-w-0">
                                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  Precio final
                                </p>
                                <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                                  {formatCurrency(Number(product.price))}
                                </p>
                              </div>
                              <span
                                className={`inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full px-3 text-sm font-bold transition-colors ${
                                  requiresScale
                                    ? scaleMockEnabled
                                      ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-100 dark:ring-sky-500/30"
                                      : "bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                                    : "bg-blue-50 text-blue-700 ring-1 ring-blue-100 group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-500/10 dark:text-blue-100 dark:ring-blue-500/20"
                                }`}
                              >
                                {requiresScale ? (
                                  scaleMockEnabled ? (
                                    <span className="inline-flex items-center gap-1">
                                      <Scale className="h-4 w-4" />
                                      Leer
                                    </span>
                                  ) : (
                                    "Sin balanza"
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
                        className={`group min-h-[230px] overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm dark:bg-slate-900 ${
                          hasProductInCart
                            ? "border-blue-200 ring-2 ring-blue-100 dark:border-blue-500/40 dark:ring-blue-500/10"
                            : "border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        <div className="flex h-full flex-col p-4">
                          <div className="flex items-start justify-between gap-3">
                            <InventoryImagePreview
                              imageUrl={effectiveImage.imageUrl}
                              altText={effectiveImage.altText}
                              lazy
                              className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 bg-cover bg-center text-sm font-semibold text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                              fallback={<span>{buildImageLabel(product.name)}</span>}
                            />
                            <div className="flex flex-col items-end gap-2">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getProductStockTone(
                                  stock
                                )}`}
                              >
                                {stock <= 0
                                  ? "Sin stock"
                                  : isLowStock(stock)
                                    ? `Stock bajo ${stock}`
                                    : `Stock ${stock}`}
                              </span>
                              {hasProductInCart ? (
                                <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
                                  En carrito {quantityInCart}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-4 min-h-0 flex-1">
                            <h3 className="line-clamp-2 text-base font-semibold text-slate-950 dark:text-white">
                              {product.name}
                            </h3>
                            <p className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              {product.sku}
                            </p>
                            <span
                              className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                productSaleType === "UNIT"
                                  ? "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                  : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100"
                              }`}
                            >
                              {productSaleTypeLabels[productSaleType]} /{" "}
                              {product.measurementUnit ??
                                (productSaleType === "UNIT" ? "UND" : "KG")}
                            </span>
                          </div>

                          <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Precio final
                              </p>
                              <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                                {formatCurrency(Number(product.price))}
                              </p>
                            </div>
                            <span
                              className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-bold transition-colors ${
                                requiresScale
                                  ? scaleMockEnabled
                                    ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-100 dark:ring-sky-500/30"
                                    : "bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                                  : "bg-blue-50 text-blue-700 ring-1 ring-blue-100 group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-500/10 dark:text-blue-100 dark:ring-blue-500/20"
                              }`}
                            >
                              {requiresScale ? (
                                scaleMockEnabled ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Scale className="h-4 w-4" />
                                    Leer
                                  </span>
                                ) : (
                                  "Sin balanza"
                                )
                              ) : (
                                <Plus className="h-5 w-5" />
                              )}
                            </span>
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

        {/* Cart Panel - Desktop: sticky sidebar, Mobile: Drawer overlay */}
        {/* Desktop Cart */}
        <aside
          className="sticky top-3 hidden h-[calc(100vh-1.5rem)] min-h-0 rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95 xl:block"
        >
          <div className="h-full overflow-hidden pt-2">
            <CartPanel />
          </div>
        </aside>

        {/* Mobile Cart Drawer Overlay */}
        {isMobile && isCartOpen ? (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
              onClick={() => setIsCartOpen(false)}
              aria-hidden="true"
            />
            {/* Drawer */}
            <aside className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-hidden rounded-t-[28px] border-t border-slate-200 bg-white/95 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-sm transition-transform duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-950/95">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />
              <div className="max-h-[calc(85vh-60px)] overflow-y-auto">
                <CartPanel />
              </div>
            </aside>
          </>
        ) : null}
      </div>

      {/* Floating Cart Button - visible when cart is closed and has items */}
      {!isCartOpen && cartItemCount > 0 ? (
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-30 flex items-center gap-3 rounded-full bg-slate-900 px-5 py-3 text-white shadow-2xl transition-all duration-200 hover:scale-105 hover:bg-slate-800 active:scale-95 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 sm:right-6 sm:px-6 sm:py-4"
        >
          <ShoppingCart className="h-5 w-5" />
          <span className="font-semibold">
            {cartItemCount} <span className="mx-1">-</span> {formatCurrency(summary.total)}
          </span>
        </button>
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

      {/* Payment Modal */}
      {paymentModalOpen ? (
        <Modal
          title="Cobrar venta"
          size="lg"
          onClose={closeChargeModal}
          className="max-h-[calc(100vh-2rem)] overflow-y-auto dark:bg-slate-950"
        >
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Cliente
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {selectedCustomer?.name ?? "Consumidor final"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Total
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                    {formatCurrency(summary.total)}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {payments.map((payment, index) => (
                <div
                  key={payment.id}
                  className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                      <CreditCard className="h-4 w-4" />
                      Metodo #{index + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => removePaymentRow(payment.id)}
                      className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                      disabled={payments.length === 1}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Select
                      label="Metodo"
                      value={payment.paymentMethodId}
                      onChange={(event) =>
                        updatePayment(
                          payment.id,
                          "paymentMethodId",
                          event.target.value
                        )
                      }
                    >
                      <option value="">Selecciona un metodo</option>
                      {paymentMethodOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>

                    <Input
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
              ))}

              <Button variant="outline" onClick={addPaymentRow} className="w-full">
                <Plus className="h-4 w-4" />
                Agregar metodo de pago
              </Button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
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

            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={closeChargeModal} disabled={processingSale}>
                Cancelar
              </Button>
              <Button isLoading={processingSale} onClick={() => void submitSale()}>
                Confirmar venta
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
};
