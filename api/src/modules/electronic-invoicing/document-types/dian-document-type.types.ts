export type DianDocumentType = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  countryCode: string;
  isActive: boolean;
  validFrom: Date | null;
  validTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
