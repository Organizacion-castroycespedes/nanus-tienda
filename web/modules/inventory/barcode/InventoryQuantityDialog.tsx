"use client";

import { useState, type FormEvent } from "react";

import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import { parseInventoryQuantity } from "./barcode-lines";

type InventoryQuantityDialogProps = {
  title: string;
  productName: string;
  label?: string;
  /** Máximo permitido (por ejemplo, el pendiente en recepción). */
  max?: number;
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
};

const formatQuantity = (value: number) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value);

/** Captura manual de peso o cantidad decimal (máximo 2 decimales, sin báscula). */
export const InventoryQuantityDialog = ({
  title,
  productName,
  label = "Peso",
  max,
  onConfirm,
  onCancel,
}: InventoryQuantityDialogProps) => {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const quantity = parseInventoryQuantity(value);
    if (quantity === null) {
      setError("Ingresa un valor mayor a 0 con máximo 2 decimales.");
      return;
    }
    if (max !== undefined && quantity > max) {
      setError(`No puede superar ${formatQuantity(max)}.`);
      return;
    }
    onConfirm(quantity);
  };

  return (
    <Modal title={title} description={productName} onClose={onCancel}>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <Input
          label={label}
          inputMode="decimal"
          autoFocus
          value={value}
          aria-invalid={Boolean(error)}
          hint={max !== undefined ? `Máximo ${formatQuantity(max)}` : "Usa coma o punto; máximo 2 decimales."}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
        />
        {error ? (
          <p role="alert" className="text-sm text-rose-600">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">Agregar</Button>
        </div>
      </form>
    </Modal>
  );
};
