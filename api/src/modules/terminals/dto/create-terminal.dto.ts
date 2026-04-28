export type CreateTerminalDto = {
  branchId: string;
  name: string;
  code: string;
  deviceFingerprint?: string;
  isActive?: boolean;
};
