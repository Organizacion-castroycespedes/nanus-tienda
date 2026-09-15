import {
  apiBlobClientWithBaseUrl,
  apiClientWithBaseUrl,
} from "../../../lib/http";
import type {
  CashAuditListDataset,
  CashClosingListDataset,
  CurrentShiftFilters,
  CurrentShiftResponse,
  CustomerOrdersStatusDataset,
  OrderSalesListDataset,
  PosSalesListDataset,
  PosSaleTicketPrintDataset,
  ElectronicInvoicePrintDataset,
  PurchasesListDataset,
  ReportFilters,
} from "../types";
import { normalizeFilters } from "../utils";

const reportsBaseUrl = process.env.NEXT_PUBLIC_REPORTS_API_BASE_URL;

const buildQuery = (filters: ReportFilters) => {
  const searchParams = new URLSearchParams();
  const normalized = normalizeFilters({
    tenantId: filters.tenantId,
    branchId: filters.branchId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    customerDocument: filters.customerDocument,
    customerName: filters.customerName,
    status: filters.status,
  });

  Object.entries(normalized).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

const buildCurrentShiftQuery = (filters: CurrentShiftFilters) => {
  const searchParams = new URLSearchParams();
  Object.entries({
    tenantId: filters.tenantId,
    branchId: filters.branchId,
    terminalId: filters.terminalId,
    cashRegisterId: filters.cashRegisterId,
    cashSessionId: filters.cashSessionId,
    tab: filters.tab,
    page: filters.page ? String(filters.page) : undefined,
    pageSize: filters.pageSize ? String(filters.pageSize) : undefined,
    search: filters.search,
  }).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

export const getPosSalesReport = (filters: ReportFilters) =>
  apiClientWithBaseUrl<PosSalesListDataset>(
    reportsBaseUrl,
    `/reports/pos-sales${buildQuery(filters)}`
  );

export const getPosSaleTicket = (saleId: string) =>
  apiBlobClientWithBaseUrl(reportsBaseUrl, `/reports/pos-sales/${saleId}/ticket`);

export const getPosSaleTicketPrintData = (saleId: string) =>
  apiClientWithBaseUrl<PosSaleTicketPrintDataset>(
    reportsBaseUrl,
    `/reports/pos-sales/${saleId}/ticket-data`
  );

export const getElectronicInvoice = (saleId: string) =>
  apiBlobClientWithBaseUrl(
    reportsBaseUrl,
    `/reports/pos-sales/${saleId}/electronic-invoice`
  );

export const getElectronicInvoicePrintData = (saleId: string) =>
  apiClientWithBaseUrl<ElectronicInvoicePrintDataset>(
    reportsBaseUrl,
    `/reports/pos-sales/${saleId}/electronic-invoice-data`
  );

export const getCashClosingsReport = (filters: ReportFilters) =>
  apiClientWithBaseUrl<CashClosingListDataset>(
    reportsBaseUrl,
    `/reports/cash-closings${buildQuery(filters)}`
  );

export const getCashClosingTicket = (cashSessionId: string) =>
  apiBlobClientWithBaseUrl(
    reportsBaseUrl,
    `/reports/cash-closings/${cashSessionId}/ticket`
  );

export const getCashAuditsReport = (filters: ReportFilters) =>
  apiClientWithBaseUrl<CashAuditListDataset>(
    reportsBaseUrl,
    `/reports/cash-audits${buildQuery(filters)}`
  );

export const getCashAuditTicket = (cashCountId: string) =>
  apiBlobClientWithBaseUrl(
    reportsBaseUrl,
    `/reports/cash-audits/${cashCountId}/ticket`
  );

export const getPurchasesReport = (filters: ReportFilters) =>
  apiClientWithBaseUrl<PurchasesListDataset>(
    reportsBaseUrl,
    `/reports/purchases${buildQuery(filters)}`
  );

export const getPurchaseTicket = (purchaseId: string) =>
  apiBlobClientWithBaseUrl(
    reportsBaseUrl,
    `/reports/purchases/${purchaseId}/ticket`
  );

export const getOrderSalesReport = (filters: ReportFilters) =>
  apiClientWithBaseUrl<OrderSalesListDataset>(
    reportsBaseUrl,
    `/reports/order-sales${buildQuery(filters)}`
  );

export const getOrderSaleTicket = (orderId: string) =>
  apiBlobClientWithBaseUrl(
    reportsBaseUrl,
    `/reports/order-sales/${orderId}/ticket`
  );

export const getCustomerOrdersStatusReport = (filters: ReportFilters) =>
  apiClientWithBaseUrl<CustomerOrdersStatusDataset>(
    reportsBaseUrl,
    `/reports/customers/orders-status${buildQuery(filters)}`
  );

export const getCurrentShiftReport = (filters: CurrentShiftFilters) =>
  apiClientWithBaseUrl<CurrentShiftResponse>(
    reportsBaseUrl,
    `/reports/current-shift${buildCurrentShiftQuery(filters)}`
  );
