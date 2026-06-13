import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  Inject,
} from "@nestjs/common";
import jwt from "jsonwebtoken";
import { DatabaseService } from "../db/database.service";
import { resolveJwtSecret } from "../config/auth-env";

type TokenPayload = {
  sub?: string;
  tenant_id?: string;
  roles?: string[];
  session_id?: string;
};

type PosSessionContextRow = {
  id: string;
  tenant_id: string;
  branch_id: string;
  terminal_id: string;
  user_id: string;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers["authorization"];
    const token =
      typeof authorization === "string" && authorization.startsWith("Bearer ")
        ? authorization.slice("Bearer ".length).trim()
        : null;
    if (!token) {
      throw new UnauthorizedException("Token requerido");
    }

    let payload: TokenPayload;
    try {
      const decoded = jwt.verify(token, resolveJwtSecret());
      if (typeof decoded === "string") {
        throw new UnauthorizedException("Token inválido");
      }
      payload = decoded as TokenPayload;
    } catch {
      throw new UnauthorizedException("Token inválido");
    }

    if (!payload?.sub || !payload?.tenant_id || !payload?.session_id) {
      throw new UnauthorizedException("Token inválido");
    }

    const session = await this.db.query(
      `
      SELECT id
      FROM auth_sessions
      WHERE id = $1 AND user_id = $2 AND tenant_id = $3 AND is_active = TRUE
      `,
      [payload.session_id, payload.sub, payload.tenant_id]
    );
    if (!session.rows?.[0]) {
      throw new UnauthorizedException("Sesión inválida");
    }

    request.user = {
      ...request.user,
      id: payload.sub,
      roles: Array.isArray(payload.roles) ? payload.roles : [],
      tenantId: payload.tenant_id,
      sessionId: payload.session_id,
    };

    const posSessionIdHeader = request.headers["x-pos-session-id"];
    const posSessionId = Array.isArray(posSessionIdHeader)
      ? posSessionIdHeader[0]?.trim()
      : typeof posSessionIdHeader === "string"
        ? posSessionIdHeader.trim()
        : "";

    if (posSessionId) {
      const posSession = await this.db.query<PosSessionContextRow>(
        `
        SELECT
          session.id,
          session.tenant_id,
          session.branch_id,
          session.terminal_id,
          session.user_id
        FROM pos_user_sessions AS session
        INNER JOIN terminals AS terminal
          ON terminal.id = session.terminal_id
         AND terminal.tenant_id = session.tenant_id
         AND terminal.branch_id = session.branch_id
         AND terminal.is_active = TRUE
        INNER JOIN tenant_branches AS branch
          ON branch.id = session.branch_id
         AND branch.tenant_id = session.tenant_id
         AND branch.estado = 'ACTIVE'
        WHERE session.id = $1
          AND session.user_id = $2
          AND session.tenant_id = $3
          AND session.is_active = TRUE
        LIMIT 1
        `,
        [posSessionId, payload.sub, payload.tenant_id]
      );

      const contextRow = posSession.rows?.[0];
      if (!contextRow) {
        throw new ForbiddenException("Sesion POS invalida");
      }

      request.context = {
        tenantId: contextRow.tenant_id,
        branchId: contextRow.branch_id,
        terminalId: contextRow.terminal_id,
        posSessionId: contextRow.id,
        userId: contextRow.user_id,
      };
    }

    return true;
  }
}
