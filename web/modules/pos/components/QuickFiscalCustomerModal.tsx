"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Search,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import { Select } from "../../../components/design-system/Select";
import type { CustomerResponse } from "../../inventory/services/customer.service";
import {
  createElectronicInvoicingCustomer,
  lookupElectronicInvoicingCustomer,
  type ElectronicInvoicingCustomer,
} from "../../electronic-invoicing/services/customer.service";

type QuickFiscalCustomerModalProps = {
  customers: CustomerResponse[];
  selectedCustomerId: string | null;
  onClose: () => void;
  onCustomerSelected: (customer: CustomerResponse) => void;
  onCustomerSaved: (customer: ElectronicInvoicingCustomer) => Promise<void> | void;
};

type FiscalForm = {
  documentTypeCode: string;
  documentNumber: string;
  name: string;
  fiscalEmail: string;
  phone: string;
  address: string;
};

const EMPTY_FORM: FiscalForm = {
  documentTypeCode: "31",
  documentNumber: "",
  name: "",
  fiscalEmail: "",
  phone: "",
  address: "",
};


const normalizeText = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const trimToNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildFormFromCustomer = (customer: CustomerResponse | null): FiscalForm => ({
  documentTypeCode: "31",
  documentNumber: customer?.documentNumber ?? "",
  name: customer?.name ?? "",
  fiscalEmail: customer?.email ?? "",
  phone: customer?.phone ?? "",
  address: customer?.address ?? "",
});

