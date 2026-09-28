import { apiClient } from "../../../lib/http";

export type TerminalPosSession = {
  id: string;
  userEmail: string | null;
  userDisplayName: string | null;
  tenantId: string;
  branchId: string;
  terminalId: string;
  terminalCode: string;
  terminalName: string;
  branchName: string | null;
  startedAt: string;
  isActive: boolean;
  hasOpenCash: boolean;
  hasPendingOperations: boolean;
  pendingSales: number;
  pendingPayments: number;
  canClose: boolean;
};

export const listActiveTerminalPosSessions = (branchId: string, terminalId: string) => {
  const query = new URLSearchParams({ branchId, terminalId });
  return apiClient<{ items: TerminalPosSession[]; limit: number; offset: number }>(
    `/pos/session/active?${query.toString()}`,
  );
};

export const closeTerminalPosSession = (
  sessionId: string,
  payload: { branchId: string; terminalId: string; reason: string },
) =>
  apiClient<{ id: string; isActive: boolean; endedAt: string | null }>(
    `/pos/session/${encodeURIComponent(sessionId)}/close`,
    { method: "POST", body: JSON.stringify(payload) },
  );
