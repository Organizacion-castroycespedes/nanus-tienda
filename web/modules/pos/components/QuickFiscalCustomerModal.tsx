"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  Search,
  ShieldCheck,
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
  applyElectronicInvoicingCustomerLookup,
  createElectronicInvoicingCustomer,
  lookupElectronicInvoicingCustomer,
  type ElectronicInvoicingCustomer,
  type ThirdPartyLookupField,
  type ThirdPartyLookupPreview,
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

const FIELD_OPTIONS: Array<{
  field: ThirdPartyLookupField;
  label: string;
}> = [
  { field: "name", label: "Nombre" },
  { field: "documentTypeCode", label: "Tipo doc" },
  { field: "documentNumber", label: "Numero" },
  { field: "verificationDigit", label: "DV" },
  { field: "legalName", label: "Razon social" },
  { field: "tradeName", label: "Nombre comercial" },
  { field: "fiscalEmail", label: "Email fiscal" },
  { field: "phone", label: "Telefono" },
  { field: "address", label: "Direccion" },
  { field: "countryCode", label: "Pais" },
  { field: "departmentCode", label: "Departamento" },
  { field: "municipalityCode", label: "Municipio" },
  { field: "personType", label: "Persona" },
  { field: "taxRegime", label: "Regimen" },
  { field: "taxResponsibilities", label: "Responsabilidades" },
];

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

const getPreviewValue = (
  preview: ThirdPartyLookupPreview,
  field: ThirdPartyLookupField
) => {
  if (!preview.data) {
    return null;
  }
  if (field === "documentNumber") {
    return preview.data.documentNumberNormalized;
  }
  return preview.data[field] ?? null;
};

const formatPreviewValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "-";
  }
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
};

const getCustomerVisibleValue = (
  customer: CustomerResponse | null,
  field: ThirdPartyLookupField
) => {
  if (!customer) {
    return null;
  }
  if (field === "name") {
    return customer.name;
  }
  if (field === "documentNumber") {
    return customer.documentNumber;
  }
  if (field === "fiscalEmail") {
    return customer.email;
  }
  if (field === "phone") {
    return customer.phone;
  }
  if (field === "address") {
    return customer.address;
  }
  return null;
};

const buildFormFromCustomer = (customer: CustomerResponse | null): FiscalForm => ({
  documentTypeCode: "31",
  documentNumber: customer?.documentNumber ?? "",
  name: customer?.name ?? "",
  fiscalEmail: customer?.email ?? "",
  phone: customer?.phone ?? "",
  address: customer?.address ?? "",
});

