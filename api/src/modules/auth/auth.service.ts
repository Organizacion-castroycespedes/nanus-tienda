import * as bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { DatabaseService } from "../../common/db/database.service";
import type { LoginDto } from "./dto/login.dto";
import type { ForgotPasswordDto } from "./dto/forgot-password.dto";
import type { ResetPasswordDto } from "./dto/reset-password.dto";
import type { RefreshTokenDto } from "./dto/refresh-token.dto";

const JWT_EXPIRES_IN_RAW = process.env.JWT_EXPIRES_IN ?? "15m";
const JWT_EXPIRES_IN: SignOptions["expiresIn"] = /^\d+$/.test(JWT_EXPIRES_IN_RAW)
  ? Number(JWT_EXPIRES_IN_RAW)
  : (JWT_EXPIRES_IN_RAW as SignOptions["expiresIn"]);
const JWT_SECRET = process.env.JWT_SECRET ?? "changeme";
const REFRESH_TOKEN_EXPIRES_DAYS = Number(
  process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? "30"
);

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

type TokenPayload = {
  sub?: string;
  tenant_id?: string;
  roles?: string[];
  session_id?: string;
};

type RefreshTokenMetadata = {
  userAgent?: string;
  ipAddress?: string;
};

type RefreshTokenRecord = {
  id: string;
  user_id: string;
  tenant_id: string;
  expires_at: string;
  revoked_at: string | null;
  user_estado: string;
  tenant_activo: boolean;
};

type AuthSessionRecord = {
  id: string;
  is_active: boolean;
  refresh_token: string;
};

