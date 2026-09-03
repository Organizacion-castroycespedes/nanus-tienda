import type { AuthContextResponse, CurrentPosSessionResponse, PosTenant } from "../types";

export type ResolvedPosSessionContext = {
  tenantId: string;
  branchId: string;
  branchName: string | null;
  terminalId: string;
  terminalName: string | null;
  posSessionId: string;
};

const findTenant = (tenants: PosTenant[], tenantId: string) =>
  tenants.find((tenant) => tenant.id === tenantId) ?? null;

const findBranch = (tenant: PosTenant | null, branchId: string) =>
  tenant?.branches.find((branch) => branch.id === branchId) ?? null;

const findTerminal = (tenant: PosTenant | null, branchId: string, terminalId: string) =>
  findBranch(tenant, branchId)?.terminals.find((terminal) => terminal.id === terminalId) ??
  null;

export const resolvePosSessionContext = (
  authContext: AuthContextResponse | null,
  currentSession: CurrentPosSessionResponse | null,
  tenantId: string | null
): ResolvedPosSessionContext | null => {
  if (!currentSession || !tenantId) {
    return null;
  }

  const tenant = authContext ? findTenant(authContext.tenants, tenantId) : null;
  const branch = findBranch(tenant, currentSession.branchId);
  const terminal = findTerminal(tenant, currentSession.branchId, currentSession.terminalId);

  return {
    tenantId,
    branchId: currentSession.branchId,
    branchName: branch?.name ?? null,
    terminalId: currentSession.terminalId,
    terminalName: terminal?.name ?? null,
    posSessionId: currentSession.posSessionId,
  };
};
