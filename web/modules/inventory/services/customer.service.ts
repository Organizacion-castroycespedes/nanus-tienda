import { apiClient } from "../../../lib/http";

export type CustomerFiscalStatus = "PENDING" | "VALIDATED" | "FAILED" | "NOT_REQUIRED";

export type CustomerFiscalDataSource =
  | "MANUAL"
  | "MOCK_LOCAL"
  | "DIAN_DIRECT"
  | "TECH_PROVIDER"
  | "RUT"
  | "UNKNOWN";

export type CustomerPersonType = "NATURAL" | "JURIDICA" | "UNKNOWN";

export type CustomerResponse = {
  id: string;
  tenantId: string;
  name: string;
  documentNumber: string | null;
  documentTypeCode?: string | null;
  documentNumberNormalized?: string | null;
  dianIdentificationType?: string | null;
  identificationNumber?: string | null;
  verificationDigit?: string | null;
  legalName?: string | null;
  tradeName?: string | null;
  fiscalEmail?: string | null;
  invoiceEmail?: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  countryCode?: string | null;
  departmentCode?: string | null;
  municipalityCode?: string | null;
  personType?: CustomerPersonType | null;
  taxRegime?: string | null;
  taxResponsibilities?: string[];
  isFinalConsumer?: boolean;
  isDianValidated?: boolean;
  dianLastLookupAt?: string | null;
  dianLastLookupStatus?: "PENDING" | "FOUND" | "NOT_FOUND" | "ERROR" | "SKIPPED" | null;
  dianMetadata?: Record<string, unknown>;
  fiscalDataSource?: CustomerFiscalDataSource;
  fiscalStatus?: CustomerFiscalStatus;
  departamentoId: string | null;
  municipioId: string | null;
  ciudad: string | null;
  departamento: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateCustomerPayload = {
  name: string;
  documentNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  departamentoId?: string | null;
  municipioId?: string | null;
  ciudad?: string | null;
  departamento?: string | null;
  isActive?: boolean;
};

export type UpdateCustomerPayload = Partial<CreateCustomerPayload>;

export type GetCustomersParams = {
  query?: string;
  limit?: number;
};

export const buildCustomersQuery = (params: GetCustomersParams = {}) => {
  const query = new URLSearchParams();
  if (params.query?.trim()) {
    query.set("query", params.query.trim());
  }
  if (params.limit) {
    query.set("limit", String(params.limit));
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return `/customers${suffix}`;
};

export const getCustomers = (
  params: GetCustomersParams = {},
  headers?: HeadersInit
) => apiClient<CustomerResponse[]>(buildCustomersQuery(params), { headers });

export const getCustomerById = (customerId: string, headers?: HeadersInit) =>
  apiClient<CustomerResponse>(`/customers/${customerId}`, { headers });

export const createCustomer = (
  payload: CreateCustomerPayload,
  headers?: HeadersInit
) =>
  apiClient<CustomerResponse>("/customers", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const updateCustomer = (
  customerId: string,
  payload: UpdateCustomerPayload,
  headers?: HeadersInit
) =>
  apiClient<CustomerResponse>(`/customers/${customerId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });

export const deleteCustomer = (customerId: string, headers?: HeadersInit) =>
  apiClient<CustomerResponse>(`/customers/${customerId}`, {
    method: "DELETE",
    headers,
  });