export type AuthProfileResponse = {
  id: string;
  email: string;
  tenant: {
    id: string;
    nombre: string;
    slug: string;
  };
  role: {
    id: string | null;
    nombre: string | null;
  } | null;
  branch: {
    id: string | null;
    nombre: string | null;
  } | null;
  persona: {
    nombres: string | null;
    apellidos: string | null;
    documentoTipo: string | null;
    documentoNumero: string | null;
    telefono: string | null;
    direccion: string | null;
    emailPersonal: string | null;
    cargoNombre: string | null;
    cargoDescripcion: string | null;
    funcionesDescripcion: string | null;
  } | null;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}
  async login(payload: LoginDto, metadata?: RefreshTokenMetadata): Promise<AuthTokens> {
    try {
      const normalizedEmail = payload.email.trim().toLowerCase();
      const user = await this.fetchUserForLogin(normalizedEmail);
      if (!user) {
        throw new UnauthorizedException("Usuario inválido");
      }
      if (user.estado !== "ACTIVE") {
        throw new UnauthorizedException("Usuario inactivo");
      }
      if (!user.tenant_activo) {
        throw new UnauthorizedException("Tenant inactivo");
      }
      const passwordOk = await bcrypt.compare(payload.password, user.password_hash);
      if (!passwordOk) {
        throw new UnauthorizedException("Credenciales inválidas");
      }

      const client = await this.db.getClient();
      try {
        await client.query("BEGIN");
        const activeSession = await this.findActiveSession(
          client,
          user.id,
          user.tenant_id
        );
        if (activeSession) {
          throw new HttpException(
            { code: "SESSION_ACTIVE", message: "Ya existe una sesión activa." },
            HttpStatus.CONFLICT
          );
        }

        const refreshToken = this.generateRefreshToken();
        const sessionId = await this.createSession(
          client,
          user.id,
          user.tenant_id,
          refreshToken,
          metadata
        );
        const accessToken = this.generateNewAccessToken(user.id, user.tenant_id, [
          user.role,
        ], sessionId);

        await client.query("COMMIT");
        return { accessToken, refreshToken };
      } catch (error: any) {
        await client.query("ROLLBACK");
        if (
          error?.code === "23505" &&
          String(error?.constraint ?? "").includes("auth_sessions_user_active")
        ) {
          throw new HttpException(
            { code: "SESSION_ACTIVE", message: "Ya existe una sesión activa." },
            HttpStatus.CONFLICT
          );
        }
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Error during login:", error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException("Error al iniciar sesión");
    }
  }

  async forceLogin(
    payload: LoginDto,
    metadata?: RefreshTokenMetadata
  ): Promise<AuthTokens> {
    const normalizedEmail = payload.email.trim().toLowerCase();
    const user = await this.fetchUserForLogin(normalizedEmail);
    if (!user) {
      throw new UnauthorizedException("Usuario inválido");
    }
    if (user.estado !== "ACTIVE") {
      throw new UnauthorizedException("Usuario inactivo");
    }
    if (!user.tenant_activo) {
      throw new UnauthorizedException("Tenant inactivo");
    }
    const passwordOk = await bcrypt.compare(payload.password, user.password_hash);
    if (!passwordOk) {
      throw new UnauthorizedException("Credenciales inválidas");
    }

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      await this.invalidateActiveSessions(client, user.id, user.tenant_id);
      const refreshToken = this.generateRefreshToken();
      const sessionId = await this.createSession(
        client,
        user.id,
        user.tenant_id,
        refreshToken,
        metadata
      );
      const accessToken = this.generateNewAccessToken(user.id, user.tenant_id, [
        user.role,
      ], sessionId);
      await client.query("COMMIT");
      return { accessToken, refreshToken };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async refreshToken(payload: RefreshTokenDto, metadata?: RefreshTokenMetadata) {
    if (!payload?.refreshToken) {
      throw new UnauthorizedException("Refresh token requerido");
    }

    const refreshTokenHash = this.hashRefreshToken(payload.refreshToken);
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const record = await this.validateRefreshToken(client, payload.refreshToken);
      const session = await this.validateSessionForRefresh(
        client,
        record,
        refreshTokenHash
      );
      const roles = await this.fetchUserRoles(client, record.user_id, record.tenant_id);
      const { refreshToken: nextRefreshToken, refreshTokenHash: nextHash } =
        await this.rotateRefreshToken(client, record, metadata);

      await this.updateSessionAfterRefresh(client, session.id, nextHash, metadata);

      const accessToken = this.generateNewAccessToken(
        record.user_id,
        record.tenant_id,
        roles,
        session.id
      );

      await client.query("COMMIT");
      return { accessToken, refreshToken: nextRefreshToken };
    } catch (error) {
      await client.query("ROLLBACK");
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async getProfileForAccessToken(accessToken: string): Promise<AuthProfileResponse> {
    const payload = this.decodeAccessToken(accessToken);
    if (!payload?.sub || !payload?.tenant_id || !payload?.session_id) {
      throw new UnauthorizedException("Token inválido");
    }
    await this.ensureActiveSession(payload.session_id, payload.sub, payload.tenant_id);

    const result = await this.db.query(
      `
      SELECT
        users.id,
        users.email,
        tenants.id AS tenant_id,
        tenants.nombre AS tenant_nombre,
        tenants.slug AS tenant_slug,
        personas.nombres,
        personas.apellidos,
        personas.documento_tipo,
        personas.documento_numero,
        personas.telefono,
        personas.direccion,
        personas.email_personal,
        personas.cargo_nombre,
        personas.cargo_descripcion,
        personas.funciones_descripcion,
        roles.id AS role_id,
        roles.nombre AS role_nombre,
        tb.id AS branch_id,
        tb.nombre AS branch_nombre
      FROM users
      INNER JOIN tenants ON tenants.id = users.tenant_id
      LEFT JOIN personas ON personas.id = users.persona_id
      LEFT JOIN user_roles ur
        ON ur.user_id = users.id
        AND ur.tenant_id = users.tenant_id
      LEFT JOIN roles ON roles.id = ur.role_id
      LEFT JOIN persona_tenant_branches ptb
        ON ptb.persona_id = personas.id
        AND ptb.es_principal = TRUE
      LEFT JOIN tenant_branches tb ON tb.id = ptb.tenant_branch_id
      WHERE users.id = $1 AND users.tenant_id = $2
      `,
      [payload.sub, payload.tenant_id]
    );

    const record = result.rows?.[0];
    if (!record) {
      throw new UnauthorizedException("Usuario no encontrado");
    }

    return {
      id: record.id,
      email: record.email,
      tenant: {
        id: record.tenant_id,
        nombre: record.tenant_nombre,
        slug: record.tenant_slug,
      },
      role: record.role_id
        ? {
            id: record.role_id,
            nombre: record.role_nombre,
          }
        : null,
      branch: record.branch_id
        ? {
            id: record.branch_id,
            nombre: record.branch_nombre,
          }
        : null,
      persona: record.nombres || record.apellidos
        ? {
            nombres: record.nombres,
            apellidos: record.apellidos,
            documentoTipo: record.documento_tipo,
            documentoNumero: record.documento_numero,
            telefono: record.telefono,
            direccion: record.direccion,
            emailPersonal: record.email_personal,
            cargoNombre: record.cargo_nombre,
            cargoDescripcion: record.cargo_descripcion,
            funcionesDescripcion: record.funciones_descripcion,
          }
        : null,
    };
  }

  private decodeAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (typeof decoded === "string") {
        return {};
      }
      return decoded as TokenPayload;
    } catch {
      throw new UnauthorizedException("Token inválido");
    }
  }

  async forgotPassword(payload: ForgotPasswordDto): Promise<void> {
    const normalizedEmail = payload.email.trim().toLowerCase();
    const users = await this.db.query(
      `
      SELECT users.id, users.tenant_id
      FROM users
      INNER JOIN tenants ON tenants.id = users.tenant_id
      WHERE users.email = $1 AND tenants.slug = $2
      `,
      [normalizedEmail, payload.tenantSlug]
    );

    const user = users[0];
    if (!user) {
      return;
    }

    const token = crypto.randomBytes(48).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await this.db.query(
      `
      INSERT INTO password_resets (user_id, tenant_id, token_hash, expires_at)
      VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')
      `,
      [user.id, user.tenant_id, tokenHash]
    );

    // TODO: enviar email con link que contiene token.
    console.info("Password reset token", token);
  }

  async resetPassword(payload: ResetPasswordDto): Promise<void> {
    const tokenHash = crypto.createHash("sha256").update(payload.token).digest("hex");
    const resets = await this.db.query(
      `
      SELECT id, user_id
      FROM password_resets
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
      `,
      [tokenHash]
    );

    const reset = resets[0];
    if (!reset) {
      throw new Error("Token inválido o expirado");
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);
    await this.db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      passwordHash,
      reset.user_id,
    ]);
    await this.db.query("UPDATE password_resets SET used_at = NOW() WHERE id = $1", [
      reset.id,
    ]);
  }

  async logout(refreshToken?: string): Promise<{ ok: true }> {
    if (refreshToken) {
      const tokenHash = this.hashRefreshToken(refreshToken);
      const client = await this.db.getClient();
      try {
        await client.query("BEGIN");
        await client.query(
          `
          UPDATE auth_refresh_tokens
          SET revoked_at = NOW()
          WHERE token_hash = $1 AND revoked_at IS NULL
          `,
          [tokenHash]
        );
        await client.query(
          `
          UPDATE auth_sessions
          SET is_active = FALSE, last_activity = NOW()
          WHERE refresh_token = $1 AND is_active = TRUE
          `,
          [tokenHash]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
    return { ok: true };
  }

  private async ensureActiveSession(
    sessionId: string,
    userId: string,
    tenantId: string
  ) {
    const session = await this.db.query(
      `
      SELECT id
      FROM auth_sessions
      WHERE id = $1 AND user_id = $2 AND tenant_id = $3 AND is_active = TRUE
      `,
      [sessionId, userId, tenantId]
    );
    if (!session.rows?.[0]) {
      throw new UnauthorizedException("Sesión inválida");
    }
  }

  private async validateRefreshToken(
    client: { query: (text: string, params?: any[]) => Promise<any> },
    refreshToken: string
  ): Promise<RefreshTokenRecord> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const result = await client.query<RefreshTokenRecord>(
      `
      SELECT
        art.id,
        art.user_id,
        art.tenant_id,
        art.expires_at,
        art.revoked_at,
        users.estado AS user_estado,
        tenants.activo AS tenant_activo
      FROM auth_refresh_tokens art
      INNER JOIN users
        ON users.id = art.user_id
        AND users.tenant_id = art.tenant_id
      INNER JOIN tenants ON tenants.id = art.tenant_id
      WHERE art.token_hash = $1
      FOR UPDATE
      `,
      [tokenHash]
    );

    const record = result.rows?.[0];
    if (!record) {
      throw new UnauthorizedException("Refresh token inválido");
    }
    if (record.revoked_at) {
      throw new UnauthorizedException("Refresh token revocado");
    }
    if (new Date(record.expires_at).getTime() <= Date.now()) {
      throw new UnauthorizedException("Refresh token expirado");
    }
    if (record.user_estado !== "ACTIVE") {
      throw new UnauthorizedException("Usuario inactivo");
    }
    if (!record.tenant_activo) {
      throw new UnauthorizedException("Tenant inactivo");
    }
    return record;
  }

  private generateNewAccessToken(
    userId: string,
    tenantId: string,
    roles: string[],
    sessionId?: string
  ) {
    return jwt.sign(
      {
        sub: userId,
        tenant_id: tenantId,
        roles: roles.filter(Boolean),
        session_id: sessionId,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  private generateRefreshToken() {
    return crypto.randomBytes(48).toString("hex");
  }

  private async fetchUserRoles(
    client: { query: (text: string, params?: any[]) => Promise<any> },
    userId: string,
    tenantId: string
  ): Promise<string[]> {
    const roles = await client.query<{ nombre: string }>(
      `
      SELECT roles.nombre
      FROM roles
      INNER JOIN user_roles
        ON user_roles.role_id = roles.id
      WHERE user_roles.user_id = $1 AND user_roles.tenant_id = $2
      `,
      [userId, tenantId]
    );
    return (roles.rows ?? [])
      .map((row) => row.nombre)
      .filter((role) => Boolean(role));
  }

  private async persistRefreshToken(
    userId: string,
    tenantId: string,
    refreshToken: string,
    metadata?: RefreshTokenMetadata
  ) {
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      await this.insertRefreshToken(client, userId, tenantId, refreshToken, metadata);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertRefreshToken(
    client: { query: (text: string, params?: any[]) => Promise<any> },
    userId: string,
    tenantId: string,
    refreshToken: string,
    metadata?: RefreshTokenMetadata
  ): Promise<string> {
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const expiresAt = this.resolveRefreshTokenExpiry();
    await client.query(
      `
      INSERT INTO auth_refresh_tokens
        (user_id, tenant_id, token_hash, user_agent, ip_address, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        userId,
        tenantId,
        refreshTokenHash,
        metadata?.userAgent ?? null,
        metadata?.ipAddress ?? null,
        expiresAt,
      ]
    );
    return refreshTokenHash;
  }

  private async rotateRefreshToken(
    client: { query: (text: string, params?: any[]) => Promise<any> },
    record: Pick<RefreshTokenRecord, "id" | "user_id" | "tenant_id">,
    metadata?: RefreshTokenMetadata
  ) {
    await client.query(
      `UPDATE auth_refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
      [record.id]
    );
    const nextRefreshToken = this.generateRefreshToken();
    const nextRefreshTokenHash = await this.insertRefreshToken(
      client,
      record.user_id,
      record.tenant_id,
      nextRefreshToken,
      metadata
    );
    return { refreshToken: nextRefreshToken, refreshTokenHash: nextRefreshTokenHash };
  }

  private hashRefreshToken(refreshToken: string) {
    return crypto.createHash("sha256").update(refreshToken).digest("hex");
  }

  private resolveRefreshTokenExpiry() {
    const days = Number.isFinite(REFRESH_TOKEN_EXPIRES_DAYS) && REFRESH_TOKEN_EXPIRES_DAYS > 0
      ? REFRESH_TOKEN_EXPIRES_DAYS
      : 30;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private async fetchUserForLogin(normalizedEmail: string) {
    const query = `
      SELECT
        users.id,
        users.tenant_id,
        users.password_hash,
        users.estado,
        tenants.activo AS tenant_activo,
        roles.nombre AS role
      FROM users
      INNER JOIN tenants ON tenants.id = users.tenant_id
      INNER JOIN user_roles ON user_roles.user_id = users.id
      INNER JOIN roles ON roles.id = user_roles.role_id
      WHERE users.email = $1
    `;

    const users = await this.db.query(query, [normalizedEmail]);
    return users.rows?.[0];
  }

  private async findActiveSession(
    client: { query: (text: string, params?: any[]) => Promise<any> },
    userId: string,
    tenantId: string
  ): Promise<AuthSessionRecord | null> {
    const result = await client.query<AuthSessionRecord>(
      `
      SELECT id, is_active, refresh_token
      FROM auth_sessions
      WHERE user_id = $1 AND tenant_id = $2 AND is_active = TRUE
      LIMIT 1
      `,
      [userId, tenantId]
    );
    return result.rows?.[0] ?? null;
  }

  private async createSession(
    client: { query: (text: string, params?: any[]) => Promise<any> },
    userId: string,
    tenantId: string,
    refreshToken: string,
    metadata?: RefreshTokenMetadata
  ): Promise<string> {
    const refreshTokenHash = await this.insertRefreshToken(
      client,
      userId,
      tenantId,
      refreshToken,
      metadata
    );
    const result = await client.query<{ id: string }>(
      `
      INSERT INTO auth_sessions
        (user_id, tenant_id, refresh_token, user_agent, ip_address, is_active, last_activity)
      VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
      RETURNING id
      `,
      [
        userId,
        tenantId,
        refreshTokenHash,
        metadata?.userAgent ?? null,
        metadata?.ipAddress ?? null,
      ]
    );
    return result.rows?.[0]?.id;
  }

  private async invalidateActiveSessions(
    client: { query: (text: string, params?: any[]) => Promise<any> },
    userId: string,
    tenantId: string
  ) {
    const sessions = await client.query<{ refresh_token: string }>(
      `
      UPDATE auth_sessions
      SET is_active = FALSE, last_activity = NOW()
      WHERE user_id = $1 AND tenant_id = $2 AND is_active = TRUE
      RETURNING refresh_token
      `,
      [userId, tenantId]
    );
    const tokenHashes = (sessions.rows ?? [])
      .map((row) => row.refresh_token)
      .filter(Boolean);
    if (tokenHashes.length === 0) {
      return;
    }
    await client.query(
      `
      UPDATE auth_refresh_tokens
      SET revoked_at = NOW()
      WHERE token_hash = ANY($1::text[]) AND revoked_at IS NULL
      `,
      [tokenHashes]
    );
  }

  private async validateSessionForRefresh(
    client: { query: (text: string, params?: any[]) => Promise<any> },
    record: RefreshTokenRecord,
    refreshTokenHash: string
  ): Promise<AuthSessionRecord> {
    const session = await client.query<AuthSessionRecord>(
      `
      SELECT id, is_active, refresh_token
      FROM auth_sessions
      WHERE user_id = $1 AND tenant_id = $2 AND refresh_token = $3
      FOR UPDATE
      `,
      [record.user_id, record.tenant_id, refreshTokenHash]
    );
    const sessionRecord = session.rows?.[0];
    if (!sessionRecord || !sessionRecord.is_active) {
      throw new UnauthorizedException("Sesión inválida o inactiva");
    }
    return sessionRecord;
  }

  private async updateSessionAfterRefresh(
    client: { query: (text: string, params?: any[]) => Promise<any> },
    sessionId: string,
    refreshTokenHash: string,
    metadata?: RefreshTokenMetadata
  ) {
    await client.query(
      `
      UPDATE auth_sessions
      SET refresh_token = $1,
          user_agent = COALESCE($2, user_agent),
          ip_address = COALESCE($3, ip_address),
          last_activity = NOW()
      WHERE id = $4
      `,
      [
        refreshTokenHash,
        metadata?.userAgent ?? null,
        metadata?.ipAddress ?? null,
        sessionId,
      ]
    );
  }
}
