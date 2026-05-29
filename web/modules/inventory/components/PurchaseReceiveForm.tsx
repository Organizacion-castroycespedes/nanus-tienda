"use client";

import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
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

type ReceiveItemValue = {
  productId: string;
  purchaseItemId: string;
  quantity: string;
  lotCode: string;
  expirationDate: string;
  locationId: string;
  unitCost: string;
};

type ReceiveFormErrors = {
  items?: string;
  submit?: string;
};

type PurchaseReceiveFormProps = {
  purchaseId: string;
  onCancel: () => void;
  onSuccess: (response?: PurchaseResponse) => void;
  onError?: (error: unknown) => void;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

const getTodayInputValue = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const today = getTodayInputValue();

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

const isReceivePayloadItem = (
  item: ReceivePurchasePayload["items"][number] | null
): item is ReceivePurchasePayload["items"][number] => item !== null;

export const PurchaseReceiveForm = ({
  purchaseId,
  onCancel,
  onSuccess,
  onError,
}: PurchaseReceiveFormProps) => {
  const [purchase, setPurchase] = useState<PurchaseDetailResponse | null>(null);
  const [values, setValues] = useState<ReceiveItemValue[]>([]);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [locations, setLocations] = useState<InventoryLocationResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lookupWarning, setLookupWarning] = useState<string | null>(null);
  const [errors, setErrors] = useState<ReceiveFormErrors>({});

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
        setValues(
          result.items.map((item) => ({
            productId: item.productId,
            purchaseItemId: item.id,
            quantity: "",
            lotCode: "",
            expirationDate: "",
            locationId: "",
            unitCost: Number.isFinite(Number(item.cost)) ? String(item.cost) : "",
          }))
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
  }, [purchaseId]);

  const productById = useMemo(() => {
    const map = new Map<string, ProductResponse>();
    products.forEach((product) => map.set(product.id, product));
    return map;
  }, [products]);

  const locationIds = useMemo(
    () => new Set(locations.map((location) => location.id)),
    [locations]
  );

  const rows = useMemo(() => {
    if (!purchase) {
      return [];
    }

    return purchase.items.map((item, index) => {
      const pending = Math.max(item.orderedQuantity - item.receivedQuantity, 0);
      return {
        item,
        index,
        pending,
      };
    });
  }, [purchase]);

  const isBlockedStatus =
    purchase?.status === "CANCELLED" ||
    purchase?.status === "RECEIVED" ||
    purchase?.status === "CERRADA_PARCIAL";

  const validate = () => {
    const nextErrors: ReceiveFormErrors = {};

    if (isBlockedStatus) {
      nextErrors.items = "No se puede recibir una compra cancelada, recibida o cerrada parcial.";
      setErrors(nextErrors);
      return false;
    }

    const hasAnyQuantity = values.some((value) => {
      const quantity = Number(value.quantity);
      return Number.isFinite(quantity) && quantity > 0;
    });

    const itemErrors: string[] = [];

    const hasInvalidQuantity = rows.some(({ item, pending }, index) => {
      const quantity = Number(values[index]?.quantity ?? "");
      if (!Number.isFinite(quantity) || quantity === 0) {
        return false;
      }

      const product = productById.get(item.productId);
      const requiresLot = Boolean(product?.requiresLot ?? item.requiresLot);
      const requiresExpiration = Boolean(
        product?.requiresExpiration ?? item.requiresExpiration
      );
      const value = values[index];

      if (requiresLot && quantity > 0) {
        if (!value?.lotCode.trim()) {
          itemErrors.push(`${item.productName || item.productId}: lote requerido.`);
        }
        if (requiresExpiration && !value?.expirationDate) {
          itemErrors.push(
            `${item.productName || item.productId}: fecha de vencimiento requerida.`
          );
        }
        if (value?.expirationDate && value.expirationDate < today) {
          itemErrors.push(
            `${item.productName || item.productId}: vencimiento no puede ser anterior a hoy.`
          );
        }
        if (value?.unitCost) {
          const unitCost = Number(value.unitCost);
          if (!Number.isFinite(unitCost) || unitCost < 0) {
            itemErrors.push(`${item.productName || item.productId}: costo no valido.`);
          }
        }
        if (value?.locationId && !locationIds.has(value.locationId)) {
          itemErrors.push(`${item.productName || item.productId}: ubicacion no valida.`);
        }
      }

      return quantity < 0 || quantity > pending;
    });

    if (!hasAnyQuantity) {
      nextErrors.items = "Debes ingresar al menos una cantidad a recibir.";
    } else if (hasInvalidQuantity) {
      nextErrors.items =
        "Las cantidades a recibir deben ser mayores a 0 y no pueden exceder el pendiente.";
    } else if (itemErrors.length > 0) {
      nextErrors.items = itemErrors.join(" ");
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

            const product = productById.get(item.productId);
            const requiresLot = Boolean(product?.requiresLot ?? item.requiresLot);
            const value = values[index];
            const payloadItem: ReceivePurchasePayload["items"][number] = {
              product_id: item.productId,
              productId: item.productId,
              purchaseItemId: item.id,
              quantity,
              receivedQuantity: quantity,
            };

            if (!requiresLot) {
              return payloadItem;
            }

            return {
              ...payloadItem,
              lotCode: value.lotCode.trim().toUpperCase(),
              expirationDate: value.expirationDate || undefined,
              locationId: value.locationId || undefined,
              unitCost: value.unitCost ? Number(value.unitCost) : undefined,
            };
          })
          .filter(isReceivePayloadItem),
      };

      const response = await receivePurchase(purchaseId, payload);
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

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Purchases</p>
          <h2 className="text-xl font-semibold text-slate-900">Recibir compra</h2>
          <p className="mt-2 text-sm text-slate-600">
            Registra las cantidades realmente recibidas por producto.
          </p>
        </div>
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting} className="w-full sm:w-auto">
          Volver
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          Cargando detalle de la compra...
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      ) : purchase ? (
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Proveedor</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {purchase.supplierName || purchase.supplierId}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Sucursal</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {purchase.branchName || purchase.branchId || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Estado</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{purchase.status}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Tipo</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{purchase.type}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Terminal</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {purchase.terminalName || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
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

          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-[920px] divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 font-medium">Pedido</th>
                    <th className="px-4 py-3 font-medium">Recibido acumulado</th>
                    <th className="px-4 py-3 font-medium">Pendiente</th>
                    <th className="px-4 py-3 font-medium">Recibir ahora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ item, index, pending }) => {
                    const product = productById.get(item.productId);
                    const requiresLot = Boolean(product?.requiresLot ?? item.requiresLot);
                    const requiresExpiration = Boolean(
                      product?.requiresExpiration ?? item.requiresExpiration
                    );
                    const isPerishable = Boolean(product?.isPerishable ?? item.isPerishable);
                    const value = values[index];

                    return (
                      <Fragment key={item.id}>
                        <tr>
                          <td className="px-4 py-3 text-slate-900">
                            <div className="space-y-2">
                              <div>
                                <p className="font-medium">{item.productName || product?.name || item.productId}</p>
                                <p className="text-xs text-slate-500">
                                  {product?.sku || item.productSku || item.productId}
                                </p>
                              </div>
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
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{item.orderedQuantity}</td>
                          <td className="px-4 py-3 text-slate-700">{item.receivedQuantity}</td>
                          <td className="px-4 py-3 text-slate-700">{pending}</td>
                          <td className="px-4 py-3">
                            <Input
                              label=""
                              type="number"
                              min="0"
                              step="0.01"
                              max={String(pending)}
                              placeholder="0"
                              value={value?.quantity ?? ""}
                              onChange={(event) => {
                                const rawValue = event.target.value;
                                const numericValue = Number(rawValue);
                                const nextValue =
                                  rawValue === "" || !Number.isFinite(numericValue)
                                    ? rawValue
                                    : String(Math.min(Math.max(numericValue, 0), pending));
                                setValues((prev) =>
                                  prev.map((currentValue, valueIndex) =>
                                    valueIndex === index
                                      ? { ...currentValue, quantity: nextValue }
                                      : currentValue
                                  )
                                );
                                setErrors((prev) => ({
                                  ...prev,
                                  items: undefined,
                                  submit: undefined,
                                }));
                              }}
                              disabled={isBlockedStatus || pending <= 0}
                            />
                          </td>
                        </tr>
                        {requiresLot ? (
                          <tr className="bg-blue-50/40">
                            <td colSpan={5} className="px-4 py-4">
                              <div className="space-y-3">
                                <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
                                  Este producto requiere lote para recibir inventario.
                                  {requiresExpiration
                                    ? " Tambien requiere fecha de vencimiento."
                                    : ""}
                                </p>
                                <div className="grid gap-3 md:grid-cols-4">
                                  <Input
                                    label="Lote"
                                    required
                                    value={value?.lotCode ?? ""}
                                    onChange={(event) => {
                                      const nextValue = event.target.value.toUpperCase();
                                      setValues((prev) =>
                                        prev.map((currentValue, valueIndex) =>
                                          valueIndex === index
                                            ? { ...currentValue, lotCode: nextValue }
                                            : currentValue
                                        )
                                      );
                                      setErrors((prev) => ({
                                        ...prev,
                                        items: undefined,
                                        submit: undefined,
                                      }));
                                    }}
                                  />
                                  <Input
                                    label="Fecha de vencimiento"
                                    type="date"
                                    required={requiresExpiration}
                                    min={today}
                                    value={value?.expirationDate ?? ""}
                                    onChange={(event) => {
                                      setValues((prev) =>
                                        prev.map((currentValue, valueIndex) =>
                                          valueIndex === index
                                            ? {
                                                ...currentValue,
                                                expirationDate: event.target.value,
                                              }
                                            : currentValue
                                        )
                                      );
                                      setErrors((prev) => ({
                                        ...prev,
                                        items: undefined,
                                        submit: undefined,
                                      }));
                                    }}
                                  />
                                  <Select
                                    label="Ubicacion"
                                    value={value?.locationId ?? ""}
                                    onChange={(event) => {
                                      setValues((prev) =>
                                        prev.map((currentValue, valueIndex) =>
                                          valueIndex === index
                                            ? { ...currentValue, locationId: event.target.value }
                                            : currentValue
                                        )
                                      );
                                      setErrors((prev) => ({
                                        ...prev,
                                        items: undefined,
                                        submit: undefined,
                                      }));
                                    }}
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
                                    value={value?.unitCost ?? ""}
                                    onChange={(event) => {
                                      setValues((prev) =>
                                        prev.map((currentValue, valueIndex) =>
                                          valueIndex === index
                                            ? { ...currentValue, unitCost: event.target.value }
                                            : currentValue
                                        )
                                      );
                                      setErrors((prev) => ({
                                        ...prev,
                                        items: undefined,
                                        submit: undefined,
                                      }));
                                    }}
                                  />
                                </div>
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
          </section>

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

          <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-medium text-amber-950">Confirmar recepcion</p>
            <p className="mt-1">
              Al guardar, se registrara la recepcion parcial de esta compra y se actualizara
              el inventario con las cantidades ingresadas.
            </p>
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button type="submit" isLoading={isSubmitting} disabled={isBlockedStatus} className="w-full sm:w-auto">
              Confirmar recepcion
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting} className="w-full sm:w-auto">
              Volver
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
};
