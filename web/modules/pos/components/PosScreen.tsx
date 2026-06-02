"use client";

import {
  ChevronDown,
  CreditCard,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  createDefaultCashPayment,
  findCashPaymentMethod,
  parsePaymentAmount,
  rebalanceCashPayment,
} from "../../shared/payments/payment-allocation.helper";

type CategoryKey = "all" | "available" | "low" | "out";

type PosItemTax = {
  id: string;
  name: string;
  rate: number;
  amount: number;
  isIncluded: boolean;
};

const categoryLabels: Record<CategoryKey, string> = {
  all: "Todos",
  available: "Con stock",
  low: "Stock bajo",
  out: "Sin stock",
};

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
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
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

  // New state for cart drawer visibility
  const [isCartOpen, setIsCartOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const activeBranchId = posBranchId ?? authUser?.branchId ?? null;
  const cartRef = useRef(cart);

  useAutoClearState(toastMessage, setToastMessage);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const setCartItemsAndRef = useCallback(
    (items: PosCartItem[]) => {
      cartRef.current = items;
      setCartItems(items);
    },
    [setCartItems]
  );

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

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  useEffect(() => {
    if (!activeBranchId) {
      setCatalogLoading(false);
      setCatalogError("No hay una sucursal POS activa para cargar inventario.");
      setProducts([]);
      return;
    }

    let active = true;

    const loadCatalog = async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      setCatalogWarnings([]);

        try {
          const [productsResult, customersResult, taxesResult] = await Promise.allSettled([
          getPosProducts(activeBranchId),
          getPosCustomers(),
          getPosTaxes(),
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

        setProducts(activeProducts);
        setCustomers(activeCustomers);
        setTaxes(activeTaxes);
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

  const createPaymentDraft = useCallback(
    (paymentMethodId: string, amount: string): PaymentDraft => ({
      id: buildPaymentId(),
      paymentMethodId,
      amount,
      reference: "",
    }),
    []
  );

  const categoryCounts = useMemo(() => {
    return {
      all: products.length,
      available: products.filter((product) => Number(product.stock ?? 0) > 0).length,
      low: products.filter((product) => isLowStock(Number(product.stock ?? 0))).length,
      out: products.filter((product) => Number(product.stock ?? 0) <= 0).length,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return products.filter((product) => {
      const stock = Number(product.stock ?? 0);
      const matchesCategory =
        activeCategory === "all"
          ? true
          : activeCategory === "available"
            ? stock > 0
            : activeCategory === "low"
              ? isLowStock(stock)
              : stock <= 0;

      if (!matchesCategory) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = normalizeText(
        `${product.name} ${product.sku} ${product.description ?? ""}`
      );
      return haystack.includes(normalizedQuery);
    });
  }, [activeCategory, products, query]);

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

  const addToCart = (product: ProductResponse) => {
    setSaleStatus("DRAFT");
    setSubmitError(null);

    const currentCart = cartRef.current;
    const existing = currentCart.find((item) => item.productId === product.id);
    const stock = Number(product.stock ?? 0);

    if (stock <= 0) {
      showToast("El producto no tiene stock disponible.", "warning");
      return;
    }

    if (existing) {
      if (existing.quantity >= stock) {
        showToast("No puedes superar el stock disponible.", "warning");
        return;
      }

      const nextQuantity = existing.quantity + 1;
      queueCartItemPricing(
        currentCart.map((item) =>
          item.productId === product.id ? { ...item, quantity: nextQuantity } : item
        ),
        product.id,
        nextQuantity
      );
      return;
    }

    const nextItem: PosCartItem = {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      quantity: 1,
      price: Number(product.price),
      stock,
      taxId: product.taxId ?? null,
      priceWithoutTax: Number(product.priceWithoutTax ?? product.price),
      baseUnitPrice: Number(product.price),
      basePriceWithoutTax: Number(product.priceWithoutTax ?? product.price),
    };
    queueCartItemPricing([...currentCart, nextItem], product.id, 1);
  };

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

  const openChargeModal = () => {
    setSubmitError(null);
    const result = createDefaultCashPayment(
      summary.total,
      paymentMethodsCatalog,
      createPaymentDraft
    );
    setPaymentWarning(result.error);
    setPayments(result.payments.length > 0 ? result.payments : buildDefaultPayments());
    setPaymentModalOpen(true);
  };

  const closeChargeModal = () => {
    if (processingSale) {
      return;
    }
    setPaymentModalOpen(false);
    setSubmitError(null);
  };

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
      await createSale({
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
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
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
            Toca un producto para empezar a construir la venta.
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {cartWithDerivedValues.map((item) => (
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
                            Number(event.target.value.replace(/[^\d]/g, "") || 0)
                          )
                        }
                        className="w-14 border-x border-slate-200 bg-transparent px-2 py-2 text-center text-sm font-semibold text-slate-900 focus:outline-none dark:border-slate-700 dark:text-white"
                        inputMode="numeric"
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
                      {item.discountTotal > 0 ? (
                        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                          Descuento {formatCurrency(item.discountTotal)}
                          {item.discountPercent ? ` (${item.discountPercent}%)` : ""}
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
              ))}
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
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
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

          <div className="grid gap-3 sm:grid-cols-3">
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

      {/* Main Layout - Split Screen */}
      <div className="flex gap-5">
        {/* Products Panel - Always visible */}
        <div className={`flex-1 transition-all duration-300 ${isCartOpen && !isMobile ? "xl:mr-[380px]" : ""}`}>
          <div className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-950/80">
            <div className="flex flex-col gap-4">
              {/* Search Input */}
              <div className="relative">
                <Input
                  label="Buscar productos"
                  placeholder="Nombre, SKU o descripcion"
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <Search className="pointer-events-none absolute left-3 top-[38px] h-4 w-4 text-slate-400" />
              </div>

              {/* Filter Chips */}
              <div className="flex flex-wrap gap-2">
                {(Object.keys(categoryLabels) as CategoryKey[]).map((category) => {
                  const isActive = activeCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 active:scale-95 ${
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span>{categoryLabels[category]}</span>
                      <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs dark:bg-white/10">
                        {categoryCounts[category]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Products Grid */}
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
                <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {filteredProducts.map((product) => {
                    const stock = Number(product.stock ?? 0);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addToCart(product)}
                        disabled={stock <= 0 || !canCreate}
                        className="group overflow-hidden rounded-[26px] border border-slate-200 bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:scale-100 dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="relative overflow-hidden border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.22),_transparent_52%),linear-gradient(135deg,_#f8fafc,_#e2e8f0)] p-5 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.28),_transparent_50%),linear-gradient(135deg,_#111827,_#1f2937)]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/80 text-lg font-semibold text-slate-900 shadow-sm backdrop-blur transition-transform duration-200 group-hover:scale-110 dark:bg-slate-950/60 dark:text-white">
                              {buildImageLabel(product.name)}
                            </div>
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getProductStockTone(
                                stock
                              )}`}
                            >
                              {stock <= 0
                                ? "Agotado"
                                : isLowStock(stock)
                                  ? "Stock bajo"
                                  : `Stock ${stock}`}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-3 p-5">
                          <div>
                            <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                              {product.name}
                            </h3>
                            <p className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              {product.sku}
                            </p>
                          </div>
                          <div className="flex items-end justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Precio final
                              </p>
                              <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                                {formatCurrency(Number(product.price))}
                              </p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition-colors group-hover:bg-slate-900 group-hover:text-white dark:bg-slate-800 dark:text-slate-200 dark:group-hover:bg-white dark:group-hover:text-slate-900">
                              +1 al carrito
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

        {/* Cart Panel - Desktop: Fixed sidebar, Mobile: Drawer overlay */}
        {/* Desktop Cart */}
        <aside
          className={`fixed right-0 top-0 z-40 hidden h-full w-[380px] transform border-l border-slate-200 bg-white/95 p-5 shadow-2xl backdrop-blur-sm transition-transform duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-950/95 xl:block ${
            isCartOpen ? "translate-x-0" : "translate-x-full"
          }`}
          style={{ marginTop: "0" }}
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
            <aside className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-hidden rounded-t-[28px] border-t border-slate-200 bg-white/95 p-5 shadow-2xl backdrop-blur-sm transition-transform duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-950/95">
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
          className="fixed bottom-6 right-6 z-30 flex items-center gap-3 rounded-full bg-slate-900 px-6 py-4 text-white shadow-2xl transition-all duration-200 hover:scale-105 hover:bg-slate-800 active:scale-95 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
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
