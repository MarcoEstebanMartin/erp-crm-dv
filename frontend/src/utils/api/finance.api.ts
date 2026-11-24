import { API_BASE_URL, request } from './httpClient';

export const financeApi = {
  // --- FINANZAS (CAJAS Y BANCOS) ---
  openDrawer: async (branch: string, openingBalance: number, targetUserId?: number, drawerType?: string, routeNote?: string, notes?: string) => {    
    const res = await request('/finance/drawers/open', {
      method: 'POST',
      body: JSON.stringify({ branch, openingBalance, userId: targetUserId, drawerType, routeNote, notes })
    });
    return res.drawer;
  },

  closeDrawer: async (drawerId: number, realBalance: number, receipts?: any[], checks?: any[], routeNote?: string, notes?: string) => {    
    const res = await request('/finance/drawers/close', {
      method: 'POST',
      body: JSON.stringify({ drawerId, realBalance, receipts, checks, routeNote, notes })
    });
    return res.drawer;
  },

  getActiveDrawer: async () => {    
    

    try {
      const res = await request('/finance/drawers/active');
      return res.drawer;
    } catch {
      return null;
    }
  },

  getActiveDrawers: async () => {    
    

    try {
      const res = await request('/finance/drawers/active-all');
      return res.drawers || [];
    } catch {
      return [];
    }
  },

  closeJointDrawers: async (payload: { realBalanceA: number; realBalanceX: number }) => {    

    const res = await request('/finance/drawers/close-joint', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res.data;
  },

  getBankAccounts: async () => {
    
    const res = await request('/finance/bank-accounts');
    return res.accounts;
  },

  createBankAccount: async (bankData: any) => {    
    const res = await request('/finance/bank-accounts', {
      method: 'POST',
      body: JSON.stringify(bankData)
    });
    return res.account;
  },

  updateBankAccount: async (id: number, bankData: { name: string; accountNumber?: string }) => {
    const res = await request(`/finance/bank-accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(bankData)
    });
    return res.data?.account || res.account;
  },

  transferFunds: async (amount: number, bankAccountId: number, description?: string) => {    
    const res = await request('/finance/bank-accounts/transfer', {
      method: 'POST',
      body: JSON.stringify({ amount, bankAccountId, description })
    });
    return res;
  },

  closeCentralDrawer: async (realBalance: number, notes?: string) => {
    const res = await request('/finance/central-drawer/close', {
      method: 'POST',
      body: JSON.stringify({ realBalance, notes })
    });
    return res;
  },

  getTransactions: async (filters?: any) => {
    

    let path = '/finance/transactions';
    if (filters) {
      const params = [];
      if (filters.branch) params.push(`branch=${filters.branch}`);
      if (filters.cashDrawerId) params.push(`cashDrawerId=${filters.cashDrawerId}`);
      if (filters.bankAccountId) params.push(`bankAccountId=${filters.bankAccountId}`);
      if (filters.paymentMethod) params.push(`paymentMethod=${filters.paymentMethod}`);
      if (filters.verified !== undefined) params.push(`verified=${filters.verified}`);
      if (params.length > 0) path += `?${params.join('&')}`;
    }

    const res = await request(path);
    return res.transactions;
  },

  createExpense: async (
    amount: number,
    description: string,
    paymentMethod: string,
    billingType: string,
    cashSource: 'CAJA_GRANDE' | 'CAJA_OFICINA' = 'CAJA_GRANDE',
  ) => {
    return await request('/finance/expenses', {
      method: 'POST',
      body: JSON.stringify({ amount, description, paymentMethod, billingType, cashSource })
    });
  },

  // --- NUEVAS APIS DE GASTOS DETALLADOS ---
  getExpenseCategories: async () => {
    const res = await request('/expenses/categories');
    return res?.data?.categories || res?.categories || [];
  },

  createExpenseCategory: async (name: string, description?: string) => {
    return await request('/expenses/categories', {
      method: 'POST',
      body: JSON.stringify({ name, description })
    });
  },

  getExpensesList: async (filters: { categoryId?: number; year?: number; month?: number; paymentMethod?: string; startDate?: string; endDate?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.categoryId) params.append('categoryId', String(filters.categoryId));
    if (filters.year) params.append('year', String(filters.year));
    if (filters.month) params.append('month', String(filters.month));
    if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    
    const res = await request(`/expenses?${params.toString()}`);
    return res?.data?.expenses || res?.expenses || [];
  },

  getExpensePeriods: async () => {
    const res = await request('/expenses/periods');
    return res?.data?.periods || [];
  },

  createExpenseNew: async (data: { amount: number; categoryId: number; description: string; date?: string; paymentMethod: string; affectFinance?: boolean; cashSource?: 'CAJA_GRANDE' | 'CAJA_OFICINA'; cashDrawerId?: number; bankAccountId?: number; vehicleId?: number; billingType?: string }) => {
    return await request('/expenses', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateExpenseNew: async (id: number, data: { amount?: number; description?: string; categoryId?: number; date?: string }) => {
    const res = await request(`/expenses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    return res?.data?.expense || res?.expense || res;
  },

  createBulkExpenses: async (data: { expenses: Array<{ amount: number; categoryId: number; description: string; date?: string; paymentMethod?: string; cashDrawerId?: number; bankAccountId?: number; vehicleId?: number; billingType?: string }>; targetDate?: string }) => {
    return await request('/expenses/bulk', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  deleteExpenseNew: async (id: number) => {
    return await request(`/expenses/${id}`, {
      method: 'DELETE'
    });
  },

  importExpensesExcel: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/expenses/import`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    
    const json = await response.json();
    if (json.status === 'error') {
      throw new Error(json.message);
    }
    return json.data;
  },

  getCashDrawers: async (params?: { limit?: number; offset?: number; startDate?: string; endDate?: string }) => {
    try {
      const qs = new URLSearchParams();
      if (params?.limit !== undefined) qs.set('limit', String(params.limit));
      if (params?.offset !== undefined) qs.set('offset', String(params.offset));
      if (params?.startDate) qs.set('startDate', params.startDate);
      if (params?.endDate) qs.set('endDate', params.endDate);
      const queryStr = qs.toString();
      const res = await request(`/finance/drawers/history${queryStr ? `?${queryStr}` : ''}`);
      return res.drawers || [];
    } catch {
      return [];
    }
  },

  verifyTransaction: async (id: number, verified: boolean, adjustedAmount?: number, bankAccountId?: number) => {
    const res = await request(`/finance/transactions/${id}/verify`, {
      method: 'PUT',
      body: JSON.stringify({ verified, adjustedAmount, bankAccountId })
    });
    return res;
  },

  getProductByBarcode: async (barcode: string) => {
    
    const res = await request(`/products/barcode/${barcode}`);
    return res.product;
  },

  importPrices: async (rows: any[]) => {    

    const res = await request('/products/import-prices', {
      method: 'POST',
      body: JSON.stringify({ products: rows })
    });
    return res.data;
  },

  getRubros: async () => {
    
    const res = await request('/rubros');
    return res.rubros;
  },

  createRubro: async (rubroData: { name: string; description?: string; profitMargin?: number; pickingZone?: string }) => {    
    const res = await request('/rubros', {
      method: 'POST',
      body: JSON.stringify(rubroData)
    });
    return res.rubro;
  },

  updateRubro: async (id: number, rubroData: { name?: string; description?: string; profitMargin?: number; pickingZone?: string }) => {    
    const res = await request(`/rubros/${id}`, {
      method: 'PUT',
      body: JSON.stringify(rubroData)
    });
    return res.rubro;
  },

  deleteRubro: async (id: number) => {    
    const res = await request(`/rubros/${id}`, {
      method: 'DELETE'
    });
    return res;
  },

  bulkUpdatePrices: async (params: {
    rubroId?: number | null;
    providerId?: number | null;
    type: 'margin' | 'percentage' | 'fixed';
    basis?: 'cost' | 'current';
    value: number;
    priceList: 'all' | 'listPrice' | 'listPriceB' | 'listPriceC';
  }) => {    

    const res = await request('/products/bulk-update-prices', {
      method: 'POST',
      body: JSON.stringify(params)
    });
    return res;
  }
};
