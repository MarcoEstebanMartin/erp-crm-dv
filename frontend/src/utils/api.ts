import { BillingType, OrderStatus, PaymentMethod } from './types';

// Usa ruta relativa para que funcione tanto en localhost, IP local y túneles externos (Ngrok/Localtunnel)
export const API_BASE_URL = '/api';

// Verificar si estamos en modo simulación
function getHeaders() {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

async function request(path: string, options: RequestInit = {}) {
  

  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers
    }
  });

  const json = await response.json();
  if (json.status === 'error') {
    const details = Array.isArray(json.errors)
      ? ': ' + json.errors.map((e: any) => `${e.field.replace('body.', '')} (${e.message})`).join(', ')
      : '';
    throw new Error(`${json.message}${details}`);
  }
  return json.data;
}

// Comprobar la conexión con el servidor
export async function testServerConnection(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.status === 200;
  } catch (e) {
    return false;
  }
}

// ==========================================================================
// INTERFAZ DE MÉTODOS DE LA API (Y SUS SIMULACIONES MOCK)
// ==========================================================================

export const api = {
  // --- AUTENTICACIÓN ---
  login: async (username: string, password: string) => {
    

    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    localStorage.setItem('auth_token', res.token);
    localStorage.setItem('auth_user', JSON.stringify(res.user));
    if (res.config) {
      localStorage.setItem('auth_config', JSON.stringify(res.config));
    }
    return res;
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_config');
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('auth_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  getMe: async () => {
    
    const token = localStorage.getItem('auth_token');
    if (!token) return null;
    try {
      const res = await request('/auth/me');
      if (res.data?.user) {
        localStorage.setItem('auth_user', JSON.stringify(res.data.user));
      }
      if (res.data?.config) {
        localStorage.setItem('auth_config', JSON.stringify(res.data.config));
      }
      return res.data?.user;
    } catch (e) {
      return null;
    }
  },

  getServerConfig: () => {
    const configStr = localStorage.getItem('auth_config');
    return configStr ? JSON.parse(configStr) : null;
  },

  updateServerConfig: async (config: { ignoreStockCheck?: boolean }) => {
    
    try {
      await request('/admin/config', {
        method: 'POST',
        body: JSON.stringify(config),
      });
      await api.getMe(); // Refrescar config
    } catch (error) {
      console.error('Error updating config', error);
      throw error;
    }
  },

  // --- PRODUCTOS e INVENTARIO ---
  getProducts: async (search?: string, all?: boolean) => {
    let url = '/products?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (all) url += `all=true&`;
    const res = await request(url);
    return res.products;
  },

  createProduct: async (productData: any) => {    
    const res = await request('/products', {
      method: 'POST',
      body: JSON.stringify(productData)
    });
    return res.product;
  },

  updateProduct: async (id: number, productData: any) => {    
    const res = await request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData)
    });
    return res.product;
  },

  uploadProductImage: async (productId: number, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/products/${productId}/image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    const json = await response.json();
    if (json.status === 'error') {
      throw new Error(json.message);
    }
    return json.product;
  },

  importProductsZip: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/products/import-images-zip`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    const json = await response.json();
    if (json.status === 'error') {
      throw new Error(json.message);
    }
    return json.data;
  },

  adjustStock: async (id: number, quantityChange: number, reason: string, lotNumber?: string, expirationDate?: string, location?: string) => {    
    const res = await request(`/products/${id}/adjust-stock`, {
      method: 'POST',
      body: JSON.stringify({ quantityChange, reason, lotNumber, expirationDate, location })
    });
    return res.product;
  },

  updateLot: async (lotId: number, lotData: { lotNumber?: string; expirationDate?: string; location?: string }) => {
    const res = await request(`/products/lots/${lotId}`, {
      method: 'PUT',
      body: JSON.stringify(lotData)
    });
    return res.lot;
  },

  deleteLot: async (lotId: number) => {
    const res = await request(`/products/lots/${lotId}`, {
      method: 'DELETE'
    });
    return res;
  },

  transferLotStock: async (productId: number, transferData: { fromLotId: number; toLotNumber: string; toExpirationDate?: string; quantity: number }) => {
    const res = await request(`/products/${productId}/lots/transfer`, {
      method: 'POST',
      body: JSON.stringify(transferData)
    });
    return res.data;
  },

  getProductMovements: async (id: number) => {
    const res = await request(`/products/${id}/movements`);
    return res.movements;
  },

  getGlobalStockMovements: async () => {
    const res = await request('/products/stock/movements');
    return res.movements;
  },

  // --- PERSONAS ---
  getPersonas: async (role?: string, search?: string) => {    
    let path = '/personas';
    const params = [];
    if (role) params.push(`role=${role}`);
    if (search) params.push(`search=${search}`);
    if (params.length > 0) path += `?${params.join('&')}`;

    const res = await request(path);
    return res.personas;
  },

  getDebtorsReport: async () => {
    const res = await request('/personas/debtors-report');
    return res;
  },

  getClients: async (search?: string) => {
    return api.getPersonas('client', search);
  },

  getSellersList: async () => {
    const res = await request('/personas/sellers');
    return res.sellers;
  },

  getSellerProfileStats: async (id: number) => {
    const res = await request(`/personas/sellers/${id}/profile`);
    return res;
  },

  recordClientVisit: async (id: number, reason: string, notes?: string | null) => {
    const res = await request(`/personas/${id}/visit`, {
      method: 'POST',
      body: JSON.stringify({ reason, notes })
    });
    return res;
  },

  getAfipData: async (cuit: string) => {
    
    const res = await request(`/personas/afip/${cuit}`);
    return res;
  },


  createPersona: async (personaData: any) => {    
    const res = await request('/personas', {
      method: 'POST',
      body: JSON.stringify(personaData)
    });
    return res.persona;
  },

  createClient: async (clientData: any) => {
    return api.createPersona({ ...clientData, isClient: true });
  },

  updatePersona: async (id: number, personaData: any) => {    
    const res = await request(`/personas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(personaData)
    });
    return res.persona;
  },

  updateClient: async (id: number, clientData: any) => {
    return api.updatePersona(id, clientData);
  },

  deletePersona: async (id: number) => {
    return await request(`/personas/${id}`, {
      method: 'DELETE'
    });
  },

  registerPayment: async (personaId: number, paymentData: { amount: number, paymentMethod: string, description?: string, branch?: string, type?: string, supplierInvoiceId?: number, orderId?: number, bankAccountId?: number | null, retenciones?: { taxType: 'GANANCIAS' | 'IIBB', number: string, amount: number }[] }) => {    
    const res = await request(`/personas/${personaId}/payments`, {
      method: 'POST',
      body: JSON.stringify(paymentData)
    });
    return res;
  },

  getPersonaPendingInvoices: async (personaId: number) => {
    const res = await request(`/personas/${personaId}/pending-invoices`);
    return res;
  },

  getPersonaLedger: async (personaId: number) => {
    
    const res = await request(`/personas/${personaId}/ledger`);
    return res;
  },

  getClientLedger: async (clientId: number) => {
    const res = await api.getPersonaLedger(clientId);
    return { client: res.persona, ledger: res.ledger };
  },

  // --- PEDIDOS ---
  getOrders: async (billingType?: BillingType, status?: OrderStatus) => {    
    
    let path = '/orders';
    const params = [];
    if (billingType) params.push(`billingType=${billingType}`);
    if (status) params.push(`status=${status}`);
    if (params.length > 0) path += `?${params.join('&')}`;

    const res = await request(path);
    return res.orders;
  },

  getOrderById: async (id: number) => {
    const res = await request(`/orders/${id}`);
    return res.order;
  },

  getTransactionById: async (id: number) => {
    const res = await request(`/finance/transactions/${id}`);
    return res.transaction;
  },

  createOrder: async (orderData: { clientId: number, items: { productId: number, quantity: number }[], notes?: string }) => {    
    const { clientId, ...rest } = orderData;
    const res = await request('/orders', {
      method: 'POST',
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

  invoiceOrder: async (id: number, billingType: BillingType, paymentMethod?: PaymentMethod, paymentDescription?: string, bankAccountId?: number) => {    

    const res = await request(`/orders/${id}/invoice`, {
      method: 'POST',
      body: JSON.stringify({ billingType, paymentMethod, paymentDescription, bankAccountId })
    });
    return res.order;
  },

  updateOrderWeights: async (id: number, items: { orderItemId: number; weight: number }[]) => {
    

    const res = await fetch(`${API_BASE_URL}/orders/${id}/weights`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
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
    return res.data;
  },

  updateOrderStatus: async (id: number, status: OrderStatus, lotAssignments?: any, bultosCount?: number, bultosDetails?: any) => {    

    const res = await request(`/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, lotAssignments, bultosCount, bultosDetails })
    });
    return res.order;
  },

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

  getFinancialReports: async (year?: number, month?: number) => {
    let path = '/admin/reports';
    if (year && month) {
      path += `?year=${year}&month=${month}`;
    }
    const res = await request(path);
    return res.report;
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

  getAuditLogs: async (page = 1, limit = 50) => {
    
    const res = await request(`/admin/audit-logs?page=${page}&limit=${limit}`);
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

  createUser: async (userData: any) => {    
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

  updateUser: async (id: number, userData: { username?: string; role?: string; password?: string }) => {
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
  },


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

  transferFunds: async (amount: number, bankAccountId: number, description?: string) => {    

    const res = await request('/finance/bank-accounts/transfer', {
      method: 'POST',
      body: JSON.stringify({ amount, bankAccountId, description })
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

  createExpense: async (amount: number, description: string, paymentMethod: string, billingType: string) => {
    return await request('/finance/expenses', {
      method: 'POST',
      body: JSON.stringify({ amount, description, paymentMethod, billingType })
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

  createExpenseNew: async (data: { amount: number; categoryId: number; description: string; date?: string; paymentMethod: string; cashDrawerId?: number; bankAccountId?: number; vehicleId?: number; billingType?: string }) => {
    return await request('/expenses', {
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
    
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/expenses/import`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const json = await response.json();
    if (json.status === 'error') {
      throw new Error(json.message);
    }
    return json.data;
  },

  getCashDrawers: async () => {
    
    try {
      const res = await request('/finance/drawers/history');
      return res.drawers || [];
    } catch {
      return [];
    }
  },

  verifyTransaction: async (id: number, verified: boolean, adjustedAmount?: number) => {
    const res = await request(`/finance/transactions/${id}/verify`, {
      method: 'PUT',
      body: JSON.stringify({ verified, adjustedAmount })
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
  },

  getSalesInvoices: async (filters?: any) => {
    

    let path = '/billing/sales';
    if (filters) {
      const params = [];
      if (filters.startDate) params.push(`startDate=${filters.startDate}`);
      if (filters.endDate) params.push(`endDate=${filters.endDate}`);
      if (filters.query) params.push(`query=${filters.query}`);
      if (params.length > 0) path += `?${params.join('&')}`;
    }
    const res = await request(path);
    return res.invoices;
  },

  getSupplierInvoices: async (filters?: any) => {
    

    let path = '/billing/purchases';
    if (filters) {
      const params = [];
      if (filters.startDate) params.push(`startDate=${filters.startDate}`);
      if (filters.endDate) params.push(`endDate=${filters.endDate}`);
      if (filters.query) params.push(`query=${filters.query}`);
      if (params.length > 0) path += `?${params.join('&')}`;
    }
    const res = await request(path);
    return res.invoices;
  },

  createSupplierInvoice: async (invoiceData: any) => {    

    const res = await request('/billing/purchases', {
      method: 'POST',
      body: JSON.stringify(invoiceData)
    });
    return res.invoice;
  },

  deleteSupplierInvoice: async (id: number) => {
    return await request(`/billing/purchases/${id}`, {
      method: 'DELETE'
    });
  },

  getCreditNotes: async (filters?: any) => {
    

    let path = '/billing/credit-notes';
    if (filters) {
      const params = [];
      if (filters.startDate) params.push(`startDate=${filters.startDate}`);
      if (filters.endDate) params.push(`endDate=${filters.endDate}`);
      if (filters.query) params.push(`query=${filters.query}`);
      if (filters.status) params.push(`status=${filters.status}`);
      if (params.length > 0) path += `?${params.join('&')}`;
    }
    const res = await request(path);
    return res.creditNotes;
  },

  getCreditNoteById: async (id: number) => {
    const res = await request(`/billing/credit-notes/${id}`);
    return res.creditNote;
  },

  createCreditNote: async (data: any) => {    

    const res = await request('/billing/credit-notes', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.creditNote;
  },

  approveCreditNote: async (id: number) => {
    const res = await request(`/billing/credit-notes/${id}/approve`, {
      method: 'POST'
    });
    return res.creditNote;
  },

  rejectCreditNote: async (id: number) => {
    const res = await request(`/billing/credit-notes/${id}/reject`, {
      method: 'POST'
    });
    return res.creditNote;
  },

  createDirectInvoice: async (payload: {
    personaId: number;
    billingType: string;
    paymentMethod?: string;
    bankAccountId?: number;
    checkNumber?: string;
    checkIssuer?: string;
    checkAmount?: number;
    items: { productId: number; quantity: number }[];
  }) => {    

    const res = await request('/orders/direct', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res.order;
  },

  getTaxWithholdings: async (filters?: any) => {
    

    let path = '/billing/tax-withholdings';
    if (filters) {
      const params = [];
      if (filters.type) params.push(`type=${filters.type}`);
      if (filters.taxType) params.push(`taxType=${filters.taxType}`);
      if (filters.startDate) params.push(`startDate=${filters.startDate}`);
      if (filters.endDate) params.push(`endDate=${filters.endDate}`);
      if (params.length > 0) path += `?${params.join('&')}`;
    }
    const res = await request(path);
    return res.withholdings;
  },

  createTaxWithholding: async (withholdingData: any) => {    

    const res = await request('/billing/tax-withholdings', {
      method: 'POST',
      body: JSON.stringify(withholdingData)
    });
    return res.withholding;
  },

  getDeliveryRoutes: async (filters?: any) => {
    

    let path = '/logistics';
    if (filters && filters.status) path += `?status=${filters.status}`;
    const res = await request(path);
    return res.routes;
  },

  createDeliveryRoute: async (routeData: any) => {    

    const res = await request('/logistics', {
      method: 'POST',
      body: JSON.stringify(routeData)
    });
    return res.route;
  },

  updateRouteStatus: async (id: number, status: string) => {    

    const res = await request(`/logistics/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    return res.route;
  },

  settleDeliveryRoute: async (id: number, settleData: { settlements: any[], cashDeclared: number, checksDeclared: number, transfersDeclared: number }) => {    

    const res = await request(`/logistics/${id}/settle`, {
      method: 'POST',
      body: JSON.stringify(settleData)
    });
    return res;
  },

  deleteDeliveryRoute: async (id: number) => {
    const res = await request(`/logistics/${id}`, {
      method: 'DELETE'
    });
    return res;
  },

  getLogisticsResources: async () => {
    const res = await request('/logistics/resources');
    return res;
  },

  getPurchaseOrders: async (filters?: any) => {
    

    let path = '/purchases';
    if (filters && filters.status) path += `?status=${filters.status}`;
    const res = await request(path);
    return res.orders;
  },

  createPurchaseOrder: async (orderData: any) => {    

    const res = await request('/purchases', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
    return res.order;
  },

  receivePurchaseOrder: async (id: number, payload: { invoiceNumber?: string, lotAssignments?: any }) => {    

    const res = await request(`/purchases/${id}/receive`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res.order;
  },

  getCrmAlerts: async () => {
    

    const res = await request('/crm/alerts');
    return res.data;
  },

  uploadPurchaseDocument: async (file: File) => {
    
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('auth_token');
    const headers = new Headers();
    if (token) {
      headers.append('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE_URL}/purchases/upload-document`, {
      method: 'POST',
      headers,
      body: formData
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Error al procesar el documento');
    }
    return data.data;
  },



  confirmPurchaseDocument: async (payload: any) => {
    
    const res = await request('/purchases/confirm-document', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res.data;
  },

  getPendingRendiciones: async () => {
    return await request('/collections/rendiciones');
  },

  verifyRendicion: async (payload: { sellerId?: number; routeId?: number; realCash: number; realChecks: number; destinationDrawerId?: number; routeNote?: string; notes?: string }) => {
    return await request('/collections/rendiciones/verify', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  getWeeklyReports: async () => {
    return await request('/admin/reports/weekly');
  },

  saveWeeklyReport: async (payload: { weekStart: string; purchases: any[]; sales: any[]; credit: number; buffer: number }) => {
    return await request('/admin/reports/weekly', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  deleteWeeklyReport: async (weekStart: string) => {
    return await request(`/admin/reports/weekly/${weekStart}`, {
      method: 'DELETE'
    });
  },

  getSuggestedCredit: async (weekStart: string) => {
    const res = await request(`/admin/reports/weekly/suggested-credit?weekStart=${encodeURIComponent(weekStart)}`);
    return res.suggested;
  },

  getAutofillSales: async (weekStart: string) => {
    return await request(`/admin/reports/weekly/autofill-sales?weekStart=${encodeURIComponent(weekStart)}`);
  },

  getPerceptions: async () => {
    return await request('/perceptions');
  },

  updatePerception: async (id: number, perceptionData: { name?: string; aliquot?: number; affectsIvaBook?: boolean; jurisdiction?: string | null }) => {
    return await request(`/perceptions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(perceptionData)
    });
  },

  // --- REGLAS DE PRECIOS & DESCUENTOS ---
  getPricingRules: async () => {
    return await request('/pricing/rules');
  },

  createDiscountRule: async (ruleData: { name: string; personaId?: number | null; priceList?: string | null; rubroId?: number | null; productId?: number | null; billingType?: string | null; discount: number }) => {
    return await request('/pricing/rules', {
      method: 'POST',
      body: JSON.stringify(ruleData)
    });
  },

  deleteDiscountRule: async (id: number) => {
    return await request(`/pricing/rules/${id}`, {
      method: 'DELETE'
    });
  },

  createSplitBillingConfig: async (configData: { personaId: number; rubroId: number; percentageOfficial?: number; percentageInternal?: number }) => {
    return await request('/pricing/split', {
      method: 'POST',
      body: JSON.stringify(configData)
    });
  },

  deleteSplitBillingConfig: async (id: number) => {
    return await request(`/pricing/split/${id}`, {
      method: 'DELETE'
    });
  },

  // --- RUTAS DE PREVENTA & VISITAS ---
  getSaleRoutes: async () => {
    return await request('/sale-routes');
  },

  getSellerSaleRoutes: async () => {
    return await request('/sale-routes/my-routes');
  },

  getSaleRouteById: async (id: number) => {
    return await request(`/sale-routes/${id}`);
  },

  createSaleRoute: async (routeData: { name: string; sellerId?: number | null; dayOfWeek?: string | null }) => {
    return await request('/sale-routes', {
      method: 'POST',
      body: JSON.stringify(routeData)
    });
  },

  updateSaleRoute: async (id: number, routeData: { name?: string; sellerId?: number | null; dayOfWeek?: string | null; isActive?: boolean }) => {
    return await request(`/sale-routes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(routeData)
    });
  },

  deleteSaleRoute: async (id: number) => {
    return await request(`/sale-routes/${id}`, {
      method: 'DELETE'
    });
  },

  updateClientSequence: async (id: number, clientIds: number[]) => {
    return await request(`/sale-routes/${id}/sequence`, {
      method: 'PUT',
      body: JSON.stringify({ clientIds })
    });
  },

  addClientToRoute: async (id: number, clientId: number) => {
    return await request(`/sale-routes/${id}/clients`, {
      method: 'POST',
      body: JSON.stringify({ clientId })
    });
  },

  recordRouteVisit: async (id: number, visitData: { personaId: number; status: 'ORDERED' | 'NO_BUY'; noBuyReason?: string | null; notes?: string | null; latitude?: number | null; longitude?: number | null }) => {
    return await request(`/sale-routes/${id}/visit`, {
      method: 'POST',
      body: JSON.stringify(visitData)
    });
  },

  getTodayVisits: async () => {
    return await request('/sale-routes/visits/today');
  },

  // --- FLOTA DE VEHÍCULOS ---
  getVehicles: async () => {
    const res = await request('/fleet');
    return res.vehicles;
  },

  createVehicle: async (data: any) => {
    return await request('/fleet', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateVehicle: async (id: number, data: any) => {
    return await request(`/fleet/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteVehicle: async (id: number) => {
    return await request(`/fleet/${id}`, {
      method: 'DELETE'
    });
  },

  createVehicleMaintenance: async (vehicleId: number, data: any) => {
    return await request(`/fleet/${vehicleId}/maintenances`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  deleteVehicleMaintenance: async (id: number) => {
    return await request(`/fleet/maintenances/${id}`, {
      method: 'DELETE'
    });
  },

  createVehicleExpiry: async (vehicleId: number, data: any) => {
    return await request(`/fleet/${vehicleId}/expirations`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  deleteVehicleExpiry: async (id: number) => {
    return await request(`/fleet/expirations/${id}`, {
      method: 'DELETE'
    });
  },

  // --- CONTROL DE COMBUSTIBLE DE FLOTA ---
  getFuelLogs: async (params?: { vehicleId?: number; startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams();
    if (params?.vehicleId) query.append('vehicleId', String(params.vehicleId));
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await request(`/fleet/fuel${queryString}`);
    return res.logs;
  },

  getFuelAnalytics: async () => {
    const res = await request('/fleet/fuel/analytics');
    return res;
  },

  createFuelLog: async (data: any) => {
    return await request('/fleet/fuel', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  deleteFuelLog: async (id: number) => {
    return await request(`/fleet/fuel/${id}`, {
      method: 'DELETE'
    });
  },

  createPerception: async (perceptionData: any) => {
    throw new Error('La creación de impuestos/percepciones no está disponible en la versión actual. Modifique un impuesto existente en su lugar.');
  },

  reconcileAllClientBalances: async () => {
    return await api.checkBalances();
  },

  recalculateAndFixClientBalance: async (personaId: number) => {
    return await api.syncBalances(personaId);
  },

  createSplitConfig: async (configData: any) => {
    return await api.createSplitBillingConfig(configData);
  },

  deleteSplitConfig: async (id: number) => {
    return await api.deleteSplitBillingConfig(id);
  },

  getCampaignSuggestions: async () => {
    const res = await request('/offers/suggestions');
    return res;
  },

  addBulkCampaignItems: async (campaignId: number, items: { productId: number, offerPrice: number, specialTag: string | null }[]) => {
    const res = await request(`/offers/${campaignId}/items/bulk`, {
      method: 'POST',
      body: JSON.stringify({ items })
    });
    return res;
  },

  // --- RECURSOS HUMANOS Y NOMINA (RRHH) ---
  getEmployees: async (filters?: { department?: string; position?: string; active?: boolean; search?: string }) => {
    const params = new URLSearchParams();
    if (filters?.department) params.append('department', filters.department);
    if (filters?.position) params.append('position', filters.position);
    if (filters?.active !== undefined) params.append('active', String(filters.active));
    if (filters?.search) params.append('search', filters.search);
    return await request(`/hr/employees?${params.toString()}`);
  },

  getEmployeeById: async (id: number) => {
    return await request(`/hr/employees/${id}`);
  },

  createEmployee: async (data: any) => {
    return await request('/hr/employees', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateEmployee: async (id: number, data: any) => {
    return await request(`/hr/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteEmployee: async (id: number) => {
    return await request(`/hr/employees/${id}`, {
      method: 'DELETE'
    });
  },

  getAdvances: async (filters?: { employeeId?: number; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.employeeId) params.append('employeeId', String(filters.employeeId));
    if (filters?.status) params.append('status', filters.status);
    return await request(`/hr/advances?${params.toString()}`);
  },

  createAdvance: async (data: { employeeId: number; amount: number; reason?: string; paymentMethod: string; cashDrawerId?: number; bankAccountId?: number }) => {
    return await request('/hr/advances', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  calculatePayroll: async (employeeId: number, periodMonth: number, periodYear: number) => {
    return await request(`/hr/payrolls/calculate?employeeId=${employeeId}&periodMonth=${periodMonth}&periodYear=${periodYear}`);
  },

  getPayrolls: async (filters?: { periodMonth?: number; periodYear?: number; employeeId?: number }) => {
    const params = new URLSearchParams();
    if (filters?.periodMonth) params.append('periodMonth', String(filters.periodMonth));
    if (filters?.periodYear) params.append('periodYear', String(filters.periodYear));
    if (filters?.employeeId) params.append('employeeId', String(filters.employeeId));
    return await request(`/hr/payrolls?${params.toString()}`);
  },

  createPayroll: async (data: any) => {
    return await request('/hr/payrolls', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getVacations: async (filters?: { employeeId?: number; year?: number; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.employeeId) params.append('employeeId', String(filters.employeeId));
    if (filters?.year) params.append('year', String(filters.year));
    if (filters?.status) params.append('status', filters.status);
    return await request(`/hr/vacations?${params.toString()}`);
  },

  createVacation: async (data: any) => {
    return await request('/hr/vacations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateVacationStatus: async (id: number, status: string) => {
    return await request(`/hr/vacations/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  getDocuments: async (filters?: { employeeId?: number }) => {
    const params = new URLSearchParams();
    if (filters?.employeeId) params.append('employeeId', String(filters.employeeId));
    return await request(`/hr/documents?${params.toString()}`);
  },

  createDocument: async (data: any) => {
    return await request('/hr/documents', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // --- WHATSAPP CRM ---
  getCrmConversations: async () => {
    return await request('/crm/whatsapp/conversations');
  },

  getCrmMessages: async (conversationId: number) => {
    return await request(`/crm/whatsapp/conversations/${conversationId}/messages`);
  },

  sendCrmMessage: async (data: { to: string; text: string; mediaUrl?: string; mediaType?: string }) => {
    return await request('/crm/whatsapp/send-message', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  parseCrmOrderDraft: async (conversationId: number, rawText: string) => {
    return await request(`/crm/whatsapp/conversations/${conversationId}/parse-order`, {
      method: 'POST',
      body: JSON.stringify({ rawText })
    });
  },

  approveCrmOrderDraft: async (draftId: number) => {
    return await request(`/crm/whatsapp/drafts/${draftId}/approve`, {
      method: 'POST'
    });
  },

  toggleCrmAutoReply: async (conversationId: number, enabled: boolean) => {
    return await request(`/crm/whatsapp/conversations/${conversationId}/auto-reply`, {
      method: 'PUT',
      body: JSON.stringify({ enabled })
    });
  },

  updateCrmStage: async (conversationId: number, stage: string) => {
    return await request(`/crm/whatsapp/conversations/${conversationId}/stage`, {
      method: 'PUT',
      body: JSON.stringify({ stage })
    });
  },

  linkCrmPersona: async (conversationId: number, personaId: number) => {
    return await request(`/crm/whatsapp/conversations/${conversationId}/link-persona`, {
      method: 'PUT',
      body: JSON.stringify({ personaId })
    });
  },

  sendCrmDeliveryNotification: async (orderId: number) => {
    return await request(`/crm/whatsapp/orders/${orderId}/notify-delivery`, {
      method: 'POST'
    });
  },

  simulateCrmIncomingMessage: async (data: { fromPhone: string; profileName?: string; text: string }) => {
    return await request('/crm/whatsapp/simulate-incoming', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  broadcastCrmCampaign: async (data: { campaignId: number; targetSegment: string; routeName?: string }) => {
    return await request('/crm/whatsapp/campaigns/broadcast', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getPersonaFromAFIP: async (cuit: string) => {
    return await request(`/personas/afip/${cuit}`);
  }
};


