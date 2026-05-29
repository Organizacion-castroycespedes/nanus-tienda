"use client";

import { Ban, Pencil, Plus, RefreshCw, Star } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { ConfirmationMessage } from "../../../components/design-system/confirmation-message";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import type {
  ProductBarcode,
  ProductBarcodeType,
} from "../../../domains/products/dtos";
import {
  createProductBarcode,
  deactivateProductBarcode,
  listProductBarcodes,
  setPrimaryProductBarcode,
  updateProductBarcode,
} from "../services/product.service";

type ProductBarcodePanelProps = {
  productId: string;
  productName: string;
};

type BarcodeFormValues = {
  barcode: string;
  barcodeType: ProductBarcodeType;
  isPrimary: boolean;
};

type BarcodeFormErrors = Partial<Record<keyof BarcodeFormValues, string>> & {
  submit?: string;
};

const barcodeTypeOptions: Array<{ value: ProductBarcodeType; label: string }> = [
  { value: "UNIT", label: "Unidad" },
  { value: "PACKAGE", label: "Paquete" },
  { value: "BOX", label: "Caja" },
  { value: "SUPPLIER", label: "Proveedor" },
  { value: "INTERNAL", label: "Interno" },
  { value: "OTHER", label: "Otro" },
];

const defaultFormValues: BarcodeFormValues = {
  barcode: "",
  barcodeType: "UNIT",
  isPrimary: false,
};

const barcodeTypeLabels = barcodeTypeOptions.reduce<Record<ProductBarcodeType, string>>(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {} as Record<ProductBarcodeType, string>
);

const formatBarcodeError = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "No se pudo completar la operacion de codigo de barras.";
};

