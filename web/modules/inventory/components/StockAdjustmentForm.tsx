"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { listBranches } from "../../../domains/branches/api";
import type { BranchResponse } from "../../../domains/branches/dtos";
import type { ProductResponse } from "../../../domains/products/dtos";
import { useInventoryScope } from "../../../hooks/useInventoryScope";
import { useAppSelector } from "../../../store/hooks";
import {
  listInventoryLocations,
  type InventoryLocationResponse,
} from "../services/inventory-location.service";
import {
  listInventoryLotBalances,
  listInventoryLots,
  type InventoryLotBalanceResponse,
  type InventoryLotResponse,
} from "../services/inventory-lot.service";
import { createStockAdjustment } from "../services/stock-adjustment.service";

type StockAdjustmentValues = {
  branchId: string;
  type: "IN" | "OUT";
  quantity: string;
  reason: string;
  lotCode: string;
  lotBalanceId: string;
  expirationDate: string;
  locationId: string;
  unitCost: string;
};

type StockAdjustmentErrors = Partial<Record<keyof StockAdjustmentValues, string>> & {
  submit?: string;
  lot?: string;
};

type StockAdjustmentFormProps = {
  product: ProductResponse;
  onCancel: () => void;
  onSuccess: () => void;
};

type AvailableLotOption = {
  balance: InventoryLotBalanceResponse;
  lot: InventoryLotResponse;
};

const getProductCostInput = (product: ProductResponse) =>
  Number.isFinite(Number(product.cost)) ? String(product.cost) : "";

const getTodayInputValue = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const today = getTodayInputValue();

const toDateInputValue = (value: string | null | undefined) =>
  value ? value.slice(0, 10) : "";

const buildInitialValues = (
  product: ProductResponse,
  branchId: string | null | undefined
): StockAdjustmentValues => ({
  branchId: product.branchId ?? branchId ?? "",
  type: "IN",
  quantity: "",
  reason: "",
  lotCode: "",
  lotBalanceId: "",
  expirationDate: "",
  locationId: "",
  unitCost: getProductCostInput(product),
});

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

const formatQuantity = (value: number | string | null | undefined) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric.toLocaleString("es-CO") : "0";
};

