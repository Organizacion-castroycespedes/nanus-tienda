import { BadRequestException, Injectable, NotFoundException, Inject } from "@nestjs/common";
import { DatabaseService } from "../../common/db/database.service";
import { SUPER_ADMIN_ROLE } from "../../common/services/role-assignment-policy";
import type { CreateRoleDto } from "./dto/create-role.dto";
import type { UpdateRoleDto } from "./dto/update-role.dto";
import type { RoleUserResponseDto } from "./dto/role-user-response.dto";

export type RoleRecord = {
  id: string;
  nombre: string;
  descripcion: string | null;
  created_at: string;
  tenant_ids?: string[];
};

type ActorContext = {
  roles: string[];
  tenantId?: string;
  userId?: string;
};

@Injectable()
export class RolesService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  async listRoles(actor: ActorContext): Promise<RoleRecord[]> {
    const isSuperAdmin = actor.roles.includes(SUPER_ADMIN_ROLE);
    const result = await this.db.query<RoleRecord>(
      `
      SELECT
        roles.id,
        roles.nombre,
        roles.descripcion,
        roles.created_at,
        COALESCE(
          ARRAY_AGG(DISTINCT user_roles.tenant_id)
            FILTER (WHERE user_roles.tenant_id IS NOT NULL),
          '{}'::uuid[]
        ) AS tenant_ids
      FROM roles
      LEFT JOIN user_roles
        ON user_roles.role_id = roles.id
        AND ($1::boolean OR user_roles.tenant_id = $3)
      WHERE $1::boolean OR roles.nombre <> $2
      GROUP BY roles.id
      ORDER BY roles.nombre ASC
      `,
      [
        isSuperAdmin,
        SUPER_ADMIN_ROLE,
        actor.tenantId ?? null,
      ]
    );
    return result.rows ?? [];
  }

  async listRoleUsers(
    roleId: string,
    actor: ActorContext,
    query?: { tenantId?: string }
  ): Promise<RoleUserResponseDto[]> {
    const isSuperAdmin = actor.roles.includes(SUPER_ADMIN_ROLE);
    const resolvedTenantId = isSuperAdmin
      ? query?.tenantId ?? null
      : actor.tenantId ?? null;

    const result = await this.db.query<{
      id: string;
      email: string;
      estado: string;
      created_at: string;
      tenant_id: string;
      tenant_nombre: string | null;
      tenant_slug: string;
      persona_id: string | null;
      nombres: string | null;
      apellidos: string | null;
      documento_tipo: string | null;
      documento_numero: string | null;
      cargo_nombre: string | null;
      telefono: string | null;
      email_personal: string | null;
      branch_id: string | null;
      branch_nombre: string | null;
    }>(
      `
      SELECT
        users.id,
        users.email,
        users.estado,
        users.created_at,
        tenants.id AS tenant_id,
        tenants.nombre AS tenant_nombre,
        tenants.slug AS tenant_slug,
        personas.id AS persona_id,
        personas.nombres,
        personas.apellidos,
        personas.documento_tipo,
        personas.documento_numero,
        personas.cargo_nombre,
        personas.telefono,
        personas.email_personal,
        tb.id AS branch_id,
        tb.nombre AS branch_nombre
      FROM users
      INNER JOIN tenants ON tenants.id = users.tenant_id
      INNER JOIN user_roles ur
        ON ur.user_id = users.id
        AND ur.tenant_id = users.tenant_id
      INNER JOIN roles ON roles.id = ur.role_id
      LEFT JOIN personas ON personas.id = users.persona_id
      LEFT JOIN persona_tenant_branches ptb
        ON ptb.persona_id = personas.id
        AND ptb.es_principal = TRUE
      LEFT JOIN tenant_branches tb ON tb.id = ptb.tenant_branch_id
      WHERE roles.id = $1
        AND ($2::boolean OR roles.nombre <> $3)
        AND ($2::boolean OR users.tenant_id = $4)
        AND ($5::uuid IS NULL OR users.tenant_id = $5)
      ORDER BY tenants.nombre ASC, users.email ASC
      `,
      [
        roleId,
        isSuperAdmin,
        SUPER_ADMIN_ROLE,
        actor.tenantId ?? null,
        resolvedTenantId,
      ]
    );

    return (result.rows ?? []).map((row) => ({
      id: row.id,
      email: row.email,
      estado: row.estado,
      createdAt: row.created_at,
      tenant: {
        id: row.tenant_id,
        nombre: row.tenant_nombre,
        slug: row.tenant_slug,
      },
      persona: row.persona_id
        ? {
            id: row.persona_id,
            nombres: row.nombres ?? "",
            apellidos: row.apellidos ?? "",
            documentoTipo: row.documento_tipo ?? "",
            documentoNumero: row.documento_numero ?? "",
            cargoNombre: row.cargo_nombre ?? "",
            telefono: row.telefono,
            emailPersonal: row.email_personal,
          }
        : null,
      branch: row.branch_id
        ? {
            id: row.branch_id,
            nombre: row.branch_nombre ?? "",
          }
        : null,
    }));
  }

  async createRole(payload: CreateRoleDto, actor: ActorContext) {
    const nombre = payload.nombre?.trim();
    if (!nombre) {
      throw new BadRequestException("Nombre requerido");
    }
    const userId = this.ensureUserId(actor);
    const tenantIds = this.normalizeTenantIds(payload.tenantIds);

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const created = await client.query<RoleRecord>(
        `
        INSERT INTO roles (nombre, descripcion)
        VALUES ($1, $2)
        RETURNING id, nombre, descripcion, created_at
        `,
        [nombre, payload.descripcion ?? null]
      );
      const role = created.rows[0];

      if (tenantIds.length > 0) {
        await client.query(
          `
          INSERT INTO user_roles (user_id, role_id, tenant_id)
          SELECT $1, $2, tenant_id
          FROM unnest($3::uuid[]) AS tenant_id
          ON CONFLICT DO NOTHING
          `,
          [userId, role.id, tenantIds]
        );
      }

      await client.query("COMMIT");
      return {
        ...role,
        tenant_ids: tenantIds,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateRole(roleId: string, payload: UpdateRoleDto, actor: ActorContext) {
    const userId = this.ensureUserId(actor);
    const nombre = payload.nombre?.trim();
    if (payload.nombre !== undefined && !nombre) {
      throw new BadRequestException("Nombre requerido");
    }

    const tenantIds =
      payload.tenantIds === undefined
        ? null
        : this.normalizeTenantIds(payload.tenantIds);

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const updated = await client.query<RoleRecord>(
        `
        UPDATE roles
        SET
          nombre = COALESCE($2, nombre),
          descripcion = COALESCE($3, descripcion)
        WHERE id = $1
        RETURNING id, nombre, descripcion, created_at
        `,
        [roleId, nombre ?? null, payload.descripcion ?? null]
      );

      const role = updated.rows[0];
      if (!role) {
        throw new NotFoundException("Rol no encontrado");
      }

      if (tenantIds !== null) {
        if (tenantIds.length === 0) {
          await client.query(
            `DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2`,
            [userId, roleId]
          );
        } else {
          await client.query(
            `
            DELETE FROM user_roles
            WHERE user_id = $1
              AND role_id = $2
              AND tenant_id <> ALL($3::uuid[])
            `,
            [userId, roleId, tenantIds]
          );
          await client.query(
            `
            INSERT INTO user_roles (user_id, role_id, tenant_id)
            SELECT $1, $2, tenant_id
            FROM unnest($3::uuid[]) AS tenant_id
            ON CONFLICT DO NOTHING
            `,
            [userId, roleId, tenantIds]
          );
        }
      }

      const refreshed = await client.query<RoleRecord>(
        `
        SELECT
          roles.id,
          roles.nombre,
          roles.descripcion,
          roles.created_at,
          COALESCE(
            ARRAY_AGG(DISTINCT user_roles.tenant_id)
              FILTER (WHERE user_roles.user_id = $2),
            '{}'::uuid[]
          ) AS tenant_ids
        FROM roles
        LEFT JOIN user_roles
          ON user_roles.role_id = roles.id
          AND user_roles.user_id = $2
        WHERE roles.id = $1
        GROUP BY roles.id
        `,
        [roleId, userId]
      );

      await client.query("COMMIT");
      return refreshed.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private ensureUserId(actor: ActorContext) {
    if (!actor.userId) {
      throw new BadRequestException("Usuario requerido");
    }
    return actor.userId;
  }

  private normalizeTenantIds(tenantIds: string[] | undefined) {
    if (!Array.isArray(tenantIds)) {
      return [];
    }
    return Array.from(
      new Set(tenantIds.map((tenantId) => tenantId.trim()).filter(Boolean))
    );
  }
}
