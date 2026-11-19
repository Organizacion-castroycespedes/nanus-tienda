/**
 * HU-TENANT-BOOTSTRAP-001: matriz de clonación aplicada al crear un tenant.
 *
 * El tenant origen es el tenant plataforma (`PLATFORM_TENANT_ID`, por defecto
 * 00000000-0000-0000-0000-000000000001). Solo se copian catálogos de
 * configuración vigentes; nunca datos operativos ni secretos.
 */
export const TENANT_BOOTSTRAP_VERSION = "HU-TENANT-BOOTSTRAP-001/v1";

export const TENANT_BOOTSTRAP_AUDIT = {
  module: "tenants",
  entity: "tenants",
  completedAction: "TENANT_BOOTSTRAP_COMPLETED",
} as const;

/** Ítems de menú exclusivos del tenant plataforma (y su subárbol). */
export const PLATFORM_ONLY_MENU_SCOPES = ["PLATFORM_ONLY"] as const;

export const DEFAULT_FINAL_CONSUMER_NAME = "Consumidor Final";

export type CloneDecision = "COPY" | "REFERENCE" | "GENERATE" | "EXCLUDE" | "MANUAL";

export type CloneMatrixEntry = {
  table: string;
  decision: CloneDecision;
  rule: string;
};

/** Documentación ejecutable de la matriz; la usan las pruebas y el resumen. */
export const TENANT_BOOTSTRAP_MATRIX: readonly CloneMatrixEntry[] = [
  { table: "tenants", decision: "GENERATE", rule: "Se crea en la misma transacción que el aprovisionamiento." },
  { table: "roles", decision: "REFERENCE", rule: "Catálogo global; se conserva role_id." },
  {
    table: "menu_items",
    decision: "COPY",
    rule: "No eliminados; excluye scope PLATFORM_ONLY y su subárbol; UUID nuevo; parent_id remapeado por key.",
  },
  {
    table: "role_menu_permissions",
    decision: "COPY",
    rule: "Solo de ítems copiados; role_id global; menu_item_id remapeado por key.",
  },
  {
    table: "customers",
    decision: "GENERATE",
    rule: "Un consumidor final activo y predeterminado; sin correo, teléfono, dirección ni ubicación del origen.",
  },
  { table: "units", decision: "COPY", rule: "Activas; una por abreviatura normalizada." },
  {
    table: "taxes",
    decision: "COPY",
    rule: "Activos y clasificados; excluye grupos ambiguos (mismo tipo y nombre) que quedan MANUAL.",
  },
  {
    table: "tax_rates",
    decision: "COPY",
    rule: "De impuestos copiados; activas y no vencidas (effective_to nulo o >= fecha actual).",
  },
  {
    table: "tax_types, tax_calculation_methods, tax_base_types, tax_categories, tax_product_categories",
    decision: "REFERENCE",
    rule: "Catálogos fiscales globales.",
  },
  { table: "payment_methods", decision: "COPY", rule: "Activos; UUID nuevo; mismo codigo y configuración fiscal." },
  {
    table: "payment_method_financial_institutions",
    decision: "COPY",
    rule: "Solo vínculos activos a entidades financieras globales activas.",
  },
  { table: "financial_institutions", decision: "REFERENCE", rule: "Globales (tenant_id nulo); las propias del origen se excluyen." },
  { table: "parameters", decision: "REFERENCE", rule: "Valores por defecto globales." },
  { table: "tenant_settings", decision: "EXCLUDE", rule: "Overrides del origen (afectan facturación electrónica)." },
  { table: "tenants_detalles", decision: "MANUAL", rule: "Datos legales y bancarios de la nueva empresa." },
  { table: "permissions", decision: "EXCLUDE", rule: "Tabla legada sin uso en la API." },
  {
    table: "users, personas, user_roles, auth_sessions, auth_refresh_tokens, password_resets, pos_user_sessions",
    decision: "EXCLUDE",
    rule: "Identidades y credenciales.",
  },
  {
    table: "tenant_branches, terminals, pos_terminals, terminal_*, cash_registers",
    decision: "MANUAL",
    rule: "Sucursales, terminales y cajas propias de la empresa.",
  },
  {
    table: "products*, product_categories, product_subcategories, promotions*, inventory_*, stock_*, suppliers",
    decision: "EXCLUDE",
    rule: "Catálogo comercial e inventario.",
  },
  {
    table: "sales*, orders*, purchases*, payments, cash_*, deliveries*, delivery_drivers",
    decision: "EXCLUDE",
    rule: "Datos operativos.",
  },
  {
    table: "tenant_electronic_billing_configs, electronic_*, electronic_billing_*",
    decision: "EXCLUDE",
    rule: "Resoluciones, llaves técnicas, credenciales e historial DIAN.",
  },
  { table: "control_center.*", decision: "EXCLUDE", rule: "Datos comerciales de la plataforma." },
  { table: "auditoria_eventos", decision: "GENERATE", rule: "Un evento TENANT_BOOTSTRAP_COMPLETED en la transacción." },
];
