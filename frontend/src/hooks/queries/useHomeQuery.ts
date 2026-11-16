import { useQuery } from '@tanstack/react-query';
import { api } from '../../utils/api';

export const HOME_QUERY_KEYS = {
  all: ['home'] as const,
  pendingRendiciones: ['home', 'pending-rendiciones'] as const,
  weeklySchedule: ['home', 'weekly-schedule'] as const,
};

export function usePendingRendicionesQuery() {
  return useQuery({
    queryKey: HOME_QUERY_KEYS.pendingRendiciones,
    queryFn: () => api.getPendingRendiciones(),
    staleTime: 30_000,
  });
}

export function useWeeklyScheduleQuery() {
  return useQuery({
    queryKey: HOME_QUERY_KEYS.weeklySchedule,
    queryFn: () => api.getWeeklySchedule(),
    staleTime: 120_000,
  });
}
