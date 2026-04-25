import * as bcrypt from 'bcryptjs';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
} from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../common/db/database.service";
import type { CreateUserDto, PersonaPayloadDto } from "./dto/create-user.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";
import type { ListUsersQueryDto } from "./dto/list-users-query.dto";
import type { UserResponseDto } from "./dto/user-response.dto";
import type { UpdateUserPasswordDto } from "./dto/update-password.dto";
import type { UpdateProfileDto } from "../auth/dto/update-profile.dto";

type ActorContext = {
  roles: string[];
  tenantId?: string;
  userId?: string;
};

type UserRecord = {
  id: string;
  email: string;
  estado: string;
  tenant_id: string;
  tenant_nombre: string | null;
  persona_id: string | null;
  nombres: string | null;
  apellidos: string | null;
  documento_tipo: string | null;
  documento_numero: string | null;
  telefono: string | null;
  direccion: string | null;
  email_personal: string | null;
  cargo_nombre: string | null;
  cargo_descripcion: string | null;
  funciones_descripcion: string | null;
  role_id: string | null;
  role_nombre: string | null;
  branch_id: string | null;
  branch_nombre: string | null;
};

@Injectable()
export class UsersService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  private isSuperAdmin(actor: ActorContext) {
    return actor.roles.includes("SUPER_ADMIN");
  }

  private shouldFilterSuperAdmin(actor: ActorContext) {
    return actor.roles.includes("ADMIN") && !this.isSuperAdmin(actor);
  }

  private resolveTenantId(actor: ActorContext, tenantId?: string) {
    if (this.isSuperAdmin(actor)) {
      if (tenantId) {
        return tenantId;
      }
      if (actor.tenantId) {
        return actor.tenantId;
      }
      throw new BadRequestException("Tenant requerido");
    }
    if (!actor.tenantId) {
      throw new ForbiddenException("Tenant requerido");
    }
    if (tenantId && tenantId !== actor.tenantId) {
      throw new ForbiddenException("No autorizado para otro tenant");
    }
    return actor.tenantId;
  }

  private normalizeEmail(email: string | undefined) {
    return email?.trim().toLowerCase() ?? "";
  }

  private mapUserResponse(record: UserRecord): UserResponseDto {
    return {
      id: record.id,
      email: record.email,
      estado: record.estado,
      tenantId: record.tenant_id,
      tenantNombre: record.tenant_nombre,
      persona: record.persona_id
        ? {
            id: record.persona_id,
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
      role: {
        id: record.role_id,
        nombre: record.role_nombre,
      },
      branch: {
        id: record.branch_id,
        nombre: record.branch_nombre,
      },
    };
  }

  private buildBaseQuery() {
    return `
      SELECT
        users.id,
        users.email,
        users.estado,
        users.tenant_id,
        tenants.nombre AS tenant_nombre,
        users.persona_id,
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
    `;
  }

  async listUsers(query: ListUsersQueryDto, actor: ActorContext) {
    const params: Array<string | number> = [];
    const where: string[] = [];
    const tenantId = this.isSuperAdmin(actor)
      ? query.tenantId
      : this.resolveTenantId(actor, query.tenantId);

    if (tenantId) {
      params.push(tenantId);
      where.push(`users.tenant_id = $${params.length}`);
    }

    const search = query.query?.trim();
    if (search) {
      params.push(`%${search}%`);
      const index = params.length;
      where.push(
        `(
          users.email ILIKE $${index}
          OR personas.nombres ILIKE $${index}
          OR personas.apellidos ILIKE $${index}
          OR personas.documento_numero ILIKE $${index}
        )`
      );
    }

    if (query.estado && query.estado !== "all") {
      params.push(query.estado);
      where.push(`users.estado = $${params.length}`);
    }

    if (this.shouldFilterSuperAdmin(actor)) {
      where.push(`(roles.nombre IS NULL OR roles.nombre <> 'SUPER_ADMIN')`);
    }

    const rawLimit = query.limit ? Number(query.limit) : NaN;
    const rawOffset = query.offset ? Number(query.offset) : NaN;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50;
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

    params.push(limit);
    params.push(offset);

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const result = await this.db.query<UserRecord>(
      `${this.buildBaseQuery()}
      ${whereClause}
      ORDER BY users.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params
    );

    return result.rows.map((row) => this.mapUserResponse(row));
  }

  async getUser(userId: string, actor: ActorContext) {
    const tenantFilter = this.isSuperAdmin(actor)
      ? ""
      : "AND users.tenant_id = $2";
    const params: string[] = [userId];
    if (!this.isSuperAdmin(actor)) {
      params.push(this.resolveTenantId(actor));
    }

    const result = await this.db.query<UserRecord>(
      `${this.buildBaseQuery()}
      WHERE users.id = $1 ${tenantFilter}
      `,
      params
    );

    const record = result.rows[0];
    if (!record) {
      throw new NotFoundException("Usuario no encontrado");
    }
    if (this.shouldFilterSuperAdmin(actor) && record.role_nombre === "SUPER_ADMIN") {
      throw new ForbiddenException("No autorizado");
    }
    return this.mapUserResponse(record);
  }

  async createUser(payload: CreateUserDto, actor: ActorContext) {
    const email = this.normalizeEmail(payload.email);
    if (!email) {
      throw new BadRequestException("Email requerido");
    }
    if (!payload.password || payload.password.length < 8) {
      throw new BadRequestException("Password debe tener mínimo 8 caracteres");
    }
    if (!payload.roleId) {
      throw new BadRequestException("Rol requerido");
    }
    if (!payload.tenantBranchId) {
      throw new BadRequestException("Sucursal requerida");
    }

    const persona = payload.persona;
    this.validatePersona(persona);

    const tenantId = this.resolveTenantId(actor, payload.tenantId);
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const existing = await client.query(
        `SELECT id FROM users WHERE tenant_id = $1 AND email = $2`,
        [tenantId, email]
      );
      if (existing.rows.length > 0) {
        throw new BadRequestException("Email ya registrado en el tenant");
      }

      const roleResult = await client.query(
        `SELECT id FROM roles WHERE id = $1`,
        [payload.roleId]
      );
      if (!roleResult.rows[0]) {
        throw new BadRequestException("Rol inválido");
      }

      const branchResult = await client.query(
        `SELECT id FROM tenant_branches WHERE id = $1 AND tenant_id = $2`,
        [payload.tenantBranchId, tenantId]
      );
      if (!branchResult.rows[0]) {
        throw new BadRequestException("Sucursal inválida");
      }

      const personaInsert = await client.query<{ id: string }>(
        `
        INSERT INTO personas (
          tenant_id,
          nombres,
          apellidos,
          documento_tipo,
          documento_numero,
          telefono,
          direccion,
          email_personal,
          cargo_nombre,
          cargo_descripcion,
          funciones_descripcion
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
        `,
        [
          tenantId,
          persona.nombres.trim(),
          persona.apellidos.trim(),
          persona.documentoTipo.trim(),
          persona.documentoNumero.trim(),
          persona.telefono ?? null,
          persona.direccion ?? null,
          persona.emailPersonal ?? null,
          persona.cargoNombre.trim(),
          persona.cargoDescripcion ?? null,
          persona.funcionesDescripcion ?? null,
        ]
      );

      const passwordHash = await bcrypt.hash(payload.password, 12);

      const userInsert = await client.query<{ id: string }>(
        `
        INSERT INTO users (tenant_id, persona_id, email, password_hash, estado)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        `,
        [
          tenantId,
          personaInsert.rows[0].id,
          email,
          passwordHash,
          payload.estado ?? "ACTIVE",
        ]
      );

      await client.query(
        `
        INSERT INTO user_roles (user_id, role_id, tenant_id)
        VALUES ($1, $2, $3)
        `,
        [userInsert.rows[0].id, payload.roleId, tenantId]
      );

      await client.query(
        `
        INSERT INTO persona_tenant_branches (persona_id, tenant_branch_id, tenant_id, es_principal)
        VALUES ($1, $2, $3, TRUE)
        `,
        [personaInsert.rows[0].id, payload.tenantBranchId, tenantId]
      );

      const created = await this.fetchUserById(userInsert.rows[0].id, client);
      await client.query("COMMIT");
      return this.mapUserResponse(created);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateUser(userId: string, payload: UpdateUserDto, actor: ActorContext) {
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const current = await this.fetchUserById(userId, client);
      if (this.shouldFilterSuperAdmin(actor) && current.role_nombre === "SUPER_ADMIN") {
        throw new ForbiddenException("No autorizado");
      }
      const tenantId = this.resolveTenantId(actor, current.tenant_id);
      let personaId = current.persona_id;

      const updates: string[] = [];
      const values: Array<string | null> = [];

      if (payload.email !== undefined) {
        const email = this.normalizeEmail(payload.email);
        if (!email) {
          throw new BadRequestException("Email requerido");
        }
        const existing = await client.query(
          `SELECT id FROM users WHERE tenant_id = $1 AND email = $2 AND id <> $3`,
          [tenantId, email, userId]
        );
        if (existing.rows.length > 0) {
          throw new BadRequestException("Email ya registrado en el tenant");
        }
        values.push(email);
        updates.push(`email = $${values.length}`);
      }

      if (payload.estado !== undefined) {
        values.push(payload.estado);
        updates.push(`estado = $${values.length}`);
      }

      if (updates.length > 0) {
        values.push(userId);
        await client.query(
          `UPDATE users SET ${updates.join(", ")} WHERE id = $${values.length}`,
          values
        );
      }

      if (payload.persona) {
        if (!personaId) {
          const persona = payload.persona as PersonaPayloadDto;
          this.validatePersona(persona);
          const personaInsert = await client.query<{ id: string }>(
            `
            INSERT INTO personas (
              tenant_id,
              nombres,
              apellidos,
              documento_tipo,
              documento_numero,
              telefono,
              direccion,
              email_personal,
              cargo_nombre,
              cargo_descripcion,
              funciones_descripcion
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id
            `,
            [
              tenantId,
              persona.nombres.trim(),
              persona.apellidos.trim(),
              persona.documentoTipo.trim(),
              persona.documentoNumero.trim(),
              persona.telefono ?? null,
              persona.direccion ?? null,
              persona.emailPersonal ?? null,
              persona.cargoNombre.trim(),
              persona.cargoDescripcion ?? null,
              persona.funcionesDescripcion ?? null,
            ]
          );
          personaId = personaInsert.rows[0].id;
          await client.query(`UPDATE users SET persona_id = $1 WHERE id = $2`, [
            personaId,
            userId,
          ]);
        } else {
          this.validatePersonaPatch(payload.persona);
          const personaUpdates: string[] = [];
          const personaValues: Array<string | null> = [];
          const persona = payload.persona;
          const mapField = (
            field: keyof PersonaPayloadDto,
            column: string,
            formatter?: (value: string) => string
          ) => {
            if (persona[field] !== undefined) {
              const value = persona[field];
              if (typeof value === "string" && formatter) {
                personaValues.push(formatter(value));
              } else {
                personaValues.push((value as string) ?? null);
              }
              personaUpdates.push(`${column} = $${personaValues.length}`);
            }
          };
          mapField("nombres", "nombres", (value) => value.trim());
          mapField("apellidos", "apellidos", (value) => value.trim());
          mapField("documentoTipo", "documento_tipo", (value) => value.trim());
          mapField("documentoNumero", "documento_numero", (value) => value.trim());
          mapField("telefono", "telefono");
          mapField("direccion", "direccion");
          mapField("emailPersonal", "email_personal");
          mapField("cargoNombre", "cargo_nombre", (value) => value.trim());
          mapField("cargoDescripcion", "cargo_descripcion");
          mapField("funcionesDescripcion", "funciones_descripcion");

          if (personaUpdates.length > 0) {
            personaValues.push(personaId);
            await client.query(
              `UPDATE personas SET ${personaUpdates.join(", ")} WHERE id = $${personaValues.length}`,
              personaValues
            );
          }
        }
      }

      if (payload.roleId) {
        const roleResult = await client.query(
          `SELECT id FROM roles WHERE id = $1`,
          [payload.roleId]
        );
        if (!roleResult.rows[0]) {
          throw new BadRequestException("Rol inválido");
        }
        await client.query(
          `DELETE FROM user_roles WHERE user_id = $1 AND tenant_id = $2`,
          [userId, tenantId]
        );
        await client.query(
          `INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES ($1, $2, $3)`,
          [userId, payload.roleId, tenantId]
        );
      }

      if (payload.tenantBranchId) {
        const branchResult = await client.query(
          `SELECT id FROM tenant_branches WHERE id = $1 AND tenant_id = $2`,
          [payload.tenantBranchId, tenantId]
        );
        if (!branchResult.rows[0]) {
          throw new BadRequestException("Sucursal inválida");
        }
        if (!personaId) {
          throw new BadRequestException("Persona asociada requerida");
        }
        await client.query(
          `DELETE FROM persona_tenant_branches WHERE persona_id = $1`,
          [personaId]
        );
        await client.query(
          `
          INSERT INTO persona_tenant_branches (persona_id, tenant_branch_id, tenant_id, es_principal)
          VALUES ($1, $2, $3, TRUE)
          `,
          [personaId, payload.tenantBranchId, tenantId]
        );
      }

      const updated = await this.fetchUserById(userId, client);
      await client.query("COMMIT");
      return this.mapUserResponse(updated);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updatePassword(userId: string, payload: UpdateUserPasswordDto, actor: ActorContext) {
    if (!payload.password || payload.password.length < 8) {
      throw new BadRequestException("Password debe tener mínimo 8 caracteres");
    }
    const current = await this.db.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM users WHERE id = $1`,
      [userId]
    );
    const record = current.rows[0];
    if (!record) {
      throw new NotFoundException("Usuario no encontrado");
    }
    this.resolveTenantId(actor, record.tenant_id);

    const passwordHash = await bcrypt.hash(payload.password, 12);
    await this.db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
      passwordHash,
      userId,
    ]);
    return { ok: true };
  }

  async updateSelfProfile(payload: UpdateProfileDto, actor: ActorContext) {
    if (!actor.userId) {
      throw new ForbiddenException("Usuario requerido");
    }
    if (!payload.persona) {
      throw new BadRequestException("Datos personales requeridos");
    }
    await this.updateUser(actor.userId, { persona: payload.persona }, actor);
    return { ok: true };
  }

  async updateSelfPassword(payload: UpdateUserPasswordDto, actor: ActorContext) {
    if (!actor.userId) {
      throw new ForbiddenException("Usuario requerido");
    }
    return this.updatePassword(actor.userId, payload, actor);
  }

  private validatePersona(persona: PersonaPayloadDto) {
    if (!persona) {
      throw new BadRequestException("Persona requerida");
    }
    if (!persona.nombres?.trim()) {
      throw new BadRequestException("Nombres requeridos");
    }
    if (!persona.apellidos?.trim()) {
      throw new BadRequestException("Apellidos requeridos");
    }
    if (!persona.documentoTipo?.trim()) {
      throw new BadRequestException("Tipo de documento requerido");
    }
    if (!persona.documentoNumero?.trim()) {
      throw new BadRequestException("Número de documento requerido");
    }
    if (!persona.cargoNombre?.trim()) {
      throw new BadRequestException("Cargo requerido");
    }
  }

  private validatePersonaPatch(persona: Partial<PersonaPayloadDto>) {
    if (persona.nombres !== undefined && !persona.nombres.trim()) {
      throw new BadRequestException("Nombres requeridos");
    }
    if (persona.apellidos !== undefined && !persona.apellidos.trim()) {
      throw new BadRequestException("Apellidos requeridos");
    }
    if (persona.documentoTipo !== undefined && !persona.documentoTipo.trim()) {
      throw new BadRequestException("Tipo de documento requerido");
    }
    if (persona.documentoNumero !== undefined && !persona.documentoNumero.trim()) {
      throw new BadRequestException("Número de documento requerido");
    }
    if (persona.cargoNombre !== undefined && !persona.cargoNombre.trim()) {
      throw new BadRequestException("Cargo requerido");
    }
  }

  private async fetchUserById(userId: string, client: PoolClient) {
    const result = await client.query<UserRecord>(
      `${this.buildBaseQuery()}
      WHERE users.id = $1
      `,
      [userId]
    );
    const record = result.rows[0];
    if (!record) {
      throw new NotFoundException("Usuario no encontrado");
    }
    return record;
  }
}
