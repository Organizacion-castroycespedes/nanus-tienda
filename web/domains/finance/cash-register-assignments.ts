import { apiClient } from "../../lib/http";

export type CashRegisterAssignment = {
  id: string;
  cashRegisterId: string;
  userId: string;
  userEmail?: string | null;
  assignedByUserId: string;
  assignedAt: string;
};

export const listCashRegisterAssignments = (cashRegisterId: string) =>
  apiClient<CashRegisterAssignment[]>(
    `/finance/cash-registers/${cashRegisterId}/assignments`
  );

export const assignCashRegisterUser = (
  cashRegisterId: string,
  userId: string
) =>
  apiClient<CashRegisterAssignment>(
    `/finance/cash-registers/${cashRegisterId}/assignments`,
    {
      method: "POST",
      body: JSON.stringify({ userId }),
    }
  );

export const unassignCashRegisterUser = (
  cashRegisterId: string,
  userId: string
) =>
  apiClient<{
    id: string;
    cashRegisterId: string;
    userId: string;
    unassignedByUserId: string | null;
    unassignedAt: string | null;
  }>(`/finance/cash-registers/${cashRegisterId}/assignments/${userId}/unassign`, {
    method: "PATCH",
  });
