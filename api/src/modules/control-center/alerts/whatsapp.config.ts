import type { AlertStage } from "./alert-stages";

export type WhatsappTemplateKind = "UPCOMING" | "DUE" | "OVERDUE";

export type WhatsappConfig = {
  enabled: boolean;
  phoneNumberId: string | null;
  accessToken: string | null;
  apiVersion: string;
  templateLang: string;
  templates: Record<WhatsappTemplateKind, string | null>;
  /** Variables que faltan para enviar (nunca incluye valores). */
  missing: string[];
  /** Configuración mínima para el mensaje de prueba (número y token). */
  credentialsReady: boolean;
  ready: boolean;
};

type Env = Record<string, string | undefined>;

const clean = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const readWhatsappConfig = (env: Env = process.env): WhatsappConfig => {
  const phoneNumberId = clean(env.CONTROL_CENTER_WHATSAPP_PHONE_NUMBER_ID);
  const accessToken = clean(env.CONTROL_CENTER_WHATSAPP_ACCESS_TOKEN);
  const version = clean(env.CONTROL_CENTER_WHATSAPP_API_VERSION) ?? "v23.0";
  const templates: Record<WhatsappTemplateKind, string | null> = {
    UPCOMING: clean(env.CONTROL_CENTER_WHATSAPP_TEMPLATE_UPCOMING),
    DUE: clean(env.CONTROL_CENTER_WHATSAPP_TEMPLATE_DUE),
    OVERDUE: clean(env.CONTROL_CENTER_WHATSAPP_TEMPLATE_OVERDUE),
  };
  const missing: string[] = [];
  if (!phoneNumberId) missing.push("CONTROL_CENTER_WHATSAPP_PHONE_NUMBER_ID");
  if (!accessToken) missing.push("CONTROL_CENTER_WHATSAPP_ACCESS_TOKEN");
  for (const [kind, name] of Object.entries(templates)) {
    if (!name) missing.push(`CONTROL_CENTER_WHATSAPP_TEMPLATE_${kind}`);
  }
  const enabled = clean(env.CONTROL_CENTER_WHATSAPP_ENABLED)?.toLowerCase() === "true";
  return {
    enabled,
    phoneNumberId,
    accessToken,
    apiVersion: /^v\d+\.\d+$/.test(version) ? version : "v23.0",
    templateLang: clean(env.CONTROL_CENTER_WHATSAPP_TEMPLATE_LANG) ?? "es",
    templates,
    missing,
    credentialsReady: Boolean(phoneNumberId && accessToken),
    ready: enabled && missing.length === 0,
  };
};

export const templateKindFor = (stage: AlertStage): WhatsappTemplateKind =>
  stage === "UPCOMING" ? "UPCOMING" : stage === "DUE" ? "DUE" : "OVERDUE";

export const E164_RE = /^\+[1-9]\d{7,14}$/;
export const isE164 = (value: string | null | undefined): value is string => typeof value === "string" && E164_RE.test(value.trim());
