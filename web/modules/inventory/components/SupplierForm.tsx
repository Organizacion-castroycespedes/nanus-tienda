"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { Textarea } from "../../../components/design-system/Textarea";
import { listCountries, listDepartments, listMunicipalities } from "../../../domains/locations/api";
import type {
  CountryResponse,
  DepartmentResponse,
  MunicipalityResponse,
} from "../../../domains/locations/dtos";
import {
  createSupplier,
  updateSupplier,
  type SupplierResponse,
} from "../services/supplier.service";

type SupplierFormValues = {
  name: string;
  documentNumber: string;
  phone: string;
  email: string;
  address: string;
  countryId: string;
  departamentoId: string;
  municipioId: string;
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

const createInitialValues = (supplier?: SupplierResponse | null): SupplierFormValues => ({
  name: supplier?.name ?? "",
  documentNumber: supplier?.documentNumber ?? "",
  phone: supplier?.phone ?? "",
  email: supplier?.email ?? "",
  address: supplier?.address ?? "",
  countryId: "",
  departamentoId: supplier?.departamentoId ?? "",
  municipioId: supplier?.municipioId ?? "",
  isActive: supplier?.isActive ?? true,
});

const isValidEmail = (value: string) =>
  value.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

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

  useEffect(() => {
    setValues(createInitialValues(supplier));
    setErrors({});
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

  const validate = () => {
    const nextErrors: SupplierFormErrors = {};

    if (!values.name.trim()) {
      nextErrors.name = "El nombre es requerido.";
    }
    if (!isValidEmail(values.email)) {
      nextErrors.email = "El correo no es valido.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    const selectedDepartment = departments.find(
      (department) => department.id === values.departamentoId
    );
    const selectedMunicipality = municipalities.find(
      (municipality) => municipality.id === values.municipioId
    );

    setErrors({});
    setIsSubmitting(true);

    try {
      const payload = {
        name: values.name.trim(),
        documentNumber: values.documentNumber.trim() || null,
        phone: values.phone.trim() || null,
        email: values.email.trim() || null,
        address: values.address.trim() || null,
        departamentoId: values.departamentoId || null,
        municipioId: values.municipioId || null,
        ciudad: selectedMunicipality?.nombre ?? null,
        departamento: selectedDepartment?.nombre ?? null,
        isActive: values.isActive,
      };

      if (mode === "create") {
        await createSupplier(payload);
      } else {
        await updateSupplier(supplier!.id, payload);
      }

      onSuccess(mode);
    } catch {
      setErrors({
        submit:
          mode === "create"
            ? "No se pudo crear el proveedor."
            : "No se pudo actualizar el proveedor.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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

      <form className="grid gap-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Input
              label="Nombre"
              required
              value={values.name}
              onChange={(event) => {
                const value = event.target.value;
                setValues((prev) => ({ ...prev, name: value }));
                setErrors((prev) => ({ ...prev, name: undefined, submit: undefined }));
              }}
            />
            {errors.name ? <p className="text-xs text-rose-600">{errors.name}</p> : null}
          </div>

          <Input
            label="Documento"
            value={values.documentNumber}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, documentNumber: event.target.value }))
            }
          />

          <Input
            label="Telefono"
            value={values.phone}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, phone: event.target.value }))
            }
          />

          <div className="space-y-1">
            <Input
              label="Email"
              value={values.email}
              onChange={(event) => {
                const value = event.target.value;
                setValues((prev) => ({ ...prev, email: value }));
                setErrors((prev) => ({ ...prev, email: undefined, submit: undefined }));
              }}
            />
            {errors.email ? <p className="text-xs text-rose-600">{errors.email}</p> : null}
          </div>

          <div className="md:col-span-2">
            <Textarea
              label="Direccion"
              value={values.address}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, address: event.target.value }))
              }
              rows={3}
            />
          </div>

          <Select
            label="Pais"
            value={values.countryId}
            disabled={countriesLoading || countries.length === 0}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                countryId: event.target.value,
                departamentoId: "",
                municipioId: "",
              }))
            }
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
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                departamentoId: event.target.value,
                municipioId: "",
              }))
            }
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
            onChange={(event) =>
              setValues((prev) => ({ ...prev, municipioId: event.target.value }))
            }
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
            onChange={(event) =>
              setValues((prev) => ({ ...prev, isActive: event.target.checked }))
            }
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
          <Button type="submit" isLoading={isSubmitting}>
            {mode === "create" ? "Guardar proveedor" : "Actualizar proveedor"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
};
