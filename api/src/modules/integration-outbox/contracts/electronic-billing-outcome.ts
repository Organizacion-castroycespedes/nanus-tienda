export type BillingElectronicDocumentFailure = {
  code: string | null;
  message: string;
  origin: "FACTUCORE" | "DIAN" | "MANUS";
  path: string | null;
  severity: string | null;
  title: string | null;
  solution: string | null;
  retryable: boolean;
};

export type BillingElectronicDocumentOutcome = {
  electronicDocumentId: string;
  documentType: string;
  status: string;
  fullNumber: string | null;
  cufe: string | null;
  cude: string | null;
  providerStatus: string | null;
  failureClass: string;
  retryable: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  failures: BillingElectronicDocumentFailure[];
};

export const ELECTRONIC_BILLING_STATUSES = {
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  QUEUED_NETWORK: "QUEUED_NETWORK",
  PROCESSING: "PROCESSING",
  TECHNICAL_ERROR: "TECHNICAL_ERROR",
} as const;

export type ElectronicBillingOnlineStatus =
  | typeof ELECTRONIC_BILLING_STATUSES.ACCEPTED
  | typeof ELECTRONIC_BILLING_STATUSES.REJECTED
  | typeof ELECTRONIC_BILLING_STATUSES.QUEUED_NETWORK
  | typeof ELECTRONIC_BILLING_STATUSES.PROCESSING;

export type ElectronicBillingOnlineResult = {
  status: ElectronicBillingOnlineStatus;
  electronicDocumentId: string | null;
  documentType: string | null;
  fullNumber: string | null;
  cufe: string | null;
  cude: string | null;
  failureClass: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  failures: BillingElectronicDocumentFailure[];
  message: string;
};

export type ElectronicBillingInlineDeliveryOutcome =
  | "PUBLISHED"
  | "RETRYABLE"
  | "FAILED"
  | "SKIPPED";

export type ElectronicBillingInlineDelivery = {
  outcome: ElectronicBillingInlineDeliveryOutcome;
  statusCode: number | null;
  errorCode: string | null;
  message: string | null;
  electronicDocument: BillingElectronicDocumentOutcome | null;
};

const MESSAGES: Record<ElectronicBillingOnlineStatus, string> = {
  [ELECTRONIC_BILLING_STATUSES.ACCEPTED]: "Factura electrónica aceptada por la DIAN.",
  [ELECTRONIC_BILLING_STATUSES.REJECTED]: "La factura electrónica fue rechazada. Revise el código y la solución sugerida.",
  [ELECTRONIC_BILLING_STATUSES.QUEUED_NETWORK]: "Sin conexión con facturación electrónica. El documento quedó en cola y se enviará automáticamente.",
  [ELECTRONIC_BILLING_STATUSES.PROCESSING]: "El documento electrónico se sigue procesando. Consulte el estado en unos minutos.",
};

const INELIGIBLE_SOLUTION =
  "Complete los datos fiscales del cliente (identificación, dirección, municipio, correo y responsabilidades) y solicite de nuevo la factura electrónica.";

const emptyResult = (status: ElectronicBillingOnlineStatus): ElectronicBillingOnlineResult => ({
  status,
  electronicDocumentId: null,
  documentType: null,
  fullNumber: null,
  cufe: null,
  cude: null,
  failureClass: null,
  errorCode: null,
  errorMessage: null,
  failures: [],
  message: MESSAGES[status],
});

export const resolveOnlineStatusFromDocument = (
  document: BillingElectronicDocumentOutcome,
): ElectronicBillingOnlineStatus => {
  if (document.status === ELECTRONIC_BILLING_STATUSES.ACCEPTED) {
    return ELECTRONIC_BILLING_STATUSES.ACCEPTED;
  }
  if (document.status === ELECTRONIC_BILLING_STATUSES.REJECTED) {
    return ELECTRONIC_BILLING_STATUSES.REJECTED;
  }
  if (document.status === ELECTRONIC_BILLING_STATUSES.TECHNICAL_ERROR) {
    return document.retryable
      ? ELECTRONIC_BILLING_STATUSES.QUEUED_NETWORK
      : ELECTRONIC_BILLING_STATUSES.REJECTED;
  }
  return ELECTRONIC_BILLING_STATUSES.PROCESSING;
};

