export type AuthContextTerminalDto = {
  id: string;
  name: string;
  code: string;
};

export type AuthContextBranchDto = {
  id: string;
  name: string;
  terminals: AuthContextTerminalDto[];
};

export type AuthContextTenantDto = {
  id: string;
  name: string;
  branches: AuthContextBranchDto[];
};

export type AuthContextResponseDto = {
  tenants: AuthContextTenantDto[];
};
