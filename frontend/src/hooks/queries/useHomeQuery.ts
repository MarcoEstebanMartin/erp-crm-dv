import { useQuery } from '@tanstack/react-query';
import { api } from '../../utils/api';

export const HOME_QUERY_KEYS = {
  all: ['home'] as const,
  pendingRendiciones: ['home', 'pending-rendiciones'] as const,
  weeklySchedule: ['home', 'weekly-schedule'] as const,
  weeklySales: (startDate: string, endDate: string) =>
    ['home', 'weekly-sales', startDate, endDate] as const,
  weeklyCitySales: (city: string, startDate: string, endDate: string) =>
    ['home', 'weekly-city-sales', city, startDate, endDate] as const,
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

export function useWeeklySalesQuery(startDate: string, endDate: string, enabled = true) {
  return useQuery({
    queryKey: HOME_QUERY_KEYS.weeklySales(startDate, endDate),
    queryFn: () => api.getFinancialReports({ startDate, endDate }),
    staleTime: 60_000,
    enabled: enabled && Boolean(startDate) && Boolean(endDate),
  });
}

export function useWeeklyCitySalesQuery(
  city: string | null,
  startDate: string,
  endDate: string,
  enabled = true,
) {
  return useQuery({
    queryKey: HOME_QUERY_KEYS.weeklyCitySales(city || '', startDate, endDate),
    queryFn: () => api.getCitySalesDetail({ city: city!, startDate, endDate }),
    staleTime: 60_000,
    enabled: enabled && Boolean(city) && Boolean(startDate) && Boolean(endDate),
  });
}
