"use client";

import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import type { CashRegister, FinanceBranchOption, OpenCashSessionPayload } from "../types";

type OpenCashSessionFormProps = {
  value: OpenCashSessionPayload;
  branchOptions: FinanceBranchOption[];
  registerOptions: CashRegister[];
  onChange: (value: OpenCashSessionPayload) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isSaving?: boolean;
};

export const OpenCashSessionForm = ({
  value,
  branchOptions,
  registerOptions,
  onChange,
  onCancel,
  onSubmit,
  isSaving = false,
}: OpenCashSessionFormProps) => {
  const availableRegisters = registerOptions.filter(
    (register) =>
      register.activo && (!value.branchId || register.branchId === value.branchId)
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Select
          label="Sucursal"
          value={value.branchId}
          onChange={(event) =>
            onChange({
              ...value,
              branchId: event.target.value,
              cashRegisterId: "",
            })
          }
          required
        >
          <option value="">Selecciona una sucursal</option>
          {branchOptions.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </Select>
        <Select
          label="Caja"
          value={value.cashRegisterId}
          onChange={(event) =>
            onChange({
              ...value,
              cashRegisterId: event.target.value,
            })
          }
          required
        >
          <option value="">Selecciona una caja</option>
          {availableRegisters.map((register) => (
            <option key={register.id} value={register.id}>
              {register.nombre} · {register.codigo}
            </option>
          ))}
        </Select>
        <Input
          label="Monto de apertura"
          type="number"
          min="0"
          step="0.01"
          value={String(value.openingAmount)}
          onChange={(event) =>
            onChange({
              ...value,
              openingAmount: Number(event.target.value),
            })
          }
          required
        />
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} isLoading={isSaving}>
          Abrir caja
        </Button>
      </div>
    </div>
  );
};
