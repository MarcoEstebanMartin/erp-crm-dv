import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';

export function useClients(role = 'CLIENT', search?: string) {
  return useQuery({
    queryKey: ['clients', role, search],
    queryFn: async () => {
      const data = await api.getPersonas(role, search);
      return data || [];
    },
  });
}

export function useSaleRoutes() {
  return useQuery({
    queryKey: ['sale-routes'],
    queryFn: async () => {
      const data = await api.getSaleRoutes();
      return data || [];
    },
  });
}

export function useSyncClientBalances() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (personaId?: number) => {
      return await api.syncBalances(personaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}
