import { useMemo, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Textarea } from "../../../components/design-system/Textarea";
import type { CreateDeliveryPayload } from "../types";

type DeliveryFormState = {
  branch_id: string;
  customer_id: string;
  order_id: string;
  sale_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_reference: string;
  delivery_fee: string;
  subtotal: string;
  total: string;
  payment_method_id: string;
  notes: string;
};

const emptyForm: DeliveryFormState = {
  branch_id: "",
  customer_id: "",
  order_id: "",
  sale_id: "",
  customer_name: "",
  customer_phone: "",
  delivery_address: "",
  delivery_reference: "",
  delivery_fee: "",
  subtotal: "",
  total: "",
  payment_method_id: "",
  notes: "",
};

const optionalText = (value: string) => {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
};

const optionalAmount = (value: string) => {
  if (!value.trim()) {
    return undefined;
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : undefined;
};

export const CreateDeliveryForm = ({
  isSaving,
  onCancel,
  onSubmit,
}: {
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (payload: CreateDeliveryPayload) => Promise<void> | void;
}) => {
  const [form, setForm] = useState<DeliveryFormState>(emptyForm);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const hasIdentity =
      Boolean(optionalText(form.customer_id)) ||
      Boolean(optionalText(form.customer_name)) ||
      Boolean(optionalText(form.customer_phone));
    return hasIdentity && Boolean(optionalText(form.delivery_address));
  }, [form]);

  const updateField = (field: keyof DeliveryFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setValidationMessage(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setValidationMessage(
        "Informa customer_id, nombre o telefono, y la direccion."
      );
      return;
    }

    await onSubmit({
      branch_id: optionalText(form.branch_id),
      customer_id: optionalText(form.customer_id),
      order_id: optionalText(form.order_id),
      sale_id: optionalText(form.sale_id),
      customer_name: optionalText(form.customer_name),
      customer_phone: optionalText(form.customer_phone),
      delivery_address: form.delivery_address.trim(),
      delivery_reference: optionalText(form.delivery_reference),
      delivery_fee: optionalAmount(form.delivery_fee),
      subtotal: optionalAmount(form.subtotal),
      total: optionalAmount(form.total),
      payment_method_id: optionalText(form.payment_method_id),
      notes: optionalText(form.notes),
      metadata: {
        source: "manual_frontend",
        no_cash_integration: true,
      },
    });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Nuevo domicilio
          </p>
          <h2 className="text-xl font-semibold text-slate-900">
            Crear domicilio manual
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Registro operativo basico. No toca caja, POS ni facturacion
            electronica.
          </p>
        </div>
        <Button variant="outline" onClick={onCancel}>
          Volver al listado
        </Button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Input
          label="Sucursal (branch_id)"
          value={form.branch_id}
          hint="Opcional si tu sesion ya tiene sucursal."
          onChange={(event) => updateField("branch_id", event.target.value)}
        />
        <Input
          label="Cliente (customer_id)"
          value={form.customer_id}
          onChange={(event) => updateField("customer_id", event.target.value)}
        />
        <Input
          label="Pedido (order_id)"
          value={form.order_id}
          onChange={(event) => updateField("order_id", event.target.value)}
        />
        <Input
          label="Venta (sale_id)"
          value={form.sale_id}
          onChange={(event) => updateField("sale_id", event.target.value)}
        />
        <Input
          label="Contacto"
          value={form.customer_name}
          onChange={(event) => updateField("customer_name", event.target.value)}
        />
        <Input
          label="Telefono"
          value={form.customer_phone}
          onChange={(event) => updateField("customer_phone", event.target.value)}
        />
        <Input
          label="Valor domicilio"
          type="number"
          min="0"
          step="0.01"
          value={form.delivery_fee}
          onChange={(event) => updateField("delivery_fee", event.target.value)}
        />
        <Input
          label="Subtotal"
          type="number"
          min="0"
          step="0.01"
          value={form.subtotal}
          onChange={(event) => updateField("subtotal", event.target.value)}
        />
        <Input
          label="Total"
          type="number"
          min="0"
          step="0.01"
          value={form.total}
          onChange={(event) => updateField("total", event.target.value)}
        />
        <Input
          label="Metodo pago (payment_method_id)"
          value={form.payment_method_id}
          onChange={(event) =>
            updateField("payment_method_id", event.target.value)
          }
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Textarea
          label="Direccion"
          required
          rows={3}
          value={form.delivery_address}
          onChange={(event) =>
            updateField("delivery_address", event.target.value)
          }
        />
        <Textarea
          label="Referencia"
          rows={3}
          value={form.delivery_reference}
          onChange={(event) =>
            updateField("delivery_reference", event.target.value)
          }
        />
      </div>

      <div className="mt-4">
        <Textarea
          label="Notas"
          rows={3}
          value={form.notes}
          onChange={(event) => updateField("notes", event.target.value)}
        />
      </div>

      {validationMessage ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {validationMessage}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button onClick={() => void handleSubmit()} isLoading={isSaving}>
          Crear domicilio
        </Button>
      </div>
    </section>
  );
};
