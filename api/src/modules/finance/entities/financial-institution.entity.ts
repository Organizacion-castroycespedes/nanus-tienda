import {
  assertOptionalLength,
  isUuid,
  normalizeOptionalText,
} from "./entity-utils";

export const FINANCIAL_INSTITUTION_TYPES = [
  "BANK",
  "WALLET",
  "PAYMENT_NETWORK",
  "OTHER",
] as const;

export type FinancialInstitutionType = (typeof FINANCIAL_INSTITUTION_TYPES)[number];

export type FinancialInstitutionProps = {
  id: string;
  tenantId?: string | null;
  codigo: string;
  nombre: string;
  nombreCorto?: string | null;
  tipo: FinancialInstitutionType;
  logoUrl?: string | null;
  active?: boolean;
  sortOrder?: number;
  createdAt: Date;
  updatedAt: Date;
};

export class FinancialInstitutionEntity {
  readonly id: string;
  readonly tenantId: string | null;
  readonly codigo: string;
  readonly nombre: string;
  readonly nombreCorto: string | null;
  readonly tipo: FinancialInstitutionType;
  readonly logoUrl: string | null;
  readonly active: boolean;
  readonly sortOrder: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: FinancialInstitutionProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (props.tenantId && !isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID if provided");
    }
    if (!FINANCIAL_INSTITUTION_TYPES.includes(props.tipo)) {
      throw new Error("tipo is invalid");
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
    this.tenantId = props.tenantId ?? null;
    this.codigo = codigo;
    this.nombre = nombre;
    this.nombreCorto = props.nombreCorto?.trim() || null;
    this.tipo = props.tipo;
    this.logoUrl = props.logoUrl?.trim() || null;
    this.active = props.active ?? true;
    this.sortOrder = props.sortOrder ?? 0;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: FinancialInstitutionProps) {
    return new FinancialInstitutionEntity(props);
  }
}
