"use client";

import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import type {
  CreateCashRegisterPayload,
  FinanceBranchOption,
  FinanceTerminalOption,
  FinanceTenantOption,
} from "../types";

type CashRegisterFormProps = {
  value: CreateCashRegisterPayload;
  tenantOptions: FinanceTenantOption[];
  branchOptions: FinanceBranchOption[];
  terminalOptions: FinanceTerminalOption[];
  isSuperRole: boolean;
  isEditing?: boolean;
  onChange: (value: CreateCashRegisterPayload) => void;
  onTenantChange?: (tenantId: string) => void;
  onBranchChange?: (branchId: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isSaving?: boolean;
};

export const CashRegisterForm = ({
  value,
  tenantOptions,
  branchOptions,
  terminalOptions,
  isSuperRole,
  isEditing = false,
  onChange,
  onTenantChange,
  onBranchChange,
  onCancel,
  onSubmit,
  isSaving = false,
}: CashRegisterFormProps) => {
  const availableTerminals = terminalOptions.filter(
    (terminal) => !value.branchId || terminal.branchId === value.branchId
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {isSuperRole ? (
          <Select
            label="Tenant"
            value={value.tenantId ?? ""}
            onChange={(event) =>
              onTenantChange
                ? onTenantChange(event.target.value)
                : onChange({
                    ...value,
                    tenantId: event.target.value || undefined,
                    branchId: "",
                    terminalId: undefined,
                  })
            }
            required
          >
            <option value="">Selecciona un tenant</option>
            {tenantOptions.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </Select>
        ) : null}
        <Select
          label="Sucursal"
          value={value.branchId}
          onChange={(event) =>
            onBranchChange
              ? onBranchChange(event.target.value)
              : onChange({
                  ...value,
                  branchId: event.target.value,
                  terminalId: undefined,
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
        <Input
          label="Codigo"
          value={value.codigo}
          onChange={(event) => onChange({ ...value, codigo: event.target.value })}
          required
        />
        <Input
          label="Nombre"
          value={value.nombre}
          onChange={(event) => onChange({ ...value, nombre: event.target.value })}
          required
        />
        <Select
          label="Caja ligada a terminal"
          value={value.terminalId ?? ""}
          onChange={(event) =>
            onChange({
              ...value,
              terminalId: event.target.value || undefined,
            })
          }
        >
          <option value="">Sin terminal asociada</option>
          {availableTerminals.map((terminal) => (
            <option key={terminal.id} value={terminal.id}>
              {terminal.name} · {terminal.code}
            </option>
          ))}
        </Select>
        {!isEditing ? (
          <Select
            label="Estado inicial"
            value={value.activo === false ? "inactive" : "active"}
            onChange={(event) =>
              onChange({
                ...value,
                activo: event.target.value === "active",
              })
            }
          >
            <option value="active">Activa</option>
            <option value="inactive">Inactiva</option>
          </Select>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} isLoading={isSaving}>
          {isEditing ? "Guardar cambios" : "Crear caja"}
        </Button>
      </div>
    </div>
  );
};
