export type ProductResponse = {
  id: string;
  tenantId: string;
  unitId: string;
  taxId: string | null;
  name: string;
  description: string | null;
  sku: string;
  price: number;
  cost: number;
  priceWithTax: number;
  priceWithoutTax: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stock?: number;
};
