import { badRequest } from "../shared/errors";
import { asBody, optionalBoolean, optionalEnum, optionalString, requireEnum, requireString, type Body } from "../shared/parsing";

export const TAX_ID_TYPES = ["NIT", "CC", "CE", "PASAPORTE"] as const;
export const ACCOUNT_STATUSES = ["ACTIVE", "INACTIVE"] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_RE = /^\+[1-9][0-9]{7,14}$/;

export type AccountInput = {
  legalName: string;
  taxIdType: (typeof TAX_ID_TYPES)[number];
  taxId: string;
  dv: string | null;
  billingEmail: string;
  contactName: string | null;
  contactPhoneE164: string | null;
  whatsappOptIn: boolean;
  address: string | null;
  city: string | null;
  notes: string | null;
};

export type AccountPatch = Partial<AccountInput> & { status?: (typeof ACCOUNT_STATUSES)[number] };

const normalizeTaxId = (value: string) => value.replace(/[\s.\-]/g, "").toUpperCase();

const parseEmail = (body: Body, required: boolean) => {
  const value = required ? requireString(body, "billingEmail", 200) : optionalString(body, "billingEmail", 200);
  if (value && !EMAIL_RE.test(value)) throw badRequest("CONTROL_CENTER_INVALID_EMAIL", "billingEmail no es un correo válido");
  return value?.toLowerCase() ?? null;
};

const parsePhone = (body: Body) => {
  const value = optionalString(body, "contactPhoneE164", 20);
  if (value && !E164_RE.test(value)) {
    throw badRequest("CONTROL_CENTER_INVALID_PHONE", "contactPhoneE164 debe tener formato internacional, por ejemplo +573001234567");
  }
  return value;
};

const parseDv = (body: Body) => {
  const value = optionalString(body, "dv", 1);
  if (value && !/^[0-9]$/.test(value)) throw badRequest("CONTROL_CENTER_INVALID_FIELD", "dv debe ser un dígito");
  return value;
};

export const parseAccountCreate = (raw: unknown): AccountInput => {
  const body = asBody(raw);
  const contactPhoneE164 = parsePhone(body);
  const whatsappOptIn = optionalBoolean(body, "whatsappOptIn") ?? false;
  if (whatsappOptIn && !contactPhoneE164) {
    throw badRequest("CONTROL_CENTER_WHATSAPP_PHONE_REQUIRED", "El consentimiento de WhatsApp requiere un teléfono");
  }
  const taxId = normalizeTaxId(requireString(body, "taxId", 30));
  if (!taxId) throw badRequest("CONTROL_CENTER_REQUIRED_FIELD", "taxId es obligatorio");
  return {
    legalName: requireString(body, "legalName", 200),
    taxIdType: requireEnum(body, "taxIdType", TAX_ID_TYPES),
    taxId,
    dv: parseDv(body),
    billingEmail: parseEmail(body, true) as string,
    contactName: optionalString(body, "contactName", 150),
    contactPhoneE164,
    whatsappOptIn,
    address: optionalString(body, "address", 300),
    city: optionalString(body, "city", 120),
    notes: optionalString(body, "notes", 2000),
  };
};

export const parseAccountPatch = (raw: unknown): AccountPatch => {
  const body = asBody(raw);
  const patch: AccountPatch = {};
  if ("legalName" in body) patch.legalName = requireString(body, "legalName", 200);
  if ("billingEmail" in body) patch.billingEmail = parseEmail(body, true) as string;
  if ("dv" in body) patch.dv = parseDv(body);
  if ("contactName" in body) patch.contactName = optionalString(body, "contactName", 150);
  if ("contactPhoneE164" in body) patch.contactPhoneE164 = parsePhone(body);
  if ("whatsappOptIn" in body) patch.whatsappOptIn = optionalBoolean(body, "whatsappOptIn") ?? false;
  if ("address" in body) patch.address = optionalString(body, "address", 300);
  if ("city" in body) patch.city = optionalString(body, "city", 120);
  if ("notes" in body) patch.notes = optionalString(body, "notes", 2000);
  const status = optionalEnum(body, "status", ACCOUNT_STATUSES);
  if (status) patch.status = status;
  if ("taxId" in body || "taxIdType" in body) {
    throw badRequest("CONTROL_CENTER_IMMUTABLE_FIELD", "La identificación tributaria no se puede cambiar; crea una cuenta nueva");
  }
  if (Object.keys(patch).length === 0) throw badRequest("CONTROL_CENTER_EMPTY_PATCH", "No hay cambios para aplicar");
  return patch;
};
