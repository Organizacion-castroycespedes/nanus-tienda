"use client";

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { Textarea } from "../../../components/design-system/Textarea";
import {
  listCountries,
  listDepartments,
  listMunicipalities,
} from "../../../domains/locations/api";
import type {
  CountryResponse,
  DepartmentResponse,
  MunicipalityResponse,
} from "../../../domains/locations/dtos";
import {
  applyElectronicInvoicingCustomerLookup,
  createElectronicInvoicingCustomer,
  lookupElectronicInvoicingCustomer,
  updateElectronicInvoicingCustomer,
  type CreateElectronicInvoicingCustomerPayload,
  type ElectronicInvoicingCustomer,
  type ThirdPartyLookupField,
  type ThirdPartyLookupPreview,
  type UpdateElectronicInvoicingCustomerPayload,
} from "../../electronic-invoicing/services/customer.service";
import {
  updateCustomer,
  type CustomerFiscalDataSource,
  type CustomerFiscalStatus,
  type CustomerPersonType,
  type CustomerResponse,
} from "../services/customer.service";
import {
  FISCAL_PERSON_TYPE_OPTIONS,
  FISCAL_RESPONSIBILITY_OPTIONS,
  FISCAL_TAX_REGIME_OPTIONS,
} from "../../electronic-invoicing/fiscal-profile-options";

type CustomerFormValues = {
  name: string;
  dianIdentificationType: string;
  identificationNumber: string;
  verificationDigit: string;
  legalName: string;
  tradeName: string;
  email: string;
  invoiceEmail: string;
  phone: string;
  address: string;
  countryId: string;
  departamentoId: string;
  municipioId: string;
  countryCode: string;
  departmentCode: string;
  municipalityCode: string;
  personType: "" | CustomerPersonType;
  taxRegime: string;
  taxResponsibilities: string;
  fiscalDataSource: CustomerFiscalDataSource;
  fiscalStatus: CustomerFiscalStatus;
  isDianValidated: boolean;
  isFinalConsumer: boolean;
  isActive: boolean;
};

type CustomerFormErrors = Partial<Record<keyof CustomerFormValues, string>> & {
  submit?: string;
};

type CustomerFormProps = {
  mode: "create" | "edit";
  customer?: CustomerResponse | null;
  onCancel: () => void;
  onSuccess: (mode: "create" | "edit") => void;
};

type LookupMessageVariant = "success" | "warning" | "error";

const LOOKUP_FIELD_OPTIONS: Array<{
  field: ThirdPartyLookupField;
  label: string;
}> = [
  { field: "name", label: "Nombre" },
  { field: "documentTypeCode", label: "Tipo DIAN" },
  { field: "documentNumber", label: "Numero ID" },
  { field: "verificationDigit", label: "DV" },
  { field: "legalName", label: "Razon social / nombre fiscal" },
  { field: "tradeName", label: "Nombre comercial" },
  { field: "fiscalEmail", label: "Email factura" },
  { field: "phone", label: "Telefono" },
  { field: "address", label: "Direccion" },
  { field: "countryCode", label: "País" },
  { field: "departmentCode", label: "Departamento" },
  { field: "municipalityCode", label: "Municipio" },
  { field: "personType", label: "Tipo persona" },
  { field: "taxRegime", label: "Regimen" },
  { field: "taxResponsibilities", label: "Responsabilidades" },
];

const createInitialValues = (customer?: CustomerResponse | null): CustomerFormValues => ({
  name: customer?.name ?? "",
  dianIdentificationType:
    customer?.dianIdentificationType ?? customer?.documentTypeCode ?? "31",
  identificationNumber:
    customer?.identificationNumber ??
    customer?.documentNumberNormalized ??
    customer?.documentNumber ??
    "",
  verificationDigit: customer?.verificationDigit ?? "",
  legalName: customer?.legalName ?? "",
  tradeName: customer?.tradeName ?? "",
  email: customer?.email ?? customer?.fiscalEmail ?? customer?.invoiceEmail ?? "",
  invoiceEmail: customer?.invoiceEmail ?? customer?.fiscalEmail ?? customer?.email ?? "",
  phone: customer?.phone ?? "",
  address: customer?.address ?? "",
  countryId: "",
  departamentoId: customer?.departamentoId ?? "",
  municipioId: customer?.municipioId ?? "",
  countryCode: customer?.countryCode ?? "",
  departmentCode: customer?.departmentCode ?? "",
  municipalityCode: customer?.municipalityCode ?? "",
  personType: customer?.personType ?? "",
  taxRegime: customer?.taxRegime ?? "",
  taxResponsibilities: customer?.taxResponsibilities?.join(", ") ?? "",
  fiscalDataSource: customer?.fiscalDataSource ?? "MANUAL",
  fiscalStatus:
    customer?.fiscalStatus ?? (customer?.isFinalConsumer ? "NOT_REQUIRED" : "PENDING"),
  isDianValidated: customer?.isDianValidated ?? false,
  isFinalConsumer: customer?.isFinalConsumer ?? false,
  isActive: customer?.isFinalConsumer ? true : customer?.isActive ?? true,
});

