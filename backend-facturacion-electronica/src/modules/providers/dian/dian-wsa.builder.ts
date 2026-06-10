import { randomUUID } from "node:crypto";
import { DIAN_GET_ACQUIRER_ACTION } from "./dian.constants";

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export type WsaHeaderOptions = {
  action?: string;
  to?: string;
  messageId?: string;
};

export const buildWsaHeaders = (options: WsaHeaderOptions = {}): string => {
  const action =
    options.action ||
    process.env.DIAN_GET_ACQUIRER_ACTION?.trim() ||
    DIAN_GET_ACQUIRER_ACTION;
  const to =
    options.to ||
    process.env.DIAN_ENDPOINT_URL?.trim() ||
    process.env.DIAN_WSDL_URL?.trim() ||
    "urn:dian:get-acquirer-fixture";
  const messageId = options.messageId || `urn:uuid:${randomUUID()}`;

  return `<wsa:Action>${escapeXml(action)}</wsa:Action>
    <wsa:To>${escapeXml(to)}</wsa:To>
    <wsa:MessageID>${escapeXml(messageId)}</wsa:MessageID>`;
};
