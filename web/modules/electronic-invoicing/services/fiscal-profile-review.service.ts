import { apiClient } from "../../../lib/http";

export type FiscalReviewRow = {
  entityType: "customer" | "supplier";
  id: string;
  name: string;
  documentType: string | null;
  maskedDocument: string | null;
  personType: string | null;
  taxRegime: string | null;
  taxResponsibilities: string[];
  fiscalStatus: string;
  fiscalDataSource: string | null;
  isDianValidated: boolean;
  location: {
    countryCode: string | null;
    countryName: string | null;
    departmentCode: string | null;
    departmentName: string | null;
    municipalityCode: string | null;
    municipalityName: string | null;
  };
  missingFields: string[];
  reviewReason: string | null;
  classification: "FINAL_CONSUMER_EXCEPTION" | "REQUIRES_HUMAN_FISCAL_REVIEW" | "FISCAL_PROFILE_COMPLETE";
};

export type FiscalReviewQuery = {
  completeness?: "complete" | "incomplete" | "all";
  fiscalStatus?: string;
  missingField?: string;
};

const queryString = (query: FiscalReviewQuery) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => value && params.set(key, value));
  const value = params.toString();
  return value ? `?${value}` : "";
};

export const listFiscalReviewCustomers = (query: FiscalReviewQuery = {}) =>
  apiClient<FiscalReviewRow[]>(`/electronic-invoicing/fiscal-review/customers${queryString(query)}`);

export const listFiscalReviewSuppliers = (query: FiscalReviewQuery = {}) =>
  apiClient<FiscalReviewRow[]>(`/electronic-invoicing/fiscal-review/suppliers${queryString(query)}`);
