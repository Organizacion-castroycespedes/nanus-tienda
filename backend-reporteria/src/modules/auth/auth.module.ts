import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { ReportAuthzGuard } from "./report-authz.guard";
import { DatabaseModule } from "../database/database.module";
import { ReportBranchScopeService } from "./report-branch-scope.service";

@Module({
  imports: [DatabaseModule],
  providers: [JwtAuthGuard, ReportAuthzGuard, ReportBranchScopeService],
  exports: [JwtAuthGuard, ReportAuthzGuard, ReportBranchScopeService],
})
export class AuthModule {}
