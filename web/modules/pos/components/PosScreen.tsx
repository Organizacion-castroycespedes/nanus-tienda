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
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import { Select } from "../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../components/design-system/Toast";
import { useAppSelector } from "../../../store/hooks";
import { useAutoClearState } from "../../../lib/useAutoClearState";
import { hasPermission } from "../../../lib/permissions";
import {
  createSale,
  getPosCustomers,
  getPosProducts,
  getPosTaxes,
  type PosSalePayload,
} from "../services/pos.service";
import type { ProductResponse } from "../../../domains/products/dtos";
import type { CustomerResponse } from "../../inventory/services/customer.service";
import type { TaxResponse } from "../../inventory/services/tax.service";

type CategoryKey = "all" | "available" | "low" | "out";

type PaymentMethodType = "CASH" | "CARD" | "TRANSFER";

type PaymentDraft = {
  id: string;
  paymentMethod: PaymentMethodType;
  amount: string;
  reference: string;
};

type PosCartItem = {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  stock: number;
  taxId: string | null;
  priceWithoutTax: number;
};

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

const paymentMethodOptions: Array<{
  value: PaymentMethodType;
  label: string;
}> = [
  { value: "CASH", label: "Efectivo" },
  { value: "CARD", label: "Tarjeta" },
  { value: "TRANSFER", label: "Transferencia" },
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

const round = (value: number) => Number(value.toFixed(2));

const parseAmount = (value: string) => {
  const sanitized = value.replace(",", ".").replace(/[^0-9.]/g, "");
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? round(parsed) : 0;
};

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

const buildPaymentId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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

export const PosScreen = () => {
  const authUser = useAppSelector((state) => state.auth.user);
  const canRead = hasPermission("pos.read");
  const canCreate = hasPermission("pos.create");

  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [customers, setCustomers] = useState<CustomerResponse[]>([]);
  const [taxes, setTaxes] = useState<TaxResponse[]>([]);
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [expandedTaxItems, setExpandedTaxItems] = useState<Record<string, boolean>>({});
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentDraft[]>([
    {
      id: buildPaymentId(),
      paymentMethod: "CASH",
      amount: "",
      reference: "",
    },
  ]);
  const [processingSale, setProcessingSale] = useState(false);
  const [saleStatus, setSaleStatus] = useState<"DRAFT" | "CONFIRMED">("DRAFT");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useAutoClearState(toastMessage, setToastMessage);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  useEffect(() => {
    let active = true;

    const loadCatalog = async () => {
      setCatalogLoading(true);
      setCatalogError(null);

      try {
        const [productsResult, customersResult, taxesResult] = await Promise.all([
          getPosProducts(),
          getPosCustomers(),
          getPosTaxes(),
        ]);

        if (!active) {
          return;
        }

        const activeProducts = productsResult.filter((product) => product.isActive);
        const activeCustomers = customersResult.filter((customer) => customer.isActive);
        const activeTaxes = taxesResult.filter((tax) => tax.isActive);

        setProducts(activeProducts);
        setCustomers(activeCustomers);
        setTaxes(activeTaxes);

        const defaultCustomer =
          activeCustomers.find((customer) =>
            normalizeText(customer.name).includes("consumidor final")
          ) ?? activeCustomers[0] ?? null;

        setSelectedCustomerId(defaultCustomer?.id ?? null);
      } catch {
        if (!active) {
          return;
        }
        setCatalogError(
          "No se pudo cargar el catalogo de POS. Verifica productos, clientes e impuestos."
        );
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
      const subtotal = round(item.price * item.quantity);
      const tax = item.taxId ? taxById[item.taxId] : null;
      const perUnitTaxAmount = round(item.price - item.priceWithoutTax);
      const itemTaxes: PosItemTax[] = tax
        ? [
            {
              id: tax.id,
              name: tax.name,
              rate: tax.rate,
              amount: round(perUnitTaxAmount * item.quantity),
              isIncluded: tax.isIncluded,
            },
          ]
        : [];

      const taxTotal = round(itemTaxes.reduce((sum, current) => sum + current.amount, 0));

      return {
        ...item,
        subtotal,
        taxes: itemTaxes,
        taxTotal,
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

    return {
      subtotal,
      taxesTotal,
      total: subtotal,
    };
  }, [cartWithDerivedValues]);

  const parsedPayments = useMemo(
    () =>
      payments.map((payment) => ({
        ...payment,
        numericAmount: parseAmount(payment.amount),
      })),
    [payments]
  );

  const totalPaid = useMemo(
    () => round(parsedPayments.reduce((sum, payment) => sum + payment.numericAmount, 0)),
    [parsedPayments]
  );

  const totalCashEntered = useMemo(
    () =>
      round(
        parsedPayments
          .filter((payment) => payment.paymentMethod === "CASH")
          .reduce((sum, payment) => sum + payment.numericAmount, 0)
      ),
    [parsedPayments]
  );

  const totalNonCashPaid = useMemo(
    () =>
      round(
        parsedPayments
          .filter((payment) => payment.paymentMethod !== "CASH")
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

  const canCharge = canRead && canCreate && cartWithDerivedValues.length > 0;

  const addToCart = (product: ProductResponse) => {
    setSaleStatus("DRAFT");
    setSubmitError(null);

    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      const stock = Number(product.stock ?? 0);

      if (stock <= 0) {
        showToast("El producto no tiene stock disponible.", "warning");
        return current;
      }

      if (existing) {
        if (existing.quantity >= stock) {
          showToast("No puedes superar el stock disponible.", "warning");
          return current;
        }

        return current.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          quantity: 1,
          price: Number(product.price),
          stock,
          taxId: product.taxId ?? null,
          priceWithoutTax: Number(product.priceWithoutTax ?? product.price),
        },
      ];
    });
  };

  const updateQuantity = (productId: string, nextQuantity: number) => {
    setSaleStatus("DRAFT");
    setSubmitError(null);

    setCart((current) =>
      current.flatMap((item) => {
        if (item.productId !== productId) {
          return [item];
        }

        if (nextQuantity <= 0) {
          return [];
        }

        const safeQuantity = Math.min(nextQuantity, item.stock);
        return [{ ...item, quantity: safeQuantity }];
      })
    );
  };

  const removeCartItem = (productId: string) => {
    setSaleStatus("DRAFT");
    setSubmitError(null);
    setCart((current) => current.filter((item) => item.productId !== productId));
  };

  const toggleTaxBreakdown = (productId: string) => {
    setExpandedTaxItems((current) => ({
      ...current,
      [productId]: !current[productId],
    }));
  };

  const resetPayments = () => {
    setPayments([
      {
        id: buildPaymentId(),
        paymentMethod: "CASH",
        amount: "",
        reference: "",
      },
    ]);
  };

  const openChargeModal = () => {
    setSubmitError(null);
    resetPayments();
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
    field: "paymentMethod" | "amount" | "reference",
    value: string
  ) => {
    setSubmitError(null);
    setPayments((current) =>
      current.map((payment) =>
        payment.id === id ? { ...payment, [field]: value } : payment
      )
    );
  };

  const addPaymentRow = () => {
    setPayments((current) => [
      ...current,
      {
        id: buildPaymentId(),
        paymentMethod: "CARD",
        amount: "",
        reference: "",
      },
    ]);
  };

  const removePaymentRow = (id: string) => {
    setPayments((current) =>
      current.length === 1 ? current : current.filter((payment) => payment.id !== id)
    );
  };

  const buildEffectivePayments = () => {
    const basePayments = parsedPayments.filter((payment) => payment.numericAmount > 0);

    if (paymentDerivedState.overpayment <= 0) {
      return basePayments.map((payment) => ({
        paymentMethod: payment.paymentMethod,
        amount: payment.numericAmount,
        reference: payment.reference.trim() || null,
      }));
    }

    let remainingChange = paymentDerivedState.overpayment;

    return basePayments
      .map((payment) => {
        if (payment.paymentMethod !== "CASH" || remainingChange <= 0) {
          return {
            paymentMethod: payment.paymentMethod,
            amount: payment.numericAmount,
            reference: payment.reference.trim() || null,
          };
        }

        const adjustedAmount = round(
          Math.max(payment.numericAmount - remainingChange, 0)
        );
        remainingChange = round(Math.max(remainingChange - payment.numericAmount, 0));

        return {
          paymentMethod: payment.paymentMethod,
          amount: adjustedAmount,
          reference: payment.reference.trim() || null,
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

    if (paymentDerivedState.overpayment > 0 && totalCashEntered <= 0) {
      return "El cambio solo puede calcularse cuando existe un pago en efectivo.";
    }

    if (paymentDerivedState.overpayment > 0 && totalNonCashPaid > summary.total) {
      return "Los pagos no en efectivo no pueden exceder el total de la venta.";
    }

    const hasInvalidPayments = parsedPayments.some(
      (payment) => payment.amount.trim() !== "" && payment.numericAmount <= 0
    );
    if (hasInvalidPayments) {
      return "Los metodos de pago deben tener montos mayores a cero.";
    }

    if (paymentDerivedState.pending === 0 && totalPaid === 0) {
      return "Registra al menos un metodo de pago para una venta al contado.";
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
          price: item.price,
        })),
        paymentMethods: effectivePayments.map((payment) => ({
          paymentMethod: payment.paymentMethod,
          amount: payment.amount,
          reference: payment.reference,
        })),
      });

      setSaleStatus("CONFIRMED");
      setCart([]);
      setExpandedTaxItems({});
      setPaymentModalOpen(false);
      resetPayments();
      showToast("Venta confirmada correctamente.", "success");

      try {
        const productsResult = await getPosProducts();
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

  return (
    <div className="space-y-5">
      {toastMessage ? (
        <Toast
          message={toastMessage}
          variant={toastVariant}
          onClose={() => setToastMessage(null)}
        />
      ) : null}

      <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-950/80">
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
                className="mt-1 flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-slate-900 dark:text-white"
              >
                <span className="truncate">
                  {customerPickerOpen ? "Ocultar selector" : "Seleccionar cliente"}
                </span>
                <span className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                  {selectedCustomer?.name ?? "Consumidor final"}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-500" />
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
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
          {catalogError}
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <div className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-950/80">
          <div className="flex flex-col gap-4">
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

            <div className="flex flex-wrap gap-2">
              {(Object.keys(categoryLabels) as CategoryKey[]).map((category) => {
                const isActive = activeCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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
                      className="group overflow-hidden rounded-[26px] border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="relative overflow-hidden border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.22),_transparent_52%),linear-gradient(135deg,_#f8fafc,_#e2e8f0)] p-5 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.28),_transparent_50%),linear-gradient(135deg,_#111827,_#1f2937)]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/80 text-lg font-semibold text-slate-900 shadow-sm backdrop-blur dark:bg-slate-950/60 dark:text-white">
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
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
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

        <aside className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-950/80">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Carrito
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
                Venta actual
              </h2>
            </div>
            <div className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
              {cartWithDerivedValues.length} items
            </div>
          </div>

          <div className="mt-4 flex min-h-[540px] flex-col">
            {cartWithDerivedValues.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <ShoppingCart className="mb-3 h-8 w-8" />
                Toca un producto para empezar a construir la venta.
              </div>
            ) : (
              <>
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
                            className="rounded-l-full px-3 py-2 text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
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
                            className="rounded-r-full px-3 py-2 text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="text-sm text-slate-600 dark:text-slate-300">
                          <p>{formatCurrency(item.price)} c/u</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Stock disponible: {item.stock}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Subtotal
                          </p>
                          <p className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
                            {formatCurrency(item.subtotal)}
                          </p>
                        </div>
                      </div>

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
                              className={`h-4 w-4 transition ${
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

                <div className="mt-4 space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                  <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                    <span>Subtotal</span>
                    <span>{formatCurrency(summary.subtotal - summary.taxesTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                    <span>Impuestos</span>
                    <span>{formatCurrency(summary.taxesTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-lg font-semibold text-slate-950 dark:border-slate-800 dark:text-white">
                    <span>Total final</span>
                    <span>{formatCurrency(summary.total)}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <Button
                    className="min-h-14 w-full rounded-2xl text-base"
                    size="lg"
                    onClick={openChargeModal}
                    disabled={!canCharge}
                  >
                    <Wallet className="h-5 w-5" />
                    COBRAR
                  </Button>
                </div>
              </>
            )}
          </div>
        </aside>
      </section>

      {paymentModalOpen ? (
        <Modal
          title="Cobrar venta"
          className="max-w-3xl dark:bg-slate-950"
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
                      value={payment.paymentMethod}
                      onChange={(event) =>
                        updatePayment(
                          payment.id,
                          "paymentMethod",
                          event.target.value
                        )
                      }
                    >
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
                      label="Referencia"
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
            </div>

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
