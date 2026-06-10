"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  ShieldCheck,
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
  applyElectronicInvoicingSupplierLookup,
  createElectronicInvoicingSupplier,
  lookupElectronicInvoicingSupplier,
  updateElectronicInvoicingSupplier,
  type CreateElectronicInvoicingSupplierPayload,
  type ElectronicInvoicingSupplier,
  type ThirdPartySupplierLookupField,
  type ThirdPartySupplierLookupPreview,
  type UpdateElectronicInvoicingSupplierPayload,
} from "../../electronic-invoicing/services/supplier.service";
import {
  updateSupplier,
  type SupplierFiscalDataSource,
  type SupplierFiscalStatus,
  type SupplierPersonType,
  type SupplierResponse,
} from "../services/supplier.service";

type SupplierFormValues = {
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
  personType: "" | SupplierPersonType;
  taxRegime: string;
  taxResponsibilities: string;
  fiscalDataSource: SupplierFiscalDataSource;
  fiscalStatus: SupplierFiscalStatus;
  isDianValidated: boolean;
  isActive: boolean;
};

type SupplierFormErrors = Partial<Record<keyof SupplierFormValues, string>> & {
  submit?: string;
};

type SupplierFormProps = {
  mode: "create" | "edit";
  supplier?: SupplierResponse | null;
  onCancel: () => void;
  onSuccess: (mode: "create" | "edit") => void;
};

type LookupMessageVariant = "success" | "warning" | "error";

const LOOKUP_FIELD_OPTIONS: Array<{
  field: ThirdPartySupplierLookupField;
  label: string;
}> = [
  { field: "name", label: "Nombre" },
  { field: "documentTypeCode", label: "Tipo DIAN" },
  { field: "documentNumber", label: "Numero ID" },
  { field: "verificationDigit", label: "DV" },
  { field: "legalName", label: "Razon social / nombre fiscal" },
  { field: "tradeName", label: "Nombre comercial" },
  { field: "fiscalEmail", label: "Email fiscal" },
  { field: "phone", label: "Telefono" },
  { field: "address", label: "Direccion" },
  { field: "countryCode", label: "Pais DIAN" },
  { field: "departmentCode", label: "Departamento DIAN" },
  { field: "municipalityCode", label: "Municipio DIAN" },
  { field: "personType", label: "Tipo persona" },
  { field: "taxRegime", label: "Regimen" },
  { field: "taxResponsibilities", label: "Responsabilidades" },
];

const createInitialValues = (supplier?: SupplierResponse | null): SupplierFormValues => ({
  name: supplier?.name ?? "",
  dianIdentificationType:
    supplier?.dianIdentificationType ?? supplier?.documentTypeCode ?? "31",
  identificationNumber:
    supplier?.identificationNumber ??
    supplier?.documentNumberNormalized ??
    supplier?.documentNumber ??
    "",
  verificationDigit: supplier?.verificationDigit ?? "",
  legalName: supplier?.legalName ?? "",
  tradeName: supplier?.tradeName ?? "",
  email: supplier?.email ?? supplier?.fiscalEmail ?? supplier?.invoiceEmail ?? "",
  invoiceEmail: supplier?.invoiceEmail ?? supplier?.fiscalEmail ?? supplier?.email ?? "",
  phone: supplier?.phone ?? "",
  address: supplier?.address ?? "",
  countryId: "",
  departamentoId: supplier?.departamentoId ?? "",
  municipioId: supplier?.municipioId ?? "",
  countryCode: supplier?.countryCode ?? "",
  departmentCode: supplier?.departmentCode ?? "",
  municipalityCode: supplier?.municipalityCode ?? "",
  personType: supplier?.personType ?? "",
  taxRegime: supplier?.taxRegime ?? "",
  taxResponsibilities: supplier?.taxResponsibilities?.join(", ") ?? "",
  fiscalDataSource: supplier?.fiscalDataSource ?? "MANUAL",
  fiscalStatus: supplier?.fiscalStatus ?? "PENDING",
  isDianValidated: supplier?.isDianValidated ?? false,
  isActive: supplier?.isActive ?? true,
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
  preview: ThirdPartySupplierLookupPreview,
  field: ThirdPartySupplierLookupField
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
  values: SupplierFormValues,
  field: ThirdPartySupplierLookupField
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
  return values[field as keyof SupplierFormValues];
};

const buildDefaultSelectedFields = (
  preview: ThirdPartySupplierLookupPreview,
  values: SupplierFormValues
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
  preview: ThirdPartySupplierLookupPreview | null,
  values: SupplierFormValues,
  selectedFields: ThirdPartySupplierLookupField[]
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
  current: SupplierFormValues,
  preview: ThirdPartySupplierLookupPreview,
  fields: ThirdPartySupplierLookupField[]
): SupplierFormValues => {
  if (!preview.data || preview.lookupStatus !== "FOUND") {
    return current;
  }

  const next: SupplierFormValues = {
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
      next.personType = String(value) as SupplierFormValues["personType"];
      return;
    }

    next[field as keyof SupplierFormValues] = String(value) as never;
  });

  return next;
};

