import { apiClient } from "../../../lib/http";

export type ElectronicBillingFailure = {
  code: string | null;
  message: string;
  origin: "FACTUCORE" | "DIAN" | "MANUS";
  path: string | null;
  severity: string | null;
  title: string | null;
  solution: string | null;
  retryable: boolean;
};

export type ElectronicBillingOnlineStatus =
  | "ACCEPTED"
  | "REJECTED"
  | "QUEUED_NETWORK"
  | "PROCESSING";

export type ElectronicBillingOnlineResult = {
  status: ElectronicBillingOnlineStatus;
  electronicDocumentId: string | null;
  documentType: string | null;
  fullNumber: string | null;
  cufe: string | null;
  cude: string | null;
  failureClass: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  failures: ElectronicBillingFailure[];
  message: string;
};

export type ElectronicBillingRequestResult = {
  saleId: string;
  result: string;
  eligibility: string;
  requestCreated: boolean;
  electronicDocumentId: string | null;
  reason?: string;
  electronicBilling?: ElectronicBillingOnlineResult | null;
};

export const describeElectronicBillingFailure = (
  result: Pick<ElectronicBillingOnlineResult, "errorCode" | "errorMessage" | "failures" | "message">,
) => {
  const failure = result.failures.find((item) => item.solution) ?? result.failures[0] ?? null;
  const code = result.errorCode ?? failure?.code ?? null;
  const detail = failure?.title ?? result.errorMessage ?? failure?.message ?? result.message;
  const solution = failure?.solution ?? null;
  return {
    code,
    detail,
    solution,
    text: [
      code ? `[${code}]` : null,
      detail,
      solution ? `Solución: ${solution}` : null,
    ].filter(Boolean).join(" "),
  };
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
