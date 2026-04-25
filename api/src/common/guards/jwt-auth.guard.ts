import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
} from "@nestjs/common";
import jwt from "jsonwebtoken";
import { DatabaseService } from "../db/database.service";

const JWT_SECRET = process.env.JWT_SECRET ?? "changeme";

type TokenPayload = {
  sub?: string;
  tenant_id?: string;
  roles?: string[];
  session_id?: string;
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
      const decoded = jwt.verify(token, JWT_SECRET);
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
    return true;
  }
}
