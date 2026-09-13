import type { AuthUser } from "./types";

/**
 * Segmento de ruta amigable para URLs `/{tenant}/...`.
 * Prefiere slug; cae a tenantId solo si el JWT viejo no trae slug.
 */
export const resolveTenantSlug = (
  source?:
    | Pick<AuthUser, "tenantSlug" | "tenantId">
    | { tenantSlug?: string | null; tenantId?: string | null }
    | null,
  fallback = "default"
): string => {
  const slug = source?.tenantSlug?.trim();
  if (slug) {
    return slug;
  }
  const id = source?.tenantId?.trim();
  if (id) {
    return id;
  }
  return fallback;
};

export const buildTenantPath = (
  tenantSegment: string,
  ...parts: string[]
): string => {
  const base = `/${encodeURIComponent(tenantSegment.trim() || "default")}`;
  if (!parts.length) {
    return base;
  }
  const rest = parts
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
  return rest ? `${base}/${rest}` : base;
};
