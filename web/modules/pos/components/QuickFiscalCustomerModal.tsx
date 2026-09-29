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
import type { CustomerResponse } from "../../inventory/services/customer.service";
import {
  createElectronicInvoicingCustomer,
  updateElectronicInvoicingCustomer,
  type ElectronicInvoicingCustomer,
} from "../../electronic-invoicing/services/customer.service";
import {
  FISCAL_PERSON_TYPE_OPTIONS,
  FISCAL_RESPONSIBILITY_OPTIONS,
  FISCAL_TAX_REGIME_OPTIONS,
} from "../../electronic-invoicing/fiscal-profile-options";

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
  countryId: string;
  departamentoId: string;
  municipioId: string;
  countryCode: string;
  departmentCode: string;
  municipalityCode: string;
  personType: "" | "NATURAL" | "JURIDICA";
  taxRegime: string;
  taxResponsibilities: string[];
};

const EMPTY_FORM: FiscalForm = {
  documentTypeCode: "31",
  documentNumber: "",
  name: "",
  fiscalEmail: "",
  phone: "",
  address: "",
  countryId: "",
  departamentoId: "",
  municipioId: "",
  countryCode: "CO",
  departmentCode: "",
  municipalityCode: "",
  personType: "",
  taxRegime: "",
  taxResponsibilities: [],
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

const buildFormFromCustomer = (customer: CustomerResponse | null): FiscalForm => {
  const docType = customer?.documentTypeCode ?? customer?.dianIdentificationType ?? "31";
  const defaultPersonType = docType === "31" ? "JURIDICA" : "NATURAL";
  return {
    documentTypeCode: docType,
    documentNumber: customer?.documentNumber ?? "",
    name: customer?.name ?? "",
    fiscalEmail: customer?.fiscalEmail ?? customer?.email ?? "",
    phone: customer?.phone ?? "",
    address: customer?.address ?? "",
    countryId: "",
    departamentoId: customer?.departamentoId ?? "",
    municipioId: customer?.municipioId ?? "",
    countryCode: customer?.countryCode?.trim() || "CO",
    departmentCode: customer?.departmentCode ?? "",
    municipalityCode: customer?.municipalityCode ?? "",
    personType:
      customer?.personType === "NATURAL" || customer?.personType === "JURIDICA"
        ? customer.personType
        : defaultPersonType,
    taxRegime: customer?.taxRegime ?? "NO_RESPONSABLE",
    taxResponsibilities: customer?.taxResponsibilities?.length
      ? customer.taxResponsibilities
      : ["R-99-PN"],
  };
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
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<CountryResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [municipalities, setMunicipalities] = useState<MunicipalityResponse[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);

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
  }, [customers, selectedCustomerId]);

  useEffect(() => {
    let active = true;
    setLocationsLoading(true);
    listCountries()
      .then((items) => {
        if (!active) return;
        setCountries(items);
        setForm((current) => {
          if (current.countryId) {
            return current;
          }
          const selected =
            items.find((item) => item.codigo_iso2 === (current.countryCode || "CO")) ??
            items.find((item) => item.codigo_iso2 === "CO") ??
            items.find((item) => item.nombre.toLowerCase().includes("colombia")) ??
            items[0];
          if (selected) {
            return {
              ...current,
              countryId: selected.id,
              countryCode: selected.codigo_iso2,
            };
          }
          return current;
        });
      })
      .catch(() => {
        if (active) setCountries([]);
      })
      .finally(() => {
        if (active) setLocationsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!form.countryId) {
      setDepartments([]);
      return;
    }
    listDepartments(form.countryId)
      .then((items) => {
        if (!active) return;
        setDepartments(items);
        const selected =
          items.find((item) => item.id === form.departamentoId) ??
          items.find((item) => item.codigo_dane === form.departmentCode);
        if (selected) {
          setForm((current) => ({
            ...current,
            departamentoId: selected.id,
            departmentCode: selected.codigo_dane,
          }));
        }
      })
      .catch(() => {
        if (active) setDepartments([]);
      });
    return () => {
      active = false;
    };
  }, [form.countryId]);

  useEffect(() => {
    let active = true;
    if (!form.departamentoId) {
      setMunicipalities([]);
      return;
    }
    listMunicipalities(form.departamentoId)
      .then((items) => {
        if (!active) return;
        setMunicipalities(items);
        const selected =
          items.find((item) => item.id === form.municipioId) ??
          items.find((item) => item.codigo_dane === form.municipalityCode);
        if (selected) {
          setForm((current) => ({
            ...current,
            municipioId: selected.id,
            municipalityCode: selected.codigo_dane,
          }));
        }
      })
      .catch(() => {
        if (active) setMunicipalities([]);
      });
    return () => {
      active = false;
    };
  }, [form.departamentoId]);

  const updateForm = (field: keyof FiscalForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError(null);
  };

  const handlePickCustomer = (customer: CustomerResponse) => {
    setTargetCustomerId(customer.id);
    setForm(buildFormFromCustomer(customer));
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
      countryId: trimToNull(form.countryId),
      departamentoId: trimToNull(form.departamentoId),
      municipioId: trimToNull(form.municipioId),
      countryCode: trimToNull(form.countryCode),
      departmentCode: trimToNull(form.departmentCode),
      municipalityCode: trimToNull(form.municipalityCode),
      personType: form.personType || null,
      taxRegime: trimToNull(form.taxRegime),
      taxResponsibilities: form.taxResponsibilities,
      isFinalConsumer: false,
      fiscalDataSource: "MANUAL" as const,
      fiscalStatus: "PENDING" as const,
      isActive: true,
    };
  };

  const handleSaveCustomer = async () => {
    const payload = buildCreatePayload();
    if (!payload.name.trim()) {
      setError("Nombre requerido.");
      return;
    }

    setSaveLoading(true);
    setError(null);
    try {
      let savedCustomer;
      if (targetCustomerId && targetCustomer) {
        // Solo enviar datos que cambiaron respecto al original para evitar conflictos de identity en backend
        const updatePayload: Record<string, any> = {};
        
        if (payload.name !== targetCustomer.name) {
          updatePayload.name = payload.name;
        }
        if (payload.documentNumber !== (targetCustomer.documentNumber ?? null)) {
          updatePayload.documentNumber = payload.documentNumber;
          updatePayload.identificationNumber = payload.identificationNumber;
        }
        if (payload.documentTypeCode !== (targetCustomer.documentTypeCode ?? null)) {
          updatePayload.documentTypeCode = payload.documentTypeCode;
          updatePayload.dianIdentificationType = payload.dianIdentificationType;
        }
        const originalEmail = targetCustomer.fiscalEmail ?? targetCustomer.email ?? null;
        if (payload.fiscalEmail !== originalEmail) {
          updatePayload.fiscalEmail = payload.fiscalEmail;
          updatePayload.invoiceEmail = payload.invoiceEmail;
        }
        if (payload.phone !== (targetCustomer.phone ?? null)) {
          updatePayload.phone = payload.phone;
        }
        if (payload.address !== (targetCustomer.address ?? null)) {
          updatePayload.address = payload.address;
        }
        updatePayload.countryId = payload.countryId;
        updatePayload.departamentoId = payload.departamentoId;
        updatePayload.municipioId = payload.municipioId;
        updatePayload.countryCode = payload.countryCode;
        updatePayload.departmentCode = payload.departmentCode;
        updatePayload.municipalityCode = payload.municipalityCode;
        updatePayload.personType = payload.personType;
        updatePayload.taxRegime = payload.taxRegime;
        updatePayload.taxResponsibilities = payload.taxResponsibilities;

        if (Object.keys(updatePayload).length === 0) {
          savedCustomer = targetCustomer as unknown as ElectronicInvoicingCustomer;
        } else {
          savedCustomer = await updateElectronicInvoicingCustomer(targetCustomerId, updatePayload);
        }
      } else {
        savedCustomer = await createElectronicInvoicingCustomer(payload);
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

  const closeModal = () => {
    if (saveLoading) {
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
                disabled={!targetCustomer || saveLoading}
              >
                <UserCheck className="h-4 w-4" />
                Usar cliente
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
            <div className="mb-4 flex items-center justify-between gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                {targetCustomerId ? "Editar Cliente Fiscal" : "Nuevo Cliente Fiscal"}
              </div>
              {targetCustomerId && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs" 
                  onClick={() => {
                    setTargetCustomerId(null);
                    setForm(EMPTY_FORM);
                  }}
                >
                  Nuevo
                </Button>
              )}
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
                <Select
                  label="Tipo de persona"
                  value={form.personType}
                  onChange={(event) =>
                    updateForm("personType", event.target.value as FiscalForm["personType"])
                  }
                >
                  <option value="">Selecciona tipo de persona</option>
                  {FISCAL_PERSON_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Régimen tributario"
                  value={form.taxRegime}
                  onChange={(event) => updateForm("taxRegime", event.target.value)}
                >
                  <option value="">Selecciona un régimen</option>
                  {FISCAL_TAX_REGIME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <div className="sm:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Responsabilidades fiscales
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {FISCAL_RESPONSIBILITY_OPTIONS.map((option) => {
                      const selected = form.taxResponsibilities.includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              taxResponsibilities: selected
                                ? current.taxResponsibilities.filter((value) => value !== option.value)
                                : [...current.taxResponsibilities, option.value],
                            }))
                          }
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            selected
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-300 bg-white text-slate-600 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Select
                  label="País"
                  value={form.countryId}
                  disabled={locationsLoading || countries.length === 0}
                  onChange={(event) => {
                    const selected = countries.find((item) => item.id === event.target.value);
                    setForm((current) => ({
                      ...current,
                      countryId: event.target.value,
                      countryCode: selected?.codigo_iso2 ?? "",
                      departamentoId: "",
                      municipioId: "",
                      departmentCode: "",
                      municipalityCode: "",
                    }));
                  }}
                >
                  <option value="">Selecciona un país</option>
                  {countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.nombre}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Departamento"
                  value={form.departamentoId}
                  disabled={departments.length === 0}
                  onChange={(event) => {
                    const selected = departments.find((item) => item.id === event.target.value);
                    setForm((current) => ({
                      ...current,
                      departamentoId: event.target.value,
                      departmentCode: selected?.codigo_dane ?? "",
                      municipioId: "",
                      municipalityCode: "",
                    }));
                  }}
                >
                  <option value="">Selecciona un departamento</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.nombre}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Municipio / Ciudad"
                  value={form.municipioId}
                  disabled={municipalities.length === 0}
                  onChange={(event) => {
                    const selected = municipalities.find((item) => item.id === event.target.value);
                    setForm((current) => ({
                      ...current,
                      municipioId: event.target.value,
                      municipalityCode: selected?.codigo_dane ?? "",
                    }));
                  }}
                >
                  <option value="">Selecciona un municipio</option>
                  {municipalities.map((municipality) => (
                    <option key={municipality.id} value={municipality.id}>
                      {municipality.nombre}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={closeModal} disabled={saveLoading}>
              Cancelar
            </Button>
            <Button
              isLoading={saveLoading}
              onClick={() => void handleSaveCustomer()}
              disabled={saveLoading || !form.name || !form.documentNumber}
            >
              {targetCustomerId ? "Actualizar y usar" : "Guardar y usar"}
            </Button>
          </div>
        </section>
      </div>
    </Modal>
  );
};
