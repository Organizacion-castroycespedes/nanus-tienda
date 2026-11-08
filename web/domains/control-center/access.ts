export const DEFAULT_PLATFORM_TENANT_ID = "00000000-0000-0000-0000-000000000001";

export const resolvePlatformTenantId = (
  value: string | undefined = process.env.NEXT_PUBLIC_PLATFORM_TENANT_ID,
) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : DEFAULT_PLATFORM_TENANT_ID;
};

/**
 * Visibilidad web del Control Center. Es solo una ayuda de interfaz:
 * la autorizacion real la aplica el backend con PlatformTenantGuard.
 */
export const canSeeControlCenter = (input: {
  role: string | null | undefined;
  tenantId: string | null | undefined;
  hasReadAccess: boolean;
  platformTenantId?: string;
}) => {
  const role = (input.role ?? "").trim().toUpperCase();
  const platformTenantId = input.platformTenantId ?? resolvePlatformTenantId();
  return (
    role === "SUPER_ADMIN" &&
    input.hasReadAccess &&
    Boolean(input.tenantId) &&
    input.tenantId === platformTenantId
  );
};

export type ControlCenterLoadError = "UNAUTHORIZED" | "DISABLED" | "UNAVAILABLE";

export const classifyControlCenterError = (
  status: number | undefined,
  code?: string,
): ControlCenterLoadError => {
  if (status === 401 || status === 403) return "UNAUTHORIZED";
  if (status === 503 && code === "CONTROL_CENTER_DISABLED") return "DISABLED";
  return "UNAVAILABLE";
};

export const READINESS_ISSUE_LABELS: Record<string, string> = {
  SCHEMA_MISSING: "El esquema control_center no existe. Aplica la migración V111.",
  AUDIT_TABLE_MISSING: "Falta la tabla de auditoría administrativa.",
  AUDIT_INSERT_DENIED: "El usuario dedicado no puede registrar auditoría.",
  AUDIT_NOT_IMMUTABLE: "La auditoría permite modificaciones; revisa los privilegios.",
  PLATFORM_TENANT_MISSING: "El tenant plataforma no existe o está inactivo.",
  OPERATIONAL_ROLE_HAS_SCHEMA_ACCESS:
    "El usuario operativo de la API tiene acceso al esquema; el aislamiento está roto.",
};
