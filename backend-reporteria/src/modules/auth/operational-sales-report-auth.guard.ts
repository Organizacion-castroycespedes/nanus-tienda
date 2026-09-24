import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import jwt from "jsonwebtoken";
import type { Request } from "express";
import { DatabaseService } from "../database/database.service";
import type { ReportUser } from "./report-auth.types";

type Payload = { sub?: string; tenant_id?: string; session_id?: string; email?: string; roles?: string[] };
type RequestWithUser = Request & { user?: ReportUser };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class OperationalSalesReportAuthGuard implements CanActivate {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedException("JWT is required");
    let payload: Payload;
    try {
      const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET ?? "changeme");
      if (typeof decoded === "string") throw new Error("payload");
      payload = decoded as Payload;
    } catch {
      throw new UnauthorizedException("Invalid JWT");
    }
    if (!payload.sub || !payload.tenant_id || !payload.session_id || !UUID.test(payload.sub) || !UUID.test(payload.tenant_id) || !UUID.test(payload.session_id)) {
      throw new UnauthorizedException("JWT is missing required claims");
    }
    const active = await this.db.query(
      `SELECT 1 FROM auth_sessions WHERE id = $1 AND user_id = $2 AND tenant_id = $3 AND is_active = TRUE LIMIT 1`,
      [payload.session_id, payload.sub, payload.tenant_id],
    );
    if (!active.rowCount) throw new UnauthorizedException("Session is not active");
    request.user = {
      id: payload.sub,
      tenantId: payload.tenant_id,
      branchId: null,
      roles: Array.isArray(payload.roles) ? payload.roles : ["USER"],
      email: payload.email ?? null,
      sessionId: payload.session_id,
    };
    return true;
  }
}
