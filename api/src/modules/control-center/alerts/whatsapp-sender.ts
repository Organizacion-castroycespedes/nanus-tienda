import type { WhatsappConfig } from "./whatsapp.config";

export const WHATSAPP_SENDER = Symbol("CONTROL_CENTER_WHATSAPP_SENDER");

export type WhatsappTemplateMessage = {
  /** Teléfono E.164 con el signo +. */
  to: string;
  template: string;
  language: string;
  bodyParameters: string[];
};

export interface WhatsappSender {
  sendTemplate(message: WhatsappTemplateMessage): Promise<{ messageId: string | null }>;
}

/** Cuerpo de la petición de la WhatsApp Cloud API para una plantilla con parámetros posicionales. */
export const buildTemplatePayload = (message: WhatsappTemplateMessage) => ({
  messaging_product: "whatsapp",
  recipient_type: "individual",
  to: message.to.replace(/^\+/, ""),
  type: "template",
  template: {
    name: message.template,
    language: { code: message.language },
    ...(message.bodyParameters.length > 0
      ? { components: [{ type: "body", parameters: message.bodyParameters.map((text) => ({ type: "text", text })) }] }
      : {}),
  },
});

type FetchLike = (url: string, init: Record<string, unknown>) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

/** Envío por la WhatsApp Cloud API de Meta con el fetch nativo de Node. */
export class CloudApiWhatsappSender implements WhatsappSender {
  constructor(
    private readonly config: WhatsappConfig,
    private readonly fetchImpl: FetchLike = (globalThis as any).fetch,
  ) {}

  async sendTemplate(message: WhatsappTemplateMessage) {
    if (!this.config.phoneNumberId || !this.config.accessToken) throw new Error("WhatsApp no configurado");
    const url = `https://graph.facebook.com/${this.config.apiVersion}/${encodeURIComponent(this.config.phoneNumberId)}/messages`;
    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildTemplatePayload(message)),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = body?.error ?? {};
      const detail = error.error_data?.details ? ` (${error.error_data.details})` : "";
      throw new Error(`Meta ${response.status} código ${error.code ?? "?"}: ${error.message ?? "error desconocido"}${detail}`);
    }
    return { messageId: body?.messages?.[0]?.id ?? null };
  }
}
