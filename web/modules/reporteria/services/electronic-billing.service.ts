import { apiClient } from "../../../lib/http";

export type ElectronicBillingRequestResult = {
  saleId: string;
  result: string;
  eligibility: string;
  requestCreated: boolean;
  electronicDocumentId: string | null;
  reason?: string;
};

export const requestElectronicBilling = (saleId: string) =>
  apiClient<ElectronicBillingRequestResult>(`/sales/${encodeURIComponent(saleId)}/electronic-billing`, {
    method: "POST",
    includePosSession: true,
    body: JSON.stringify({}),
  });

export const requestElectronicBillingBatch = (saleIds: string[]) =>
  apiClient<{ selected: number; results: ElectronicBillingRequestResult[] }>(
    "/sales/electronic-billing/batch",
    {
      method: "POST",
      includePosSession: true,
      body: JSON.stringify({ saleIds }),
    },
  );
