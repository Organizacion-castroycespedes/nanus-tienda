import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import type { ReportUser } from "./report-auth.types";
import { getReportRoles } from "./report-roles.decorator";

type AuthenticatedRequest = Request & {
  user?: ReportUser;
};

const DEFAULT_REPORT_ROLES = ["SUPER_ADMIN", "SUPER_USER", "ADMIN"];

@Injectable()
export class ReportAuthzGuard implements CanActivate {
  private getAllowedRoles(context: ExecutionContext) {
    return (
      getReportRoles(context.getHandler()) ??
      getReportRoles(context.getClass()) ??
      DEFAULT_REPORT_ROLES
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user?.id || !user.tenantId || user.roles.length === 0) {
      throw new ForbiddenException("Report actor is not authorized");
    }

    const allowedRoles = new Set(this.getAllowedRoles(context));
    if (!user.roles.some((role) => allowedRoles.has(role.toUpperCase()))) {
      throw new ForbiddenException("Report role is not authorized");
    }

    return true;
  }
}
