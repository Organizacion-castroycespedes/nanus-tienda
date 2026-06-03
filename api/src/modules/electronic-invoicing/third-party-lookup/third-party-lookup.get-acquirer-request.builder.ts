export const GET_ACQUIRER_ACTION =
  "http://wcf.dian.colombia/IWcfDianCustomerServices/GetAcquirer";

export const GET_ACQUIRER_WS_ADDRESSING_ENABLED = true;

export const GET_ACQUIRER_WSDL_ENDPOINT_SOURCE =
  "DIAN participant catalog";

export const GET_ACQUIRER_VALID_IDENTIFICATION_TYPES = [
  "11",
  "12",
  "13",
  "21",
  "22",
  "31",
  "41",
  "42",
  "47",
  "48",
  "50",
  "91",
] as const;

export type GetAcquirerIdentificationType =
  (typeof GET_ACQUIRER_VALID_IDENTIFICATION_TYPES)[number];

export const GET_ACQUIRER_SOAP_NAMESPACES = {
  soap: "http://www.w3.org/2003/05/soap-envelope",
  wsa: "http://www.w3.org/2005/08/addressing",
  wsse: "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd",
  wsu: "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd",
  dian: "http://wcf.dian.colombia",
} as const;

export type GetAcquirerSoapRequestIds = {
  actionId: string;
  bodyId: string;
  messageIdId: string;
  securityId: string;
  timestampId: string;
  toId: string;
};

export type GetAcquirerSoapRequestInput = {
  action?: string;
  createdAt: Date;
  endpointUrl: string;
  identificationNumber: string;
  identificationType: string;
  ids?: Partial<GetAcquirerSoapRequestIds>;
  messageId: string;
  timestampTtlMs?: number;
};

export type GetAcquirerSoapRequest = {
  action: string;
  contentType: string;
  createdAt: string;
  expiresAt: string;
  ids: GetAcquirerSoapRequestIds;
  identificationNumber: string;
  identificationType: GetAcquirerIdentificationType;
  wsAddressingEnabled: true;
  xml: string;
};

const DEFAULT_IDS: GetAcquirerSoapRequestIds = {
  actionId: "Action-1",
  bodyId: "Body-1",
  messageIdId: "MessageID-1",
  securityId: "Security-1",
  timestampId: "Timestamp-1",
  toId: "To-1",
};

const DEFAULT_TIMESTAMP_TTL_MS = 300000;

const IDENTIFICATION_TYPE_SET = new Set<string>(
  GET_ACQUIRER_VALID_IDENTIFICATION_TYPES
);

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const assertHttpHeaderParameter = (value: string, label: string) => {
  const normalized = value.trim();
  if (!normalized || /["\r\n]/.test(normalized)) {
    throw new Error(`${label} must be a non-empty HTTP header parameter`);
  }
  return normalized;
};

export const buildGetAcquirerSoapContentType = (
  action = GET_ACQUIRER_ACTION
): string => {
  const normalizedAction = assertHttpHeaderParameter(
    action,
    "DIAN GetAcquirer action"
  );
  return `application/soap+xml; charset=utf-8; action="${normalizedAction}"`;
};

export const assertGetAcquirerIdentificationType = (
  value: string
): GetAcquirerIdentificationType => {
  const normalized = value.trim();
  if (!IDENTIFICATION_TYPE_SET.has(normalized)) {
    throw new Error(
      `DIAN GetAcquirer identificationType must be one of ${GET_ACQUIRER_VALID_IDENTIFICATION_TYPES.join(", ")}`
    );
  }
  return normalized as GetAcquirerIdentificationType;
};

const assertGetAcquirerIdentificationNumber = (value: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("DIAN GetAcquirer identificationNumber is required");
  }
  return normalized;
};

export const buildGetAcquirerSoapRequest = (
  input: GetAcquirerSoapRequestInput
): GetAcquirerSoapRequest => {
  const ids: GetAcquirerSoapRequestIds = {
    ...DEFAULT_IDS,
    ...input.ids,
  };
  const action = input.action?.trim() || GET_ACQUIRER_ACTION;
  const contentType = buildGetAcquirerSoapContentType(action);
  const identificationType = assertGetAcquirerIdentificationType(
    input.identificationType
  );
  const identificationNumber = assertGetAcquirerIdentificationNumber(
    input.identificationNumber
  );
  const createdAt = input.createdAt.toISOString();
  const expiresAt = new Date(
    input.createdAt.getTime() + (input.timestampTtlMs ?? DEFAULT_TIMESTAMP_TTL_MS)
  ).toISOString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${GET_ACQUIRER_SOAP_NAMESPACES.soap}" xmlns:wsa="${GET_ACQUIRER_SOAP_NAMESPACES.wsa}" xmlns:wsse="${GET_ACQUIRER_SOAP_NAMESPACES.wsse}" xmlns:wsu="${GET_ACQUIRER_SOAP_NAMESPACES.wsu}" xmlns:dian="${GET_ACQUIRER_SOAP_NAMESPACES.dian}">
  <soap:Header>
    <wsa:Action wsu:Id="${escapeXml(ids.actionId)}">${escapeXml(action)}</wsa:Action>
    <wsa:To wsu:Id="${escapeXml(ids.toId)}">${escapeXml(input.endpointUrl)}</wsa:To>
    <wsa:MessageID wsu:Id="${escapeXml(ids.messageIdId)}">${escapeXml(input.messageId)}</wsa:MessageID>
    <wsse:Security wsu:Id="${escapeXml(ids.securityId)}">
      <wsu:Timestamp wsu:Id="${escapeXml(ids.timestampId)}">
        <wsu:Created>${escapeXml(createdAt)}</wsu:Created>
        <wsu:Expires>${escapeXml(expiresAt)}</wsu:Expires>
      </wsu:Timestamp>
    </wsse:Security>
  </soap:Header>
  <soap:Body wsu:Id="${escapeXml(ids.bodyId)}">
    <dian:GetAcquirer>
      <dian:identificationType>${escapeXml(identificationType)}</dian:identificationType>
      <dian:identificationNumber>${escapeXml(identificationNumber)}</dian:identificationNumber>
    </dian:GetAcquirer>
  </soap:Body>
</soap:Envelope>`;

  return {
    action,
    contentType,
    createdAt,
    expiresAt,
    ids,
    identificationNumber,
    identificationType,
    wsAddressingEnabled: GET_ACQUIRER_WS_ADDRESSING_ENABLED,
    xml,
  };
};
