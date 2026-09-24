import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { ReportAuthzGuard } from "./report-authz.guard";
import { DatabaseModule } from "../database/database.module";
import { ReportBranchScopeService } from "./report-branch-scope.service";
import { OperationalSalesReportAuthGuard } from "./operational-sales-report-auth.guard";

@Module({
  imports: [DatabaseModule],
  providers: [JwtAuthGuard, ReportAuthzGuard, ReportBranchScopeService, OperationalSalesReportAuthGuard],
  exports: [JwtAuthGuard, ReportAuthzGuard, ReportBranchScopeService, OperationalSalesReportAuthGuard],
})
export class AuthModule {}