const isValidEmail = (value: string) =>
  value.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const trimToNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const splitTaxResponsibilities = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const hasUsefulValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value !== null && value !== undefined && String(value).trim() !== "";
};

const formatPreviewValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "-";
  }
  if (!hasUsefulValue(value)) {
    return "-";
  }
  return String(value);
};

const normalizeCompareValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join("|");
  }
  return String(value ?? "").trim().toLowerCase();
};

const valuesAreEqual = (left: unknown, right: unknown) =>
  normalizeCompareValue(left) === normalizeCompareValue(right);

const getPreviewValue = (
  preview: ThirdPartyLookupPreview,
  field: ThirdPartyLookupField
) => {
  if (!preview.data) {
    return null;
  }
  if (field === "documentNumber") {
    return preview.data.documentNumberNormalized || preview.data.documentNumber;
  }
  if (field === "fiscalEmail") {
    return preview.data.invoiceEmail ?? preview.data.fiscalEmail;
  }
  return preview.data[field] ?? null;
};

const getCurrentFieldValue = (
  values: CustomerFormValues,
  field: ThirdPartyLookupField
) => {
  if (field === "documentTypeCode") {
    return values.dianIdentificationType;
  }
  if (field === "documentNumber") {
    return values.identificationNumber;
  }
  if (field === "fiscalEmail") {
    return values.invoiceEmail;
  }
  if (field === "taxResponsibilities") {
    return splitTaxResponsibilities(values.taxResponsibilities);
  }
  if (field === "personType") {
    return values.personType;
  }
  return values[field as keyof CustomerFormValues];
};

const buildDefaultSelectedFields = (
  preview: ThirdPartyLookupPreview,
  values: CustomerFormValues
) => {
  if (!preview.data || preview.lookupStatus !== "FOUND") {
    return [];
  }

  return LOOKUP_FIELD_OPTIONS.filter(({ field }) => {
    const previewValue = getPreviewValue(preview, field);
    const currentValue = getCurrentFieldValue(values, field);
    return hasUsefulValue(previewValue) && !hasUsefulValue(currentValue);
  }).map(({ field }) => field);
};

const getOverwriteFields = (
  preview: ThirdPartyLookupPreview | null,
  values: CustomerFormValues,
  selectedFields: ThirdPartyLookupField[]
) => {
  if (!preview?.data || preview.lookupStatus !== "FOUND") {
    return [];
  }

  return selectedFields.filter((field) => {
    const currentValue = getCurrentFieldValue(values, field);
    const previewValue = getPreviewValue(preview, field);
    return (
      hasUsefulValue(currentValue) &&
      hasUsefulValue(previewValue) &&
      !valuesAreEqual(currentValue, previewValue)
    );
  });
};

const applyPreviewToValues = (
  current: CustomerFormValues,
  preview: ThirdPartyLookupPreview,
  fields: ThirdPartyLookupField[]
): CustomerFormValues => {
  if (!preview.data || preview.lookupStatus !== "FOUND") {
    return current;
  }

  const next: CustomerFormValues = {
    ...current,
    fiscalDataSource: preview.provider === "MOCK_LOCAL" ? "MOCK_LOCAL" : "UNKNOWN",
    fiscalStatus: fields.length > 0 ? "VALIDATED" : current.fiscalStatus,
    isDianValidated: fields.length > 0 ? true : current.isDianValidated,
  };

  fields.forEach((field) => {
    const value = getPreviewValue(preview, field);
    if (!hasUsefulValue(value)) {
      return;
    }

    if (field === "documentTypeCode") {
      next.dianIdentificationType = String(value);
      return;
    }
    if (field === "documentNumber") {
      next.identificationNumber = String(value);
      return;
    }
    if (field === "fiscalEmail") {
      next.invoiceEmail = String(value);
      if (!next.email.trim()) {
        next.email = String(value);
      }
      return;
    }
    if (field === "taxResponsibilities") {
      next.taxResponsibilities = Array.isArray(value)
        ? value.join(", ")
        : String(value);
      return;
    }
    if (field === "personType") {
      next.personType = String(value) as CustomerFormValues["personType"];
      return;
    }

    next[field as keyof CustomerFormValues] = String(value) as never;
  });

  return next;
};

