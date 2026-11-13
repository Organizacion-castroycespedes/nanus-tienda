"use client";

import { Button } from "../../../components/design-system/Button";
import { Modal } from "../../../components/design-system/Modal";
import type { InventoryCaptureMode } from "./barcode-lines";

type InventorySaleModeDialogProps = {
  productName: string;
  onSelect: (mode: InventoryCaptureMode) => void;
  onCancel: () => void;
};

/** Producto BOTH: elegir unidad o peso, como en el POS (D5). */
export const InventorySaleModeDialog = ({
  productName,
  onSelect,
  onCancel,
}: InventorySaleModeDialogProps) => (
  <Modal
    title="¿Cómo quieres agregarlo?"
    description={productName}
    onClose={onCancel}
    footer={
      <Button variant="ghost" onClick={onCancel}>
        Cancelar
      </Button>
    }
  >
    <div className="grid gap-3 sm:grid-cols-2">
      <Button size="lg" autoFocus onClick={() => onSelect("UNIT")}>
        Por unidad
      </Button>
      <Button size="lg" variant="outline" onClick={() => onSelect("WEIGHT")}>
        Por peso
      </Button>
    </div>
  </Modal>
);
