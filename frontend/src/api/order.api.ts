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
  }
};
