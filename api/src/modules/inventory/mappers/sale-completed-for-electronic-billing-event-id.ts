export const buildSaleCompletedForElectronicBillingEventId = (
  tenantId: string,
  saleId: string,
) => `SALE_COMPLETED_FOR_ELECTRONIC_BILLING:${tenantId}:${saleId}`;
