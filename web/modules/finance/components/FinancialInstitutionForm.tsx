import React from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import type { FinancialInstitution, FinancialInstitutionType } from "../types";

type FinancialInstitutionFormProps = {
  value: Partial<FinancialInstitution>;
  isEditing?: boolean;
  isSaving?: boolean;
  onChange: (value: Partial<FinancialInstitution>) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export const FinancialInstitutionForm: React.FC<FinancialInstitutionFormProps> = ({
  value,
  isEditing = false,
  isSaving = false,
  onChange,
  onCancel,
  onSubmit,
}) => {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Código *"
          placeholder="BANCOLOMBIA"
          value={value.codigo || ""}
          onChange={(e) => onChange({ ...value, codigo: e.target.value })}
          disabled={isEditing}
        />
        <Input
          label="Nombre completo *"
          placeholder="Bancolombia S.A."
          value={value.nombre || ""}
          onChange={(e) => onChange({ ...value, nombre: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Nombre corto"
          placeholder="Bancolombia"
          value={value.nombreCorto || ""}
          onChange={(e) => onChange({ ...value, nombreCorto: e.target.value })}
        />
        <Select
          label="Tipo de entidad *"
          value={value.tipo || "BANK"}
          onChange={(e) => onChange({ ...value, tipo: e.target.value as FinancialInstitutionType })}
        >
          <option value="BANK">Banco</option>
          <option value="WALLET">Billetera Digital</option>
          <option value="PAYMENT_NETWORK">Red de Pago</option>
          <option value="OTHER">Otro</option>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Logo / Asset URL (Opcional)"
          placeholder="/images/banks/bancolombia.png"
          value={value.logoUrl || ""}
          onChange={(e) => onChange({ ...value, logoUrl: e.target.value })}
        />
        <Input
          label="Orden de aparición"
          type="number"
          placeholder="0"
          value={value.sortOrder ?? 0}
          onChange={(e) => onChange({ ...value, sortOrder: parseInt(e.target.value) || 0 })}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <Button variant="outline" type="button" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button variant="primary" type="submit" isLoading={isSaving}>
          {isEditing ? "Guardar cambios" : "Crear entidad"}
        </Button>
      </div>
    </form>
  );
};
