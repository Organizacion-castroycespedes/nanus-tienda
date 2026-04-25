import type { PersonaPayloadDto } from "../../users/dto/create-user.dto";

export type UpdateProfileDto = {
  persona?: Partial<PersonaPayloadDto>;
};
