export type CreateTerminalDto = {
  tenantId?: string;
  branchId: string;
  name: string;
  code: string;
  deviceFingerprint?: string;
  isActive?: boolean;
};
