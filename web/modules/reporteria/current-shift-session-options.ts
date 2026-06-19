import type { CurrentShiftCashSession } from "./types";

type DateFormatter = (value: string | null | undefined) => string;

const compact = (values: Array<string | null | undefined>) =>
  values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

export const getCurrentShiftSessionCashRegisterLabel = (
  session: CurrentShiftCashSession
) => {
  const name = session.cashRegisterName?.trim() || "Caja";
  return session.cashRegisterCode
    ? `${name} (${session.cashRegisterCode})`
    : name;
};

export const buildCurrentShiftSessionOptionLabel = (
  session: CurrentShiftCashSession,
  formatDateTime: DateFormatter = (value) => value ?? "-"
) =>
  compact([
    session.branchName ?? session.branchId,
    session.terminalName ?? "Sin terminal",
    getCurrentShiftSessionCashRegisterLabel(session),
    session.userName ? `Abierta por ${session.userName}` : "Usuario no identificado",
    formatDateTime(session.openedAt),
  ]).join(" | ");

export const filterCurrentShiftSessions = (
  sessions: CurrentShiftCashSession[],
  search: string
) => {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) {
    return sessions;
  }

  return sessions.filter((session) =>
    compact([
      session.branchName,
      session.branchId,
      session.terminalName,
      session.terminalId,
      session.cashRegisterName,
      session.cashRegisterCode,
      session.cashRegisterId,
      session.userName,
      session.userId,
      session.status,
    ])
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch)
  );
};
