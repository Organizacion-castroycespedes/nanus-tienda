"use client";

import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { BankLogo } from "../../shared/payments/BankLogo";
import type {
  CreatePaymentMethodPayload,
  FinancialInstitution,
  PaymentMethod,
} from "../types";

type PaymentMethodFormProps = {
  value: CreatePaymentMethodPayload;
  tenantOptions: Array<{ id: string; name: string }>;
  isSuperRole: boolean;
  isEditing?: boolean;
  financialInstitutions: FinancialInstitution[];
  selectedInstitutionIds: string[];
  onSelectedInstitutionIdsChange: (ids: string[]) => void;
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
  financialInstitutions,
  selectedInstitutionIds,
  onSelectedInstitutionIdsChange,
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
        label="Requiere Banco/Billetera"
        value={value.requiresFinancialInstitution ? "yes" : "no"}
        onChange={(event) =>
          onChange({
            ...value,
            requiresFinancialInstitution: event.target.value === "yes",
          })
        }
      >
        <option value="no">No</option>
        <option value="yes">Sí (Muestra lista de bancos)</option>
      </Select>
      <Input
        label="Orden de aparición"
        type="number"
        value={value.sortOrder ?? 0}
        onChange={(event) =>
          onChange({
            ...value,
            sortOrder: parseInt(event.target.value) || 0,
          })
        }
      />
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
      <Select
        label="Facturacion electronica"
        value={value.electronicBillingEnabled ? "enabled" : "disabled"}
        onChange={(event) =>
          onChange({
            ...value,
            electronicBillingEnabled: event.target.value === "enabled",
            electronicPaymentMeansId:
              event.target.value === "enabled"
                ? (value.electronicPaymentMeansId ?? "1")
                : undefined,
          })
        }
      >
        <option value="disabled">Deshabilitada</option>
        <option value="enabled">Habilitada</option>
      </Select>
      {value.electronicBillingEnabled ? (
        <Select
          label="Medio fiscal DIAN"
          value={value.electronicPaymentMeansCode ?? ""}
          onChange={(event) =>
            onChange({
              ...value,
              electronicPaymentMeansCode: event.target.value as "10" | "47" | "49",
              electronicPaymentMeansId: "1",
            })
          }
          required
        >
          <option value="">Selecciona un medio fiscal</option>
          <option value="10">10 - Efectivo</option>
          <option value="47">47 - Transferencia debito bancaria</option>
          <option value="49">49 - Tarjeta debito</option>
        </Select>
      ) : null}
    </div>

    {value.requiresFinancialInstitution ? (
      <div className="space-y-2 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Bancos y billeteras disponibles
          </p>
          <p className="text-xs text-slate-500">
            Selecciona las entidades que aparecerán para este medio de pago.
          </p>
        </div>
        <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {financialInstitutions
            .filter((institution) => institution.active)
            .map((institution) => {
              const selected = selectedInstitutionIds.includes(institution.id);
              return (
                <label
                  key={institution.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2 text-xs transition ${
                    selected
                      ? "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
                      : "border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() =>
                      onSelectedInstitutionIdsChange(
                        selected
                          ? selectedInstitutionIds.filter((id) => id !== institution.id)
                          : [...selectedInstitutionIds, institution.id]
                      )
                    }
                  />
                  <BankLogo
                    code={institution.codigo}
                    name={institution.nombre}
                    logoUrl={institution.logoUrl}
                    className="h-6 w-6 shrink-0"
                  />
                  <span className="truncate">{institution.nombreCorto || institution.nombre}</span>
                </label>
              );
            })}
        </div>
      </div>
    ) : null}

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
