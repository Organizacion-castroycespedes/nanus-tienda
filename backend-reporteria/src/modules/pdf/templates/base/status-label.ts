const STATUS_LABELS: Record<string, string> = {
  ACCEPTED: "Aceptada",
  ACTIVE: "Activa",
  CANCELLED: "Cancelada",
  CLOSED: "Cerrada",
  COMPLETED: "Completada",
  CONFIRMED: "Confirmada",
  CREATED: "Creada",
  CERRADA_PARCIAL: "Cerrada parcial",
  DELIVERED: "Entregada",
  DISPATCHED: "Despachada",
  ERROR: "Error",
  OPEN: "Abierta",
  PAID: "Pagada",
  PARTIAL: "Parcial",
  PENDING: "Pendiente",
  RECEIVED: "Recibida",
  REFUNDED: "Reembolsada",
  REJECTED: "Rechazada",
};

export const formatTicketStatus = (value?: string | null) => {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) {
    return "No disponible";
  }

  if (normalized === "UNKNOWN") {
    return "No disponible";
  }

  return STATUS_LABELS[normalized] ?? value!.trim();
};