const mergeFiscalSupplierIntoValues = (
  current: SupplierFormValues,
  supplier: ElectronicInvoicingSupplier
): SupplierFormValues => ({
  ...current,
  name: supplier.name ?? current.name,
  dianIdentificationType:
    supplier.dianIdentificationType ?? supplier.documentTypeCode ?? "",
  identificationNumber:
    supplier.identificationNumber ??
    supplier.documentNumberNormalized ??
    supplier.documentNumber ??
    "",
  verificationDigit: supplier.verificationDigit ?? "",
  legalName: supplier.legalName ?? "",
  tradeName: supplier.tradeName ?? "",
  invoiceEmail: supplier.invoiceEmail ?? supplier.fiscalEmail ?? current.invoiceEmail,
  phone: supplier.phone ?? "",
  address: supplier.address ?? "",
  countryCode: supplier.countryCode ?? "",
  departmentCode: supplier.departmentCode ?? "",
  municipalityCode: supplier.municipalityCode ?? "",
  personType: supplier.personType ?? "",
  taxRegime: supplier.taxRegime ?? "",
  taxResponsibilities: supplier.taxResponsibilities.join(", "),
  fiscalDataSource: supplier.fiscalDataSource,
  fiscalStatus: supplier.fiscalStatus,
  isDianValidated: supplier.isDianValidated,
  isActive: supplier.isActive,
});