const mergeFiscalCustomerIntoValues = (
  current: CustomerFormValues,
  customer: ElectronicInvoicingCustomer
): CustomerFormValues => ({
  ...current,
  name: customer.name ?? current.name,
  dianIdentificationType:
    customer.dianIdentificationType ?? customer.documentTypeCode ?? "",
  identificationNumber:
    customer.identificationNumber ??
    customer.documentNumberNormalized ??
    customer.documentNumber ??
    "",
  verificationDigit: customer.verificationDigit ?? "",
  legalName: customer.legalName ?? "",
  tradeName: customer.tradeName ?? "",
  invoiceEmail: customer.invoiceEmail ?? customer.fiscalEmail ?? current.invoiceEmail,
  phone: customer.phone ?? "",
  address: customer.address ?? "",
  countryCode: customer.countryCode ?? "",
  departmentCode: customer.departmentCode ?? "",
  municipalityCode: customer.municipalityCode ?? "",
  personType: customer.personType ?? "",
  taxRegime: customer.taxRegime ?? "",
  taxResponsibilities: customer.taxResponsibilities.join(", "),
  fiscalDataSource: customer.fiscalDataSource,
  fiscalStatus: customer.fiscalStatus,
  isDianValidated: customer.isDianValidated,
  isFinalConsumer: customer.isFinalConsumer,
  isActive: customer.isFinalConsumer ? true : customer.isActive,
});

