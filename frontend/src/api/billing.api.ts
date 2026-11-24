import { apiClient } from './apiClient';

export interface SalesInvoicesQuery {
  startDate?: string;
  endDate?: string;
  query?: string;
  billingType?: string;
}

export interface EligibleOrderItemSummary {
  productId: number;
  name: string;
  sku: string;
  isPesable: boolean;
  approximateWeight: number;
  orderQuantity: number;
  alreadyReturnedQuantity: number;
  remainingReturnableQuantity: number;
  orderWeight: number | null;
  unitPrice: number;
  subtotal: number;
}

export interface EligibleOrderForCreditNote {
  id: number;
  invoiceNumber: string | null;
  invoiceType: string;
  billingType: 'OFFICIAL' | 'INTERNAL';
  cae: string | null;
  createdAt: string;
  invoicedAt: string | null;
  totalAmount: number;
  alreadyCreditedAmount: number;
  remainingCreditableAmount: number;
  items: EligibleOrderItemSummary[];
}

export interface CreditNotesQuery {
  startDate?: string;
  endDate?: string;
  query?: string;
  status?: string;
  billingType?: string;
}

export interface TaxWithholdingsQuery {
  type?: string;
  taxType?: string;
  startDate?: string;
  endDate?: string;
  query?: string;
}

function buildSearchParams(entries: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    const clean = typeof value === 'string' ? value.trim() : '';
    if (clean) params.set(key, clean);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const billingApi = {
  async getSalesInvoices(filters?: SalesInvoicesQuery): Promise<any[]> {
    const qs = buildSearchParams({
      startDate: filters?.startDate,
      endDate: filters?.endDate,
      query: filters?.query,
      billingType: filters?.billingType && filters.billingType !== 'ALL' ? filters.billingType : undefined,
    });
    const res = await apiClient.get<{ status: string; data?: { invoices?: any[] }; invoices?: any[] }>(
      `/billing/sales${qs}`,
    );
    return res?.data?.invoices ?? res?.invoices ?? [];
  },

  async getCreditNotes(filters?: CreditNotesQuery): Promise<any[]> {
    const qs = buildSearchParams({
      startDate: filters?.startDate,
      endDate: filters?.endDate,
      query: filters?.query,
      status: filters?.status && filters.status !== 'ALL' ? filters.status : undefined,
      billingType: filters?.billingType && filters.billingType !== 'ALL' ? filters.billingType : undefined,
    });
    const res = await apiClient.get<{ status: string; data?: { creditNotes?: any[] }; creditNotes?: any[] }>(
      `/billing/credit-notes${qs}`,
    );
    return res?.data?.creditNotes ?? res?.creditNotes ?? [];
  },

  async getTaxWithholdings(filters?: TaxWithholdingsQuery): Promise<any[]> {
    const qs = buildSearchParams({
      type: filters?.type,
      taxType: filters?.taxType,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
      query: filters?.query,
    });
    const res = await apiClient.get<{ status: string; data?: { withholdings?: any[] }; withholdings?: any[] }>(
      `/billing/tax-withholdings${qs}`,
    );
    return res?.data?.withholdings ?? res?.withholdings ?? [];
  },

  async getEligibleOrdersForCreditNote(
    personaId: number,
    query?: string,
  ): Promise<EligibleOrderForCreditNote[]> {
    const qs = buildSearchParams({ query });
    const res = await apiClient.get<{
      status: string;
      data?: { orders?: EligibleOrderForCreditNote[] };
      orders?: EligibleOrderForCreditNote[];
    }>(`/billing/credit-notes/eligible-orders/${personaId}${qs}`);
    return res?.data?.orders ?? res?.orders ?? [];
  },

  async requestOrderCae(orderId: number): Promise<{ message?: string; data?: any }> {
    return apiClient.post<{ status: string; message?: string; data?: any }>(
      `/orders/${orderId}/request-cae`,
    );
  },
};