export const SupplierForm = ({
  mode,
  supplier,
  onCancel,
  onSuccess,
}: SupplierFormProps) => {
  const [values, setValues] = useState<SupplierFormValues>(createInitialValues(supplier));
  const [errors, setErrors] = useState<SupplierFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countries, setCountries] = useState<CountryResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [municipalities, setMunicipalities] = useState<MunicipalityResponse[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [municipalitiesLoading, setMunicipalitiesLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ThirdPartySupplierLookupPreview | null>(null);
  const [selectedFields, setSelectedFields] = useState<ThirdPartySupplierLookupField[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [lookupMessageVariant, setLookupMessageVariant] =
    useState<LookupMessageVariant>("success");
  const [overwriteConfirmed, setOverwriteConfirmed] = useState(false);
  const [lastAppliedFields, setLastAppliedFields] = useState<
    ThirdPartySupplierLookupField[]
  >([]);

  const previewFound = preview?.lookupStatus === "FOUND" && preview.data;
  const overwriteFields = useMemo(
    () => getOverwriteFields(preview, values, selectedFields),
    [preview, selectedFields, values]
  );

  useEffect(() => {
    setValues(createInitialValues(supplier));
    setErrors({});
    setPreview(null);
    setSelectedFields([]);
    setLookupMessage(null);
    setOverwriteConfirmed(false);
    setLastAppliedFields([]);
  }, [mode, supplier]);

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
        setValues((prev) => ({
          ...prev,
          countryId: prev.countryId || items[0]?.id || "",
        }));
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

  const resetLookupState = () => {
    setPreview(null);
    setSelectedFields([]);
    setLookupMessage(null);
    setOverwriteConfirmed(false);
    setLastAppliedFields([]);
  };

  const updateValue = <K extends keyof SupplierFormValues>(
    field: K,
    value: SupplierFormValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined, submit: undefined }));
    resetLookupState();
  };

  const validate = () => {
    const nextErrors: SupplierFormErrors = {};

    if (!values.name.trim()) {
      nextErrors.name = "El nombre es requerido.";
    }
    if (!isValidEmail(values.email)) {
      nextErrors.email = "El correo comercial no es valido.";
    }
    if (!isValidEmail(values.invoiceEmail)) {
      nextErrors.invoiceEmail = "El correo fiscal no es valido.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildFiscalPayload = ():
    | CreateElectronicInvoicingSupplierPayload
    | UpdateElectronicInvoicingSupplierPayload => {
    const invoiceEmail = trimToNull(values.invoiceEmail);
    const lookupMetadata =
      preview?.lookupStatus === "FOUND" && values.fiscalDataSource === "MOCK_LOCAL"
        ? {
            fiscalProvider: "MOCK_LOCAL",
            fiscalLastLookupAt: preview.lookupAt,
            fiscalLastLookupStatus: preview.lookupStatus,
          }
        : {};

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
      countryCode: trimToNull(values.countryCode),
      departmentCode: trimToNull(values.departmentCode),
      municipalityCode: trimToNull(values.municipalityCode),
      personType: values.personType || null,
      taxRegime: trimToNull(values.taxRegime),
      taxResponsibilities: splitTaxResponsibilities(values.taxResponsibilities),
      fiscalDataSource: values.fiscalDataSource,
      fiscalStatus: values.fiscalStatus,
      isDianValidated: values.isDianValidated,
      isActive: values.isActive,
      ...lookupMetadata,
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
      isActive: values.isActive,
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
      const nextPreview = await lookupElectronicInvoicingSupplier({
        documentTypeCode,
        documentNumber,
      });
      setPreview(nextPreview);
      setSelectedFields(buildDefaultSelectedFields(nextPreview, values));
      if (nextPreview.lookupStatus === "FOUND") {
        setLookupMessage("Consulta fiscal mock lista.");
        setLookupMessageVariant("success");
      } else {
        setLookupMessage("Mock fiscal sin datos. Puedes guardar manual.");
        setLookupMessageVariant("warning");
      }
    } catch (error) {
      setLookupMessage(
        error instanceof Error
          ? error.message
          : "No se pudo consultar datos fiscales mock."
      );
      setLookupMessageVariant("error");
    } finally {
      setLookupLoading(false);
    }
  };

  const toggleLookupField = (field: ThirdPartySupplierLookupField) => {
    setSelectedFields((current) =>
      current.includes(field)
        ? current.filter((item) => item !== field)
        : [...current, field]
    );
    setOverwriteConfirmed(false);
  };

  const handleApplyPreview = async () => {
    if (!preview || preview.lookupStatus !== "FOUND") {
      setLookupMessage("Consulta fiscal mock requerida.");
      setLookupMessageVariant("warning");
      return;
    }
    if (selectedFields.length === 0) {
      setLookupMessage("Selecciona al menos un campo.");
      setLookupMessageVariant("warning");
      return;
    }
    if (overwriteFields.length > 0 && !overwriteConfirmed) {
      setLookupMessage("Confirma overwrite de campos manuales.");
      setLookupMessageVariant("warning");
      return;
    }

    if (mode === "create" || !supplier) {
      setValues((current) => applyPreviewToValues(current, preview, selectedFields));
      setLastAppliedFields(selectedFields);
      setLookupMessage("Campos mock aplicados al formulario.");
      setLookupMessageVariant("success");
      return;
    }

    setLookupLoading(true);
    try {
      const applied = await applyElectronicInvoicingSupplierLookup(supplier.id, {
        documentTypeCode: values.dianIdentificationType,
        documentNumber: values.identificationNumber,
        fieldsToApply: selectedFields,
      });
      setValues((current) => mergeFiscalSupplierIntoValues(current, applied.supplier));
      setLastAppliedFields(applied.appliedFields);
      setLookupMessage("Campos mock aplicados al proveedor.");
      setLookupMessageVariant("success");
    } catch (error) {
      setLookupMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron aplicar campos fiscales mock."
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
        const created = await createElectronicInvoicingSupplier(
          fiscalPayload as CreateElectronicInvoicingSupplierPayload
        );
        await updateSupplier(created.id, legacyPayload);
      } else if (supplier) {
        await updateElectronicInvoicingSupplier(
          supplier.id,
          fiscalPayload as UpdateElectronicInvoicingSupplierPayload
        );
        await updateSupplier(supplier.id, legacyPayload);
      }

      onSuccess(mode);
    } catch (error) {
      setErrors({
        submit:
          error instanceof Error
            ? error.message
            : mode === "create"
              ? "No se pudo crear el proveedor."
              : "No se pudo actualizar el proveedor.",
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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Suppliers</p>
          <h2 className="text-xl font-semibold text-slate-900">
            {mode === "create" ? "Crear proveedor" : "Editar proveedor"}
          </h2>
        </div>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>

      <form className="grid gap-6" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Input
              label="Nombre"
              required
              value={values.name}
              onChange={(event) => updateValue("name", event.target.value)}
            />
            {errors.name ? <p className="text-xs text-rose-600">{errors.name}</p> : null}
          </div>

          <Select
            label="Tipo identificacion DIAN"
            value={values.dianIdentificationType}
            onChange={(event) =>
              updateValue("dianIdentificationType", event.target.value)
            }
          >
            <option value="">Sin tipo</option>
            <option value="11">Registro civil</option>
            <option value="12">Tarjeta identidad</option>
            <option value="13">Cedula</option>
            <option value="21">Tarjeta extranjeria</option>
            <option value="22">Cedula extranjeria</option>
            <option value="31">NIT</option>
            <option value="41">Pasaporte</option>
            <option value="42">Documento extranjero</option>
            <option value="47">PPT</option>
            <option value="48">PEP</option>
            <option value="50">NIT otro pais</option>
            <option value="91">NUIP</option>
          </Select>

          <Input
            label="Numero identificacion"
            value={values.identificationNumber}
            onChange={(event) =>
              updateValue("identificationNumber", event.target.value)
            }
          />

          <Input
            label="Digito verificacion"
            value={values.verificationDigit}
            onChange={(event) => updateValue("verificationDigit", event.target.value)}
          />

          <Input
            label="Razon social / nombre fiscal"
            value={values.legalName}
            onChange={(event) => updateValue("legalName", event.target.value)}
          />

          <Input
            label="Nombre comercial"
            value={values.tradeName}
            onChange={(event) => updateValue("tradeName", event.target.value)}
          />

          <div className="space-y-1">
            <Input
              label="Email comercial"
              value={values.email}
              onChange={(event) => updateValue("email", event.target.value)}
            />
            {errors.email ? <p className="text-xs text-rose-600">{errors.email}</p> : null}
          </div>

          <div className="space-y-1">
            <Input
              label="Email fiscal"
              value={values.invoiceEmail}
              onChange={(event) => updateValue("invoiceEmail", event.target.value)}
            />
            {errors.invoiceEmail ? (
              <p className="text-xs text-rose-600">{errors.invoiceEmail}</p>
            ) : null}
          </div>

          <Input
            label="Telefono"
            value={values.phone}
            onChange={(event) => updateValue("phone", event.target.value)}
          />

          <div className="md:col-span-2">
            <Textarea
              label="Direccion"
              value={values.address}
              onChange={(event) => updateValue("address", event.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Input
            label="countryCode"
            value={values.countryCode}
            onChange={(event) => updateValue("countryCode", event.target.value)}
          />
          <Input
            label="departmentCode"
            value={values.departmentCode}
            onChange={(event) => updateValue("departmentCode", event.target.value)}
          />
          <Input
            label="municipalityCode"
            value={values.municipalityCode}
            onChange={(event) => updateValue("municipalityCode", event.target.value)}
          />

          <Select
            label="personType"
            value={values.personType}
            onChange={(event) =>
              updateValue(
                "personType",
                event.target.value as SupplierFormValues["personType"]
              )
            }
          >
            <option value="">Sin definir</option>
            <option value="NATURAL">NATURAL</option>
            <option value="JURIDICA">JURIDICA</option>
            <option value="UNKNOWN">UNKNOWN</option>
          </Select>

          <Input
            label="taxRegime"
            value={values.taxRegime}
            onChange={(event) => updateValue("taxRegime", event.target.value)}
          />

          <Input
            label="taxResponsibilities"
            hint="Separadas por coma"
            value={values.taxResponsibilities}
            onChange={(event) => updateValue("taxResponsibilities", event.target.value)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Select
            label="fiscalDataSource"
            value={values.fiscalDataSource}
            onChange={(event) =>
              updateValue(
                "fiscalDataSource",
                event.target.value as SupplierFiscalDataSource
              )
            }
          >
            <option value="MANUAL">MANUAL</option>
            <option value="MOCK_LOCAL">MOCK_LOCAL</option>
            <option value="TECH_PROVIDER">TECH_PROVIDER</option>
            <option value="RUT">RUT</option>
            <option value="UNKNOWN">UNKNOWN</option>
          </Select>

          <Select
            label="Estado fiscal"
            value={values.fiscalStatus}
            onChange={(event) => {
              const fiscalStatus = event.target.value as SupplierFiscalStatus;
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
            <option value="PENDING">Pendiente</option>
            <option value="VALIDATED">Validado fiscal</option>
            <option value="FAILED">Fallido</option>
            <option value="NOT_REQUIRED">No requerido</option>
          </Select>

          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={values.isDianValidated}
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
            isDianValidated
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <ShieldCheck className="h-4 w-4" />
              Consulta fiscal mock
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
                Consultar datos fiscales mock
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
                Aplicar seleccion
              </Button>
            </div>
          </div>

          {preview ? (
            <div className="mb-3 grid gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm md:grid-cols-4">
              <div>
                <span className="block text-xs text-slate-500">Estado</span>
                <span className="font-semibold text-slate-900">
                  {preview.lookupStatus}
                </span>
              </div>
              <div>
                <span className="block text-xs text-slate-500">Provider</span>
                <span className="font-semibold text-slate-900">
                  {preview.provider}
                </span>
              </div>
              <div>
                <span className="block text-xs text-slate-500">Codigo</span>
                <span className="font-semibold text-slate-900">
                  {preview.statusCode}
                </span>
              </div>
              <div>
                <span className="block text-xs text-slate-500">Campos</span>
                <span className="font-semibold text-slate-900">
                  {preview.responseSummary.fieldCount}
                </span>
              </div>
              <p className="md:col-span-4 text-xs text-slate-500">
                {preview.message}
              </p>
            </div>
          ) : null}

          {preview && preview.lookupStatus === "FOUND" && preview.data ? (
            <div className="grid gap-3 md:grid-cols-2">
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
                    className={`flex min-h-16 items-start gap-3 rounded-lg border px-3 py-2 text-sm ${
                      checked
                        ? "border-blue-300 bg-blue-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      checked={checked}
                      onChange={() => toggleLookupField(field)}
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-800">
                        {label}
                        {overwrites ? (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
                            pisa manual
                          </span>
                        ) : null}
                      </span>
                      <span className="block break-words text-xs text-slate-500">
                        {formatPreviewValue(value)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : null}

          {overwriteFields.length > 0 ? (
            <label className="mt-3 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-600"
                checked={overwriteConfirmed}
                onChange={(event) => setOverwriteConfirmed(event.target.checked)}
              />
              Confirmo sobrescribir {overwriteFields.length} campo(s) manual(es).
            </label>
          ) : null}

          {lastAppliedFields.length > 0 ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Campos aplicados: {lastAppliedFields.length}
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

        <div className="grid gap-4 md:grid-cols-3">
          <Select
            label="Pais"
            value={values.countryId}
            disabled={countriesLoading || countries.length === 0}
            onChange={(event) => {
              setValues((prev) => ({
                ...prev,
                countryId: event.target.value,
                departamentoId: "",
                municipioId: "",
              }));
              setErrors((prev) => ({ ...prev, submit: undefined }));
              resetLookupState();
            }}
          >
            <option value="">{countriesLoading ? "Cargando..." : "Selecciona un pais"}</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.nombre}
              </option>
            ))}
          </Select>

          <Select
            label="Departamento"
            value={values.departamentoId}
            disabled={departmentsLoading || departments.length === 0}
            onChange={(event) => {
              setValues((prev) => ({
                ...prev,
                departamentoId: event.target.value,
                municipioId: "",
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

          <Select
            label="Municipio"
            value={values.municipioId}
            disabled={municipalitiesLoading || municipalities.length === 0}
            onChange={(event) => updateValue("municipioId", event.target.value)}
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
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(event) => updateValue("isActive", event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
          />
          Proveedor activo
        </label>

        {locationError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {locationError}
          </div>
        ) : null}

        {errors.submit ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errors.submit}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" isLoading={isSubmitting} disabled={lookupLoading}>
            {mode === "create" ? "Guardar proveedor" : "Actualizar proveedor"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting || lookupLoading}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
};