export const CustomerForm = ({
  mode,
  customer,
  onCancel,
  onSuccess,
}: CustomerFormProps) => {
  const [values, setValues] = useState<CustomerFormValues>(createInitialValues(customer));
  const [errors, setErrors] = useState<CustomerFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countries, setCountries] = useState<CountryResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [municipalities, setMunicipalities] = useState<MunicipalityResponse[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [municipalitiesLoading, setMunicipalitiesLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ThirdPartyLookupPreview | null>(null);
  const [selectedFields, setSelectedFields] = useState<ThirdPartyLookupField[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [lookupMessageVariant, setLookupMessageVariant] =
    useState<LookupMessageVariant>("success");
  const [overwriteConfirmed, setOverwriteConfirmed] = useState(false);
  const [lastAppliedFields, setLastAppliedFields] = useState<ThirdPartyLookupField[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const previewFound = preview?.lookupStatus === "FOUND" && preview.data;
  const overwriteFields = useMemo(
    () => getOverwriteFields(preview, values, selectedFields),
    [preview, selectedFields, values]
  );

  useEffect(() => {
    setValues(createInitialValues(customer));
    setErrors({});
    setPreview(null);
    setSelectedFields([]);
    setLookupMessage(null);
    setOverwriteConfirmed(false);
    setLastAppliedFields([]);
  }, [mode, customer]);

  useEffect(() => {
    let mounted = true;

    const loadCountries = async () => {
      setCountriesLoading(true);
      setLocationError(null);

      try {
        const items = await listCountries();
        if (!mounted) {
          return;
        }

        setCountries(items);
        setValues((prev) => {
          const selected =
            items.find((country) => country.codigo_iso2 === prev.countryCode) ??
            items.find((country) => country.id === prev.countryId) ??
            items[0];
          return {
            ...prev,
            countryId: selected?.id ?? "",
            countryCode: selected?.codigo_iso2 ?? "",
          };
        });
      } catch {
        if (mounted) {
          setLocationError("No se pudo cargar la ubicacion.");
        }
      } finally {
        if (mounted) {
          setCountriesLoading(false);
        }
      }
    };

    void loadCountries();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadDepartments = async () => {
      if (!values.countryId) {
        setDepartments([]);
        return;
      }

      setDepartmentsLoading(true);
      try {
        const items = await listDepartments(values.countryId);
        if (!mounted) {
          return;
        }
        setDepartments(items);
        setValues((prev) => {
          const selected =
            items.find((department) => department.codigo_dane === prev.departmentCode) ??
            items.find((department) => department.id === prev.departamentoId);
          return {
            ...prev,
            departamentoId: selected?.id ?? "",
            departmentCode: selected?.codigo_dane ?? "",
          };
        });
      } catch {
        if (mounted) {
          setLocationError("No se pudieron cargar los departamentos.");
        }
      } finally {
        if (mounted) {
          setDepartmentsLoading(false);
        }
      }
    };

    void loadDepartments();

    return () => {
      mounted = false;
    };
  }, [values.countryId]);

  useEffect(() => {
    let mounted = true;

    const loadMunicipalities = async () => {
      if (!values.departamentoId) {
        setMunicipalities([]);
        return;
      }

      setMunicipalitiesLoading(true);
      try {
        const items = await listMunicipalities(values.departamentoId);
        if (!mounted) {
          return;
        }
        setMunicipalities(items);
        setValues((prev) => {
          const selected =
            items.find((municipality) => municipality.codigo_dane === prev.municipalityCode) ??
            items.find((municipality) => municipality.id === prev.municipioId);
          return {
            ...prev,
            municipioId: selected?.id ?? "",
            municipalityCode: selected?.codigo_dane ?? "",
          };
        });
      } catch {
        if (mounted) {
          setLocationError("No se pudieron cargar los municipios.");
        }
      } finally {
        if (mounted) {
          setMunicipalitiesLoading(false);
        }
      }
    };

    void loadMunicipalities();

    return () => {
      mounted = false;
    };
  }, [values.departamentoId]);

  useEffect(() => {
    const selected = countries.find(
      (country) => country.codigo_iso2 === values.countryCode
    );
    if (selected && selected.id !== values.countryId) {
      setValues((prev) => ({ ...prev, countryId: selected.id }));
    }
  }, [countries, values.countryCode, values.countryId]);

  useEffect(() => {
    const selected = departments.find(
      (department) => department.codigo_dane === values.departmentCode
    );
    if (selected && selected.id !== values.departamentoId) {
      setValues((prev) => ({ ...prev, departamentoId: selected.id }));
    }
  }, [departments, values.departmentCode, values.departamentoId]);

  useEffect(() => {
    const selected = municipalities.find(
      (municipality) => municipality.codigo_dane === values.municipalityCode
    );
    if (selected && selected.id !== values.municipioId) {
      setValues((prev) => ({ ...prev, municipioId: selected.id }));
    }
  }, [municipalities, values.municipalityCode, values.municipioId]);

  const resetLookupState = () => {
    setPreview(null);
    setSelectedFields([]);
    setLookupMessage(null);
    setOverwriteConfirmed(false);
    setLastAppliedFields([]);
  };

  const updateValue = <K extends keyof CustomerFormValues>(
    field: K,
    value: CustomerFormValues[K]
  ) => {
    setValues((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "name" && (!prev.legalName || prev.legalName === prev.name)) {
        next.legalName = value as string;
      }
      if (field === "email" && (!prev.invoiceEmail || prev.invoiceEmail === prev.email)) {
        next.invoiceEmail = value as string;
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, [field]: undefined, submit: undefined }));
    resetLookupState();
  };

  const toggleResponsibility = (code: string) => {
    const currentList = splitTaxResponsibilities(values.taxResponsibilities);
    const exists = currentList.includes(code);
    const updated = exists
      ? currentList.filter((item) => item !== code)
      : [...currentList, code];
    updateValue("taxResponsibilities", updated.join(", "));
  };

  const validate = () => {
    const nextErrors: CustomerFormErrors = {};

    if (!values.name.trim()) {
      nextErrors.name = "El nombre es requerido.";
    }
    if (!isValidEmail(values.email)) {
      nextErrors.email = "El correo comercial no es valido.";
    }
    if (!isValidEmail(values.invoiceEmail)) {
      nextErrors.invoiceEmail = "El correo de factura no es valido.";
    }
    if (!values.countryCode) {
      nextErrors.countryCode = "El pais es requerido.";
    }
    if (values.countryCode === "CO" && !values.departmentCode) {
      nextErrors.departmentCode = "El departamento es requerido.";
    }
    if (values.countryCode === "CO" && !values.municipalityCode) {
      nextErrors.municipalityCode = "El municipio es requerido.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildFiscalPayload = ():
    | CreateElectronicInvoicingCustomerPayload
    | UpdateElectronicInvoicingCustomerPayload => {
    const invoiceEmail = trimToNull(values.invoiceEmail);
    const fiscalStatus = values.isFinalConsumer
      ? "NOT_REQUIRED"
      : values.fiscalStatus;

    return {
      name: values.name.trim(),
      documentNumber: trimToNull(values.identificationNumber),
      documentTypeCode: trimToNull(values.dianIdentificationType),
      dianIdentificationType: trimToNull(values.dianIdentificationType),
      identificationNumber: trimToNull(values.identificationNumber),
      verificationDigit: trimToNull(values.verificationDigit),
      legalName: trimToNull(values.legalName),
      tradeName: trimToNull(values.tradeName),
      fiscalEmail: invoiceEmail,
      invoiceEmail,
      phone: trimToNull(values.phone),
      address: trimToNull(values.address),
      countryId: trimToNull(values.countryId),
      departamentoId: trimToNull(values.departamentoId),
      municipioId: trimToNull(values.municipioId),
      countryCode: trimToNull(values.countryCode),
      departmentCode: trimToNull(values.departmentCode),
      municipalityCode: trimToNull(values.municipalityCode),
      personType: values.personType || null,
      taxRegime: trimToNull(values.taxRegime),
      taxResponsibilities: splitTaxResponsibilities(values.taxResponsibilities),
      isFinalConsumer: values.isFinalConsumer,
      isDianValidated: values.isFinalConsumer ? false : values.isDianValidated,
      fiscalDataSource: "MANUAL",
      fiscalStatus,
      isActive: values.isFinalConsumer ? true : values.isActive,
    };
  };

  const buildLegacyPayload = () => {
    const selectedDepartment = departments.find(
      (department) => department.id === values.departamentoId
    );
    const selectedMunicipality = municipalities.find(
      (municipality) => municipality.id === values.municipioId
    );

    return {
      name: values.name.trim(),
      documentNumber: trimToNull(values.identificationNumber),
      phone: trimToNull(values.phone),
      email: trimToNull(values.email),
      address: trimToNull(values.address),
      departamentoId: values.departamentoId || null,
      municipioId: values.municipioId || null,
      ciudad: selectedMunicipality?.nombre ?? null,
      departamento: selectedDepartment?.nombre ?? null,
      isActive: values.isFinalConsumer ? true : values.isActive,
    };
  };

  const handleLookup = async () => {
    const documentTypeCode = trimToNull(values.dianIdentificationType);
    const documentNumber = trimToNull(values.identificationNumber);

    if (!documentTypeCode || !documentNumber) {
      setLookupMessage("Tipo DIAN y numero son requeridos.");
      setLookupMessageVariant("warning");
      return;
    }

    setLookupLoading(true);
    setLookupMessage(null);
    setLastAppliedFields([]);
    setOverwriteConfirmed(false);

    try {
      const nextPreview = await lookupElectronicInvoicingCustomer({
        documentTypeCode,
        documentNumber,
      });
      setPreview(nextPreview);
      setSelectedFields(buildDefaultSelectedFields(nextPreview, values));
      if (nextPreview.lookupStatus === "FOUND") {
        setLookupMessage("Consulta DIAN lista.");
        setLookupMessageVariant("success");
      } else {
        setLookupMessage("DIAN no encontro datos. Puedes guardar manual.");
        setLookupMessageVariant("warning");
      }
    } catch (error) {
      setLookupMessage(
        error instanceof Error
          ? error.message
          : "No se pudo consultar DIAN."
      );
      setLookupMessageVariant("error");
    } finally {
      setLookupLoading(false);
    }
  };

  const toggleLookupField = (field: ThirdPartyLookupField) => {
    setSelectedFields((current) =>
      current.includes(field)
        ? current.filter((item) => item !== field)
        : [...current, field]
    );
    setOverwriteConfirmed(false);
  };

  const handleApplyPreview = async () => {
    if (!preview || preview.lookupStatus !== "FOUND") {
      setLookupMessage("Consulta DIAN requerida.");
      setLookupMessageVariant("warning");
      return;
    }
    if (selectedFields.length === 0) {
      setLookupMessage("Selecciona al menos un campo.");
      setLookupMessageVariant("warning");
      return;
    }
    if (overwriteFields.length > 0 && !overwriteConfirmed) {
      setLookupMessage("Confirma overwrite manual antes de aplicar.");
      setLookupMessageVariant("warning");
      return;
    }

    if (mode === "create" || !customer) {
      setValues((current) => applyPreviewToValues(current, preview, selectedFields));
      setLastAppliedFields(selectedFields);
      setLookupMessage("Campos DIAN aplicados al formulario.");
      setLookupMessageVariant("success");
      return;
    }

    setLookupLoading(true);
    setLookupMessage(null);
    try {
      const applied = await applyElectronicInvoicingCustomerLookup(customer.id, {
        documentTypeCode: values.dianIdentificationType,
        documentNumber: values.identificationNumber,
        fieldsToApply: selectedFields,
      });
      setValues((current) => mergeFiscalCustomerIntoValues(current, applied.customer));
      setLastAppliedFields(applied.appliedFields);
      setLookupMessage("Campos DIAN aplicados al cliente.");
      setLookupMessageVariant("success");
    } catch (error) {
      setLookupMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron aplicar campos DIAN."
      );
      setLookupMessageVariant("error");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const fiscalPayload = buildFiscalPayload();
      const legacyPayload = buildLegacyPayload();

      if (mode === "create") {
        const created = await createElectronicInvoicingCustomer(
          fiscalPayload as CreateElectronicInvoicingCustomerPayload
        );
        await updateCustomer(created.id, legacyPayload);
      } else if (customer) {
        await updateElectronicInvoicingCustomer(
          customer.id,
          fiscalPayload as UpdateElectronicInvoicingCustomerPayload
        );
        await updateCustomer(customer.id, legacyPayload);
      }

      onSuccess(mode);
    } catch (error) {
      setErrors({
        submit:
          error instanceof Error
            ? error.message
            : mode === "create"
              ? "No se pudo crear el cliente."
              : "No se pudo actualizar el cliente.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const lookupMessageClass =
    lookupMessageVariant === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : lookupMessageVariant === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Customers</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {mode === "create" ? "Crear cliente" : "Editar cliente"}
          </h2>
        </div>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* SECCIÓN 1: Identificación y Datos Básicos */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-700/60 dark:bg-slate-800/40">
          <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
            <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              1. Identificación y Datos Básicos
            </h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Tipo de documento"
              value={values.dianIdentificationType}
              onChange={(event) =>
                updateValue("dianIdentificationType", event.target.value)
              }
            >
              <option value="">Selecciona tipo de documento</option>
              <option value="13">Cédula de ciudadanía</option>
              <option value="31">NIT (Número de Identificación Tributaria)</option>
              <option value="12">Tarjeta de identidad</option>
              <option value="22">Cédula de extranjería</option>
              <option value="41">Pasaporte</option>
              <option value="47">PPT (Permiso por Protección Temporal)</option>
              <option value="48">PEP (Permiso Especial de Permanencia)</option>
              <option value="11">Registro civil</option>
              <option value="21">Tarjeta de extranjería</option>
              <option value="42">Documento de identificación extranjero</option>
              <option value="50">NIT de otro país</option>
              <option value="91">NUIP</option>
            </Select>

            <div className="grid grid-cols-3 gap-2">
              <div className={values.dianIdentificationType === "31" ? "col-span-2" : "col-span-3"}>
                <Input
                  label="Número de identificación / NIT"
                  required
                  placeholder="Ej: 1020304050"
                  value={values.identificationNumber}
                  onChange={(event) =>
                    updateValue("identificationNumber", event.target.value)
                  }
                />
              </div>
              {values.dianIdentificationType === "31" ? (
                <div className="col-span-1">
                  <Input
                    label="DV"
                    placeholder="0"
                    maxLength={1}
                    value={values.verificationDigit}
                    onChange={(event) =>
                      updateValue("verificationDigit", event.target.value)
                    }
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-1 md:col-span-2">
              <Input
                label="Nombre completo / Razón social"
                required
                placeholder="Nombre de la persona o razón social registrada en RUT"
                value={values.name}
                onChange={(event) => updateValue("name", event.target.value)}
              />
              {errors.name ? <p className="text-xs text-rose-600">{errors.name}</p> : null}
            </div>

            <div>
              <Input
                label="Razón social fiscal (si difiere)"
                placeholder="Nombre fiscal oficial registrado en DIAN"
                value={values.legalName}
                onChange={(event) => updateValue("legalName", event.target.value)}
              />
            </div>

            <div>
              <Input
                label="Nombre comercial (opcional)"
                placeholder="Ej: Tienda Don Pedro"
                value={values.tradeName}
                onChange={(event) => updateValue("tradeName", event.target.value)}
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: Contacto y Facturación Electrónica */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-700/60 dark:bg-slate-800/40">
          <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
            <Mail className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              2. Contacto y Facturación Electrónica
            </h3>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Input
                label="Teléfono / Celular"
                placeholder="Ej: 3001234567"
                value={values.phone}
                onChange={(event) => updateValue("phone", event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Input
                label="Correo comercial / general"
                placeholder="cliente@ejemplo.com"
                value={values.email}
                onChange={(event) => updateValue("email", event.target.value)}
              />
              {errors.email ? <p className="text-xs text-rose-600">{errors.email}</p> : null}
            </div>

            <div className="space-y-1">
              <Input
                label="Correo para factura electrónica"
                placeholder="facturacion@ejemplo.com"
                value={values.invoiceEmail}
                onChange={(event) => updateValue("invoiceEmail", event.target.value)}
              />
              {errors.invoiceEmail ? (
                <p className="text-xs text-rose-600">{errors.invoiceEmail}</p>
              ) : null}
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                A esta dirección la DIAN enviará el XML y PDF de la factura.
              </p>
            </div>
          </div>
        </div>

        {/* SECCIÓN 3: Ubicación y Domicilio Fiscal */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-700/60 dark:bg-slate-800/40">
          <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
            <MapPin className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              3. Ubicación y Domicilio Fiscal
            </h3>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Select
                label="País"
                value={values.countryId}
                disabled={countriesLoading || countries.length === 0}
                onChange={(event) => {
                  setValues((prev) => ({
                    ...prev,
                    countryId: event.target.value,
                    departamentoId: "",
                    municipioId: "",
                    countryCode:
                      countries.find((country) => country.id === event.target.value)?.codigo_iso2 ??
                      "",
                    departmentCode: "",
                    municipalityCode: "",
                  }));
                  setErrors((prev) => ({ ...prev, submit: undefined }));
                  resetLookupState();
                }}
              >
                <option value="">{countriesLoading ? "Cargando..." : "Selecciona un país"}</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.nombre}
                  </option>
                ))}
              </Select>
              {errors.countryCode ? (
                <p className="text-xs text-rose-600 mt-1">{errors.countryCode}</p>
              ) : null}
            </div>

            <div>
              <Select
                label="Departamento"
                value={values.departamentoId}
                disabled={departmentsLoading || departments.length === 0}
                onChange={(event) => {
                  setValues((prev) => ({
                    ...prev,
                    departamentoId: event.target.value,
                    municipioId: "",
                    departmentCode:
                      departments.find((department) => department.id === event.target.value)
                        ?.codigo_dane ?? "",
                    municipalityCode: "",
                  }));
                  resetLookupState();
                }}
              >
                <option value="">
                  {departmentsLoading ? "Cargando..." : "Selecciona un departamento"}
                </option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.nombre}
                  </option>
                ))}
              </Select>
              {errors.departmentCode ? (
                <p className="text-xs text-rose-600 mt-1">{errors.departmentCode}</p>
              ) : null}
            </div>

            <div>
              <Select
                label="Municipio / Ciudad"
                value={values.municipioId}
                disabled={municipalitiesLoading || municipalities.length === 0}
                onChange={(event) => {
                  const selected = municipalities.find(
                    (municipality) => municipality.id === event.target.value
                  );
                  setValues((prev) => ({
                    ...prev,
                    municipioId: event.target.value,
                    municipalityCode: selected?.codigo_dane ?? "",
                  }));
                  resetLookupState();
                }}
              >
                <option value="">
                  {municipalitiesLoading ? "Cargando..." : "Selecciona un municipio"}
                </option>
                {municipalities.map((municipality) => (
                  <option key={municipality.id} value={municipality.id}>
                    {municipality.nombre}
                  </option>
                ))}
              </Select>
              {errors.municipalityCode ? (
                <p className="text-xs text-rose-600 mt-1">{errors.municipalityCode}</p>
              ) : null}
            </div>

            <div className="md:col-span-3">
              <Input
                label="Dirección física"
                placeholder="Ej: Carrera 15 # 85-30 Oficina 402"
                value={values.address}
                onChange={(event) => updateValue("address", event.target.value)}
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN 4: Perfil Tributario DIAN */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-700/60 dark:bg-slate-800/40">
          <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
            <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              4. Perfil Tributario DIAN
            </h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Tipo de persona"
              value={values.personType}
              onChange={(event) =>
                updateValue(
                  "personType",
                  event.target.value as CustomerFormValues["personType"]
                )
              }
            >
              <option value="">Selecciona tipo de persona</option>
              {FISCAL_PERSON_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              {values.personType === "UNKNOWN" ? (
                <option value="UNKNOWN">Requiere revisión</option>
              ) : null}
            </Select>

            <Select
              label="Régimen tributario"
              value={values.taxRegime}
              onChange={(event) => updateValue("taxRegime", event.target.value)}
            >
              <option value="">Selecciona un régimen</option>
              {FISCAL_TAX_REGIME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              {values.taxRegime &&
              !FISCAL_TAX_REGIME_OPTIONS.some((option) => option.value === values.taxRegime) ? (
                <option value={values.taxRegime}>Valor existente: {values.taxRegime}</option>
              ) : null}
            </Select>
          </div>

          {/* Pastillas Interactivas de Responsabilidades Fiscales */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
              Responsabilidades fiscales
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5">
              Toca cada botón para marcar o desmarcar responsabilidades:
            </p>
            <div className="flex flex-wrap gap-2">
              {FISCAL_RESPONSIBILITY_OPTIONS.map((option) => {
                const currentList = splitTaxResponsibilities(values.taxResponsibilities);
                const isSelected = currentList.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleResponsibility(option.value)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-all ${
                      isSelected
                        ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300 shadow-sm"
                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/60"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                        isSelected
                          ? "bg-blue-600 text-white dark:bg-blue-500"
                          : "border border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {isSelected ? "✓" : ""}
                    </span>
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
            {values.taxResponsibilities ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Seleccionadas: <strong className="text-slate-700 dark:text-slate-200">{values.taxResponsibilities}</strong>
              </p>
            ) : null}
          </div>

          {/* Consulta DIAN / RUT */}
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/80">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Consulta automática en DIAN / RUT
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  isLoading={lookupLoading}
                  disabled={isSubmitting}
                  onClick={() => void handleLookup()}
                >
                  <FileCheck2 className="h-4 w-4" />
                  Consultar DIAN
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    !previewFound ||
                    selectedFields.length === 0 ||
                    lookupLoading ||
                    isSubmitting ||
                    (overwriteFields.length > 0 && !overwriteConfirmed)
                  }
                  onClick={() => void handleApplyPreview()}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Aplicar selección
                </Button>
              </div>
            </div>

            {preview ? (
              <div className="mb-3 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm md:grid-cols-4 dark:bg-slate-700/50 dark:border-slate-600">
                <div>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">Estado</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {preview.lookupStatus === "FOUND" ? "Encontrado" : preview.lookupStatus}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">Proveedor</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {preview.provider}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">Código</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {preview.statusCode}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">Campos disponibles</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {preview.responseSummary.fieldCount}
                  </span>
                </div>
                <p className="md:col-span-4 text-xs text-slate-600 dark:text-slate-300">
                  {preview.message}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ingresa el tipo y número de documento, y haz clic en &quot;Consultar DIAN&quot; para autocompletar la razón social, régimen y responsabilidades fiscales directamente desde el registro tributario.
              </p>
            )}

            {preview && preview.lookupStatus === "FOUND" && preview.data ? (
              <div className="grid gap-3 md:grid-cols-2 mt-3">
                {LOOKUP_FIELD_OPTIONS.map(({ field, label }) => {
                  const value = getPreviewValue(preview, field);
                  if (!hasUsefulValue(value)) {
                    return null;
                  }
                  const checked = selectedFields.includes(field);
                  const overwrites = overwriteFields.includes(field);
                  return (
                    <label
                      key={field}
                      className={`flex min-h-14 items-start gap-3 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                        checked
                          ? "border-blue-300 bg-blue-50/60 dark:border-blue-600 dark:bg-blue-950/40"
                          : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                        checked={checked}
                        onChange={() => toggleLookupField(field)}
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold text-slate-800 dark:text-slate-100">
                          {label}
                          {overwrites ? (
                            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              Sobrescribe valor actual
                            </span>
                          ) : null}
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

            {overwriteFields.length > 0 ? (
              <label className="mt-3 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-600"
                  checked={overwriteConfirmed}
                  onChange={(event) => setOverwriteConfirmed(event.target.checked)}
                />
                Confirmo sobrescribir {overwriteFields.length} campo(s) previamente ingresado(s).
              </label>
            ) : null}

            {lastAppliedFields.length > 0 ? (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                ✓ Se aplicaron {lastAppliedFields.length} campo(s) exitosamente.
              </div>
            ) : null}

            {lookupMessage ? (
              <div
                className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${lookupMessageClass}`}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                <span>{lookupMessage}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* SECCIÓN 5: Configuración Técnica y Estado Fiscal (Colapsible) */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="flex w-full items-center justify-between p-4 text-left font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/50 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold">Configuración técnica y estado fiscal</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {values.isDianValidated ? "Validado DIAN" : "Avanzado"}
              </span>
            </div>
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {showAdvanced ? (
            <div className="border-t border-slate-200 p-4 space-y-4 dark:border-slate-700">
              <div className="grid gap-4 md:grid-cols-3">
                <Select
                  label="Origen de datos fiscales"
                  value={values.fiscalDataSource}
                  onChange={(event) =>
                    updateValue(
                      "fiscalDataSource",
                      event.target.value as CustomerFiscalDataSource
                    )
                  }
                >
                  <option value="MANUAL">Manual</option>
                  <option value="DIAN_DIRECT">Consulta directa DIAN</option>
                  <option value="TECH_PROVIDER">Proveedor tecnológico</option>
                  <option value="RUT">RUT</option>
                  <option value="MOCK_LOCAL">Prueba local</option>
                  <option value="UNKNOWN">Desconocido</option>
                </Select>

                <Select
                  label="Estado fiscal"
                  value={values.isFinalConsumer ? "NOT_REQUIRED" : values.fiscalStatus}
                  disabled={values.isFinalConsumer}
                  onChange={(event) => {
                    const fiscalStatus = event.target.value as CustomerFiscalStatus;
                    setValues((prev) => ({
                      ...prev,
                      fiscalStatus,
                      isDianValidated:
                        fiscalStatus === "VALIDATED" ? true : prev.isDianValidated,
                    }));
                    setErrors((prev) => ({ ...prev, submit: undefined }));
                    resetLookupState();
                  }}
                >
                  <option value="PENDING">Pendiente de validación</option>
                  <option value="VALIDATED">Validado ante la DIAN</option>
                  <option value="FAILED">Validación fallida</option>
                  <option value="NOT_REQUIRED">Consumidor Final (No requerido)</option>
                </Select>

                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={values.isDianValidated}
                    disabled={values.isFinalConsumer}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setValues((prev) => ({
                        ...prev,
                        isDianValidated: checked,
                        fiscalStatus: checked ? "VALIDATED" : "PENDING",
                      }));
                      resetLookupState();
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  Validado ante la DIAN
                </label>
              </div>
            </div>
          ) : null}
        </div>

        {/* SECCIÓN 6: Activo y Botones de acción */}
        <div className="flex flex-col gap-4 pt-2">
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={values.isActive}
              disabled={values.isFinalConsumer}
              onChange={(event) => updateValue("isActive", event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span className="font-medium">Cliente activo para ventas y facturación</span>
          </label>

          {values.isFinalConsumer ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              Consumidor Final protegido. No se puede inactivar desde esta pantalla.
            </div>
          ) : null}

          {locationError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              {locationError}
            </div>
          ) : null}

          {errors.submit ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
              {errors.submit}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              type="submit"
              size="lg"
              className="min-h-[48px] px-8 text-base font-semibold shadow-sm"
              isLoading={isSubmitting}
              disabled={lookupLoading}
            >
              {mode === "create" ? "Guardar cliente" : "Actualizar cliente"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-[48px] px-6 text-base"
              onClick={onCancel}
              disabled={isSubmitting || lookupLoading}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
};
