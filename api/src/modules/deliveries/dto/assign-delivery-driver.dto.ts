import { IsUUID, ValidateIf } from "class-validator";

export class AssignDeliveryDriverDto {
  @ValidateIf((_object: object, value: unknown) => value !== null)
  @IsUUID()
  driver_id!: string | null;
}
