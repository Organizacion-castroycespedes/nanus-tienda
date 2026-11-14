import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  type HttpException,
} from "@nestjs/common";

/**
 * Traduce los errores SERIAL_* que lanzan las funciones fnc_product_serials_* (V117)
 * a excepciones HTTP con mensaje en español. Devuelve null si el error no es de series,
 * para que el llamador lo relance sin cambios.
 */
const SERIAL_ERRORS: Record<string, { status: "BAD_REQUEST" | "CONFLICT" | "NOT_FOUND"; message: string }> = {
  SERIAL_REQUIRED: { status: "BAD_REQUEST", message: "Debes indicar las series del producto." },
  SERIAL_NOT_REQUIRED: { status: "BAD_REQUEST", message: "El producto no maneja número de serie." },
  SERIAL_SOURCE_INVALID: { status: "BAD_REQUEST", message: "Origen de series no válido." },
  SERIAL_PRODUCT_NOT_FOUND: { status: "NOT_FOUND", message: "Producto no encontrado." },
  SERIAL_INVALID_FORMAT: {
    status: "BAD_REQUEST",
    message: "Serie con formato no válido. Usa de 1 a 100 caracteres: letras, números, - _ / .",
  },
  SERIAL_DUPLICATE_IN_PAYLOAD: { status: "BAD_REQUEST", message: "Hay series repetidas en la carga." },
  SERIAL_DUPLICATE: { status: "CONFLICT", message: "La serie ya está registrada para este producto." },
  SERIAL_LOCATION_INVALID: {
    status: "BAD_REQUEST",
    message: "La ubicación no existe, está inactiva o pertenece a otra sucursal.",
  },
  SERIAL_MOVEMENT_INVALID: { status: "BAD_REQUEST", message: "El movimiento de inventario no corresponde a las series." },
  SERIAL_COUNT_MISMATCH: {
    status: "BAD_REQUEST",
    message: "La cantidad de series no coincide con la cantidad de unidades.",
  },
  SERIAL_QUANTITY_NOT_INTEGER: { status: "BAD_REQUEST", message: "Los productos con serie solo admiten cantidades enteras." },
  SERIAL_SALE_NOT_FOUND: { status: "NOT_FOUND", message: "Venta no encontrada." },
  SERIAL_SALE_ITEM_NOT_FOUND: { status: "BAD_REQUEST", message: "La línea de venta no pertenece a la venta." },
  SERIAL_ORDER_NOT_FOUND: { status: "NOT_FOUND", message: "Pedido no encontrado." },
  SERIAL_NOT_AVAILABLE: {
    status: "CONFLICT",
    message: "Una o más series ya no están disponibles. Selecciona otra serie.",
  },
  SERIAL_WRONG_BRANCH: { status: "CONFLICT", message: "La serie pertenece a otra sucursal." },
  SERIAL_NOT_FOUND: { status: "NOT_FOUND", message: "Serie no encontrada." },
  SERIAL_NOT_IN_STOCK: { status: "CONFLICT", message: "La serie no está en existencia." },
  SERIAL_REASON_REQUIRED: { status: "BAD_REQUEST", message: "Indica un motivo de al menos 5 caracteres." },
  SERIAL_INSPECTION_RESULT_INVALID: { status: "BAD_REQUEST", message: "Resultado de inspección no válido." },
  SERIAL_TRANSITION_INVALID: { status: "CONFLICT", message: "La serie no admite ese cambio de estado." },
  SERIAL_EVENTS_IMMUTABLE: { status: "CONFLICT", message: "El historial de series no se puede modificar." },
};

export const SERIAL_ERROR_CODES = Object.keys(SERIAL_ERRORS);

type DatabaseErrorLike = { message?: unknown; detail?: unknown };

export const mapSerialDatabaseError = (error: unknown): HttpException | null => {
  const candidate = error as DatabaseErrorLike | null;
  const code = typeof candidate?.message === "string" ? candidate.message.trim() : "";
  const known = SERIAL_ERRORS[code];
  if (!known) {
    return null;
  }
  const detail = typeof candidate?.detail === "string" && candidate.detail ? candidate.detail : undefined;
  const body = { code, message: known.message, ...(detail ? { detail } : {}) };
  if (known.status === "CONFLICT") {
    return new ConflictException(body);
  }
  if (known.status === "NOT_FOUND") {
    return new NotFoundException(body);
  }
  return new BadRequestException(body);
};
