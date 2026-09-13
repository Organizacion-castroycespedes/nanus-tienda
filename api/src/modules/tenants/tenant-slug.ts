const RESERVED_TENANT_SLUGS = new Set([
  "login",
  "api",
  "auth",
  "_next",
  "static",
  "favicon.ico",
]);

const MAX_SLUG_LENGTH = 150;

/**
 * Convierte un nombre de empresa a slug URL-friendly.
 * "Almacén La 40" → "almacen-la-40"
 * "ManusTienda Platform S.A.S" → "manustienda-platform-s-a-s"
 */
export const slugifyTenantName = (value: string): string => {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");

  return slug;
};

export const isReservedTenantSlug = (slug: string): boolean =>
  RESERVED_TENANT_SLUGS.has(slug.trim().toLowerCase());

/**
 * Garantiza unicidad: base, base-2, base-3, ...
 * `exists` debe devolver true si el slug ya está ocupado.
 */
export const ensureUniqueTenantSlug = async (
  baseSlug: string,
  exists: (candidate: string) => Promise<boolean>
): Promise<string> => {
  let candidate = baseSlug;
  if (!candidate || isReservedTenantSlug(candidate)) {
    candidate = candidate ? `${candidate}-tenant` : "tenant";
  }

  if (!(await exists(candidate))) {
    return candidate;
  }

  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const suffixStr = String(suffix);
    const maxBase = MAX_SLUG_LENGTH - suffixStr.length - 1;
    const trimmedBase = candidate.slice(0, Math.max(1, maxBase)).replace(/-+$/g, "");
    const next = `${trimmedBase}-${suffixStr}`;
    if (!(await exists(next))) {
      return next;
    }
  }

  throw new Error("Unable to allocate unique tenant slug");
};

export const resolveTenantSlugFromInput = async (options: {
  explicitSlug?: string | null;
  nombre?: string | null;
  exists: (candidate: string) => Promise<boolean>;
}): Promise<string> => {
  const source =
    options.explicitSlug?.trim() ||
    options.nombre?.trim() ||
    "";
  const base = slugifyTenantName(source);
  if (!base) {
    throw new Error("slug is required");
  }
  return ensureUniqueTenantSlug(base, options.exists);
};
