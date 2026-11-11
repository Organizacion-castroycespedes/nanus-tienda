import assert from "node:assert/strict";
import test from "node:test";
import { whatsappParameters } from "./alerts.service";
import { CloudApiWhatsappSender, buildTemplatePayload } from "./whatsapp-sender";
import { isE164, readWhatsappConfig, templateKindFor } from "./whatsapp.config";

const full = {
  CONTROL_CENTER_WHATSAPP_ENABLED: "true",
  CONTROL_CENTER_WHATSAPP_PHONE_NUMBER_ID: "123456789",
  CONTROL_CENTER_WHATSAPP_ACCESS_TOKEN: "EAAG-secret-token",
  CONTROL_CENTER_WHATSAPP_TEMPLATE_UPCOMING: "manus_cobro_previo",
  CONTROL_CENTER_WHATSAPP_TEMPLATE_DUE: "manus_cobro_vence_hoy",
  CONTROL_CENTER_WHATSAPP_TEMPLATE_OVERDUE: "manus_cobro_vencido",
};

test("whatsapp config: off by default and lists missing variables", () => {
  const config = readWhatsappConfig({});
  assert.equal(config.enabled, false);
  assert.equal(config.ready, false);
  assert.equal(config.apiVersion, "v23.0");
  assert.equal(config.templateLang, "es");
  assert.equal(config.missing.length, 5);
});

test("whatsapp config: ready with number, token and the three templates", () => {
  const config = readWhatsappConfig({ ...full, CONTROL_CENTER_WHATSAPP_API_VERSION: "v24.0" });
  assert.equal(config.ready, true);
  assert.equal(config.apiVersion, "v24.0");
  assert.equal(readWhatsappConfig({ ...full, CONTROL_CENTER_WHATSAPP_API_VERSION: "latest" }).apiVersion, "v23.0");
  assert.equal(readWhatsappConfig({ ...full, CONTROL_CENTER_WHATSAPP_TEMPLATE_DUE: "" }).ready, false);
});

test("template kind per stage and E.164 validation", () => {
  assert.equal(templateKindFor("UPCOMING"), "UPCOMING");
  assert.equal(templateKindFor("DUE"), "DUE");
  assert.equal(templateKindFor("OVERDUE_15"), "OVERDUE");
  assert.equal(isE164("+573022243805"), true);
  assert.equal(isE164("3022243805"), false);
  assert.equal(isE164("+57 302"), false);
});

test("template parameters: client, charge, amount, due date and overdue days", () => {
  const charge = { legal_name: "Caribbean Beer", charge_number: "MCC-COB-2026-000003", balance: "348082.00", due_date: "2026-11-10" };
  assert.deepEqual(whatsappParameters(charge, "DUE", 0), ["Caribbean Beer", "MCC-COB-2026-000003", "$348.082", "10/11/2026"]);
  assert.deepEqual(whatsappParameters(charge, "OVERDUE_7", 8), ["Caribbean Beer", "MCC-COB-2026-000003", "$348.082", "10/11/2026", "8"]);
});

test("payload follows the Cloud API template format", () => {
  const payload = buildTemplatePayload({ to: "+573022243805", template: "manus_cobro_vencido", language: "es", bodyParameters: ["A", "B"] });
  assert.equal(payload.to, "573022243805");
  assert.equal(payload.type, "template");
  assert.deepEqual(payload.template.language, { code: "es" });
  assert.deepEqual((payload.template as any).components[0].parameters, [{ type: "text", text: "A" }, { type: "text", text: "B" }]);
  assert.equal("components" in buildTemplatePayload({ to: "+1", template: "hello_world", language: "en_US", bodyParameters: [] }).template, false);
});

test("sender posts to the phone number endpoint and reports Meta errors", async () => {
  const calls: { url: string; init: any }[] = [];
  const ok = new CloudApiWhatsappSender(readWhatsappConfig(full), async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: "wamid.1" }] }) };
  });
  assert.deepEqual(await ok.sendTemplate({ to: "+573022243805", template: "t", language: "es", bodyParameters: [] }), { messageId: "wamid.1" });
  assert.equal(calls[0].url, "https://graph.facebook.com/v23.0/123456789/messages");
  assert.equal(calls[0].init.headers.Authorization, "Bearer EAAG-secret-token");
  const failing = new CloudApiWhatsappSender(readWhatsappConfig(full), async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: { code: 132001, message: "Template name does not exist in the translation" } }),
  }));
  await assert.rejects(failing.sendTemplate({ to: "+573022243805", template: "x", language: "es", bodyParameters: [] }), /132001/);
});
