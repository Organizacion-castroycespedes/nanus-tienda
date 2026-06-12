import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import jwt from "jsonwebtoken";
import process from "node:process";
import type { Request } from "express";
import type { ReportUser } from "./report-auth.types";

type JwtPayload = {
  sub?: string;
  tenant_id?: string;
  branch_id?: string | null;
  email?: string;
  roles?: string[];
};

type AuthenticatedRequest = Request & {
  user?: ReportUser;
};

const isMockAuthAllowed = () =>
  (process.env.REPORTS_ALLOW_MOCK_AUTH ?? "true").toLowerCase() !== "false";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private buildMockUser(request: Request): ReportUser {
    return {
      id: String(request.headers["x-report-user-id"] ?? "report-demo-user"),
      tenantId: String(
        request.headers["x-report-tenant-id"] ?? "00000000-0000-0000-0000-000000000001"
      ),
      branchId: request.headers["x-report-branch-id"]
        ? String(request.headers["x-report-branch-id"])
        : null,
      roles: String(request.headers["x-report-role"] ?? "SUPER_ADMIN")
        .split(",")
        .map((role) => role.trim())
        .filter(Boolean),
      email: request.headers["x-report-email"]
        ? String(request.headers["x-report-email"])
        : "report-demo@manustienda.local",
    };
  }

  private decodeJwt(token: string): ReportUser {
    const secret = process.env.JWT_SECRET ?? "changeme";
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === "string") {
      throw new UnauthorizedException("Invalid JWT payload");
    }

    const payload = decoded as JwtPayload;
    if (!payload.sub || !payload.tenant_id) {
      throw new UnauthorizedException("JWT is missing required claims");
    }

    return {
      id: payload.sub,
      tenantId: payload.tenant_id,
      branchId: payload.branch_id ?? null,
      roles: Array.isArray(payload.roles) ? payload.roles : ["USER"],
      email: payload.email ?? null,
    };
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (authorization?.startsWith("Bearer ")) {
      try {
        request.user = this.decodeJwt(authorization.slice("Bearer ".length));
        return true;
      } catch (error) {
        if (!isMockAuthAllowed()) {
          throw error instanceof UnauthorizedException
            ? error
            : new UnauthorizedException("Invalid JWT");
        }

        request.user = this.buildMockUser(request);
        return true;
      }
    }

    if (!isMockAuthAllowed()) {
      throw new UnauthorizedException("JWT is required");
    }

    request.user = this.buildMockUser(request);
    return true;
  }
}
