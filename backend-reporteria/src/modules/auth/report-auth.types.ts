export type ReportUser = {
  id: string;
  tenantId: string;
  branchId: string | null;
  roles: string[];
  email?: string | null;
};
