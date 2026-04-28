export type PosState = {
  tenantId: string | null;
  branchId: string | null;
  terminalId: string | null;
  posSessionId: string | null;
  loading: boolean;
  error: string | null;
};

export type PosTerminal = {
  id: string;
  name: string;
  code: string;
};

export type PosBranch = {
  id: string;
  name: string;
  terminals: PosTerminal[];
};

export type PosTenant = {
  id: string;
  name: string;
  branches: PosBranch[];
};

export type AuthContextResponse = {
  tenants: PosTenant[];
};

export type CreatePosSessionPayload = {
  branchId: string;
  terminalId: string;
};

export type CreatePosSessionResponse = {
  posSessionId: string;
  branchId: string;
  terminalId: string;
};
