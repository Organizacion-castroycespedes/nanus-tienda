"use client";

/* eslint-disable @next/next/no-img-element -- The tenant logo preview accepts data URLs from FileReader. */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  MapPin,
  Monitor,
  Paintbrush,
  Plus,
  Save,
  Star,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { ColorField } from "../../../components/design-system/ColorField";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import { SearchFilters } from "../../../components/design-system/SearchFilters";
import { Select } from "../../../components/design-system/Select";
import { Textarea } from "../../../components/design-system/Textarea";
import { TenantListItem } from "../../../components/design-system/TenantListItem";
import { Toast, type ToastVariant } from "../../../components/design-system/Toast";
import { defaultTheme } from "../../../components/design-system/theme";
import { isConfirmCancelledError, useConfirm } from "../../../hooks/use-confirm";
import { useAutoClearState } from "../../../lib/useAutoClearState";
import {
  createBranch,
  listBranches,
  updateBranch,
  updateBranchStatus,
} from "../../../domains/branches/api";
import type { Branch, BranchStatus } from "../../../domains/branches/types";
import type { BranchResponse } from "../../../domains/branches/dtos";
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
  createTenant,
  deleteTenantDetails,
  getTenantConfig,
  getTenantDetails,
  listTenants,
  updateTenantConfig,
  updateTenantDetails,
  updateTenant,
} from "../../../domains/tenants/api";
import { previewTenantSlug } from "../../../domains/tenants/slug";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { setBranding, type BrandingConfig } from "../../../store/brandingSlice";
import {
  resetCompanyDetails,
  setCompanyDetails,
  type CompanyDetails,
} from "../../../store/companySlice";
import { buildTenantThemeTokens } from "../../../src/lib/theme/buildTenantTheme";
import {
  isValidHexColor,
  normalizeHexColor,
} from "../../../src/lib/theme/colors";
import { BrandingThemePreview } from "./components/BrandingThemePreview";

type TabKey = "empresa" | "branding" | "sucursales";

type TenantSummary = {
  id: string;
  slug: string;
  nombre: string | null;
  activo: boolean;
};

type BranchForm = {
  codigo: string;
  nombre: string;
  descripcion: string;
  esPrincipal: boolean;
  direccion: string;
  paisId: string;
  departamentoId: string;
  municipioId: string;
  ciudad: string;
  departamento: string;
  pais: string;
  telefono: string;
  email: string;
  estado: BranchStatus;
};

type BrandingColorKey = keyof BrandingConfig["colors"];

type BrandingFormState = {
  colors: BrandingConfig["colors"];
  font: string;
  logo: string;
  spacing: BrandingConfig["spacing"];
};

const brandingColorFields: Array<{
  key: BrandingColorKey;
  label: string;
  required?: boolean;
}> = [
  { key: "primary", label: "Color primario", required: true },
  { key: "secondary", label: "Color secundario" },
  { key: "background", label: "Color fondo" },
  { key: "text", label: "Color texto" },
];

const colorFallbacks: Record<BrandingColorKey, string> = {
  primary: defaultTheme.colors.primary,
  secondary: defaultTheme.colors.secondary,
  background: defaultTheme.colors.background,
  text: defaultTheme.colors.text,
};

const resolveColorFormValue = (value: unknown, fallback: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }

  return normalizeHexColor(value) ?? value;
};

const normalizeColorOrFallback = (value: string, fallback: string) =>
  normalizeHexColor(value) ?? fallback;

const emptyCompanyDetails = {
  razonSocial: "",
  nit: "",
  dv: "",
  tipoPersona: "Jurídica",
  tipoSociedad: "SAS",
  fechaConstitucion: "",
  estado: "Activa",
  responsabilidadesDian: "",
  regimen: "",
  vatResponsibility: "UNKNOWN" as const,
  actividadEconomica: "",
  obligadoFacturacionElectronica: false,
  resolucionDian: "",
  fechaInicioFacturacion: "",
  direccionPrincipal: "",
  paisId: "",
  departamentoId: "",
  municipioId: "",
  ciudad: "",
  departamento: "",
  pais: "Colombia",
  telefono: "",
  emailCorporativo: "",
  sitioWeb: "",
  representanteNombre: "",
  representanteTipoDocumento: "CC",
  representanteNumeroDocumento: "",
  representanteEmail: "",
  representanteTelefono: "",
  cuentaContableDefecto: "",
  bancoPrincipal: "",
  numeroCuenta: "",
  tipoCuenta: "Ahorros",
};

const emptyBranchForm: BranchForm = {
  codigo: "",
  nombre: "",
  descripcion: "",
  esPrincipal: false,
  direccion: "",
  paisId: "",
  departamentoId: "",
  municipioId: "",
  ciudad: "",
  departamento: "",
  pais: "Colombia",
  telefono: "",
  email: "",
  estado: "ACTIVE",
};

const normalizeDateInputValue = (value?: string | null) => {
  if (!value) {
    return "";
  }
  return value.length >= 10 ? value.slice(0, 10) : value;
};

