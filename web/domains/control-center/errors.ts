import { ApiError } from "../../lib/request";

export const apiErrorMessage = (error: unknown, fallback = "No fue posible completar la operación.") => {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return "No tienes acceso a esta operación.";
    if (error.status === 503 && error.code === "CONTROL_CENTER_DISABLED") return "El Control Center está deshabilitado en este ambiente.";
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
};
