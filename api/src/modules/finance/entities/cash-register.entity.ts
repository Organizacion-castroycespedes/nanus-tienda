import {
  assertOptionalLength,
  isOptionalUuid,
  isUuid,
  normalizeOptionalText,
} from "./entity-utils";

export type CashRegisterProps = {
  id: string;
  tenantId: string;
  branchId: string;
  terminalId?: string | null;
  codigo: string;
  nombre: string;
  activo?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class CashRegisterEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly terminalId: string | null;
  readonly codigo: string;
  readonly nombre: string;
  readonly activo: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: CashRegisterProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID");
    }
    if (!isUuid(props.branchId)) {
      throw new Error("branchId must be a valid UUID");
    }
    if (!isOptionalUuid(props.terminalId)) {
      throw new Error("terminalId must be a valid UUID");
    }

    assertOptionalLength(props.codigo, "codigo", 50);
    assertOptionalLength(props.nombre, "nombre", 120);

    const codigo = normalizeOptionalText(props.codigo);
    const nombre = normalizeOptionalText(props.nombre);
    if (!codigo) {
      throw new Error("codigo is required");
    }
    if (!nombre) {
      throw new Error("nombre is required");
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.terminalId = props.terminalId?.trim() || null;
    this.codigo = codigo;
    this.nombre = nombre;
    this.activo = props.activo ?? true;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: CashRegisterProps) {
    return new CashRegisterEntity(props);
  }
}

export const CASH_REGISTER_RELATIONS = {
  tenant: {
    type: "ManyToOne",
    target: "TenantEntity",
    foreignKey: "tenant_id",
  },
  branch: {
    type: "ManyToOne",
    target: "BranchEntity",
    foreignKey: "branch_id",
  },
  terminal: {
    type: "ManyToOne",
    target: "TerminalEntity",
    foreignKey: "terminal_id",
  },
} as const;