const ConfiguracionPage = () => {
  const dispatch = useAppDispatch();
  const branding = useAppSelector((state) => state.branding.config);
  const companyDetails = useAppSelector((state) => state.company.details);
  const authUser = useAppSelector((state) => state.auth.user);
  const [activeTab, setActiveTab] = useState<TabKey>("empresa");
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [tenantActionId, setTenantActionId] = useState<string | null>(null);
  const [tenantForm, setTenantForm] = useState({ slug: "", nombre: "" });
  const [tenantSearch, setTenantSearch] = useState({
    query: "",
    status: "all",
  });
  const [tenantModalMode, setTenantModalMode] = useState<"create" | "edit">(
    "create"
  );
  const [tenantFormsVisible, setTenantFormsVisible] = useState(false);
  const [tenantEditingId, setTenantEditingId] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [branchModalMode, setBranchModalMode] = useState<"create" | "edit">(
    "create"
  );
  const [branchEditingId, setBranchEditingId] = useState<string | null>(null);
  const [branchForm, setBranchForm] = useState<BranchForm>({
    ...emptyBranchForm,
  });
  const [countries, setCountries] = useState<CountryResponse[]>([]);
  const [companyDepartments, setCompanyDepartments] = useState<DepartmentResponse[]>([]);
  const [companyMunicipalities, setCompanyMunicipalities] = useState<MunicipalityResponse[]>([]);
  const [branchDepartments, setBranchDepartments] = useState<DepartmentResponse[]>([]);
  const [branchMunicipalities, setBranchMunicipalities] = useState<MunicipalityResponse[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [companyDepartmentsLoading, setCompanyDepartmentsLoading] = useState(false);
  const [companyMunicipalitiesLoading, setCompanyMunicipalitiesLoading] = useState(false);
  const [branchDepartmentsLoading, setBranchDepartmentsLoading] = useState(false);
  const [branchMunicipalitiesLoading, setBranchMunicipalitiesLoading] = useState(false);
  const departmentsCache = useRef(new Map<string, DepartmentResponse[]>());
  const municipalitiesCache = useRef(new Map<string, MunicipalityResponse[]>());
  const [branchActionId, setBranchActionId] = useState<string | null>(null);
  const [branchSearch, setBranchSearch] = useState({
    query: "",
    status: "all",
  });
  const [shouldScrollToCompanyForm, setShouldScrollToCompanyForm] =
    useState(false);
  const companyFormRef = useRef<HTMLDivElement | null>(null);
  const [companyForm, setCompanyForm] = useState<CompanyDetails>(() => ({
    ...emptyCompanyDetails,
    ...(companyDetails ?? {}),
  }));
  const [brandingForm, setBrandingForm] = useState<BrandingFormState>(() => ({
    colors: {
      primary: resolveColorFormValue(
        branding.colors.primary,
        defaultTheme.colors.primary
      ),
      secondary: resolveColorFormValue(
        branding.colors.secondary,
        defaultTheme.colors.secondary
      ),
      background: resolveColorFormValue(
        branding.colors.background,
        defaultTheme.colors.background
      ),
      text: resolveColorFormValue(branding.colors.text, defaultTheme.colors.text),
    },
    font: branding.font,
    logo: branding.logo ?? "",
    spacing: {
      sm: branding.spacing.sm,
      md: branding.spacing.md,
      lg: branding.spacing.lg,
    },
  }));
  const [status, setStatus] = useState<{
    message: string;
    variant: ToastVariant;
  } | null>(null);
  const confirm = useConfirm();
  useAutoClearState(status, setStatus);

  const currentTenantId = authUser?.tenantId ?? "";
  const isSuperAdmin = authUser?.role === "SUPER_ADMIN";
  const isSuperUser = authUser?.role === "SUPER_USER";
  const isCurrentTenant =
    Boolean(selectedTenantId) && selectedTenantId === currentTenantId;
  const setStatusMessage = useCallback((message: string, variant: ToastVariant) => {
    setStatus({ message, variant });
  }, []);
  const setStatusSuccess = useCallback(
    (message: string) => setStatusMessage(message, "success"),
    [setStatusMessage]
  );
  const setStatusError = useCallback(
    (message: string) => setStatusMessage(message, "error"),
    [setStatusMessage]
  );
  const setStatusWarning = useCallback(
    (message: string) => setStatusMessage(message, "warning"),
    [setStatusMessage]
  );

  const buildBranchHeaders = useCallback(() => {
    const headers: Record<string, string> = {};
    if (authUser?.role) {
      headers["x-user-role"] = authUser.role;
    }
    if (authUser?.tenantId) {
      headers["x-tenant-id"] = authUser.tenantId;
    }
    return headers;
  }, [authUser?.role, authUser?.tenantId]);

  const loadCountries = useCallback(async () => {
    setCountriesLoading(true);
    try {
      const items = await listCountries();
      setCountries(items);
    } catch {
      setStatus({ message: "No fue posible cargar los países.", variant: "error" });
    } finally {
      setCountriesLoading(false);
    }
  }, []);

  const loadDepartments = useCallback(
    async (
      paisId: string,
      setter: (items: DepartmentResponse[]) => void,
      setLoading: (value: boolean) => void
    ) => {
      if (!paisId) {
        setter([]);
        return;
      }
      const cached = departmentsCache.current.get(paisId);
      if (cached) {
        setter(cached);
        return;
      }
      setLoading(true);
      try {
        const items = await listDepartments(paisId);
        departmentsCache.current.set(paisId, items);
        setter(items);
      } catch {
        setter([]);
        setStatus({
          message: "No fue posible cargar los departamentos.",
          variant: "error",
        });
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadMunicipalities = useCallback(
    async (
      departamentoId: string,
      setter: (items: MunicipalityResponse[]) => void,
      setLoading: (value: boolean) => void
    ) => {
      if (!departamentoId) {
        setter([]);
        return;
      }
      const cached = municipalitiesCache.current.get(departamentoId);
      if (cached) {
        setter(cached);
        return;
      }
      setLoading(true);
      try {
        const items = await listMunicipalities(departamentoId);
        municipalitiesCache.current.set(departamentoId, items);
        setter(items);
      } catch {
        setter([]);
        setStatus({
          message: "No fue posible cargar los municipios.",
          variant: "error",
        });
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const toBranch = useCallback(
    (branch: BranchResponse): Branch => ({
      id: branch.id,
      tenantId: branch.tenant_id,
      codigo: branch.codigo,
      nombre: branch.nombre,
      descripcion: branch.descripcion ?? "",
      esPrincipal: branch.es_principal,
      direccion: branch.direccion ?? "",
      paisId: branch.pais_id ?? "",
      departamentoId: branch.departamento_id ?? "",
      municipioId: branch.municipio_id ?? "",
      ciudad: branch.ciudad ?? "",
      departamento: branch.departamento ?? "",
      pais: branch.pais ?? "Colombia",
      telefono: branch.telefono ?? "",
      email: branch.email ?? "",
      estado: branch.estado,
      metadata: branch.metadata ?? {},
      createdAt: branch.created_at,
      updatedAt: branch.updated_at,
    }),
    []
  );

  const buildBrandingForm = useCallback(
    (config?: {
      colors?: Record<string, unknown>;
      font?: string;
      logo?: string;
      logoUrl?: string;
      spacing?: Record<string, unknown>;
    }): BrandingFormState => ({
      colors: {
        primary: resolveColorFormValue(
          config?.colors?.primary,
          defaultTheme.colors.primary
        ),
        secondary: resolveColorFormValue(
          config?.colors?.secondary,
          defaultTheme.colors.secondary
        ),
        background: resolveColorFormValue(
          config?.colors?.background,
          defaultTheme.colors.background
        ),
        text: resolveColorFormValue(config?.colors?.text, defaultTheme.colors.text),
      },
      font: config?.font ?? defaultTheme.typography.fontFamily,
      logo: config?.logo ?? config?.logoUrl ?? "",
      spacing: {
        sm:
          typeof config?.spacing?.sm === "string"
            ? config.spacing.sm
            : defaultTheme.spacing.sm,
        md:
          typeof config?.spacing?.md === "string"
            ? config.spacing.md
            : defaultTheme.spacing.md,
        lg:
          typeof config?.spacing?.lg === "string"
            ? config.spacing.lg
            : defaultTheme.spacing.lg,
      },
    }),
    []
  );

  const loadTenants = useCallback(
    async (nextSelectedId?: string) => {
      setTenantsLoading(true);
      try {
        const items = await listTenants();
        setTenants(items);
        const fallbackId =
          items.find((item) => item.id === currentTenantId)?.id ??
          items[0]?.id ??
          "";
        setSelectedTenantId(nextSelectedId ?? fallbackId);
      } catch {
        setStatusError("No fue posible cargar los tenants.");
      } finally {
        setTenantsLoading(false);
      }
    },
    [currentTenantId, setStatusError]
  );

  const loadBranches = useCallback(async () => {
    const tenantId = isSuperAdmin ? selectedTenantId : currentTenantId;
    if (!tenantId && isSuperAdmin) {
      setBranches([]);
      return;
    }
    if (!tenantId) {
      return;
    }
    setBranchesLoading(true);
    try {
      const response = await listBranches({ tenantId }, buildBranchHeaders());
      setBranches(response.map(toBranch));
    } catch {
      setStatusError("No fue posible cargar las sucursales.");
    } finally {
      setBranchesLoading(false);
    }
  }, [
    buildBranchHeaders,
    currentTenantId,
    isSuperAdmin,
    selectedTenantId,
    setStatusError,
    toBranch,
  ]);

  useEffect(() => {
    if (!isSuperAdmin) {
      return;
    }
    setTenantFormsVisible(false);
  }, [isSuperAdmin, selectedTenantId]);

  useEffect(() => {
    if (isSuperAdmin) {
      return;
    }
    if (currentTenantId) {
      setSelectedTenantId(currentTenantId);
      setTenantFormsVisible(true);
    }
    setActiveTab("empresa");
  }, [currentTenantId, isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin) {
      return;
    }
    void loadTenants();
  }, [isSuperAdmin, loadTenants]);

  useEffect(() => {
    void loadCountries();
  }, [loadCountries]);

  useEffect(() => {
    if (countries.length === 0) {
      return;
    }
    if (!companyForm.paisId) {
      const defaultCountry =
        countries.find((item) => item.codigo_iso2 === "CO") ?? countries[0];
      if (defaultCountry) {
        setCompanyForm((prev) => ({
          ...prev,
          paisId: defaultCountry.id,
          pais: defaultCountry.nombre,
        }));
      }
    }
    if (branchModalOpen && !branchForm.paisId) {
      const defaultCountry =
        countries.find((item) => item.codigo_iso2 === "CO") ?? countries[0];
      if (defaultCountry) {
        setBranchForm((prev) => ({
          ...prev,
          paisId: defaultCountry.id,
          pais: defaultCountry.nombre,
        }));
      }
    }
  }, [branchForm.paisId, branchModalOpen, companyForm.paisId, countries]);

  useEffect(() => {
    if (!companyForm.paisId) {
      setCompanyDepartments([]);
      setCompanyMunicipalities([]);
      return;
    }
    void loadDepartments(
      companyForm.paisId,
      setCompanyDepartments,
      setCompanyDepartmentsLoading
    );
  }, [companyForm.paisId, loadDepartments]);

  useEffect(() => {
    if (!companyForm.departamentoId) {
      setCompanyMunicipalities([]);
      return;
    }
    void loadMunicipalities(
      companyForm.departamentoId,
      setCompanyMunicipalities,
      setCompanyMunicipalitiesLoading
    );
  }, [companyForm.departamentoId, loadMunicipalities]);

  useEffect(() => {
    if (!branchModalOpen) {
      return;
    }
    if (!branchForm.paisId) {
      setBranchDepartments([]);
      setBranchMunicipalities([]);
      return;
    }
    void loadDepartments(
      branchForm.paisId,
      setBranchDepartments,
      setBranchDepartmentsLoading
    );
  }, [branchForm.paisId, branchModalOpen, loadDepartments]);

  useEffect(() => {
    if (!branchModalOpen) {
      return;
    }
    if (!branchForm.departamentoId) {
      setBranchMunicipalities([]);
      return;
    }
    void loadMunicipalities(
      branchForm.departamentoId,
      setBranchMunicipalities,
      setBranchMunicipalitiesLoading
    );
  }, [branchForm.departamentoId, branchModalOpen, loadMunicipalities]);

  useEffect(() => {
    if (activeTab !== "sucursales" || !tenantFormsVisible) {
      return;
    }
    void loadBranches();
  }, [activeTab, loadBranches, tenantFormsVisible]);

  useEffect(() => {
    if (!isCurrentTenant) {
      return;
    }
    setCompanyForm({ ...emptyCompanyDetails, ...(companyDetails ?? {}) });
  }, [companyDetails, isCurrentTenant]);

  useEffect(() => {
    if (!isCurrentTenant) {
      return;
    }
    setBrandingForm(buildBrandingForm(branding));
  }, [branding, buildBrandingForm, isCurrentTenant]);

  useEffect(() => {
    if (!isSuperAdmin) {
      return;
    }
    if (!selectedTenantId || !tenantFormsVisible || activeTab === "sucursales") {
      return;
    }
    let active = true;
    setTenantLoading(true);
    setBrandingForm(isCurrentTenant ? buildBrandingForm(branding) : buildBrandingForm());
    if (!isCurrentTenant) {
      setCompanyForm({ ...emptyCompanyDetails });
    }
    void (async () => {
      try {
        const [configResult, detailsResult] = await Promise.allSettled([
          getTenantConfig(selectedTenantId),
          getTenantDetails(selectedTenantId),
        ]);
        if (!active) {
          return;
        }
        if (configResult.status === "fulfilled" && configResult.value?.config) {
          setBrandingForm(buildBrandingForm(configResult.value.config));
        } else if (!isCurrentTenant) {
          setBrandingForm(buildBrandingForm());
        }
        if (detailsResult.status === "fulfilled" && detailsResult.value) {
          const response = detailsResult.value;
          setCompanyForm({
            razonSocial: response.razon_social,
            nit: response.nit,
            dv: response.dv ?? "",
            tipoPersona: response.tipo_persona ?? "",
            tipoSociedad: response.tipo_sociedad ?? "",
            fechaConstitucion: response.fecha_constitucion ?? "",
            estado: response.estado ?? "",
            responsabilidadesDian: response.responsabilidades_dian ?? "",
            regimen: response.regimen ?? "",
            vatResponsibility: response.vat_responsibility ?? "UNKNOWN",
            actividadEconomica: response.actividad_economica ?? "",
            obligadoFacturacionElectronica:
              response.obligado_facturacion_electronica ?? false,
            resolucionDian: response.resolucion_dian ?? "",
            fechaInicioFacturacion: response.fecha_inicio_facturacion ?? "",
            direccionPrincipal: response.direccion_principal ?? "",
            paisId: response.pais_id ?? "",
            departamentoId: response.departamento_id ?? "",
            municipioId: response.municipio_id ?? "",
            ciudad: response.ciudad ?? "",
            departamento: response.departamento ?? "",
            pais: response.pais ?? "",
            telefono: response.telefono ?? "",
            emailCorporativo: response.email_corporativo ?? "",
            sitioWeb: response.sitio_web ?? "",
            representanteNombre: response.representante_nombre ?? "",
            representanteTipoDocumento: response.representante_tipo_documento ?? "",
            representanteNumeroDocumento: response.representante_numero_documento ?? "",
            representanteEmail: response.representante_email ?? "",
            representanteTelefono: response.representante_telefono ?? "",
            cuentaContableDefecto: response.cuenta_contable_defecto ?? "",
            bancoPrincipal: response.banco_principal ?? "",
            numeroCuenta: response.numero_cuenta ?? "",
            tipoCuenta: response.tipo_cuenta ?? "",
          });
        } else if (!isCurrentTenant) {
          setCompanyForm({ ...emptyCompanyDetails });
        }
      } catch {
        if (active) {
          setStatusError("No fue posible cargar la información del tenant.");
          if (!isCurrentTenant) {
            setCompanyForm({ ...emptyCompanyDetails });
            setBrandingForm(buildBrandingForm());
          }
        }
      } finally {
        if (active) {
          setTenantLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [
    activeTab,
    buildBrandingForm,
    branding,
    isCurrentTenant,
    isSuperAdmin,
    selectedTenantId,
    setStatusError,
    tenantFormsVisible,
  ]);

  useEffect(() => {
    if (
      !shouldScrollToCompanyForm ||
      !tenantFormsVisible ||
      activeTab !== "empresa"
    ) {
      return;
    }
    const target = companyFormRef.current;
    if (target) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    setShouldScrollToCompanyForm(false);
  }, [activeTab, shouldScrollToCompanyForm, tenantFormsVisible]);

  const tabs = useMemo(() => {
    if (!isSuperAdmin) {
      return [
        {
          key: "empresa" as const,
          label: "Empresa",
          icon: Building2,
        },
        {
          key: "branding" as const,
          label: "Branding",
          icon: Paintbrush,
        },
        {
          key: "sucursales" as const,
          label: "Sucursales",
          icon: MapPin,
        },
      ];
    }
    return [
      {
        key: "empresa" as const,
        label: "Empresas",
        icon: Building2,
      },
      {
        key: "branding" as const,
        label: "Branding Empresas",
        icon: Paintbrush,
      },
      {
        key: "sucursales" as const,
        label: "Sucursales",
        icon: MapPin,
      },
    ];
  }, [isSuperAdmin]);

  const handleCompanyChange = (field: string, value: string | boolean) => {
    setCompanyForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleBrandingChange = (path: string, value: string) => {
    setBrandingForm((prev) => {
      if (path.startsWith("colors.")) {
        const key = path.replace("colors.", "");
        return { ...prev, colors: { ...prev.colors, [key]: value } };
      }
      if (path.startsWith("spacing.")) {
        const key = path.replace("spacing.", "");
        return { ...prev, spacing: { ...prev.spacing, [key]: value } };
      }
      return { ...prev, [path]: value };
    });
  };

  const normalizeBrandingColorField = (key: BrandingColorKey) => {
    setBrandingForm((prev) => {
      const normalized = normalizeHexColor(prev.colors[key]);
      if (!normalized) {
        return prev;
      }

      return {
        ...prev,
        colors: {
          ...prev.colors,
          [key]: normalized,
        },
      };
    });
  };

  const handleLogoUpload = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result?.toString() ?? "";
      handleBrandingChange("logo", result);
    };
    reader.readAsDataURL(file);
  };

  const brandingColorErrors = useMemo(() => {
    return brandingColorFields.reduce<Record<BrandingColorKey, string | null>>(
      (acc, field) => {
        const value = brandingForm.colors[field.key]?.trim() ?? "";

        if (!value) {
          acc[field.key] = field.required ? "Este color es obligatorio." : null;
          return acc;
        }

        acc[field.key] = isValidHexColor(value)
          ? null
          : "Usa formato #RGB o #RRGGBB.";
        return acc;
      },
      {
        primary: null,
        secondary: null,
        background: null,
        text: null,
      }
    );
  }, [brandingForm.colors]);

  const hasBrandingColorErrors = Object.values(brandingColorErrors).some(Boolean);

  const normalizedBrandingConfig = useMemo<BrandingConfig>(
    () => ({
      colors: {
        primary: normalizeColorOrFallback(
          brandingForm.colors.primary,
          defaultTheme.colors.primary
        ),
        secondary: normalizeColorOrFallback(
          brandingForm.colors.secondary,
          defaultTheme.colors.secondary
        ),
        background: normalizeColorOrFallback(
          brandingForm.colors.background,
          defaultTheme.colors.background
        ),
        text: normalizeColorOrFallback(brandingForm.colors.text, defaultTheme.colors.text),
      },
      font: brandingForm.font.trim() || defaultTheme.typography.fontFamily,
      logo: brandingForm.logo.trim() || undefined,
      spacing: {
        sm: brandingForm.spacing.sm.trim() || defaultTheme.spacing.sm,
        md: brandingForm.spacing.md.trim() || defaultTheme.spacing.md,
        lg: brandingForm.spacing.lg.trim() || defaultTheme.spacing.lg,
      },
    }),
    [brandingForm]
  );

  const previewTheme = useMemo(
    () => buildTenantThemeTokens(normalizedBrandingConfig),
    [normalizedBrandingConfig]
  );
  const selectedTenantName =
    tenants.find((tenant) => tenant.id === selectedTenantId)?.nombre ??
    authUser?.tenantName ??
    "";
  const previewCompanyName =
    companyForm.razonSocial.trim() ||
    companyDetails?.razonSocial?.trim() ||
    selectedTenantName ||
    "Manus Tienda Platform S.A.S.";

  const openCreateBranchModal = () => {
    setBranchModalMode("create");
    setBranchEditingId(null);
    setBranchForm({ ...emptyBranchForm });
    setBranchModalOpen(true);
  };

  const openEditBranchModal = (branch: Branch) => {
    setBranchModalMode("edit");
    setBranchEditingId(branch.id);
    setBranchForm({
      codigo: branch.codigo,
      nombre: branch.nombre,
      descripcion: branch.descripcion,
      esPrincipal: branch.esPrincipal,
      direccion: branch.direccion,
      paisId: branch.paisId,
      departamentoId: branch.departamentoId,
      municipioId: branch.municipioId,
      ciudad: branch.ciudad,
      departamento: branch.departamento,
      pais: branch.pais,
      telefono: branch.telefono,
      email: branch.email,
      estado: branch.estado,
    });
    setBranchModalOpen(true);
  };

  const closeBranchModal = () => {
    setBranchModalOpen(false);
    setBranchEditingId(null);
    setBranchForm({ ...emptyBranchForm });
  };

  const EmpresaForm = () => (
    <div
      ref={companyFormRef}
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Información de la compañía
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Datos legales, tributarios y de contacto para facturación e impuestos.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => void handleConfirmSaveCompany()}
            disabled={!isCompanyFormComplete}
          >
            <Save className="h-4 w-4" />
            Guardar
          </Button>
          <Button
            variant="ghost"
            onClick={() => void handleConfirmResetCompany()}
            disabled={!isCompanyFormComplete}
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
          {isSuperAdmin ? (
            <Button variant="ghost" onClick={closeTenantModal}>
              Cerrar
            </Button>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Los campos marcados con{" "}
        <span className="font-semibold text-red-600">*</span> son obligatorios.
      </p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Input
          label="Razón social"
          required
          value={companyForm.razonSocial}
          onChange={(event) => handleCompanyChange("razonSocial", event.target.value)}
        />
        <Input
          label="NIT"
          required
          value={companyForm.nit}
          onChange={(event) => handleCompanyChange("nit", event.target.value)}
        />
        <Input
          label="DV"
          required
          value={companyForm.dv}
          onChange={(event) => handleCompanyChange("dv", event.target.value)}
        />
        <Select
          label="Tipo de persona"
          required
          value={companyForm.tipoPersona}
          onChange={(event) => handleCompanyChange("tipoPersona", event.target.value)}
        >
          <option value="Natural">Natural</option>
          <option value="Jurídica">Jurídica</option>
        </Select>
        <Input
          label="Tipo de sociedad"
          required
          value={companyForm.tipoSociedad}
          onChange={(event) => handleCompanyChange("tipoSociedad", event.target.value)}
        />
        <Input
          label="Fecha de constitución"
          type="date"
          required
          value={normalizeDateInputValue(companyForm.fechaConstitucion)}
          onChange={(event) =>
            handleCompanyChange("fechaConstitucion", event.target.value)
          }
        />
        <Select
          label="Estado"
          required
          value={companyForm.estado}
          onChange={(event) => handleCompanyChange("estado", event.target.value)}
        >
          <option value="Activa">Activa</option>
          <option value="Inactiva">Inactiva</option>
          <option value="En liquidación">En liquidación</option>
        </Select>
        <Input
          label="Responsabilidades DIAN"
          value={companyForm.responsabilidadesDian}
          required
          onChange={(event) =>
            handleCompanyChange("responsabilidadesDian", event.target.value)
          }
        />
        <Input
          label="Régimen"
          value={companyForm.regimen}
          required
          onChange={(event) => handleCompanyChange("regimen", event.target.value)}
        />
        <Input
          label="Actividad económica (CIIU)"
          required
          value={companyForm.actividadEconomica}
          onChange={(event) =>
            handleCompanyChange("actividadEconomica", event.target.value)
          }
        />
        <Select
          label="Obligado a facturación electrónica"
          value={companyForm.obligadoFacturacionElectronica ? "true" : "false"}
          required
          onChange={(event) =>
            handleCompanyChange(
              "obligadoFacturacionElectronica",
              event.target.value === "true"
            )
          }
        >
          <option value="true">Sí</option>
          <option value="false">No</option>
        </Select>
        <Input
          label="Resolución DIAN"
          required
          value={companyForm.resolucionDian}
          onChange={(event) =>
            handleCompanyChange("resolucionDian", event.target.value)
          }
        />
        <Select
          label="Responsabilidad de IVA"
          value={companyForm.vatResponsibility ?? "UNKNOWN"}
          required
          onChange={(event) =>
            handleCompanyChange("vatResponsibility", event.target.value)
          }
        >
          <option value="RESPONSIBLE">Responsable de IVA</option>
          <option value="NOT_RESPONSIBLE">No responsable de IVA</option>
          <option value="UNKNOWN">Por validar</option>
        </Select>
        <Input
          label="Fecha inicio facturación electrónica"
          type="date"
          required
          value={normalizeDateInputValue(companyForm.fechaInicioFacturacion)}
          onChange={(event) =>
            handleCompanyChange("fechaInicioFacturacion", event.target.value)
          }
        />
        <Input
          label="Dirección principal"
          required
          value={companyForm.direccionPrincipal}
          onChange={(event) =>
            handleCompanyChange("direccionPrincipal", event.target.value)
          }
        />
        <Select
          label="País"
          required
          value={companyForm.paisId}
          disabled={countriesLoading || countries.length === 0}
          onChange={(event) => {
            const paisId = event.target.value;
            const selected = countries.find((item) => item.id === paisId);
            setCompanyForm((prev) => ({
              ...prev,
              paisId,
              pais: selected?.nombre ?? "",
              departamentoId: "",
              departamento: "",
              municipioId: "",
              ciudad: "",
            }));
          }}
        >
          <option value="">
            {countriesLoading ? "Cargando..." : "Selecciona un país"}
          </option>
          {countries.map((pais) => (
            <option key={pais.id} value={pais.id}>
              {pais.nombre}
            </option>
          ))}
        </Select>
        <Select
          label="Departamento"
          required
          value={companyForm.departamentoId}
          disabled={companyDepartmentsLoading || companyDepartments.length === 0}
          onChange={(event) => {
            const departamentoId = event.target.value;
            const selected = companyDepartments.find(
              (item) => item.id === departamentoId
            );
            setCompanyForm((prev) => ({
              ...prev,
              departamentoId,
              departamento: selected?.nombre ?? "",
              municipioId: "",
              ciudad: "",
            }));
          }}
        >
          <option value="">
            {companyDepartmentsLoading ? "Cargando..." : "Selecciona un departamento"}
          </option>
          {companyDepartments.map((departamento) => (
            <option key={departamento.id} value={departamento.id}>
              {departamento.nombre}
            </option>
          ))}
        </Select>
        <Select
          label="Ciudad"
          required
          value={companyForm.municipioId}
          disabled={companyMunicipalitiesLoading || companyMunicipalities.length === 0}
          onChange={(event) => {
            const municipioId = event.target.value;
            const selected = companyMunicipalities.find(
              (item) => item.id === municipioId
            );
            setCompanyForm((prev) => ({
              ...prev,
              municipioId,
              ciudad: selected?.nombre ?? "",
            }));
          }}
        >
          <option value="">
            {companyMunicipalitiesLoading ? "Cargando..." : "Selecciona una ciudad"}
          </option>
          {companyMunicipalities.map((municipio) => (
            <option key={municipio.id} value={municipio.id}>
              {municipio.nombre}
            </option>
          ))}
        </Select>
        <Input
          label="Teléfono"
          required
          value={companyForm.telefono}
          onChange={(event) => handleCompanyChange("telefono", event.target.value)}
        />
        <Input
          label="Email corporativo"
          type="email"
          required
          value={companyForm.emailCorporativo}
          onChange={(event) =>
            handleCompanyChange("emailCorporativo", event.target.value)
          }
        />
        <Input
          label="Sitio web"
          required
          value={companyForm.sitioWeb}
          onChange={(event) => handleCompanyChange("sitioWeb", event.target.value)}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Input
          label="Representante legal"
          required
          value={companyForm.representanteNombre}
          onChange={(event) =>
            handleCompanyChange("representanteNombre", event.target.value)
          }
        />
        <Select
          label="Tipo de documento"
          required
          value={companyForm.representanteTipoDocumento}
          onChange={(event) =>
            handleCompanyChange("representanteTipoDocumento", event.target.value)
          }
        >
          <option value="CC">CC</option>
          <option value="CE">CE</option>
          <option value="NIT">NIT</option>
          <option value="Pasaporte">Pasaporte</option>
        </Select>
        <Input
          label="Número de documento"
          required
          value={companyForm.representanteNumeroDocumento}
          onChange={(event) =>
            handleCompanyChange("representanteNumeroDocumento", event.target.value)
          }
        />
        <Input
          label="Email representante"
          type="email"
          required
          value={companyForm.representanteEmail}
          onChange={(event) =>
            handleCompanyChange("representanteEmail", event.target.value)
          }
        />
        <Input
          label="Teléfono representante"
          required
          value={companyForm.representanteTelefono}
          onChange={(event) =>
            handleCompanyChange("representanteTelefono", event.target.value)
          }
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Input
          label="Cuenta contable por defecto"
          required
          value={companyForm.cuentaContableDefecto}
          onChange={(event) =>
            handleCompanyChange("cuentaContableDefecto", event.target.value)
          }
        />
        <Input
          label="Banco principal"
          required
          value={companyForm.bancoPrincipal}
          onChange={(event) => handleCompanyChange("bancoPrincipal", event.target.value)}
        />
        <Input
          label="Número de cuenta"
          required
          value={companyForm.numeroCuenta}
          onChange={(event) => handleCompanyChange("numeroCuenta", event.target.value)}
        />
        <Select
          label="Tipo de cuenta"
          required
          value={companyForm.tipoCuenta}
          onChange={(event) => handleCompanyChange("tipoCuenta", event.target.value)}
        >
          <option value="Ahorros">Ahorros</option>
          <option value="Corriente">Corriente</option>
        </Select>
      </div>
    </div>
  );

  const BrandingForm = () => (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Branding de la empresa
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Define colores, tipografía y logo visibles en todo el sistema.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {isSuperAdmin ? (
            <Button variant="ghost" onClick={closeTenantModal}>
              Cerrar
            </Button>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => void handleConfirmSaveBranding()}
            disabled={!isBrandingFormComplete}
          >
            <Save className="h-4 w-4" />
            Guardar branding
          </Button>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Los campos marcados con <span className="font-semibold text-red-600">*</span>{" "}
        son obligatorios.
      </p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {brandingColorFields.map((field) => (
          <ColorField
            key={field.key}
            id={`branding-color-${field.key}`}
            label={field.label}
            required={field.required}
            value={brandingForm.colors[field.key] ?? ""}
            fallback={colorFallbacks[field.key]}
            error={brandingColorErrors[field.key]}
            onBlur={() => normalizeBrandingColorField(field.key)}
            onChange={(value) =>
              handleBrandingChange(`colors.${field.key}`, value)
            }
          />
        ))}
        <Input
          label="Tipografía base"
          required
          value={brandingForm.font}
          onChange={(event) => handleBrandingChange("font", event.target.value)}
        />
        <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
          <span className="font-medium">Logo</span>
          <label className="flex items-center gap-3 rounded-lg border border-dashed border-slate-200 p-4">
            <UploadCloud className="h-5 w-5 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Cargar logo</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                PNG o SVG recomendado (se guarda en la configuración).
              </p>
            </div>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => handleLogoUpload(event.target.files?.[0])}
            />
          </label>
          {brandingForm.logo ? (
            <img
              src={brandingForm.logo}
              alt="Logo preview"
              className="h-16 rounded-lg border border-slate-200 bg-white object-contain p-2 dark:bg-slate-800 dark:border-slate-700"
            />
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">Sin logo cargado.</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Input
          label="Spacing SM"
          required
          value={brandingForm.spacing.sm}
          onChange={(event) => handleBrandingChange("spacing.sm", event.target.value)}
        />
        <Input
          label="Spacing MD"
          required
          value={brandingForm.spacing.md}
          onChange={(event) => handleBrandingChange("spacing.md", event.target.value)}
        />
        <Input
          label="Spacing LG"
          required
          value={brandingForm.spacing.lg}
          onChange={(event) => handleBrandingChange("spacing.lg", event.target.value)}
        />
      </div>

      <BrandingThemePreview
        theme={previewTheme}
        companyName={previewCompanyName}
        logo={normalizedBrandingConfig.logo}
      />
    </div>
  );

  const SucursalesForm = () => (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Sucursales</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Administra las sucursales y define la principal por tenant.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {isSuperAdmin ? (
            <Button variant="ghost" onClick={closeTenantModal}>
              Cerrar
            </Button>
          ) : null}
          <Button
            variant="secondary"
            onClick={openCreateBranchModal}
            disabled={isSuperAdmin && !selectedTenantId}
          >
            <Plus className="h-4 w-4" />
            Nueva sucursal
          </Button>
        </div>
      </div>

      <SearchFilters
        query={branchSearch.query}
        status={branchSearch.status}
        onQueryChange={(value) =>
          setBranchSearch((prev) => ({ ...prev, query: value }))
        }
        onStatusChange={(value) =>
          setBranchSearch((prev) => ({ ...prev, status: value }))
        }
        queryLabel="Buscar por nombre o código"
        queryPlaceholder="Ej. principal"
        statusOptions={[
          { value: "all", label: "Todas" },
          { value: "ACTIVE", label: "Activa" },
          { value: "INACTIVE", label: "Inactiva" },
        ]}
      />

      {!selectedTenantId && isSuperAdmin ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
          Selecciona un tenant para ver sus sucursales.
        </div>
      ) : branchesLoading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
          Cargando sucursales...
        </div>
      ) : branches.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
          No hay sucursales registradas.
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
          No hay sucursales que coincidan con la búsqueda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Ubicación</th>
                <th className="px-4 py-3">Principal</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredBranches.map((branch) => (
                <tr key={branch.id} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                    {branch.codigo}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{branch.nombre}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {[branch.ciudad, branch.departamento, branch.pais]
                      .filter(Boolean)
                      .join(", ") || "Sin ubicación"}
                  </td>
                  <td className="px-4 py-3">
                    {branch.esPrincipal ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                        <Star className="h-3 w-3" />
                        Principal
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                          branch.estado === "ACTIVE"
                            ? "bg-emerald-500"
                            : "bg-slate-200"
                        }`}
                        onClick={() => void handleConfirmToggleBranchStatus(branch)}
                        disabled={branchActionId === branch.id}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            branch.estado === "ACTIVE"
                              ? "translate-x-6"
                              : "translate-x-1"
                          }`}
                        />
                      </button>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {branch.estado === "ACTIVE" ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => openEditBranchModal(branch)}
                    >
                      Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const isCompanyFormComplete = useMemo(() => {
    const requiredFields: Array<keyof typeof companyForm> = [
      "razonSocial",
      "nit",
      "dv",
      "tipoPersona",
      "tipoSociedad",
      "fechaConstitucion",
      "estado",
      "responsabilidadesDian",
      "regimen",
      "actividadEconomica",
      "resolucionDian",
      "fechaInicioFacturacion",
      "direccionPrincipal",
      "municipioId",
      "departamentoId",
      "paisId",
      "telefono",
      "emailCorporativo",
      "sitioWeb",
      "representanteNombre",
      "representanteTipoDocumento",
      "representanteNumeroDocumento",
      "representanteEmail",
      "representanteTelefono",
      "cuentaContableDefecto",
      "bancoPrincipal",
      "numeroCuenta",
      "tipoCuenta",
    ];

    return requiredFields.every((field) => {
      const value = companyForm[field];
      if (typeof value === "string") {
        return value.trim().length > 0;
      }
      return value !== null && value !== undefined;
    });
  }, [companyForm]);

  const isBrandingFormComplete = useMemo(() => {
    const { colors, spacing, font } = brandingForm;
    return (
      colors.primary.trim().length > 0 &&
      font.trim().length > 0 &&
      spacing.sm.trim().length > 0 &&
      spacing.md.trim().length > 0 &&
      spacing.lg.trim().length > 0 &&
      !hasBrandingColorErrors
    );
  }, [brandingForm, hasBrandingColorErrors]);

  const isBranchFormComplete = useMemo(() => {
    return (
      branchForm.codigo.trim().length > 0 &&
      branchForm.nombre.trim().length > 0
    );
  }, [branchForm]);

  const handleSaveCompany = async () => {
    setStatus(null);
    if (!selectedTenantId) {
      setStatusWarning("No hay un tenant activo para guardar la información.");
      return;
    }
    try {
      const response = await updateTenantDetails(selectedTenantId, companyForm);
      if (isCurrentTenant) {
        dispatch(
          setCompanyDetails({
            razonSocial: response.razon_social,
            nit: response.nit,
            dv: response.dv,
            tipoPersona: response.tipo_persona,
            tipoSociedad: response.tipo_sociedad,
            fechaConstitucion: response.fecha_constitucion,
            estado: response.estado,
            responsabilidadesDian: response.responsabilidades_dian,
            regimen: response.regimen,
            vatResponsibility: response.vat_responsibility ?? "UNKNOWN",
            actividadEconomica: response.actividad_economica,
            obligadoFacturacionElectronica:
              response.obligado_facturacion_electronica,
            resolucionDian: response.resolucion_dian,
            fechaInicioFacturacion: response.fecha_inicio_facturacion,
            direccionPrincipal: response.direccion_principal,
            paisId: response.pais_id ?? "",
            departamentoId: response.departamento_id ?? "",
            municipioId: response.municipio_id ?? "",
            ciudad: response.ciudad,
            departamento: response.departamento,
            pais: response.pais,
            telefono: response.telefono,
            emailCorporativo: response.email_corporativo,
            sitioWeb: response.sitio_web,
            representanteNombre: response.representante_nombre,
            representanteTipoDocumento: response.representante_tipo_documento,
            representanteNumeroDocumento: response.representante_numero_documento,
            representanteEmail: response.representante_email,
            representanteTelefono: response.representante_telefono,
            cuentaContableDefecto: response.cuenta_contable_defecto,
            bancoPrincipal: response.banco_principal,
            numeroCuenta: response.numero_cuenta,
            tipoCuenta: response.tipo_cuenta,
          })
        );
      }
      setStatusSuccess("Información de empresa actualizada.");
    } catch {
      setStatusError("No fue posible guardar la información de la empresa.");
    }
  };

  const handleResetCompany = async () => {
    setStatus(null);
    if (!selectedTenantId) {
      setStatusWarning("No hay un tenant activo para eliminar la información.");
      return;
    }
    try {
      await deleteTenantDetails(selectedTenantId);
      if (isCurrentTenant) {
        dispatch(resetCompanyDetails());
      }
      setCompanyForm({ ...emptyCompanyDetails });
      setStatusSuccess("Información de empresa eliminada.");
    } catch {
      setStatusError("No fue posible eliminar la información.");
    }
  };

  const handleSaveBranding = async () => {
    
    setStatus(null);
    if (!selectedTenantId) {
      setStatusWarning("No hay un tenant activo para guardar el branding.");
      return;
    }
    if (hasBrandingColorErrors) {
      setStatusWarning("Corrige los colores invalidos antes de guardar.");
      return;
    }
    try {
      const response = await updateTenantConfig(selectedTenantId, normalizedBrandingConfig);
      const savedConfig = buildBrandingForm(response?.config ?? normalizedBrandingConfig);
      const savedBranding: BrandingConfig = {
        colors: {
          primary: normalizeColorOrFallback(
            savedConfig.colors.primary,
            normalizedBrandingConfig.colors.primary
          ),
          secondary: normalizeColorOrFallback(
            savedConfig.colors.secondary,
            normalizedBrandingConfig.colors.secondary
          ),
          background: normalizeColorOrFallback(
            savedConfig.colors.background,
            normalizedBrandingConfig.colors.background
          ),
          text: normalizeColorOrFallback(
            savedConfig.colors.text,
            normalizedBrandingConfig.colors.text
          ),
        },
        font: savedConfig.font || normalizedBrandingConfig.font,
        logo: savedConfig.logo || normalizedBrandingConfig.logo,
        spacing: {
          sm: savedConfig.spacing.sm || normalizedBrandingConfig.spacing.sm,
          md: savedConfig.spacing.md || normalizedBrandingConfig.spacing.md,
          lg: savedConfig.spacing.lg || normalizedBrandingConfig.spacing.lg,
        },
      };

      setBrandingForm(savedConfig);

      if (isCurrentTenant) {
        dispatch(setBranding(savedBranding));
      }
      setStatusSuccess("Branding actualizado.");
    } catch {
      setStatusError("No fue posible guardar el branding.");
    }
  };

  const handleToggleTenant = async (tenant: TenantSummary) => {
    setStatus(null);
    setTenantActionId(tenant.id);
    try {
      const updated = await updateTenant(tenant.id, { activo: !tenant.activo });
      if (!updated) {
        setStatusError("No fue posible actualizar el estado del tenant.");
        return;
      }
      setTenants((prev) =>
        prev.map((item) => (item.id === tenant.id ? { ...item, ...updated } : item))
      );
      setStatusSuccess(
        updated.activo
          ? "Tenant reactivado correctamente."
          : "Tenant inactivado correctamente."
      );
    } catch {
      setStatusError("No fue posible actualizar el estado del tenant.");
    } finally {
      setTenantActionId(null);
    }
  };

  const handleSubmitBranch = async () => {
    setStatus(null);
    const tenantId = isSuperAdmin ? selectedTenantId : currentTenantId;
    if (!tenantId) {
      setStatusWarning("Selecciona un tenant para administrar sus sucursales.");
      return;
    }
    try {
      if (branchModalMode === "create") {
        await createBranch(
          {
            tenantId,
            codigo: branchForm.codigo.trim(),
            nombre: branchForm.nombre.trim(),
            descripcion: branchForm.descripcion.trim() || undefined,
            esPrincipal: branchForm.esPrincipal,
            direccion: branchForm.direccion.trim() || undefined,
            paisId: branchForm.paisId || undefined,
            departamentoId: branchForm.departamentoId || undefined,
            municipioId: branchForm.municipioId || undefined,
            telefono: branchForm.telefono.trim() || undefined,
            email: branchForm.email.trim() || undefined,
            estado: branchForm.estado,
          },
          buildBranchHeaders()
        );
        setStatusSuccess("Sucursal creada correctamente.");
      } else {
        if (!branchEditingId) {
          setStatusWarning("No hay una sucursal seleccionada para editar.");
          return;
        }
        await updateBranch(
          branchEditingId,
          {
            codigo: branchForm.codigo.trim(),
            nombre: branchForm.nombre.trim(),
            descripcion: branchForm.descripcion.trim() || undefined,
            esPrincipal: branchForm.esPrincipal,
            direccion: branchForm.direccion.trim() || undefined,
            paisId: branchForm.paisId || undefined,
            departamentoId: branchForm.departamentoId || undefined,
            municipioId: branchForm.municipioId || undefined,
            telefono: branchForm.telefono.trim() || undefined,
            email: branchForm.email.trim() || undefined,
            estado: branchForm.estado,
          },
          buildBranchHeaders()
        );
        setStatusSuccess("Sucursal actualizada correctamente.");
      }
      closeBranchModal();
      await loadBranches();
    } catch {
      setStatusError(
        branchModalMode === "create"
          ? "No fue posible crear la sucursal."
          : "No fue posible actualizar la sucursal."
      );
    }
  };

  const handleToggleBranchStatus = async (branch: Branch) => {
    setStatus(null);
    setBranchActionId(branch.id);
    try {
      const nextStatus: BranchStatus =
        branch.estado === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const updated = await updateBranchStatus(
        branch.id,
        nextStatus,
        buildBranchHeaders()
      );
      setBranches((prev) =>
        prev.map((item) =>
          item.id === branch.id
            ? { ...item, estado: updated.estado }
            : item
        )
      );
      setStatusSuccess(
        nextStatus === "ACTIVE"
          ? "Sucursal activada correctamente."
          : "Sucursal inactivada correctamente."
      );
    } catch {
      setStatusError("No fue posible actualizar el estado de la sucursal.");
    } finally {
      setBranchActionId(null);
    }
  };

  const handleSubmitTenant = async () => {
    setStatus(null);
    try {
      if (tenantModalMode === "create") {
        const nombre = tenantForm.nombre.trim();
        const slugInput = tenantForm.slug.trim();
        if (!nombre) {
          setStatusWarning("Debes definir un nombre para el tenant.");
          return;
        }
        const created = await createTenant({
          nombre,
          ...(slugInput ? { slug: slugInput } : {}),
        });
        if (!created) {
          setStatusError("No fue posible crear el tenant.");
          return;
        }
        setTenantForm({ slug: "", nombre: "" });
        setTenantModalOpen(false);
        setTenantFormsVisible(true);
        await loadTenants(created.id);
        setStatusSuccess(
          `Tenant creado correctamente (${created.slug}).`
        );
        return;
      }
      if (!tenantEditingId) {
        setStatusWarning("No hay un tenant seleccionado para editar.");
        return;
      }
      setTenantModalOpen(false);
      setTenantFormsVisible(true);
      setTenantForm({ slug: "", nombre: "" });
      setTenantEditingId(null);
    } catch {
      setStatusError(
        tenantModalMode === "create"
          ? "No fue posible crear el tenant."
          : "No fue posible actualizar el tenant."
      );
    }
  };

  const handleConfirmSaveCompany = async () => {
    if (!selectedTenantId) {
      await handleSaveCompany();
      return;
    }

    try {
      await confirm({
        title: "¿Deseas guardar los cambios?",
        description:
          "Se actualizará la información de la compañía del tenant seleccionado.",
        confirmText: "Guardar",
        variant: "default",
      });
      await handleSaveCompany();
    } catch (error) {
      if (!isConfirmCancelledError(error)) {
        throw error;
      }
    }
  };

  const handleConfirmResetCompany = async () => {
    if (!selectedTenantId) {
      await handleResetCompany();
      return;
    }

    try {
      await confirm({
        title: "¿Estás seguro de eliminar este registro?",
        description:
          "La información de la compañía será eliminada. Esta acción no se puede deshacer.",
        confirmText: "Eliminar",
        variant: "danger",
      });
      await handleResetCompany();
    } catch (error) {
      if (!isConfirmCancelledError(error)) {
        throw error;
      }
    }
  };

  const handleConfirmSaveBranding = async () => {
    if (!selectedTenantId) {
      await handleSaveBranding();
      return;
    }

    try {
      await confirm({
        title: "¿Deseas guardar los cambios?",
        description:
          "El branding se aplicará globalmente al tenant seleccionado.",
        confirmText: "Guardar branding",
        variant: "default",
      });
      await handleSaveBranding();
    } catch (error) {
      if (!isConfirmCancelledError(error)) {
        throw error;
      }
    }
  };

  const handleConfirmToggleTenant = async (tenant: TenantSummary) => {
    try {
      await confirm({
        title: tenant.activo
          ? "¿Deseas inactivar este registro?"
          : "¿Deseas reactivar este registro?",
        description: tenant.activo
          ? `El tenant "${tenant.nombre ?? tenant.slug}" quedará inactivo.`
          : `El tenant "${tenant.nombre ?? tenant.slug}" volverá a estar activo.`,
        confirmText: tenant.activo ? "Inactivar" : "Reactivar",
        variant: "warning",
      });
      await handleToggleTenant(tenant);
    } catch (error) {
      if (!isConfirmCancelledError(error)) {
        throw error;
      }
    }
  };

  const handleConfirmSubmitBranch = async () => {
    if (!isBranchFormComplete) {
      await handleSubmitBranch();
      return;
    }

    try {
      await confirm({
        title:
          branchModalMode === "create"
            ? "¿Deseas guardar los cambios?"
            : "¿Confirmas actualizar la información?",
        description:
          branchModalMode === "create"
            ? "Se creará una nueva sucursal para el tenant seleccionado."
            : "Se actualizará la información de la sucursal seleccionada.",
        confirmText:
          branchModalMode === "create" ? "Crear sucursal" : "Actualizar sucursal",
        variant: "default",
      });
      await handleSubmitBranch();
    } catch (error) {
      if (!isConfirmCancelledError(error)) {
        throw error;
      }
    }
  };

  const handleConfirmToggleBranchStatus = async (branch: Branch) => {
    try {
      const isActive = branch.estado === "ACTIVE";
      await confirm({
        title: isActive
          ? "¿Deseas inactivar este registro?"
          : "¿Deseas reactivar este registro?",
        description: isActive
          ? `La sucursal "${branch.nombre}" quedará inactiva.`
          : `La sucursal "${branch.nombre}" volverá a estar activa.`,
        confirmText: isActive ? "Inactivar" : "Reactivar",
        variant: "warning",
      });
      await handleToggleBranchStatus(branch);
    } catch (error) {
      if (!isConfirmCancelledError(error)) {
        throw error;
      }
    }
  };

  const handleConfirmSubmitTenant = async () => {
    if (tenantModalMode === "create" && !tenantForm.nombre.trim()) {
      await handleSubmitTenant();
      return;
    }

    try {
      await confirm({
        title:
          tenantModalMode === "create"
            ? "¿Deseas guardar los cambios?"
            : "¿Confirmas actualizar la información?",
        description:
          tenantModalMode === "create"
            ? "Se creará un nuevo tenant con la información diligenciada."
            : "Se mantendrá el tenant actual y se aplicarán los cambios visibles en pantalla.",
        confirmText:
          tenantModalMode === "create" ? "Crear tenant" : "Actualizar tenant",
        variant: "default",
      });
      await handleSubmitTenant();
    } catch (error) {
      if (!isConfirmCancelledError(error)) {
        throw error;
      }
    }
  };

  const openCreateTenantModal = () => {
    setTenantForm({ slug: "", nombre: "" });
    setTenantModalMode("create");
    setTenantEditingId(null);
    setTenantFormsVisible(true);
    setTenantModalOpen(true);
  };

  const openEditTenantModal = (tenant: TenantSummary) => {
    setTenantForm({
      slug: tenant.slug,
      nombre: tenant.nombre ?? "",
    });
    setTenantModalMode("edit");
    setTenantEditingId(tenant.id);
    setSelectedTenantId(tenant.id);
    setTenantFormsVisible(true);
    setActiveTab("empresa");
    setShouldScrollToCompanyForm(true);
    //setTenantModalOpen(true);
  };

  const closeTenantModal = () => {
    setTenantModalOpen(false);
    if (isSuperAdmin) {
      setTenantFormsVisible(false);
    }
  };

  const filteredTenants = useMemo(() => {
    const query = tenantSearch.query.trim().toLowerCase();
    return tenants.filter((tenant) => {
      const matchesStatus =
        tenantSearch.status === "all" ||
        (tenantSearch.status === "active" ? tenant.activo : !tenant.activo);
      const matchesQuery =
        !query ||
        tenant.slug.toLowerCase().includes(query) ||
        (tenant.nombre ?? "").toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [tenants, tenantSearch]);

  const selectedTenant =
    tenants.find((tenant) => tenant.id === selectedTenantId) ?? null;

  const filteredBranches = useMemo(() => {
    const query = branchSearch.query.trim().toLowerCase();
    return branches.filter((branch) => {
      const matchesStatus =
        branchSearch.status === "all" || branch.estado === branchSearch.status;
      const matchesQuery =
        !query ||
        branch.codigo.toLowerCase().includes(query) ||
        branch.nombre.toLowerCase().includes(query) ||
        branch.ciudad.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [branchSearch, branches]);

  if (!isSuperAdmin && !isSuperUser) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Acceso restringido
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Solo los usuarios con rol SUPER_ADMIN o SUPER_USER pueden acceder a la
          configuración.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Configuración
        </p>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
          {isSuperAdmin ? "Empresas, Branding y Sucursales" : "Empresa, Branding y Sucursales"}
        </h2>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          {isSuperAdmin
            ? "Administra la información legal, tributaria, branding y sucursales de cada tenant."
            : "Administra la informacion legal, branding y sucursales del tenant al que perteneces."}
        </p>
      </header>

      {authUser?.role === "SUPER_ADMIN" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-800 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Terminales POS</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Crea y administra terminales por sucursal desde un modulo dedicado.
              </p>
            </div>
            <Link
              href={`/${selectedTenantId || currentTenantId || "default"}/config/terminals`}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md"
            >
              <Monitor className="h-4 w-4" />
              Abrir terminales
            </Link>
          </div>
        </div>
      ) : null}

      {isSuperAdmin ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Tenants</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Gestiona el estado y selecciona el tenant a modificar.
              </p>
            </div>
            <Button variant="secondary" onClick={openCreateTenantModal}>
              <Plus className="h-4 w-4" />
              Nueva tenant
            </Button>
          </div>

          <SearchFilters
            query={tenantSearch.query}
            status={tenantSearch.status}
            onQueryChange={(value) =>
              setTenantSearch((prev) => ({ ...prev, query: value }))
            }
            onStatusChange={(value) =>
              setTenantSearch((prev) => ({ ...prev, status: value }))
            }
            queryLabel="Buscar por nombre o slug"
            queryPlaceholder="Ej. acme"
            statusLabel="Estado"
          />

          {tenantsLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Cargando tenants...</p>
          ) : tenants.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No hay tenants registrados.
            </p>
          ) : filteredTenants.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No hay tenants que coincidan con la búsqueda.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTenants.map((tenant) => (
                <TenantListItem
                  key={tenant.id}
                  name={tenant.nombre ?? tenant.slug}
                  slug={tenant.slug}
                  active={tenant.activo}
                  selected={tenant.id === selectedTenantId}
                  onSelect={() => setSelectedTenantId(tenant.id)}
                  actions={
                    <>
                      <Button
                        variant="ghost"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => {
                          openEditTenantModal(tenant);
                        }}
                      >
                        Modificar
                      </Button>
                      <Button
                        variant="secondary"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => void handleConfirmToggleTenant(tenant)}
                        disabled={tenantActionId === tenant.id}
                      >
                        {tenant.activo ? "Inactivar" : "Reactivar"}
                      </Button>
                    </>
                  }
                />
              ))}
            </div>
          )}
        </div>
      ) : null}


      {status ? (
        <Toast
          message={status.message}
          variant={status.variant}
          onClose={() => setStatus(null)}
        />
      ) : null}

      {isSuperAdmin ? (
        selectedTenant ? (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Tenant seleccionado: {selectedTenant.nombre ?? selectedTenant.slug}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
            Selecciona un tenant para editar la información.
          </div>
        )
      ) : (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Tenant actual: {currentTenantId || "Sin tenant"}
        </div>
      )}

      {tenantFormsVisible ? (
        <>
          <div className="flex flex-wrap gap-3">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  } dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {tenantLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
              Cargando información del tenant seleccionado...
            </div>
          ) : null}
          {activeTab === "empresa" ? (
            <EmpresaForm />
          ) : activeTab === "branding" ? (
            <BrandingForm />
          ) : (
            <SucursalesForm />
          )}
        </>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
          Presiona &quot;Modificar&quot; en un tenant o crea uno nuevo para ver los
          formularios de configuración.
        </div>
      )}

      {tenantModalOpen ? (
        <Modal title={tenantModalMode === "create" ? "Crear tenant" : "Editar tenant"}>
          <div className="space-y-4">
            <Input
              label="Nombre"
              required
              value={tenantForm.nombre}
              disabled={tenantModalMode === "edit"}
              onChange={(event) =>
                setTenantForm((prev) => ({ ...prev, nombre: event.target.value }))
              }
            />
            <Input
              label="Slug (opcional)"
              value={tenantForm.slug}
              disabled={tenantModalMode === "edit"}
              placeholder={
                previewTenantSlug(tenantForm.nombre) || "se genera desde el nombre"
              }
              onChange={(event) =>
                setTenantForm((prev) => ({ ...prev, slug: event.target.value }))
              }
            />
            {tenantModalMode === "create" ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Vista previa:{" "}
                <span className="font-mono">
                  /
                  {tenantForm.slug.trim()
                    ? previewTenantSlug(tenantForm.slug) || "…"
                    : previewTenantSlug(tenantForm.nombre) || "…"}
                  /dashboard
                </span>
                . El backend garantiza unicidad.
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={closeTenantModal}>
                Cerrar
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleConfirmSubmitTenant()}
              >
                {tenantModalMode === "create" ? "Crear tenant" : "Actualizar tenant"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {branchModalOpen ? (
        <Modal
          title={branchModalMode === "create" ? "Crear sucursal" : "Editar sucursal"}
        >
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Código"
                required
                value={branchForm.codigo}
                onChange={(event) =>
                  setBranchForm((prev) => ({ ...prev, codigo: event.target.value }))
                }
              />
              <Input
                label="Nombre"
                required
                value={branchForm.nombre}
                onChange={(event) =>
                  setBranchForm((prev) => ({ ...prev, nombre: event.target.value }))
                }
              />
              <Select
                label="Tipo de sucursal"
                value={branchForm.esPrincipal ? "principal" : "secundaria"}
                onChange={(event) =>
                  setBranchForm((prev) => ({
                    ...prev,
                    esPrincipal: event.target.value === "principal",
                  }))
                }
              >
                <option value="principal">Principal</option>
                <option value="secundaria">Secundaria</option>
              </Select>
              <Select
                label="Estado"
                value={branchForm.estado}
                onChange={(event) =>
                  setBranchForm((prev) => ({
                    ...prev,
                    estado: event.target.value as BranchStatus,
                  }))
                }
              >
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
              </Select>
            </div>

            <Textarea
              label="Descripción"
              value={branchForm.descripcion}
              className="min-h-[96px]"
              onChange={(event) =>
                setBranchForm((prev) => ({
                  ...prev,
                  descripcion: event.target.value,
                }))
              }
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Dirección"
                value={branchForm.direccion}
                onChange={(event) =>
                  setBranchForm((prev) => ({
                    ...prev,
                    direccion: event.target.value,
                  }))
                }
              />
              <Select
                label="País"
                value={branchForm.paisId}
                disabled={countriesLoading || countries.length === 0}
                onChange={(event) => {
                  const paisId = event.target.value;
                  const selected = countries.find((item) => item.id === paisId);
                  setBranchForm((prev) => ({
                    ...prev,
                    paisId,
                    pais: selected?.nombre ?? "",
                    departamentoId: "",
                    departamento: "",
                    municipioId: "",
                    ciudad: "",
                  }));
                }}
              >
                <option value="">
                  {countriesLoading ? "Cargando..." : "Selecciona un país"}
                </option>
                {countries.map((pais) => (
                  <option key={pais.id} value={pais.id}>
                    {pais.nombre}
                  </option>
                ))}
              </Select>
              <Select
                label="Departamento"
                value={branchForm.departamentoId}
                disabled={branchDepartmentsLoading || branchDepartments.length === 0}
                onChange={(event) => {
                  const departamentoId = event.target.value;
                  const selected = branchDepartments.find(
                    (item) => item.id === departamentoId
                  );
                  setBranchForm((prev) => ({
                    ...prev,
                    departamentoId,
                    departamento: selected?.nombre ?? "",
                    municipioId: "",
                    ciudad: "",
                  }));
                }}
              >
                <option value="">
                  {branchDepartmentsLoading
                    ? "Cargando..."
                    : "Selecciona un departamento"}
                </option>
                {branchDepartments.map((departamento) => (
                  <option key={departamento.id} value={departamento.id}>
                    {departamento.nombre}
                  </option>
                ))}
              </Select>
              <Select
                label="Ciudad"
                value={branchForm.municipioId}
                disabled={
                  branchMunicipalitiesLoading || branchMunicipalities.length === 0
                }
                onChange={(event) => {
                  const municipioId = event.target.value;
                  const selected = branchMunicipalities.find(
                    (item) => item.id === municipioId
                  );
                  setBranchForm((prev) => ({
                    ...prev,
                    municipioId,
                    ciudad: selected?.nombre ?? "",
                  }));
                }}
              >
                <option value="">
                  {branchMunicipalitiesLoading
                    ? "Cargando..."
                    : "Selecciona una ciudad"}
                </option>
                {branchMunicipalities.map((municipio) => (
                  <option key={municipio.id} value={municipio.id}>
                    {municipio.nombre}
                  </option>
                ))}
              </Select>
              <Input
                label="Teléfono"
                value={branchForm.telefono}
                onChange={(event) =>
                  setBranchForm((prev) => ({
                    ...prev,
                    telefono: event.target.value,
                  }))
                }
              />
              <Input
                label="Email"
                type="email"
                value={branchForm.email}
                onChange={(event) =>
                  setBranchForm((prev) => ({ ...prev, email: event.target.value }))
                }
              />
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={closeBranchModal}>
                Cerrar
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleConfirmSubmitBranch()}
                disabled={!isBranchFormComplete}
              >
                {branchModalMode === "create" ? "Crear sucursal" : "Actualizar sucursal"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
};

export default ConfiguracionPage;

