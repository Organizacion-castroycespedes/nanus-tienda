import { Injectable, Inject } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../common/db/database.service";
import type { CreateBranchDto } from "./dto/create-branch.dto";
import type { UpdateBranchDto } from "./dto/update-branch.dto";
import type { BranchResponseDto } from "./dto/branch-response.dto";

@Injectable()
export class BranchesRepository {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  private async query<T extends QueryResultRow>(
    text: string,
    params: unknown[] = [],
    client?: PoolClient
  ) {
    if (client) {
      return client.query<T>(text, params);
    }
    return this.db.query(text, params);
  }

  async list(tenantId?: string): Promise<BranchResponseDto[]> {
    if (tenantId) {
      const result = await this.query<BranchResponseDto>(
        `SELECT
          tb.id,
          tb.tenant_id,
          tb.codigo,
          tb.nombre,
          tb.descripcion,
          tb.es_principal,
          tb.direccion,
          tb.pais_id,
          tb.departamento_id,
          tb.municipio_id,
          m.nombre AS ciudad,
          d.nombre AS departamento,
          p.nombre AS pais,
          tb.telefono,
          tb.email,
          tb.estado,
          tb.metadata,
          tb.created_at,
          tb.updated_at
        FROM tenant_branches tb
        LEFT JOIN paises p ON p.id = tb.pais_id
        LEFT JOIN departamentos d ON d.id = tb.departamento_id
        LEFT JOIN municipios m ON m.id = tb.municipio_id
        WHERE tb.tenant_id = $1
        ORDER BY tb.es_principal DESC, tb.nombre ASC`,
        [tenantId]
      );
      return result.rows ?? [];
    }

    const result = await this.query<BranchResponseDto>(
      `SELECT
        tb.id,
        tb.tenant_id,
        tb.codigo,
        tb.nombre,
        tb.descripcion,
        tb.es_principal,
        tb.direccion,
        tb.pais_id,
        tb.departamento_id,
        tb.municipio_id,
        m.nombre AS ciudad,
        d.nombre AS departamento,
        p.nombre AS pais,
        tb.telefono,
        tb.email,
        tb.estado,
        tb.metadata,
        tb.created_at,
        tb.updated_at
      FROM tenant_branches tb
      LEFT JOIN paises p ON p.id = tb.pais_id
      LEFT JOIN departamentos d ON d.id = tb.departamento_id
      LEFT JOIN municipios m ON m.id = tb.municipio_id
      ORDER BY tb.tenant_id, tb.es_principal DESC, tb.nombre ASC`
    );
    return result.rows ?? [];
  }

  async findById(
    branchId: string,
    tenantId?: string
  ): Promise<BranchResponseDto | null> {
    if (tenantId) {
      const result = await this.query<BranchResponseDto>(
        `SELECT
          tb.id,
          tb.tenant_id,
          tb.codigo,
          tb.nombre,
          tb.descripcion,
          tb.es_principal,
          tb.direccion,
          tb.pais_id,
          tb.departamento_id,
          tb.municipio_id,
          m.nombre AS ciudad,
          d.nombre AS departamento,
          p.nombre AS pais,
          tb.telefono,
          tb.email,
          tb.estado,
          tb.metadata,
          tb.created_at,
          tb.updated_at
        FROM tenant_branches tb
        LEFT JOIN paises p ON p.id = tb.pais_id
        LEFT JOIN departamentos d ON d.id = tb.departamento_id
        LEFT JOIN municipios m ON m.id = tb.municipio_id
        WHERE tb.id = $1 AND tb.tenant_id = $2`,
        [branchId, tenantId]
      );
      return result.rows[0] ?? null;
    }

    const result = await this.query<BranchResponseDto>(
      `SELECT
        tb.id,
        tb.tenant_id,
        tb.codigo,
        tb.nombre,
        tb.descripcion,
        tb.es_principal,
        tb.direccion,
        tb.pais_id,
        tb.departamento_id,
        tb.municipio_id,
        m.nombre AS ciudad,
        d.nombre AS departamento,
        p.nombre AS pais,
        tb.telefono,
        tb.email,
        tb.estado,
        tb.metadata,
        tb.created_at,
        tb.updated_at
      FROM tenant_branches tb
      LEFT JOIN paises p ON p.id = tb.pais_id
      LEFT JOIN departamentos d ON d.id = tb.departamento_id
      LEFT JOIN municipios m ON m.id = tb.municipio_id
      WHERE tb.id = $1`,
      [branchId]
    );
    return result.rows[0] ?? null;
  }

  async hasPrincipal(tenantId: string, client?: PoolClient): Promise<boolean> {
    const result = await this.query<QueryResultRow>(
      `SELECT 1
      FROM tenant_branches
      WHERE tenant_id = $1 AND es_principal = TRUE
      LIMIT 1`,
      [tenantId],
      client
    );
    return (result.rows?.length ?? 0) > 0;
  }

