import { apiClient } from "../../../lib/http";

export type SupplierResponse = {
  id: string;
  tenantId: string;
  name: string;
  documentNumber: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  departamentoId: string | null;
  municipioId: string | null;
  ciudad: string | null;
  departamento: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateSupplierPayload = {
  name: string;
  documentNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  departamentoId?: string | null;
  municipioId?: string | null;
  ciudad?: string | null;
  departamento?: string | null;
  isActive?: boolean;
};

export type UpdateSupplierPayload = Partial<CreateSupplierPayload>;

export const getSuppliers = (headers?: HeadersInit) =>
  apiClient<SupplierResponse[]>("/suppliers", { headers });

export const getSupplierById = (supplierId: string, headers?: HeadersInit) =>
  apiClient<SupplierResponse>(`/suppliers/${supplierId}`, { headers });

export const createSupplier = (
  payload: CreateSupplierPayload,
  headers?: HeadersInit
) =>
  apiClient<SupplierResponse>("/suppliers", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const updateSupplier = (
  supplierId: string,
  payload: UpdateSupplierPayload,
  headers?: HeadersInit
) =>
  apiClient<SupplierResponse>(`/suppliers/${supplierId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });

export const deleteSupplier = (supplierId: string, headers?: HeadersInit) =>
  apiClient<SupplierResponse>(`/suppliers/${supplierId}`, {
    method: "DELETE",
    headers,
  });
