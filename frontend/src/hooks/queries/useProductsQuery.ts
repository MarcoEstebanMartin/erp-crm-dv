import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';

export function useProducts(search?: string) {
  return useQuery({
    queryKey: ['products', search],
    queryFn: async () => {
      const data = await api.getProducts(search);
      return data || [];
    },
  });
}

export function useRubros() {
  return useQuery({
    queryKey: ['rubros'],
    queryFn: async () => {
      const data = await api.getRubros();
      return data || [];
    },
  });
}

export function useUpdateProductStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, quantity, type, reason }: { productId: number; quantity: number; type: 'IN' | 'OUT' | 'ADJUSTMENT'; reason?: string }) => {
      return await api.adjustStock(productId, quantity, type, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
    },
  });
}
