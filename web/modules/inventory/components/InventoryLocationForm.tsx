"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import {
  createInventoryLocation,
  INVENTORY_LOCATION_TYPES,
  updateInventoryLocation,
  type InventoryLocationResponse,
  type InventoryLocationType,
} from "../services/inventory-location.service";

export type InventoryLocationBranchOption = {
  id: string;
  name: string;
};

type InventoryLocationFormValues = {
  branchId: string;
  code: string;
  name: string;
  type: InventoryLocationType;
  description: string;
};

type InventoryLocationFormErrors = Partial<
  Record<keyof InventoryLocationFormValues, string>
> & {
  submit?: string;
};

type InventoryLocationFormProps = {
  mode: "create" | "edit";
  location?: InventoryLocationResponse | null;
  branchOptions: InventoryLocationBranchOption[];
  onCancel: () => void;
  onSuccess: (mode: "create" | "edit") => void;
};

const typeLabels: Record<InventoryLocationType, string> = {
  WAREHOUSE: "Bodega",
  DISPLAY: "Vitrina",
  SHELF: "Estante",
  COLD_ROOM: "Cuarto frio",
  COUNTER: "Mostrador",
  OTHER: "Otro",
};

const createInitialValues = (
  location?: InventoryLocationResponse | null,
  branchOptions: InventoryLocationBranchOption[] = []
): InventoryLocationFormValues => ({
  branchId: location?.branchId ?? branchOptions[0]?.id ?? "",
  code: location?.code ?? "",
  name: location?.name ?? "",
  type: location?.type ?? "OTHER",
  description: location?.description ?? "",
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

export const InventoryLocationForm = ({
  mode,
  location,
  branchOptions,
  onCancel,
  onSuccess,
}: InventoryLocationFormProps) => {
  const [values, setValues] = useState<InventoryLocationFormValues>(
    createInitialValues(location, branchOptions)
  );
  const [errors, setErrors] = useState<InventoryLocationFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setValues(createInitialValues(location, branchOptions));
    setErrors({});
  }, [mode, location, branchOptions]);

  const validate = () => {
    const nextErrors: InventoryLocationFormErrors = {};

    if (!values.branchId.trim()) {
      nextErrors.branchId = "La sucursal es requerida.";
    }
    if (!values.code.trim()) {
      nextErrors.code = "El codigo es requerido.";
    }
    if (!values.name.trim()) {
      nextErrors.name = "El nombre es requerido.";
    }
    if (!INVENTORY_LOCATION_TYPES.includes(values.type)) {
      nextErrors.type = "El tipo no es valido.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    const payload = {
      code: values.code.trim().toUpperCase(),
      name: values.name.trim(),
      type: values.type,
      description: values.description.trim() || null,
    };

    setErrors({});
    setIsSubmitting(true);

    try {
      if (mode === "create") {
        await createInventoryLocation({
          branchId: values.branchId,
          ...payload,
        });
      } else {
        await updateInventoryLocation(location!.id, payload);
      }

      onSuccess(mode);
    } catch (error) {
      setErrors({
        submit: getErrorMessage(
          error,
          mode === "create"
            ? "No se pudo crear la ubicacion."
            : "No se pudo actualizar la ubicacion."
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Select
            label="Sucursal"
            required
            value={values.branchId}
            disabled={mode === "edit"}
            onChange={(event) => {
              setValues((prev) => ({ ...prev, branchId: event.target.value }));
              setErrors((prev) => ({ ...prev, branchId: undefined, submit: undefined }));
            }}
            hint={mode === "edit" ? "La sucursal no se mueve en esta fase." : undefined}
          >
            <option value="">Selecciona sucursal</option>
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
          {errors.branchId ? (
            <p className="text-xs text-rose-600">{errors.branchId}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <Input
            label="Codigo"
            required
            value={values.code}
            onChange={(event) => {
              const value = event.target.value.toUpperCase();
              setValues((prev) => ({ ...prev, code: value }));
              setErrors((prev) => ({ ...prev, code: undefined, submit: undefined }));
            }}
          />
          {errors.code ? <p className="text-xs text-rose-600">{errors.code}</p> : null}
        </div>

        <div className="space-y-1">
          <Input
            label="Nombre"
            required
            value={values.name}
            onChange={(event) => {
              setValues((prev) => ({ ...prev, name: event.target.value }));
              setErrors((prev) => ({ ...prev, name: undefined, submit: undefined }));
            }}
          />
          {errors.name ? <p className="text-xs text-rose-600">{errors.name}</p> : null}
        </div>

        <div className="space-y-1">
          <Select
            label="Tipo"
            required
            value={values.type}
            onChange={(event) => {
              setValues((prev) => ({
                ...prev,
                type: event.target.value as InventoryLocationType,
              }));
              setErrors((prev) => ({ ...prev, type: undefined, submit: undefined }));
            }}
          >
            {INVENTORY_LOCATION_TYPES.map((type) => (
              <option key={type} value={type}>
                {typeLabels[type]}
              </option>
            ))}
          </Select>
          {errors.type ? <p className="text-xs text-rose-600">{errors.type}</p> : null}
        </div>
      </div>

      <label className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
        <span className="font-medium">Descripcion</span>
        <textarea
          value={values.description}
          rows={3}
          onChange={(event) => {
            setValues((prev) => ({ ...prev, description: event.target.value }));
            setErrors((prev) => ({ ...prev, submit: undefined }));
          }}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
        />
      </label>

      {errors.submit ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errors.submit}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {mode === "create" ? "Guardar ubicacion" : "Actualizar ubicacion"}
        </Button>
      </div>
    </form>
  );
};
