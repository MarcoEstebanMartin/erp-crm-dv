import { API_BASE_URL, request } from './httpClient';
import { BillingType, PaymentMethod } from '../types';

export const billingLogisticsApi = {
  getSalesInvoices: async (filters?: any) => {
    

    let path = '/billing/sales';
    if (filters) {
      const params = [];
      if (filters.startDate) params.push(`startDate=${filters.startDate}`);
      if (filters.endDate) params.push(`endDate=${filters.endDate}`);
      if (filters.query) params.push(`query=${filters.query}`);
      if (params.length > 0) path += `?${params.join('&')}`;
    }
    const res = await request(path);
    return res.invoices;
  },

  getSupplierInvoices: async (filters?: any) => {
    

    let path = '/billing/purchases';
    if (filters) {
      const params = [];
      if (filters.startDate) params.push(`startDate=${filters.startDate}`);
      if (filters.endDate) params.push(`endDate=${filters.endDate}`);
      if (filters.query) params.push(`query=${filters.query}`);
      if (params.length > 0) path += `?${params.join('&')}`;
    }
    const res = await request(path);
    return res.invoices;
  },

  createSupplierInvoice: async (invoiceData: any) => {    

    const res = await request('/billing/purchases', {
      method: 'POST',
      body: JSON.stringify(invoiceData)
    });
    return res.invoice;
  },

  deleteSupplierInvoice: async (id: number) => {
    return await request(`/billing/purchases/${id}`, {
      method: 'DELETE'
    });
  },

  getCreditNotes: async (filters?: any) => {
    

    let path = '/billing/credit-notes';
    if (filters) {
      const params = [];
      if (filters.startDate) params.push(`startDate=${filters.startDate}`);
      if (filters.endDate) params.push(`endDate=${filters.endDate}`);
      if (filters.query) params.push(`query=${filters.query}`);
      if (filters.status) params.push(`status=${filters.status}`);
      if (params.length > 0) path += `?${params.join('&')}`;
    }
    const res = await request(path);
    return res.creditNotes;
  },

  getCreditNoteById: async (id: number) => {
    const res = await request(`/billing/credit-notes/${id}`);
    return res.creditNote;
  },

  createCreditNote: async (data: any) => {    

    const res = await request('/billing/credit-notes', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.creditNote;
  },

  approveCreditNote: async (id: number) => {
    const res = await request(`/billing/credit-notes/${id}/approve`, {
      method: 'POST'
    });
    return res.creditNote;
  },

  rejectCreditNote: async (id: number) => {
    const res = await request(`/billing/credit-notes/${id}/reject`, {
      method: 'POST'
    });
    return res.creditNote;
  },

  createDirectInvoice: async (payload: {
    personaId: number;
    billingType: string;
    deliveryMethod?: 'DELIVERY' | 'PICKUP';
    deliveryRouteId?: number | null;
    markDelivered?: boolean;
    paymentMethod?: string;
    cashDrawerId?: number;
    bankAccountId?: number;
    checkNumber?: string;
    checkIssuer?: string;
    checkAmount?: number;
    items: { productId: number; quantity: number }[];
  }) => {    

    const res = await request('/orders/direct', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res.order;
  },

  getTaxWithholdings: async (filters?: any) => {
    

    let path = '/billing/tax-withholdings';
    if (filters) {
      const params = [];
      if (filters.type) params.push(`type=${filters.type}`);
      if (filters.taxType) params.push(`taxType=${filters.taxType}`);
      if (filters.startDate) params.push(`startDate=${filters.startDate}`);
      if (filters.endDate) params.push(`endDate=${filters.endDate}`);
      if (params.length > 0) path += `?${params.join('&')}`;
    }
    const res = await request(path);
    return res.withholdings;
  },

  createTaxWithholding: async (withholdingData: any) => {    

    const res = await request('/billing/tax-withholdings', {
      method: 'POST',
      body: JSON.stringify(withholdingData)
    });
    return res.withholding;
  },

  getDeliveryRoutes: async (filters?: any) => {
    

    let path = '/logistics';
    if (filters && filters.status) path += `?status=${filters.status}`;
    const res = await request(path);
    return res.routes;
  },

  createDeliveryRoute: async (routeData: any) => {    

    const res = await request('/logistics', {
      method: 'POST',
      body: JSON.stringify(routeData)
    });
    return res.route;
  },

  updateDeliveryRoute: async (id: number, routeData: any) => {
    const res = await request(`/logistics/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(routeData),
    });
    return res.route;
  },

  updateRouteStatus: async (id: number, status: string) => {    

    const res = await request(`/logistics/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    return res.route;
  },

  transferRouteCustody: async (id: number, driverNotes?: string) => {
    const res = await request(`/logistics/${id}/custody`, {
      method: 'POST',
      body: JSON.stringify({ driverNotes })
    });
    return res.route;
  },

  recordRouteGpsPing: async (id: number, gpsData: { latitude: number; longitude: number; speed?: number | null; heading?: number | null }) => {
    const res = await request(`/logistics/${id}/gps`, {
      method: 'POST',
      body: JSON.stringify(gpsData)
    });
    return res;
  },

  getRouteGpsHistory: async (id: number) => {
    const res = await request(`/logistics/${id}/gps-history`);
    return res;
  },

  settleDeliveryRoute: async (id: number, settleData: { settlements: any[], cashDeclared: number, checksDeclared: number, transfersDeclared: number }) => {    

    const res = await request(`/logistics/${id}/settle`, {
      method: 'POST',
      body: JSON.stringify(settleData)
    });
    return res;
  },

  deleteDeliveryRoute: async (id: number) => {
    const res = await request(`/logistics/${id}`, {
      method: 'DELETE'
    });
    return res;
  },

  getLogisticsResources: async () => {
    const res = await request('/logistics/resources');
    return res;
  },

  getLogisticsLiveMap: async (date?: string) => {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await request(`/logistics/live-map${qs}`);
    return res;
  },

  getPurchaseOrders: async (filters?: any) => {
    

    let path = '/purchases';
    if (filters && filters.status) path += `?status=${filters.status}`;
    const res = await request(path);
    return res.orders;
  },

  createPurchaseOrder: async (orderData: any) => {    

    const res = await request('/purchases', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
    return res.order;
  },

  receivePurchaseOrder: async (
    id: number,
    payload: {
      invoiceNumber?: string;
      billingType?: string;
      invoiceType?: string;
      lotAssignments?: any;
      receivedQuantities?: Record<number, number>;
    },
  ) => {
    const res = await request(`/purchases/${id}/receive`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.order;
  },

  getCrmAlerts: async () => {
    

    const res = await request('/crm/alerts');
    return res.data;
  },

  uploadPurchaseDocument: async (file: File) => {
    
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/purchases/upload-document`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Error al procesar el documento');
    }
    return data.data;
  },



  confirmPurchaseDocument: async (payload: any) => {
    
    const res = await request('/purchases/confirm-document', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res.data;
  },

  getCollectionsSummary: async () => {
    return await request('/collections/summary');
  },

  getPendingRendiciones: async () => {
    return await request('/collections/rendiciones');
  },

  verifyRendicion: async (payload: { sellerId?: number; routeId?: number; realCash: number; realChecks: number; destinationDrawerId?: number; routeNote?: string; notes?: string }) => {
    return await request('/collections/rendiciones/verify', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  deleteReceipt: async (id: number) => {
    return await request(`/collections/receipt/${id}`, {
      method: 'DELETE'
    });
  },

  getPerceptions: async () => {
    return await request('/perceptions');
  },

  updatePerception: async (id: number, perceptionData: { name?: string; aliquot?: number; affectsIvaBook?: boolean; jurisdiction?: string | null }) => {
    return await request(`/perceptions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(perceptionData)
    });
  }
};
