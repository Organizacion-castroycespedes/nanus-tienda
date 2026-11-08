export const CONTROL_CENTER_DISABLED_CODE = "CONTROL_CENTER_DISABLED";
export const CONTROL_CENTER_REASON_REQUIRED_CODE = "CONTROL_CENTER_REASON_REQUIRED";
export const CONTROL_CENTER_MIN_REASON_LENGTH = 10;

/**
 * Acciones que exigen motivo. Cada fase del Control Center agrega aqui sus
 * acciones criticas (activar, enmendar, terminar, ajustar precio, etc.).
 */
export const CONTROL_CENTER_CRITICAL_ACTIONS = new Set<string>([]);