export const QuickFiscalCustomerModal = ({
  customers,
  selectedCustomerId,
  onClose,
  onCustomerSelected,
  onCustomerSaved,
}: QuickFiscalCustomerModalProps) => {
  const [customerQuery, setCustomerQuery] = useState("");
  const [targetCustomerId, setTargetCustomerId] = useState<string | null>(
    selectedCustomerId
  );
  const [form, setForm] = useState<FiscalForm>(EMPTY_FORM);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMockLocal, setIsMockLocal] = useState(false);

  const targetCustomer = useMemo(
    () => customers.find((customer) => customer.id === targetCustomerId) ?? null,
    [customers, targetCustomerId]
  );

  const filteredCustomers = useMemo(() => {
    const query = normalizeText(customerQuery);
    if (!query) {
      return customers.slice(0, 6);
    }
    return customers
      .filter((customer) => {
        const haystack = [
          customer.name,
          customer.documentNumber,
          customer.email,
          customer.phone,
        ]
          .map(normalizeText)
          .join(" ");
        return haystack.includes(query);
      })
      .slice(0, 6);
  }, [customerQuery, customers]);

  useEffect(() => {
    const initialCustomer =
      customers.find((customer) => customer.id === selectedCustomerId) ?? null;
    setTargetCustomerId(initialCustomer?.id ?? null);
    setForm(buildFormFromCustomer(initialCustomer));
    setError(null);
    setIsMockLocal(false);
  }, [customers, selectedCustomerId]);

  const updateForm = (field: keyof FiscalForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setTargetCustomerId(null);
    setError(null);
  };

  const handlePickCustomer = (customer: CustomerResponse) => {
    setTargetCustomerId(customer.id);
    setForm(buildFormFromCustomer(customer));
    setError(null);
    setIsMockLocal(false);
  };

  const handleUseExisting = () => {
    if (!targetCustomer) {
      setError("Selecciona un cliente existente.");
      return;
    }
    onCustomerSelected(targetCustomer);
    onClose();
  };

  const handleLookup = async () => {
    const documentNumber = trimToNull(form.documentNumber);
    const documentTypeCode = trimToNull(form.documentTypeCode);
    if (!documentTypeCode || !documentNumber) {
      setError("Tipo y número de documento son requeridos.");
      return;
    }

    setLookupLoading(true);
    setError(null);
    try {
      const nextPreview = await lookupElectronicInvoicingCustomer({
        documentTypeCode,
        documentNumber,
      });
      setIsMockLocal(nextPreview.provider === "MOCK_LOCAL");

      if (nextPreview.lookupStatus === "FOUND" && nextPreview.data) {
        setForm((prev) => ({
          ...prev,
          name: nextPreview.data!.legalName || nextPreview.data!.name || prev.name,
          fiscalEmail: nextPreview.data!.fiscalEmail || nextPreview.data!.invoiceEmail || prev.fiscalEmail,
          phone: nextPreview.data!.phone || prev.phone,
          address: nextPreview.data!.address || prev.address,
        }));
      } else {
        setError("Consulta DIAN sin datos. Puedes ingresar los datos manualmente.");
      }
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : "No se pudo realizar la consulta a la DIAN."
      );
    } finally {
      setLookupLoading(false);
    }
  };

  const buildCreatePayload = () => {
    const name = trimToNull(form.name) ?? "Cliente POS";
    const fiscalEmail = trimToNull(form.fiscalEmail);

    return {
      name,
      documentTypeCode: trimToNull(form.documentTypeCode),
      dianIdentificationType: trimToNull(form.documentTypeCode),
      documentNumber: trimToNull(form.documentNumber),
      identificationNumber: trimToNull(form.documentNumber),
      fiscalEmail,
      invoiceEmail: fiscalEmail,
      phone: trimToNull(form.phone),
      address: trimToNull(form.address),
      fiscalDataSource:
        isMockLocal ? ("MOCK_LOCAL" as const) : ("MANUAL" as const),
      fiscalStatus: "PENDING" as const,
      isActive: true,
    };
  };

  const handleCreateCustomer = async () => {
    const payload = buildCreatePayload();
    if (!payload.name.trim()) {
      setError("Nombre requerido.");
      return;
    }

    setSaveLoading(true);
    setError(null);
    try {
      const savedCustomer = await createElectronicInvoicingCustomer(payload);
      await onCustomerSaved(savedCustomer);
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el cliente fiscal."
      );
    } finally {
      setSaveLoading(false);
    }
  };

  const closeModal = () => {
    if (lookupLoading || saveLoading) {
      return;
    }
    onClose();
  };


  return (
    <Modal
      title="Cliente fiscal rapido"
      size="xl"
      onClose={closeModal}
      className="max-h-[calc(100vh-2rem)] overflow-y-auto dark:bg-slate-950"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Search className="h-4 w-4" />
              Buscar cliente
            </div>
            <Input
              label="Busqueda"
              placeholder="Nombre, documento o email"
              value={customerQuery}
              onChange={(event) => setCustomerQuery(event.target.value)}
              autoFocus
            />
            <div className="mt-3 space-y-2">
              {filteredCustomers.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Sin coincidencias.
                </p>
              ) : (
                filteredCustomers.map((customer) => {
                  const isSelected = customer.id === targetCustomerId;
                  return (
                    <button
                      key={customer.id}
                      type="button"
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition ${
                        isSelected
                          ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-100"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                      }`}
                      onClick={() => handlePickCustomer(customer)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">
                          {customer.name}
                        </span>
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                          {customer.documentNumber ?? "Sin documento"}
                        </span>
                      </span>
                      {isSelected ? <CheckCircle2 className="h-4 w-4" /> : null}
                    </button>
                  );
                })
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUseExisting}
                disabled={!targetCustomer || saveLoading || lookupLoading}
              >
                <UserCheck className="h-4 w-4" />
                Usar cliente
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
            <div className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
              <UserPlus className="h-4 w-4" />
              Nuevo Cliente Fiscal
            </div>
            
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <Select
                    label="Tipo doc"
                    value={form.documentTypeCode}
                    onChange={(event) => updateForm("documentTypeCode", event.target.value)}
                  >
                    <option value="31">NIT</option>
                    <option value="13">Cedula</option>
                    <option value="22">Cedula extranjeria</option>
                    <option value="47">PPT</option>
                  </Select>
                </div>
                <div className="flex-[2]">
                  <Input
                    label="Numero"
                    inputMode="text"
                    value={form.documentNumber}
                    onChange={(event) => updateForm("documentNumber", event.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  isLoading={lookupLoading}
                  onClick={() => void handleLookup()}
                  disabled={saveLoading || !form.documentNumber}
                  className="mb-[2px] h-[42px]"
                >
                  <Search className="mr-2 h-4 w-4" />
                  Consultar DIAN
                </Button>
              </div>

              {error ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                  <span>{error}</span>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Input
                    label="Nombre / Razon Social"
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                  />
                </div>
                <Input
                  label="Email fiscal"
                  type="email"
                  value={form.fiscalEmail}
                  onChange={(event) => updateForm("fiscalEmail", event.target.value)}
                />
                <Input
                  label="Telefono"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(event) => updateForm("phone", event.target.value)}
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Direccion"
                    value={form.address}
                    onChange={(event) => updateForm("address", event.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={closeModal} disabled={lookupLoading || saveLoading}>
              Cancelar
            </Button>
            <Button
              isLoading={saveLoading}
              onClick={() => void handleCreateCustomer()}
              disabled={lookupLoading || saveLoading || !form.name || !form.documentNumber}
            >
              Guardar y usar
            </Button>
          </div>
        </section>
      </div>
    </Modal>
  );
};