const buildDefaultFields = (
  preview: ThirdPartyLookupPreview,
  customer: CustomerResponse | null
) => {
  if (!preview.data || preview.lookupStatus !== "FOUND") {
    return [];
  }

  return FIELD_OPTIONS.filter(({ field }) => {
    const previewValue = getPreviewValue(preview, field);
    if (
      previewValue === null ||
      previewValue === undefined ||
      (Array.isArray(previewValue) && previewValue.length === 0)
    ) {
      return false;
    }
    if (!customer) {
      return true;
    }
    return !getCustomerVisibleValue(customer, field);
  }).map(({ field }) => field);
};

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
  const [preview, setPreview] = useState<ThirdPartyLookupPreview | null>(null);
  const [selectedFields, setSelectedFields] = useState<ThirdPartyLookupField[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastApplyFields, setLastApplyFields] = useState<ThirdPartyLookupField[]>([]);

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
    setPreview(null);
    setSelectedFields([]);
    setError(null);
    setLastApplyFields([]);
  }, [customers, selectedCustomerId]);

  const updateForm = (field: keyof FiscalForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setPreview(null);
    setSelectedFields([]);
    setLastApplyFields([]);
    setError(null);
  };

  const handlePickCustomer = (customer: CustomerResponse) => {
    setTargetCustomerId(customer.id);
    setForm(buildFormFromCustomer(customer));
    setPreview(null);
    setSelectedFields([]);
    setLastApplyFields([]);
    setError(null);
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
      setError("Tipo y numero de documento son requeridos.");
      return;
    }

    setLookupLoading(true);
    setError(null);
    setLastApplyFields([]);
    try {
      const nextPreview = await lookupElectronicInvoicingCustomer({
        documentTypeCode,
        documentNumber,
      });
      setPreview(nextPreview);
      setSelectedFields(buildDefaultFields(nextPreview, targetCustomer));
      if (nextPreview.lookupStatus !== "FOUND") {
        setError("Mock fiscal sin datos. Registro manual disponible.");
      }
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : "No se pudo consultar el mock fiscal."
      );
    } finally {
      setLookupLoading(false);
    }
  };

  const toggleField = (field: ThirdPartyLookupField) => {
    setSelectedFields((current) =>
      current.includes(field)
        ? current.filter((item) => item !== field)
        : [...current, field]
    );
  };

  const buildCreatePayload = () => {
    const lookupData = preview?.lookupStatus === "FOUND" ? preview.data : null;
    const name =
      trimToNull(form.name) ??
      lookupData?.legalName ??
      lookupData?.name ??
      "Cliente POS";
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
        preview?.provider === "MOCK_LOCAL" ? ("MOCK_LOCAL" as const) : ("MANUAL" as const),
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
      let savedCustomer = await createElectronicInvoicingCustomer(payload);

      if (preview?.lookupStatus === "FOUND" && selectedFields.length > 0) {
        const applied = await applyElectronicInvoicingCustomerLookup(
          savedCustomer.id,
          {
            documentTypeCode: payload.documentTypeCode,
            documentNumber: payload.documentNumber,
            fieldsToApply: selectedFields,
          }
        );
        savedCustomer = applied.customer;
        setLastApplyFields(applied.appliedFields);
      }

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

  const handleApplyExisting = async () => {
    if (!targetCustomer) {
      setError("Selecciona un cliente existente.");
      return;
    }
    if (!preview || preview.lookupStatus !== "FOUND") {
      setError("Consulta mock requerida.");
      return;
    }

    setSaveLoading(true);
    setError(null);
    try {
      const applied = await applyElectronicInvoicingCustomerLookup(
        targetCustomer.id,
        {
          documentTypeCode: form.documentTypeCode,
          documentNumber: form.documentNumber,
          fieldsToApply: selectedFields,
        }
      );
      setLastApplyFields(applied.appliedFields);
      await onCustomerSaved(applied.customer);
      onClose();
    } catch (applyError) {
      setError(
        applyError instanceof Error
          ? applyError.message
          : "No se pudo aplicar el lookup mock."
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

  const previewFound = preview?.lookupStatus === "FOUND" && preview.data;

  return (
    <Modal
      title="Cliente fiscal rapido"
      size="xl"
      onClose={closeModal}
      className="max-h-[calc(100vh-2rem)] overflow-y-auto dark:bg-slate-950"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Search className="h-4 w-4" />
              Buscar cliente
            </div>
            <Input
              label="Busqueda"
              placeholder="Nombre, documento o email"
              value={customerQuery}
              onChange={(event) => setCustomerQuery(event.target.value)}
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
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
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

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <UserPlus className="h-4 w-4" />
              Datos rapidos
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
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
              <Input
                label="Numero"
                inputMode="text"
                value={form.documentNumber}
                onChange={(event) => updateForm("documentNumber", event.target.value)}
              />
              <Input
                label="Nombre"
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
              />
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
              <Input
                label="Direccion"
                value={form.address}
                onChange={(event) => updateForm("address", event.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <ShieldCheck className="h-4 w-4" />
                Mock DIAN
              </div>
              <Button
                variant="outline"
                size="sm"
                isLoading={lookupLoading}
                onClick={() => void handleLookup()}
                disabled={saveLoading}
              >
                <FileCheck2 className="h-4 w-4" />
                Consultar
              </Button>
            </div>

            {preview ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {preview.lookupStatus}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {preview.provider}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {preview.statusCode}
                </p>
              </div>
            ) : null}

            {previewFound ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {FIELD_OPTIONS.map(({ field, label }) => {
                  const value = getPreviewValue(preview, field);
                  const hasValue =
                    value !== null &&
                    value !== undefined &&
                    (!Array.isArray(value) || value.length > 0);
                  if (!hasValue) {
                    return null;
                  }
                  const checked = selectedFields.includes(field);
                  return (
                    <label
                      key={field}
                      className={`flex min-h-16 items-start gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                        checked
                          ? "border-blue-300 bg-blue-50 dark:border-blue-500/50 dark:bg-blue-500/10"
                          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                        checked={checked}
                        onChange={() => toggleField(field)}
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold text-slate-800 dark:text-slate-100">
                          {label}
                        </span>
                        <span className="block break-words text-xs text-slate-500 dark:text-slate-400">
                          {formatPreviewValue(value)}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : null}

            {lastApplyFields.length > 0 ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                Campos aplicados: {lastApplyFields.length}
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                <span>{error}</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={closeModal} disabled={lookupLoading || saveLoading}>
              Cerrar
            </Button>
            <Button
              variant="outline"
              isLoading={saveLoading}
              onClick={() => void handleApplyExisting()}
              disabled={!targetCustomer || !previewFound || lookupLoading || saveLoading}
            >
              Aplicar a existente
            </Button>
            <Button
              isLoading={saveLoading}
              onClick={() => void handleCreateCustomer()}
              disabled={lookupLoading || saveLoading}
            >
              Crear y usar
            </Button>
          </div>
        </section>
      </div>
    </Modal>
  );
};
