export type FiscalProviderName = "MOCK_LOCAL" | "DIAN_DIRECT" | "TECH_PROVIDER";

export type FiscalProviderConfig = {
  provider: FiscalProviderName;
  apiBaseUrl: string;
  hasApiInternalToken: boolean;
  hasDianWsdlUrl: boolean;
  hasDianCertificatePath: boolean;
};

const normalizeProvider = (value: string | undefined): FiscalProviderName => {
  if (value === "DIAN_DIRECT" || value === "TECH_PROVIDER") {
    return value;
  }
  return "MOCK_LOCAL";
};

export const getProviderConfig = (): FiscalProviderConfig => ({
  provider: normalizeProvider(process.env.FISCAL_PROVIDER),
  apiBaseUrl: process.env.API_BASE_URL?.trim() || "http://localhost:3000",
  hasApiInternalToken: Boolean(process.env.API_INTERNAL_TOKEN?.trim()),
  hasDianWsdlUrl: Boolean(process.env.DIAN_WSDL_URL?.trim()),
  hasDianCertificatePath: Boolean(process.env.DIAN_CERT_PATH?.trim()),
});
