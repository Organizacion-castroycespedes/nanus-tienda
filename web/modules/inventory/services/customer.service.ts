import { apiClient } from "../../../lib/http";

export type CustomerResponse = {
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

export type CreateCustomerPayload = {
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

export type UpdateCustomerPayload = Partial<CreateCustomerPayload>;

export const getCustomers = (headers?: HeadersInit) =>
  apiClient<CustomerResponse[]>("/customers", { headers });

export const getCustomerById = (customerId: string, headers?: HeadersInit) =>
  apiClient<CustomerResponse>(`/customers/${customerId}`, { headers });

export const createCustomer = (
  payload: CreateCustomerPayload,
  headers?: HeadersInit
) =>
  apiClient<CustomerResponse>("/customers", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const updateCustomer = (
  customerId: string,
  payload: UpdateCustomerPayload,
  headers?: HeadersInit
) =>
  apiClient<CustomerResponse>(`/customers/${customerId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });

export const deleteCustomer = (customerId: string, headers?: HeadersInit) =>
  apiClient<CustomerResponse>(`/customers/${customerId}`, {
    method: "DELETE",
    headers,
  });
