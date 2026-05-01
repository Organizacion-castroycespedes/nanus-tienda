"use client";

import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { Textarea } from "../../../components/design-system/Textarea";
import type { CashSession, CreateCashMovementPayload } from "../types";

type CashMovementFormProps = {
  value: CreateCashMovementPayload;
  openSessions: CashSession[];
  onChange: (value: CreateCashMovementPayload) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isSaving?: boolean;
};

export const CashMovementForm = ({
  value,
  openSessions,
  onChange,
  onCancel,
  onSubmit,
  isSaving = false,
}: CashMovementFormProps) => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2">
      <Select
        label="Sesion abierta"
        value={value.cashSessionId}
        onChange={(event) =>
          onChange({
            ...value,
            cashSessionId: event.target.value,
          })
        }
        required
      >
        <option value="">Selecciona una sesion</option>
        {openSessions.map((session) => (
          <option key={session.id} value={session.id}>
            {session.cashRegisterNombre ?? "Caja"} · {session.cashRegisterCodigo ?? "-"}
          </option>
        ))}
      </Select>
      <Select
        label="Tipo de movimiento"
        value={value.movementType}
        onChange={(event) =>
          onChange({
            ...value,
            movementType: event.target.value as CreateCashMovementPayload["movementType"],
          })
        }
      >
        <option value="ADJUSTMENT">Ajuste</option>
        <option value="EXPENSE">Gasto</option>
        <option value="WITHDRAWAL">Retiro</option>
      </Select>
      <Select
        label="Direccion"
        value={value.direction}
        onChange={(event) =>
          onChange({
            ...value,
            direction: event.target.value as CreateCashMovementPayload["direction"],
          })
        }
      >
        <option value="IN">Entrada</option>
        <option value="OUT">Salida</option>
      </Select>
      <Input
        label="Monto"
        type="number"
        min="0.01"
        step="0.01"
        value={String(value.amount)}
        onChange={(event) =>
          onChange({
            ...value,
            amount: Number(event.target.value),
          })
        }
        required
      />
      <Input
        label="Referencia tipo"
        value={value.referenceType ?? ""}
        onChange={(event) =>
          onChange({
            ...value,
            referenceType: event.target.value || undefined,
          })
        }
      />
      <Input
        label="Referencia id"
        value={value.referenceId ?? ""}
        onChange={(event) =>
          onChange({
            ...value,
            referenceId: event.target.value || undefined,
          })
        }
      />
      <div className="md:col-span-2">
        <Textarea
          label="Descripcion"
          rows={3}
          value={value.description ?? ""}
          onChange={(event) =>
            onChange({
              ...value,
              description: event.target.value,
            })
          }
        />
      </div>
    </div>

    <div className="flex flex-wrap justify-end gap-3">
      <Button variant="ghost" onClick={onCancel}>
        Cancelar
      </Button>
      <Button onClick={onSubmit} isLoading={isSaving}>
        Registrar movimiento
      </Button>
    </div>
  </div>
);
