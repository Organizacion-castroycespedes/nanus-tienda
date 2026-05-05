import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import type { ReportUser } from "./report-auth.types";

type AuthenticatedRequest = Request & {
  user?: ReportUser;
};

@Injectable()
export class ReportAuthzGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user?.id || !user.tenantId || user.roles.length === 0) {
      throw new ForbiddenException("Report actor is not authorized");
    }

    return true;
  }
}
