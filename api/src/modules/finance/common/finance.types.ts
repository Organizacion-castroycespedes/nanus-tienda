export type FinanceActor = {
  userId: string;
  tenantId: string;
  roles: string[];
  sessionId?: string;
};

export type FinanceAuthRequest = {
  user?: {
    id?: string;
    tenantId?: string;
    roles?: string[];
    sessionId?: string;
  };
  financeActor?: FinanceActor;
};