export const StockAdjustmentForm = ({
  product,
  onCancel,
  onSuccess,
}: StockAdjustmentFormProps) => {
  const { currentBranch, currentTenant } = useInventoryScope();
  const authBranchName = useAppSelector((state) => state.auth.user?.branchName ?? null);
  const [values, setValues] = useState<StockAdjustmentValues>(() =>
    buildInitialValues(product, currentBranch)
  );
  const [errors, setErrors] = useState<StockAdjustmentErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [locations, setLocations] = useState<InventoryLocationResponse[]>([]);
  const [lots, setLots] = useState<InventoryLotResponse[]>([]);
  const [lotBalances, setLotBalances] = useState<InventoryLotBalanceResponse[]>([]);
  const [loadingLotData, setLoadingLotData] = useState(false);
  const [lotDataError, setLotDataError] = useState<string | null>(null);

  const requiresLot = Boolean(product.requiresLot);
  const requiresExpiration = Boolean(product.requiresExpiration);
  const isPerishable = Boolean(product.isPerishable);

  useEffect(() => {
    setValues(buildInitialValues(product, currentBranch));
    setErrors({});
    setLotDataError(null);
    setLocations([]);
    setLots([]);
    setLotBalances([]);
  }, [currentBranch, product.id, product.branchId, product.cost]);

  useEffect(() => {
    let mounted = true;

    const loadBranches = async () => {
      if (!currentTenant) {
        return;
      }

      setLoadingBranches(true);
      try {
        const result = await listBranches({ tenantId: currentTenant });
        if (!mounted) {
          return;
        }
        setBranches(result.filter((branch) => branch.estado === "ACTIVE"));
      } catch {
        if (!mounted) {
          return;
        }
        setBranches([]);
      } finally {
        if (mounted) {
          setLoadingBranches(false);
        }
      }
    };

    void loadBranches();

    return () => {
      mounted = false;
    };
  }, [currentTenant]);

  useEffect(() => {
    let mounted = true;

    const loadLotData = async () => {
      if (!requiresLot || !values.branchId) {
        setLocations([]);
        setLots([]);
        setLotBalances([]);
        setLotDataError(null);
        return;
      }

      setLoadingLotData(true);
      setLotDataError(null);
      try {
        const [locationResult, lotResult, balanceResult] = await Promise.all([
          listInventoryLocations({ branchId: values.branchId, isActive: true }),
          values.type === "OUT"
            ? listInventoryLots({
                branchId: values.branchId,
                productId: product.id,
              })
            : Promise.resolve([] as InventoryLotResponse[]),
          values.type === "OUT"
            ? listInventoryLotBalances({
                branchId: values.branchId,
                productId: product.id,
                onlyAvailable: true,
              })
            : Promise.resolve([] as InventoryLotBalanceResponse[]),
        ]);

        if (!mounted) {
          return;
        }

        setLocations(locationResult);
        setLots(lotResult);
        setLotBalances(balanceResult);
      } catch {
        if (!mounted) {
          return;
        }
        setLocations([]);
        setLots([]);
        setLotBalances([]);
        setLotDataError("No se pudieron cargar lotes o ubicaciones para el ajuste.");
      } finally {
        if (mounted) {
          setLoadingLotData(false);
        }
      }
    };

    void loadLotData();

    return () => {
      mounted = false;
    };
  }, [product.id, requiresLot, values.branchId, values.type]);

  const selectedBranchName =
    branches.find((branch) => branch.id === values.branchId)?.nombre ??
    product.branchName ??
    authBranchName ??
    "";

  const locationIds = useMemo(
    () => new Set(locations.map((location) => location.id)),
    [locations]
  );

  const locationById = useMemo(() => {
    const map = new Map<string, InventoryLocationResponse>();
    locations.forEach((location) => map.set(location.id, location));
    return map;
  }, [locations]);

  const lotById = useMemo(() => {
    const map = new Map<string, InventoryLotResponse>();
    lots.forEach((lot) => map.set(lot.id, lot));
    return map;
  }, [lots]);

  const availableLotOptions = useMemo<AvailableLotOption[]>(() => {
    return lotBalances
      .map((balance) => {
        const lot = lotById.get(balance.lotId);
        if (!lot) {
          return null;
        }
        const available = Number(balance.quantityAvailable);
        if (!Number.isFinite(available) || available <= 0) {
          return null;
        }
        if (["BLOCKED", "CANCELLED", "CONSUMED"].includes(lot.status)) {
          return null;
        }
        return { balance, lot };
      })
      .filter((option): option is AvailableLotOption => option !== null);
  }, [lotBalances, lotById]);

  const selectedLotOption =
    availableLotOptions.find((option) => option.balance.id === values.lotBalanceId) ??
    null;

  const clearLotFieldsForType = (type: "IN" | "OUT") => ({
    lotCode: "",
    lotBalanceId: "",
    expirationDate: "",
    locationId: "",
    unitCost: type === "IN" ? getProductCostInput(product) : "",
  });

  const validate = () => {
    const nextErrors: StockAdjustmentErrors = {};

    if (!values.branchId) {
      nextErrors.branchId = "La sucursal es requerida.";
    }
    if (!values.type) {
      nextErrors.type = "El tipo es requerido.";
    }

    const quantity = Number(values.quantity);
    if (values.quantity.trim() === "" || Number.isNaN(quantity)) {
      nextErrors.quantity = "La cantidad es requerida.";
    } else if (quantity <= 0) {
      nextErrors.quantity = "La cantidad debe ser mayor a 0.";
    }

    if (!values.reason.trim()) {
      nextErrors.reason = "El motivo es requerido.";
    }

    if (requiresLot) {
      if (values.type === "IN") {
        if (!values.lotCode.trim()) {
          nextErrors.lotCode = "El lote es requerido.";
        }
        if (requiresExpiration && !values.expirationDate) {
          nextErrors.expirationDate = "La fecha de vencimiento es requerida.";
        }
        if (values.expirationDate && values.expirationDate < today) {
          nextErrors.expirationDate = "La fecha no puede ser anterior a hoy.";
        }
        if (values.unitCost.trim()) {
          const unitCost = Number(values.unitCost);
          if (!Number.isFinite(unitCost) || unitCost < 0) {
            nextErrors.unitCost = "El costo no puede ser negativo.";
          }
        }
        if (values.locationId && !locationIds.has(values.locationId)) {
          nextErrors.locationId = "La ubicacion seleccionada no es valida.";
        }
      } else {
        if (!values.lotBalanceId || !selectedLotOption) {
          nextErrors.lotBalanceId = "Selecciona un lote disponible.";
        } else if (quantity > Number(selectedLotOption.balance.quantityAvailable)) {
          nextErrors.quantity = "La cantidad no puede superar el disponible del lote.";
        }
      }
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
        productId: product.id,
        branchId: values.branchId,
        type: values.type,
        quantity: Number(values.quantity),
        reason: values.reason.trim(),
        ...(requiresLot && values.type === "IN"
          ? {
              lotCode: values.lotCode.trim().toUpperCase(),
              expirationDate: values.expirationDate || undefined,
              locationId: values.locationId || undefined,
              unitCost: values.unitCost.trim() ? Number(values.unitCost) : undefined,
            }
          : {}),
        ...(requiresLot && values.type === "OUT" && selectedLotOption
          ? {
              lotId: selectedLotOption.lot.id,
              lotCode: selectedLotOption.lot.lotCode,
              expirationDate:
                toDateInputValue(selectedLotOption.lot.expirationDate) || undefined,
              locationId: selectedLotOption.balance.locationId ?? undefined,
            }
          : {}),
      };

      await createStockAdjustment(payload);
      onSuccess();
    } catch (error) {
      setErrors({
        submit: getErrorMessage(error, "No se pudo registrar el ajuste de stock."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Stock</p>
          <h2 className="text-xl font-semibold text-slate-900">Ajustar stock</h2>
          <p className="mt-2 text-sm text-slate-600">
            Producto: <span className="font-medium text-slate-900">{product.name}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">{product.sku}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
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
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>

      <form className="grid gap-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1 md:col-span-3">
            <Select
              label="Sucursal"
              required
              value={values.branchId}
              disabled={loadingBranches || branches.length === 0}
              onChange={(event) => {
                const value = event.target.value;
                setValues((prev) => ({
                  ...prev,
                  branchId: value,
                  ...clearLotFieldsForType(prev.type),
                }));
                setErrors((prev) => ({
                  ...prev,
                  branchId: undefined,
                  lot: undefined,
                  submit: undefined,
                }));
              }}
            >
              <option value="">
                {loadingBranches ? "Cargando sucursales..." : "Selecciona una sucursal"}
              </option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.nombre}
                </option>
              ))}
            </Select>
            {selectedBranchName && values.branchId ? (
              <p className="text-xs text-slate-500">Movimiento para: {selectedBranchName}</p>
            ) : null}
            {errors.branchId ? <p className="text-xs text-rose-600">{errors.branchId}</p> : null}
          </div>

          <div className="space-y-1">
            <Select
              label="Tipo"
              value={values.type}
              onChange={(event) => {
                const value = event.target.value as "IN" | "OUT";
                setValues((prev) => ({
                  ...prev,
                  type: value,
                  ...clearLotFieldsForType(value),
                }));
                setErrors((prev) => ({
                  ...prev,
                  type: undefined,
                  lot: undefined,
                  lotCode: undefined,
                  lotBalanceId: undefined,
                  expirationDate: undefined,
                  locationId: undefined,
                  unitCost: undefined,
                  submit: undefined,
                }));
              }}
            >
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
            </Select>
            {errors.type ? <p className="text-xs text-rose-600">{errors.type}</p> : null}
          </div>

          <div className="space-y-1">
            <Input
              label="Cantidad"
              required
              type="number"
              min="0"
              step="0.01"
              value={values.quantity}
              onChange={(event) => {
                const value = event.target.value;
                setValues((prev) => ({ ...prev, quantity: value }));
                setErrors((prev) => ({ ...prev, quantity: undefined, submit: undefined }));
              }}
            />
            {errors.quantity ? <p className="text-xs text-rose-600">{errors.quantity}</p> : null}
          </div>

          <div className="space-y-1 md:col-span-3">
            <Input
              label="Motivo"
              required
              value={values.reason}
              onChange={(event) => {
                const value = event.target.value;
                setValues((prev) => ({ ...prev, reason: value }));
                setErrors((prev) => ({ ...prev, reason: undefined, submit: undefined }));
              }}
              placeholder="Ej: Ajuste manual de inventario"
            />
            {errors.reason ? <p className="text-xs text-rose-600">{errors.reason}</p> : null}
          </div>
        </div>

        {requiresLot ? (
          <section className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
            <div className="mb-4">
              <p className="text-sm font-semibold text-blue-950">Datos de lote</p>
              <p className="mt-1 text-xs text-blue-700">
                {values.type === "IN"
                  ? "Este ajuste puede crear o reutilizar un lote."
                  : "Para salida de producto loteado, selecciona el lote disponible."}
              </p>
            </div>

            {lotDataError ? (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                {lotDataError}
              </div>
            ) : null}

            {values.type === "IN" ? (
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <Input
                    label="Lote"
                    required
                    value={values.lotCode}
                    onChange={(event) => {
                      setValues((prev) => ({
                        ...prev,
                        lotCode: event.target.value.toUpperCase(),
                      }));
                      setErrors((prev) => ({ ...prev, lotCode: undefined, submit: undefined }));
                    }}
                  />
                  {errors.lotCode ? (
                    <p className="text-xs text-rose-600">{errors.lotCode}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Input
                    label="Fecha de vencimiento"
                    type="date"
                    required={requiresExpiration}
                    min={today}
                    value={values.expirationDate}
                    onChange={(event) => {
                      setValues((prev) => ({ ...prev, expirationDate: event.target.value }));
                      setErrors((prev) => ({
                        ...prev,
                        expirationDate: undefined,
                        submit: undefined,
                      }));
                    }}
                  />
                  {errors.expirationDate ? (
                    <p className="text-xs text-rose-600">{errors.expirationDate}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Select
                    label="Ubicacion"
                    value={values.locationId}
                    disabled={loadingLotData}
                    onChange={(event) => {
                      setValues((prev) => ({ ...prev, locationId: event.target.value }));
                      setErrors((prev) => ({ ...prev, locationId: undefined, submit: undefined }));
                    }}
                  >
                    <option value="">Sin ubicacion</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.code} - {location.name}
                      </option>
                    ))}
                  </Select>
                  {errors.locationId ? (
                    <p className="text-xs text-rose-600">{errors.locationId}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Input
                    label="Costo unitario"
                    type="number"
                    min="0"
                    step="0.01"
                    value={values.unitCost}
                    onChange={(event) => {
                      setValues((prev) => ({ ...prev, unitCost: event.target.value }));
                      setErrors((prev) => ({ ...prev, unitCost: undefined, submit: undefined }));
                    }}
                  />
                  {errors.unitCost ? (
                    <p className="text-xs text-rose-600">{errors.unitCost}</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                <div className="space-y-1">
                  <Select
                    label="Lote disponible"
                    required
                    value={values.lotBalanceId}
                    disabled={loadingLotData || availableLotOptions.length === 0}
                    onChange={(event) => {
                      const balanceId = event.target.value;
                      const option = availableLotOptions.find(
                        (availableOption) => availableOption.balance.id === balanceId
                      );
                      setValues((prev) => ({
                        ...prev,
                        lotBalanceId: balanceId,
                        lotCode: option?.lot.lotCode ?? "",
                        expirationDate: toDateInputValue(option?.lot.expirationDate),
                        locationId: option?.balance.locationId ?? "",
                      }));
                      setErrors((prev) => ({
                        ...prev,
                        lotBalanceId: undefined,
                        quantity: undefined,
                        submit: undefined,
                      }));
                    }}
                  >
                    <option value="">
                      {loadingLotData ? "Cargando lotes..." : "Selecciona un lote"}
                    </option>
                    {availableLotOptions.map(({ balance, lot }) => {
                      const location = balance.locationId
                        ? locationById.get(balance.locationId)
                        : null;
                      const locationLabel = location
                        ? `${location.code} - ${location.name}`
                        : "Sin ubicacion";
                      return (
                        <option key={balance.id} value={balance.id}>
                          {lot.lotCode} |{" "}
                          {toDateInputValue(lot.expirationDate) || "Sin vencimiento"} |{" "}
                          {locationLabel} | Disponible {formatQuantity(balance.quantityAvailable)}
                        </option>
                      );
                    })}
                  </Select>
                  {availableLotOptions.length === 0 && !loadingLotData ? (
                    <p className="text-xs text-amber-700">
                      No hay saldos disponibles para salida en esta sucursal.
                    </p>
                  ) : null}
                  {errors.lotBalanceId ? (
                    <p className="text-xs text-rose-600">{errors.lotBalanceId}</p>
                  ) : null}
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Disponible</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {selectedLotOption
                      ? formatQuantity(selectedLotOption.balance.quantityAvailable)
                      : "0"}
                  </p>
                  {selectedLotOption ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedLotOption.balance.locationId
                        ? locationById.get(selectedLotOption.balance.locationId)?.name ??
                          selectedLotOption.balance.locationId
                        : "Sin ubicacion"}
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </section>
        ) : null}

        {errors.submit ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errors.submit}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" isLoading={isSubmitting}>
            Guardar ajuste
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
};
