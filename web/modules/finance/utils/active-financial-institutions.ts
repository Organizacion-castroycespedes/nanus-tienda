import type { FinancialInstitution } from "../types";

type FinancialInstitutionLoader = (
  paymentMethodId?: string,
  active?: boolean | "all"
) => Promise<FinancialInstitution[]>;

export const loadActiveFinancialInstitutions = async (
  loader: FinancialInstitutionLoader
) => {
  const institutions = await loader(undefined, true);
  return institutions.filter((institution) => institution.active);
};

export const isActiveFinancialInstitutionAvailable = (
  institutions: FinancialInstitution[],
  financialInstitutionId: string
) =>
  institutions.some(
    (institution) => institution.id === financialInstitutionId && institution.active
  );
