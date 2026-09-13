/**
 * Preview client-side del mismo algoritmo de slug del API.
 * El backend es la autoridad final (unicidad, reserved).
 */
export const previewTenantSlug = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150)
    .replace(/-+$/g, "");
