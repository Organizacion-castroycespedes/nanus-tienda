import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import { SupplierEntity, type SupplierProps } from "../entities/supplier.entity";

type SupplierRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  name: string;
  document_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  departamento_id: string | null;
  municipio_id: string | null;
  ciudad: string | null;
  departamento: string | null;
  is_active: boolean;
  created_at: string | Date;
  updated_at: string | Date;
};

type CreateSupplierData = SupplierProps;

type UpdateSupplierData = Partial<
  Pick<
    SupplierProps,
    | "name"
    | "documentNumber"
    | "phone"
    | "email"
    | "address"
    | "departamentoId"
    | "municipioId"
    | "ciudad"
    | "departamento"
    | "isActive"
  >
>;

@Injectable()
export class SupplierRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService
  ) {}

  private async query<T extends QueryResultRow>(
    text: string,
    params: unknown[] = [],
    client?: PoolClient
  ) {
    if (client) {
      return client.query<T>(text, params);
    }
    return this.db.query<T>(text, params);
  }

  private mapRowToEntity(row: SupplierRow): SupplierEntity {
    return SupplierEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      documentNumber: row.document_number,
      phone: row.phone,
      email: row.email,
      address: row.address,
      departamentoId: row.departamento_id,
      municipioId: row.municipio_id,
      ciudad: row.ciudad,
      departamento: row.departamento,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  async create(
    supplier: CreateSupplierData,
    client?: PoolClient
  ): Promise<SupplierEntity | null> {
    const result = await this.query<SupplierRow>(
      `
        INSERT INTO suppliers (
          id,
          tenant_id,
          name,
          document_number,
          phone,
          email,
          address,
          departamento_id,
          municipio_id,
          ciudad,
          departamento,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          COALESCE((SELECT nombre FROM municipios WHERE id = $9), $10),
          COALESCE((SELECT nombre FROM departamentos WHERE id = $8), $11),
          $12, $13, $14
        )
        RETURNING
          id,
          tenant_id,
          name,
          document_number,
          phone,
          email,
          address,
          departamento_id,
          municipio_id,
          ciudad,
          departamento,
          is_active,
          created_at,
          updated_at
      `,
      [
        supplier.id,
        supplier.tenantId,
        supplier.name,
        supplier.documentNumber ?? null,
        supplier.phone ?? null,
        supplier.email ?? null,
        supplier.address ?? null,
        supplier.departamentoId ?? null,
        supplier.municipioId ?? null,
        supplier.ciudad ?? null,
        supplier.departamento ?? null,
        supplier.isActive ?? true,
        supplier.createdAt,
        supplier.updatedAt,
      ],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findAllByTenant(
    tenantId: string,
    client?: PoolClient
  ): Promise<SupplierEntity[]> {
    const result = await this.query<SupplierRow>(
      `
        SELECT
          id,
          tenant_id,
          name,
          document_number,
          phone,
          email,
          address,
          departamento_id,
          municipio_id,
          ciudad,
          departamento,
          is_active,
          created_at,
          updated_at
        FROM suppliers
        WHERE tenant_id = $1
        ORDER BY created_at DESC
      `,
      [tenantId],
      client
    );

    return (result.rows ?? []).map((row) => this.mapRowToEntity(row));
  }

  async findById(
    id: string,
    tenantId: string,
    client?: PoolClient
  ): Promise<SupplierEntity | null> {
    const result = await this.query<SupplierRow>(
      `
        SELECT
          id,
          tenant_id,
          name,
          document_number,
          phone,
          email,
          address,
          departamento_id,
          municipio_id,
          ciudad,
          departamento,
          is_active,
          created_at,
          updated_at
        FROM suppliers
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1
      `,
      [id, tenantId],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateSupplierData,
    client?: PoolClient
  ): Promise<SupplierEntity | null> {
    const result = await this.query<SupplierRow>(
      `
        UPDATE suppliers
        SET
          name = COALESCE($3, name),
          document_number = COALESCE($4, document_number),
          phone = COALESCE($5, phone),
          email = COALESCE($6, email),
          address = COALESCE($7, address),
          departamento_id = COALESCE($8, departamento_id),
          municipio_id = COALESCE($9, municipio_id),
          ciudad = COALESCE((SELECT nombre FROM municipios WHERE id = $9), COALESCE($10, ciudad)),
          departamento = COALESCE((SELECT nombre FROM departamentos WHERE id = $8), COALESCE($11, departamento)),
          is_active = COALESCE($12, is_active),
          updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING
          id,
          tenant_id,
          name,
          document_number,
          phone,
          email,
          address,
          departamento_id,
          municipio_id,
          ciudad,
          departamento,
          is_active,
          created_at,
          updated_at
      `,
      [
        id,
        tenantId,
        data.name ?? null,
        data.documentNumber ?? null,
        data.phone ?? null,
        data.email ?? null,
        data.address ?? null,
        data.departamentoId ?? null,
        data.municipioId ?? null,
        data.ciudad ?? null,
        data.departamento ?? null,
        data.isActive ?? null,
      ],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async softDelete(
    id: string,
    tenantId: string,
    client?: PoolClient
  ): Promise<SupplierEntity | null> {
    const result = await this.query<SupplierRow>(
      `
        UPDATE suppliers
        SET
          is_active = FALSE,
          updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING
          id,
          tenant_id,
          name,
          document_number,
          phone,
          email,
          address,
          departamento_id,
          municipio_id,
          ciudad,
          departamento,
          is_active,
          created_at,
          updated_at
      `,
      [id, tenantId],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }
}
