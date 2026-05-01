import {
  assertOptionalLength,
  isUuid,
  normalizeOptionalText,
} from "./entity-utils";

export const PAYMENT_METHOD_TYPES = [
  "CASH",
  "CARD",
  "BANK",
  "DIGITAL",
  "CREDIT",
] as const;

export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

export type PaymentMethodProps = {
  id: string;
  tenantId: string;
  codigo: string;
  nombre: string;
  tipo: PaymentMethodType;
  requiresReference?: boolean;
  allowsChange?: boolean;
  active?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class PaymentMethodEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly tipo: PaymentMethodType;
  readonly requiresReference: boolean;
  readonly allowsChange: boolean;
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: PaymentMethodProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID");
    }
    if (!PAYMENT_METHOD_TYPES.includes(props.tipo)) {
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

    const requiresReference = props.requiresReference ?? false;
    const allowsChange = props.allowsChange ?? false;

    if (props.tipo === "CREDIT" && allowsChange) {
      throw new Error("credit payment methods cannot allow change");
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.codigo = codigo;
    this.nombre = nombre;
    this.tipo = props.tipo;
    this.requiresReference = requiresReference;
    this.allowsChange = allowsChange;
    this.active = props.active ?? true;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: PaymentMethodProps) {
    return new PaymentMethodEntity(props);
  }
}

export const PAYMENT_METHOD_RELATIONS = {
  tenant: {
    type: "ManyToOne",
    target: "TenantEntity",
    foreignKey: "tenant_id",
  },
} as const;