export const ProductBarcodePanel = ({
  productId,
  productName,
}: ProductBarcodePanelProps) => {
  const [barcodes, setBarcodes] = useState<ProductBarcode[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBarcode, setEditingBarcode] = useState<ProductBarcode | null>(null);
  const [values, setValues] = useState<BarcodeFormValues>(defaultFormValues);
  const [errors, setErrors] = useState<BarcodeFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState<ProductBarcode | null>(null);
  const [pendingPrimary, setPendingPrimary] = useState<ProductBarcode | null>(null);

  const activeBarcodes = useMemo(
    () => barcodes.filter((barcode) => barcode.isActive).length,
    [barcodes]
  );

  const resetForm = () => {
    setShowForm(false);
    setEditingBarcode(null);
    setValues(defaultFormValues);
    setErrors({});
  };

  const loadBarcodes = async () => {
    setLoading(true);
    setErrors((prev) => ({ ...prev, submit: undefined }));
    try {
      const result = await listProductBarcodes(productId);
      setBarcodes(result);
    } catch (error) {
      setErrors((prev) => ({ ...prev, submit: formatBarcodeError(error) }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    resetForm();
    void loadBarcodes();
  }, [productId]);

  const startCreate = () => {
    setEditingBarcode(null);
    setValues(defaultFormValues);
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (barcode: ProductBarcode) => {
    setEditingBarcode(barcode);
    setValues({
      barcode: barcode.barcode,
      barcodeType: barcode.barcodeType,
      isPrimary: barcode.isPrimary,
    });
    setErrors({});
    setShowForm(true);
  };

  const setFieldValue = <K extends keyof BarcodeFormValues>(
    field: K,
    value: BarcodeFormValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined, submit: undefined }));
  };

  const validate = () => {
    const nextErrors: BarcodeFormErrors = {};
    const normalizedBarcode = values.barcode.trim();
    const validType = barcodeTypeOptions.some((option) => option.value === values.barcodeType);

    if (!normalizedBarcode) {
      nextErrors.barcode = "El codigo de barras es requerido.";
    }
    if (!validType) {
      nextErrors.barcodeType = "El tipo de codigo de barras no es valido.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    const payload = {
      barcode: values.barcode.trim(),
      barcodeType: values.barcodeType,
      isPrimary: values.isPrimary,
    };

    try {
      if (editingBarcode) {
        await updateProductBarcode(productId, editingBarcode.id, payload);
      } else {
        await createProductBarcode(productId, payload);
      }
      resetForm();
      await loadBarcodes();
    } catch (error) {
      setErrors({ submit: formatBarcodeError(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetPrimary = async () => {
    if (!pendingPrimary) {
      return;
    }

    setActionLoadingId(pendingPrimary.id);
    setErrors((prev) => ({ ...prev, submit: undefined }));
    try {
      await setPrimaryProductBarcode(productId, pendingPrimary.id);
      setPendingPrimary(null);
      await loadBarcodes();
    } catch (error) {
      setErrors((prev) => ({ ...prev, submit: formatBarcodeError(error) }));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeactivate = async () => {
    if (!pendingDeactivate) {
      return;
    }

    setActionLoadingId(pendingDeactivate.id);
    try {
      await deactivateProductBarcode(productId, pendingDeactivate.id);
      setPendingDeactivate(null);
      await loadBarcodes();
    } catch (error) {
      setErrors((prev) => ({ ...prev, submit: formatBarcodeError(error) }));
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Producto</p>
          <h2 className="text-xl font-semibold text-slate-900">Codigos de barras</h2>
          <p className="mt-2 text-sm text-slate-600">
            Administra codigos alternos de {productName}. El SKU no cambia.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => void loadBarcodes()} isLoading={loading}>
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </div>
      </div>

      {pendingPrimary ? (
        <div className="mt-5">
          <ConfirmationMessage
            title={`Marcar principal: ${pendingPrimary.barcode}`}
            description="Este codigo quedara como principal y reemplazara el principal anterior del producto."
            variant="info"
            actions={
              <>
                <Button
                  variant="ghost"
                  onClick={() => setPendingPrimary(null)}
                  disabled={Boolean(actionLoadingId)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => void handleSetPrimary()}
                  isLoading={actionLoadingId === pendingPrimary.id}
                >
                  Marcar principal
                </Button>
              </>
            }
          />
        </div>
      ) : null}

      {pendingDeactivate ? (
        <div className="mt-5">
          <ConfirmationMessage
            title={`Inactivar codigo: ${pendingDeactivate.barcode}`}
            description="El codigo quedara inactivo y no se borrara fisicamente."
            variant="warning"
            actions={
              <>
                <Button
                  variant="ghost"
                  onClick={() => setPendingDeactivate(null)}
                  disabled={Boolean(actionLoadingId)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="warning"
                  onClick={() => void handleDeactivate()}
                  isLoading={actionLoadingId === pendingDeactivate.id}
                >
                  Inactivar
                </Button>
              </>
            }
          />
        </div>
      ) : null}

      {showForm ? (
        <form
          className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
            <div className="space-y-1">
              <Input
                label="Codigo de barras"
                required
                value={values.barcode}
                onChange={(event) => setFieldValue("barcode", event.target.value)}
                placeholder="Ej: 7701234567890"
              />
              {errors.barcode ? <p className="text-xs text-rose-600">{errors.barcode}</p> : null}
            </div>

            <div className="space-y-1">
              <Select
                label="Tipo"
                value={values.barcodeType}
                onChange={(event) =>
                  setFieldValue("barcodeType", event.target.value as ProductBarcodeType)
                }
              >
                {barcodeTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {errors.barcodeType ? (
                <p className="text-xs text-rose-600">{errors.barcodeType}</p>
              ) : null}
            </div>

            <label className="flex items-center gap-3 self-end rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={values.isPrimary}
                disabled={editingBarcode?.isActive === false}
                onChange={(event) => setFieldValue("isPrimary", event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              Principal
            </label>
          </div>

          {values.isPrimary ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              Este codigo quedara como principal y reemplazara el principal anterior.
            </div>
          ) : null}

          {editingBarcode?.isActive === false ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Este codigo esta inactivo. Puedes ajustar texto y tipo, pero no marcarlo principal.
            </div>
          ) : null}

          {errors.submit ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errors.submit}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" isLoading={isSubmitting}>
              {editingBarcode ? "Actualizar codigo" : "Guardar codigo"}
            </Button>
            <Button type="button" variant="ghost" onClick={resetForm} disabled={isSubmitting}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      {errors.submit && !showForm ? (
        <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errors.submit}
        </div>
      ) : null}

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Codigo</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Principal</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Cargando codigos...
                </td>
              </tr>
            ) : barcodes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Este producto aun no tiene codigos de barras.
                </td>
              </tr>
            ) : (
              barcodes.map((barcode) => (
                <tr key={barcode.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{barcode.barcode}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {barcodeTypeLabels[barcode.barcodeType] ?? barcode.barcodeType}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        barcode.isPrimary
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    >
                      {barcode.isPrimary ? "Si" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        barcode.isActive
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-600"
                      }`}
                    >
                      {barcode.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(barcode)}>
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Button>
                      {barcode.isActive && !barcode.isPrimary ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingPrimary(barcode)}
                          isLoading={actionLoadingId === barcode.id}
                        >
                          <Star className="h-4 w-4" />
                          Principal
                        </Button>
                      ) : null}
                      {barcode.isActive ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingDeactivate(barcode)}
                          disabled={Boolean(actionLoadingId)}
                        >
                          <Ban className="h-4 w-4" />
                          Inactivar
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-slate-500">
        {activeBarcodes} codigo(s) activo(s). El SKU del producto se mantiene independiente.
      </div>
    </section>
  );
};
