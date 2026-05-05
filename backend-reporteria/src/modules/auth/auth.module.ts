import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { ReportAuthzGuard } from "./report-authz.guard";

@Module({
  providers: [JwtAuthGuard, ReportAuthzGuard],
  exports: [JwtAuthGuard, ReportAuthzGuard],
})
export class AuthModule {}
