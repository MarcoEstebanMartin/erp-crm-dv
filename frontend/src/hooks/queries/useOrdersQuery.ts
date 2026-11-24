import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { BillingType, OrderStatus } from '../../utils/types';

export interface OrdersPageParams {
  page?: number;
  limit?: number;
  statusGroup?: string;
  search?: string;
  billingType?: BillingType;
  status?: OrderStatus;
  deliveryMethod?: 'DELIVERY' | 'PICKUP';
  deliveryRouteId?: number | 'NONE';
  dispatchQueue?: boolean;
}

export const ORDERS_QUERY_KEYS = {
  all: ['orders'] as const,
  summary: ['orders', 'summary'] as const,
  page: (params: OrdersPageParams) => ['orders', 'page', params] as const,
};

export const PENDING_ROUTES_QUERY_KEY = ['logistics', 'pending-routes'] as const;

export function usePendingDeliveryRoutesQuery(enabled = true) {
  return useQuery({
    queryKey: PENDING_ROUTES_QUERY_KEY,
    queryFn: async () => {
      const routes = await api.getDeliveryRoutes({ status: 'PENDING' });
      return Array.isArray(routes) ? routes : [];
    },
    staleTime: 20_000,
    enabled,
  });
}

export function useOrders(billingType?: BillingType, status?: OrderStatus) {
  return useQuery({
    queryKey: ['orders', billingType, status],
    queryFn: async () => {
      const data = await api.getOrders(billingType, status, { page: 1, limit: 100 });
      return data || [];
    },
  });
}

export function useOrdersSummaryQuery(enabled = true) {
  return useQuery({
    queryKey: ORDERS_QUERY_KEYS.summary,
    queryFn: () => api.getOrdersSummary(),
    staleTime: 20_000,
    enabled,
  });
}

export function useOrdersPageQuery(params: OrdersPageParams, enabled = true) {
  return useQuery({
    queryKey: ORDERS_QUERY_KEYS.page(params),
    queryFn: () => api.getOrdersPage(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    enabled,
  });
}

export function useOrderDetails(orderId: number | null) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      return await api.getOrderById(orderId);
    },
    enabled: !!orderId,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderData: any) => {
      return await api.createOrder(orderData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: OrderStatus }) => {
      return await api.updateOrderStatus(orderId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
