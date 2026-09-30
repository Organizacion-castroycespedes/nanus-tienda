import type { ReportUser } from "../auth/report-auth.types";

export type OperationalControlPeriod = "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS";
export type OperationalControlQuery = {
  period?: OperationalControlPeriod;
  tenantId?: string;
  branchId?: string;
  terminalId?: string;
  cashierId?: string;
};
export type OperationalControlActor = ReportUser;
