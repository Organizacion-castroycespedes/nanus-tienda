const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export type CustomerProps = {
  id: string;
  tenantId: string;
  name: string;
  documentNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  departamentoId?: string | null;
  municipioId?: string | null;
  ciudad?: string | null;
  departamento?: string | null;
  isFinalConsumer?: boolean;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class CustomerEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly documentNumber: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly departamentoId: string | null;
  readonly municipioId: string | null;
  readonly ciudad: string | null;
  readonly departamento: string | null;
  readonly isFinalConsumer: boolean;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: CustomerProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID");
    }
    if (!props.name?.trim()) {
      throw new Error("name is required");
    }
    if (
      props.departamentoId !== undefined &&
      props.departamentoId !== null &&
      !isUuid(props.departamentoId)
    ) {
      throw new Error("departamentoId must be a valid UUID");
    }
    if (
      props.municipioId !== undefined &&
      props.municipioId !== null &&
      !isUuid(props.municipioId)
    ) {
      throw new Error("municipioId must be a valid UUID");
    }
    if (props.email && !isValidEmail(props.email.trim())) {
      throw new Error("email is invalid");
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name.trim();
    this.documentNumber = props.documentNumber?.trim() || null;
    this.phone = props.phone?.trim() || null;
    this.email = props.email?.trim().toLowerCase() || null;
    this.address = props.address?.trim() || null;
    this.departamentoId = props.departamentoId ?? null;
    this.municipioId = props.municipioId ?? null;
    this.ciudad = props.ciudad?.trim() || null;
    this.departamento = props.departamento?.trim() || null;
    this.isFinalConsumer = props.isFinalConsumer ?? false;
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: CustomerProps) {
    return new CustomerEntity(props);
  }
}
