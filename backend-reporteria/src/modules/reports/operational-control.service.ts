import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { FunctionRunnerService } from "../database/function-runner.service";
import type { ReportUser } from "../auth/report-auth.types";
import { ReportBranchScopeService } from "../auth/report-branch-scope.service";
import type { OperationalControlQuery } from "./operational-control.types";

// PostgreSQL accepts the full UUID textual form. Keep this aligned with the
// existing report guards, which also accept fixture UUIDs such as all-zero IDs.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TZ = "America/Bogota";

@Injectable()
export class OperationalControlService {
  constructor(
    @Inject(FunctionRunnerService) private readonly functions: FunctionRunnerService,
    @Inject(ReportBranchScopeService) private readonly branchScope: ReportBranchScopeService,
  ) {}

  private uuid(value: string | undefined, name: string) {
    if (value && !UUID.test(value)) throw new BadRequestException(`${name} must be a UUID`);
    return value ?? null;
  }

  private dates(period: OperationalControlQuery["period"], now = new Date()) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now).map(({ type, value }) => [type, Number(value)]),
    ) as Record<string, number>;
    const year = parts.year;
    const month = parts.month;
    const day = parts.day;
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      throw new BadRequestException("Unable to resolve report date range");
    }
    const local = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    const end = new Date(`${local}T00:00:00-05:00`);
    const days = period === "LAST_30_DAYS" ? 30 : period === "LAST_7_DAYS" ? 7 : 1;
    const from = new Date(end.getTime() - (days - 1) * 86400000);
    const to = new Date(end.getTime() + 86400000);
    if ([end, from, to].some((value) => Number.isNaN(value.getTime()))) {
      throw new BadRequestException("Unable to resolve report date range");
    }
    return { from, to, bucket: period === "TODAY" ? "hour" : "day" };
  }

  async getSnapshot(query: OperationalControlQuery, user?: ReportUser) {
    if (!user?.id || !user.tenantId) throw new ForbiddenException("Report actor is not authorized");
    const period = query.period ?? "TODAY";
    if (!["TODAY", "LAST_7_DAYS", "LAST_30_DAYS"].includes(period)) throw new BadRequestException("Unsupported period");
    const dates = this.dates(period);
    const role = ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"].find((candidate) => user.roles.some((item) => item.toUpperCase() === candidate)) ?? "USER";
    const requestedTenant = this.uuid(query.tenantId, "tenantId");
    const requestedBranch = this.uuid(query.branchId, "branchId");
    const requestedTerminal = this.uuid(query.terminalId, "terminalId");
    const requestedCashier = this.uuid(query.cashierId, "cashierId");
    const authorizedBranches = role === "ADMIN"
      ? await this.branchScope.resolve(user, requestedBranch, requestedTenant)
      : null;
    const effectiveActorBranch = role === "ADMIN"
      ? requestedBranch ?? user.branchId ?? (authorizedBranches?.branchIds.length === 1 ? authorizedBranches.branchIds[0] : null)
      : user.branchId;
    if (role === "ADMIN" && !effectiveActorBranch) {
      throw new ForbiddenException("Admin branch scope is required");
    }
    if (role === "USER" && requestedTenant && requestedTenant !== user.tenantId) throw new ForbiddenException("Tenant filter is outside actor scope");
    if (role === "USER" && requestedBranch && user.branchId && requestedBranch !== user.branchId) throw new ForbiddenException("Branch filter is outside actor scope");
    if (role === "USER" && requestedCashier && requestedCashier !== user.id) throw new ForbiddenException("Cashier filter is outside actor scope");
    if (role === "SUPER_USER" && requestedTenant && requestedTenant !== user.tenantId) throw new ForbiddenException("Tenant filter is outside actor scope");
    const result = await this.functions.executeFunction<Record<string, unknown>>("report_operational_control", [
      user.id, role, user.tenantId, effectiveActorBranch,
      requestedTenant, requestedBranch, requestedTerminal, requestedCashier,
      dates.from.toISOString(), dates.to.toISOString(), dates.bucket,
    ]);
    return { ...result, meta: { timezone: TZ, period, generatedAt: new Date().toISOString() } };
  }
}