export const buildOnlineResultFromDocument = (
  document: BillingElectronicDocumentOutcome,
): ElectronicBillingOnlineResult => {
  const status = resolveOnlineStatusFromDocument(document);
  return {
    status,
    electronicDocumentId: document.electronicDocumentId,
    documentType: document.documentType,
    fullNumber: document.fullNumber,
    cufe: document.cufe,
    cude: document.cude,
    failureClass: document.failureClass,
    errorCode: document.errorCode ?? document.failures[0]?.code ?? null,
    errorMessage: document.errorMessage ?? document.failures[0]?.message ?? null,
    failures: document.failures ?? [],
    message: MESSAGES[status],
  };
};

export const buildOnlineResultFromDelivery = (
  delivery: ElectronicBillingInlineDelivery | null,
): ElectronicBillingOnlineResult => {
  if (!delivery || delivery.outcome === "SKIPPED") {
    return emptyResult("PROCESSING");
  }

  if (delivery.electronicDocument) {
    return buildOnlineResultFromDocument(delivery.electronicDocument);
  }

  if (delivery.outcome === "RETRYABLE") {
    return {
      ...emptyResult("QUEUED_NETWORK"),
      failureClass: "NETWORK_OR_TRANSIENT",
      errorCode: delivery.errorCode ?? "BILLING_BACKEND_UNREACHABLE",
      errorMessage: delivery.message,
    };
  }

  if (delivery.outcome === "FAILED") {
    const errorCode = delivery.errorCode ?? "BILLING_REQUEST_REJECTED";
    const message = delivery.message ?? "El servicio de facturación rechazó la solicitud.";
    return {
      ...emptyResult("REJECTED"),
      failureClass: errorCode === "OUTBOX_EVENT_INELIGIBLE_SNAPSHOT" ? "VALIDATION" : "UNKNOWN",
      errorCode,
      errorMessage: message,
      failures: [{
        code: errorCode,
        message,
        origin: "MANUS",
        path: null,
        severity: null,
        title: errorCode === "OUTBOX_EVENT_INELIGIBLE_SNAPSHOT" ? "Datos fiscales incompletos" : null,
        solution: errorCode === "OUTBOX_EVENT_INELIGIBLE_SNAPSHOT" ? INELIGIBLE_SOLUTION : null,
        retryable: false,
      }],
    };
  }

  return emptyResult("PROCESSING");
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const readBillingElectronicDocumentOutcome = (value: unknown): BillingElectronicDocumentOutcome | null => {
  if (!isRecord(value) || typeof value.electronicDocumentId !== "string" || typeof value.status !== "string") {
    return null;
  }
  const failures = Array.isArray(value.failures)
    ? value.failures.filter(isRecord).map((failure): BillingElectronicDocumentFailure => ({
        code: typeof failure.code === "string" ? failure.code : null,
        message: typeof failure.message === "string" ? failure.message : "",
        origin: failure.origin === "DIAN" || failure.origin === "MANUS" ? failure.origin : "FACTUCORE",
        path: typeof failure.path === "string" ? failure.path : null,
        severity: typeof failure.severity === "string" ? failure.severity : null,
        title: typeof failure.title === "string" ? failure.title : null,
        solution: typeof failure.solution === "string" ? failure.solution : null,
        retryable: failure.retryable === true,
      }))
    : [];
  const readString = (key: string) => (typeof value[key] === "string" ? value[key] as string : null);
  return {
    electronicDocumentId: value.electronicDocumentId,
    documentType: readString("documentType") ?? "INVOICE",
    status: value.status,
    fullNumber: readString("fullNumber"),
    cufe: readString("cufe"),
    cude: readString("cude"),
    providerStatus: readString("providerStatus"),
    failureClass: readString("failureClass") ?? "UNKNOWN",
    retryable: value.retryable === true,
    errorCode: readString("errorCode"),
    errorMessage: readString("errorMessage"),
    failures,
  };
};
