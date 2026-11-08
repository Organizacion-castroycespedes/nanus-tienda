import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";

export const badRequest = (code: string, message: string) =>
  new BadRequestException({ code, message });
export const notFound = (code: string, message: string) => new NotFoundException({ code, message });
export const conflict = (code: string, message: string) => new ConflictException({ code, message });
export const unprocessable = (code: string, message: string) =>
  new UnprocessableEntityException({ code, message });

type PgError = { code?: string; constraint?: string; message?: string };

/** Traduce errores de PostgreSQL a respuestas HTTP sin filtrar detalles internos. */
export const mapDatabaseError = (error: unknown, conflictMessage = "El registro entra en conflicto con datos existentes"): never => {
  const pg = error as PgError;
  if (pg?.code === "23505") throw conflict("CONTROL_CENTER_CONFLICT", conflictMessage);
  if (pg?.code === "23503") throw unprocessable("CONTROL_CENTER_REFERENCE_INVALID", "Una referencia no existe o no está permitida");
  if (pg?.code === "23514") throw badRequest("CONTROL_CENTER_CONSTRAINT_VIOLATION", "Los datos no cumplen las reglas del registro");
  if (pg?.code === "P0001" && /CONTROL_CENTER_/.test(pg.message ?? "")) {
    throw conflict("CONTROL_CENTER_IMMUTABLE", "El registro no se puede modificar");
  }
  throw error;
};
