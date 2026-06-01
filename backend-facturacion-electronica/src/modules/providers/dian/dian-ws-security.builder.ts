const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export type WsSecurityOptions = {
  createdAt?: Date;
  ttlMs?: number;
  tokenReference?: string;
};

export const buildWsSecurityHeader = (
  options: WsSecurityOptions = {}
): string => {
  const createdAt = options.createdAt ?? new Date();
  const ttlMs = options.ttlMs ?? Number(process.env.DIAN_WS_SECURITY_TIMESTAMP_TTL_MS ?? 300000);
  const expiresAt = new Date(createdAt.getTime() + ttlMs);
  const tokenReference =
    options.tokenReference || "DIAN_CERTIFICATE_TOKEN_PLACEHOLDER";

  return `<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
      <wsu:Timestamp wsu:Id="Timestamp-1">
        <wsu:Created>${escapeXml(createdAt.toISOString())}</wsu:Created>
        <wsu:Expires>${escapeXml(expiresAt.toISOString())}</wsu:Expires>
      </wsu:Timestamp>
      <wsse:BinarySecurityToken wsu:Id="BinarySecurityToken-1">${escapeXml(tokenReference)}</wsse:BinarySecurityToken>
      <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <!-- TODO FE-3.3: implementar firma real o integracion con libreria WS-Security. -->
        <ds:SignatureValue>DIAN_SIGNATURE_PLACEHOLDER</ds:SignatureValue>
      </ds:Signature>
    </wsse:Security>`;
};
