import type { FiscalLookupInput } from "../../fiscal-lookup/fiscal-lookup.types";
import { DIAN_GET_ACQUIRER_ACTION } from "./dian.constants";
import { buildWsSecurityHeader } from "./dian-ws-security.builder";
import { buildWsaHeaders } from "./dian-wsa.builder";

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export const buildGetAcquirerRequest = (input: FiscalLookupInput): string => {
  const action =
    process.env.DIAN_GET_ACQUIRER_ACTION?.trim() || DIAN_GET_ACQUIRER_ACTION;
  const to =
    process.env.DIAN_ENDPOINT_URL?.trim() || process.env.DIAN_WSDL_URL?.trim();

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:wsa="http://www.w3.org/2005/08/addressing" xmlns:dian="http://wcf.dian.colombia">
  <soap:Header>
    ${buildWsaHeaders({ action, to })}
    ${buildWsSecurityHeader()}
  </soap:Header>
  <soap:Body>
    <dian:GetAcquirer>
      <dian:identificationType>${escapeXml(input.documentTypeCode)}</dian:identificationType>
      <dian:identificationNumber>${escapeXml(input.documentNumberNormalized)}</dian:identificationNumber>
    </dian:GetAcquirer>
  </soap:Body>
</soap:Envelope>`;
};
