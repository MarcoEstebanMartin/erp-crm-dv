import { type AuditLogQueryFilters, request } from './httpClient';

export interface CitySaleDetailItem {
  id: number;
  movementId: number;
  kind: 'ORDER' | 'CREDIT_NOTE';
  date: string;
  clientName: string;
  voucher: string;
  billingType: 'OFFICIAL' | 'INTERNAL';
  branch: 'A' | 'X';
  amount: number;
}

export interface CitySalesDetailResponse {
  city: string;
  summary: {
    official: number;
    internal: number;
    total: number;
    officialCount: number;
    internalCount: number;
    count: number;
    creditNotesCount: number;
  };
  items: CitySaleDetailItem[];
}

export const adminApi = {
  // --- ADMINISTRADOR ---
  getDocumentAuditLogs: async (entityType: string, entityId: number) => {
    const res = await request(`/admin/audit-logs/document/${entityType}/${entityId}`);
    return res.logs;
  },

  getProfitabilityReport: async (params?: {
    startDate?: string;
    endDate?: string;
    sellerId?: number;
    city?: string;
    rubroId?: number;
    billingType?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.sellerId) query.append('sellerId', String(params.sellerId));
    if (params?.city) query.append('city', params.city);
    if (params?.rubroId) query.append('rubroId', String(params.rubroId));
    if (params?.billingType) query.append('billingType', params.billingType);

    const queryString = query.toString();
    const url = `/admin/reports/profitability${queryString ? `?${queryString}` : ''}`;
    return await request(url);
  },

  getTripProfitabilityReport: async (params?: { startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    const queryString = query.toString();
    return await request(`/admin/reports/trips${queryString ? `?${queryString}` : ''}`);
  },

  updateRouteTripCosts: async (
    routeId: number,
    payload: { tripKm: number | null; tripExpenses: number },
  ) => {
    return await request(`/admin/reports/trips/${routeId}/costs`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  getExecutivePdfReport: async (startDate?: string, endDate?: string) => {
    const query = new URLSearchParams();
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);
    const queryString = query.toString();
    return await request(`/admin/reports/pdf/executive${queryString ? `?${queryString}` : ''}`);
  },

  getEmployeePdfReport: async (userId: number, startDate?: string, endDate?: string) => {
    const query = new URLSearchParams();
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);
    const queryString = query.toString();
    return await request(`/admin/reports/pdf/employee/${userId}${queryString ? `?${queryString}` : ''}`);
  },

  getSellerMeetingPdfReport: async (sellerId: number, startDate?: string, endDate?: string) => {
    const query = new URLSearchParams();
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);
    const queryString = query.toString();
    return await request(`/admin/reports/pdf/seller/${sellerId}${queryString ? `?${queryString}` : ''}`);
  },

  getFinancialReports: async (
    paramsOrYear?: number | { year?: number; month?: number; startDate?: string; endDate?: string },
    month?: number,
  ) => {
    const query = new URLSearchParams();
    if (typeof paramsOrYear === 'object' && paramsOrYear !== null) {
      if (paramsOrYear.year) query.set('year', String(paramsOrYear.year));
      if (paramsOrYear.month) query.set('month', String(paramsOrYear.month));
      if (paramsOrYear.startDate) query.set('startDate', paramsOrYear.startDate);
      if (paramsOrYear.endDate) query.set('endDate', paramsOrYear.endDate);
    } else if (paramsOrYear && month) {
      query.set('year', String(paramsOrYear));
      query.set('month', String(month));
    }
    const qs = query.toString();
    const res = await request(`/admin/reports${qs ? `?${qs}` : ''}`);
    return res.report;
  },

  getCitySalesDetail: async (params: {
    city: string;
    startDate?: string;
    endDate?: string;
  }): Promise<CitySalesDetailResponse> => {
    const query = new URLSearchParams();
    query.set('city', params.city);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const res = await request(`/admin/reports/city-sales?${query.toString()}`);
    return res.detail;
  },

  getZoneReports: async (filters: { city?: string; cities?: string[]; sellerId?: number; startDate?: string; endDate?: string } = {}) => {
    const params = [];
    if (filters.city) params.push(`city=${encodeURIComponent(filters.city)}`);
    if (filters.cities && filters.cities.length > 0) {
      params.push(`cities=${encodeURIComponent(filters.cities.join(','))}`);
    }
    if (filters.sellerId) params.push(`sellerId=${filters.sellerId}`);
    if (filters.startDate) params.push(`startDate=${encodeURIComponent(filters.startDate)}`);
    if (filters.endDate) params.push(`endDate=${encodeURIComponent(filters.endDate)}`);
    const query = params.length > 0 ? `?${params.join('&')}` : '';
    
    return await request(`/admin/reports/zones${query}`);
  },

  getCommercialOpportunities: async (filters?: {
    stagnantDays?: 30 | 45 | 60;
    expiringDays?: 30 | 60;
  }) => {
    const params = new URLSearchParams();
    if (filters?.stagnantDays) params.set('stagnantDays', String(filters.stagnantDays));
    if (filters?.expiringDays) params.set('expiringDays', String(filters.expiringDays));
    const qs = params.toString();
    const res = await request(`/admin/reports/opportunities${qs ? `?${qs}` : ''}`);
    return res.data?.report;
  },

  getWeeklyPulse: async (weekStart?: string) => {
    const qs = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : '';
    const res = await request(`/admin/reports/weekly-pulse${qs}`);
    return res.pulse;
  },

  saveWeeklyPulse: async (payload: {
    weekStart: string;
    resultBuffer: number;
    manualOpeningCredit?: number | null;
    manualPurchases: Array<{ id: string; company: string; date: string; amount: number }>;
    manualSales: Array<{ id: string; locality: string; date: string; amountA: number; amountX: number }>;
    excludedSourceKeys: string[];
  }) => {
    const res = await request('/admin/reports/weekly-pulse', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.pulse;
  },

  getAuditLogs: async (page = 1, limit = 50, filters?: AuditLogQueryFilters) => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (filters?.search?.trim()) params.set('search', filters.search.trim());
    if (filters?.userId !== undefined && filters?.userId !== '') params.set('userId', String(filters.userId));
    if (filters?.module) params.set('module', filters.module);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate) params.set('endDate', filters.endDate);

    const res = await request(`/admin/audit-logs?${params.toString()}`);
    return res;
  },

  checkBalances: async () => {
    return await request('/admin/reconcile/check');
  },

  syncBalances: async (personaId?: number) => {
    return await request('/admin/reconcile/sync', {
      method: 'POST',
      body: JSON.stringify({ personaId })
    });
  },

  getExpiringLots: async () => {
    return await request('/products/stock/expiring-lots');
  },

  getUsers: async () => {
    
    const res = await request('/admin/users');
    return res.users;
  },

  createUser: async (userData: {
    username: string;
    password?: string;
    role: string;
    permissions?: { canDeliver?: boolean; canPick?: boolean } | null;
  }) => {
    const res = await request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    return res.user;
  },

  toggleUserStatus: async (id: number) => {    
    const res = await request(`/admin/users/${id}/toggle`, {
      method: 'POST'
    });
    return res.user;
  },

  updateUser: async (
    id: number,
    userData: {
      username?: string;
      role?: string;
      password?: string;
      permissions?: { canDeliver?: boolean; canPick?: boolean } | null;
    },
  ) => {
    const res = await request(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
    return res.user;
  },

  deleteUser: async (username: string) => {
    const res = await request(`/admin/users/${encodeURIComponent(username)}`, {
      method: 'DELETE'
    });
    return res;
  }
};
