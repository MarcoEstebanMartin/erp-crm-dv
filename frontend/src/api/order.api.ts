import { apiClient } from './apiClient';

export const orderApi = {
  getOrders: (params?: any) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiClient.get(`/orders${query}`);
  },

  getOrderById: (id: string | number) => {
    return apiClient.get(`/orders/${id}`);
  },

  createOrder: (data: any) => {
    return apiClient.post('/orders', data);
  },

  updateOrderStatus: (id: string | number, data: any) => {
    return apiClient.put(`/orders/${id}/status`, data);
  },

  invoiceOrder: (id: string | number, data: any) => {
    return apiClient.post(`/orders/${id}/invoice`, data);
  },

  updateOrderDelivery: (id: string | number, data: any) => {
    return apiClient.patch(`/orders/${id}/delivery`, data);
  },

  bulkUpdateOrdersDelivery: (data: any) => {
    return apiClient.post('/orders/bulk-delivery', data);
  },

  syncWebOrders: () => {
    return apiClient.post<{ status: string; data: any }>('/orders/sync-web', {});
  },

  getWebSyncStatus: () => {
    return apiClient.get<{ status: string; data: any }>('/orders/sync-web/status');
  },

  parseOrderWithAi: (data: {
    text?: string;
    audioBase64?: string;
    audioMimeType?: string;
    selectedClientId?: number;
  }) => {
    return apiClient.post<{
      status: string;
      data: {
        rawText: string;
        usedAi: boolean;
        detectedClient: { id: number; name: string; city: string | null; address: string | null } | null;
        clientQuery: string | null;
        clientCandidates: Array<{ id: number; name: string; city: string | null; address: string | null }>;
        items: Array<{
          productId: number;
          sku: string;
          productName: string;
          quantity: number;
          unitPrice: number;
          note?: string;
        }>;
        unmatchedLines: string[];
        orderNotes: string | null;
      };
    }>('/orders/ai-parse', data);
  },
};
