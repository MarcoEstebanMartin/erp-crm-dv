import { API_BASE_URL, request } from './httpClient';
import { BillingType, OrderStatus, PaymentMethod } from '../types';

export const ordersApi = {
  // --- PEDIDOS ---
  getOrders: async (
    billingType?: BillingType,
    status?: OrderStatus,
    options?: { pickingQueue?: boolean; page?: number; limit?: number },
  ) => {
    let path = '/orders';
    const params = [];
    if (billingType) params.push(`billingType=${billingType}`);
    if (status) params.push(`status=${status}`);
    if (options?.pickingQueue) params.push('pickingQueue=true');
    params.push(`page=${options?.page ?? 1}`);
    params.push(`limit=${options?.limit ?? 100}`);
    if (params.length > 0) path += `?${params.join('&')}`;

    const res = await request(path);
    return res.orders;
  },

  getOrdersSummary: async (): Promise<{
    recibidosCount: number;
    armadosCount: number;
    facturadosCount: number;
    enRepartoCount: number;
  }> => {
    return await request('/orders/summary');
  },

  getOrdersPage: async (params: {
    page?: number;
    limit?: number;
    statusGroup?: string;
    search?: string;
    billingType?: BillingType;
    status?: OrderStatus;
    deliveryMethod?: 'DELIVERY' | 'PICKUP';
    deliveryRouteId?: number | 'NONE';
    dispatchQueue?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.statusGroup && params.statusGroup !== 'ALL') qs.set('statusGroup', params.statusGroup);
    if (params.search && params.search.trim()) qs.set('search', params.search.trim());
    if (params.billingType) qs.set('billingType', params.billingType);
    if (params.status) qs.set('status', params.status);
    if (params.deliveryMethod) qs.set('deliveryMethod', params.deliveryMethod);
    if (params.deliveryRouteId !== undefined) qs.set('deliveryRouteId', String(params.deliveryRouteId));
    if (params.dispatchQueue) qs.set('dispatchQueue', 'true');
    const queryStr = qs.toString();
    const res = await request(`/orders${queryStr ? `?${queryStr}` : ''}`);
    return {
      orders: res.orders || [],
      pagination: res.pagination || {
        total: 0,
        page: params.page || 1,
        limit: params.limit || 50,
        totalPages: 1,
      },
    };
  },

  getOrderById: async (id: number) => {
    const res = await request(`/orders/${id}`);
    return res.order;
  },

  getTransactionById: async (id: number) => {
    const res = await request(`/finance/transactions/${id}`);
    return res.transaction;
  },

  createOrder: async (
    orderData: {
      clientId: number;
      salesChannel?: string;
      deliveryMethod?: 'DELIVERY' | 'PICKUP';
      deliveryRouteId?: number | null;
      items: { productId: number; quantity: number; isEmergencyOverride?: boolean }[];
      notes?: string;
    },
    options?: { idempotencyKey?: string }
  ) => {
    const { clientId, ...rest } = orderData;
    const res = await request('/orders', {
      method: 'POST',
      headers: options?.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined,
      body: JSON.stringify({ personaId: clientId, ...rest })
    });
    return res.order;
  },

  updateOrder: async (id: number, orderData: { items: { productId: number, quantity: number }[] }) => {    

    const res = await request(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(orderData)
    });
    return res.order;
  },

  invoiceOrder: async (
    id: number,
    billingType: BillingType,
    paymentMethod?: PaymentMethod,
    paymentDescription?: string,
    bankAccountId?: number,
    deferCae?: boolean,
    deliveryMethod?: 'DELIVERY' | 'PICKUP',
    markPickedUp?: boolean
  ) => {    
    const res = await request(`/orders/${id}/invoice`, {
      method: 'POST',
      body: JSON.stringify({
        billingType,
        paymentMethod,
        paymentDescription,
        bankAccountId,
        deferCae,
        deliveryMethod,
        markPickedUp,
      })
    });
    return res.order;
  },

  updateOrderDelivery: async (
    id: number,
    payload: {
      deliveryMethod: 'DELIVERY' | 'PICKUP';
      deliveryRouteId?: number | null;
      deliverySequence?: number | null;
      markPickedUp?: boolean;
      markDelivered?: boolean;
    }
  ) => {
    const res = await request(`/orders/${id}/delivery`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.order;
  },

  bulkUpdateOrdersDelivery: async (payload: {
    orderIds: number[];
    deliveryMethod: 'DELIVERY' | 'PICKUP';
    deliveryRouteId?: number | null;
  }) => {
    return await request('/orders/bulk-delivery', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  requestCaeForOrder: async (id: number) => {
    const res = await request(`/orders/${id}/request-cae`, {
      method: 'POST',
    });
    return res;
  },

  updateOrderWeights: async (id: number, items: { orderItemId: number; weight: number }[]) => {
    

    const res = await fetch(`${API_BASE_URL}/orders/${id}/weights`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || 'Error al actualizar pesos');
    }
    
    const data = await res.json();
    return data.data.order;
  },

  confirmOrderArmado: async (orderId: number, items: any[]) => {
    const res = await request(`/orders/${orderId}/confirm-armado`, {
      method: 'POST',
      body: JSON.stringify({ items })
    });
    return res;
  },

  updateOrderStatus: async (id: number, status: OrderStatus, lotAssignments?: any, bultosCount?: number, bultosDetails?: any) => {    

    const res = await request(`/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, lotAssignments, bultosCount, bultosDetails })
    });
    return res.order;
  }
};