  async hasOtherPrincipal(
    tenantId: string,
    branchId: string,
    client?: PoolClient
  ): Promise<boolean> {
    const result = await this.query<QueryResultRow>(
      `SELECT 1
      FROM tenant_branches
      WHERE tenant_id = $1 AND es_principal = TRUE AND id <> $2
      LIMIT 1`,
      [tenantId, branchId],
      client
    );
    return (result.rows?.length ?? 0) > 0;
  }

  async clearPrincipal(tenantId: string, client?: PoolClient) {
    await this.query(
      `UPDATE tenant_branches
      SET es_principal = FALSE, updated_at = NOW()
      WHERE tenant_id = $1 AND es_principal = TRUE`,
      [tenantId],
      client
    );
  }

  async insert(
    tenantId: string,
    payload: CreateBranchDto,
    esPrincipal: boolean,
    client?: PoolClient
  ): Promise<BranchResponseDto | null> {
    const result = await this.query<BranchResponseDto>(
      `INSERT INTO tenant_branches (
        tenant_id,
        codigo,
        nombre,
        descripcion,
        es_principal,
        direccion,
        pais_id,
        departamento_id,
        municipio_id,
        ciudad,
        departamento,
        pais,
        telefono,
        email,
        estado,
        metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        (SELECT nombre FROM municipios WHERE id = $9),
        (SELECT nombre FROM departamentos WHERE id = $8),
        (SELECT nombre FROM paises WHERE id = $7),
        $10, $11, $12, $13
      )
      RETURNING
        id,
        tenant_id,
        codigo,
        nombre,
        descripcion,
        es_principal,
        direccion,
        pais_id,
        departamento_id,
        municipio_id,
        ciudad,
        departamento,
        pais,
        telefono,
        email,
        estado,
        metadata,
        created_at,
        updated_at`,
      [
        tenantId,
        payload.codigo,
        payload.nombre,
        payload.descripcion ?? null,
        esPrincipal,
        payload.direccion ?? null,
        payload.paisId ?? null,
        payload.departamentoId ?? null,
        payload.municipioId ?? null,
        payload.telefono ?? null,
        payload.email ?? null,
        payload.estado ?? "ACTIVE",
        payload.metadata ?? {},
      ],
      client
    );
    return result.rows[0] ?? null;
  }

  async update(
    branchId: string,
    payload: UpdateBranchDto,
    esPrincipal?: boolean | null,
    client?: PoolClient
  ): Promise<BranchResponseDto | null> {
    const result = await this.query<BranchResponseDto>(
      `UPDATE tenant_branches
      SET
        codigo = COALESCE($2, codigo),
        nombre = COALESCE($3, nombre),
        descripcion = COALESCE($4, descripcion),
        es_principal = COALESCE($5, es_principal),
        direccion = COALESCE($6, direccion),
        pais_id = COALESCE($7, pais_id),
        departamento_id = COALESCE($8, departamento_id),
        municipio_id = COALESCE($9, municipio_id),
        ciudad = COALESCE(
          (SELECT nombre FROM municipios WHERE id = COALESCE($9, municipio_id)),
          ciudad
        ),
        departamento = COALESCE(
          (SELECT nombre FROM departamentos WHERE id = COALESCE($8, departamento_id)),
          departamento
        ),
        pais = COALESCE(
          (SELECT nombre FROM paises WHERE id = COALESCE($7, pais_id)),
          pais
        ),
        telefono = COALESCE($10, telefono),
        email = COALESCE($11, email),
        estado = COALESCE($12, estado),
        metadata = COALESCE($13, metadata),
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        tenant_id,
        codigo,
        nombre,
        descripcion,
        es_principal,
        direccion,
        pais_id,
        departamento_id,
        municipio_id,
        ciudad,
        departamento,
        pais,
        telefono,
        email,
        estado,
        metadata,
        created_at,
        updated_at`,
      [
        branchId,
        payload.codigo ?? null,
        payload.nombre ?? null,
        payload.descripcion ?? null,
        esPrincipal ?? null,
        payload.direccion ?? null,
        payload.paisId ?? null,
        payload.departamentoId ?? null,
        payload.municipioId ?? null,
        payload.telefono ?? null,
        payload.email ?? null,
        payload.estado ?? null,
        payload.metadata ?? null,
      ],
      client
    );
    return result.rows[0] ?? null;
  }

  async updateStatus(
    branchId: string,
    estado: string,
    client?: PoolClient
  ): Promise<BranchResponseDto | null> {
    const result = await this.query<BranchResponseDto>(
      `UPDATE tenant_branches
      SET estado = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        tenant_id,
        codigo,
        nombre,
        descripcion,
        es_principal,
        direccion,
        pais_id,
        departamento_id,
        municipio_id,
        ciudad,
        departamento,
        pais,
        telefono,
        email,
        estado,
        metadata,
        created_at,
        updated_at`,
      [branchId, estado],
      client
    );
    return result.rows[0] ?? null;
  }
}
