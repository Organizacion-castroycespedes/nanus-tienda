"use client";

import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import type { CreatePaymentMethodPayload, PaymentMethod } from "../types";

type PaymentMethodFormProps = {
  value: CreatePaymentMethodPayload;
  tenantOptions: Array<{ id: string; name: string }>;
  isSuperRole: boolean;
  isEditing?: boolean;
  onChange: (value: CreatePaymentMethodPayload) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isSaving?: boolean;
};

export const PaymentMethodForm = ({
  value,
  tenantOptions,
  isSuperRole,
  isEditing = false,
  onChange,
  onCancel,
  onSubmit,
  isSaving = false,
}: PaymentMethodFormProps) => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2">
      {isSuperRole ? (
        <Select
          label="Tenant"
          value={value.tenantId ?? ""}
          onChange={(event) =>
            onChange({
              ...value,
              tenantId: event.target.value || undefined,
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
        label="Tipo"
        value={value.tipo}
        onChange={(event) =>
          onChange({
            ...value,
            tipo: event.target.value as PaymentMethod["tipo"],
            allowsChange:
              event.target.value === "CREDIT" ? false : value.allowsChange,
          })
        }
      >
        <option value="CASH">Efectivo</option>
        <option value="CARD">Tarjeta</option>
        <option value="BANK">Banco</option>
        <option value="DIGITAL">Digital</option>
        <option value="CREDIT">Credito</option>
      </Select>
      <Select
        label="Requiere referencia"
        value={value.requiresReference ? "yes" : "no"}
        onChange={(event) =>
          onChange({
            ...value,
            requiresReference: event.target.value === "yes",
          })
        }
      >
        <option value="no">No</option>
        <option value="yes">Si</option>
      </Select>
      <Select
        label="Permite cambio"
        value={value.allowsChange ? "yes" : "no"}
        onChange={(event) =>
          onChange({
            ...value,
            allowsChange: event.target.value === "yes",
          })
        }
        disabled={value.tipo === "CREDIT"}
      >
        <option value="no">No</option>
        <option value="yes">Si</option>
      </Select>
      <Select
        label="Estado"
        value={value.active === false ? "inactive" : "active"}
        onChange={(event) =>
          onChange({
            ...value,
            active: event.target.value === "active",
          })
        }
      >
        <option value="active">Activo</option>
        <option value="inactive">Inactivo</option>
      </Select>
    </div>

    <div className="flex flex-wrap justify-end gap-3">
      <Button variant="ghost" onClick={onCancel}>
        Cancelar
      </Button>
      <Button onClick={onSubmit} isLoading={isSaving}>
        {isEditing ? "Guardar cambios" : "Crear metodo"}
      </Button>
    </div>
  </div>
);
