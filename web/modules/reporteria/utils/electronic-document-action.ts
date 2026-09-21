import type { PosSalesListRow } from "../types";

export const canViewElectronicDocument = (status: PosSalesListRow["billingStatus"]) =>
  status === "ACCEPTED";
