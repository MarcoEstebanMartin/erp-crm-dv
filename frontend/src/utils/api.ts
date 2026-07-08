import { BillingType, InvoiceType, OrderStatus, TransactionType, PaymentMethod } from './types';
import rawClients from './clients_data.json';
import rawProducts from './products_data.json';

// Detecta dinámicamente el host para que funcione en localhost y desde el celular en la red local
export const API_BASE_URL = `http://${window.location.hostname}:3000/api`;

// Verificar si estamos en modo simulación
let simulationMode = localStorage.getItem('simulation_mode') === 'true';

export function setSimulationMode(active: boolean) {
  simulationMode = active;
  localStorage.setItem('simulation_mode', String(active));
  if (active) {
    initMockDatabase();
  }
}

export function isSimulationMode() {
  return simulationMode;
}

// ==========================================================================
// BASE DE DATOS MOCK (LOCAL STORAGE) PARA MODO SIMULACIÓN
// ==========================================================================
function initMockDatabase() {
  const categoriesList = [
    { id: 1, name: 'REMOTTI', description: 'Productos de marca Remotti / Melincue' },
    { id: 2, name: 'LECHES', description: 'Leches líquidas, en polvo, chocolatadas y yogur' },
    { id: 3, name: 'SANCOR y CREMIGAL', description: 'Cremas, mantecas, dulce de leche y quesos untables' },
    { id: 4, name: 'QUESOS RALLADOS', description: 'Quesos rallados' },
    { id: 5, name: 'SODECAR', description: 'Fiambres y chacinados Sodecar' },
    { id: 6, name: 'CONSERVAS', description: 'Conservas de todo tipo' },
    { id: 7, name: 'A.G.D Y NIZA', description: 'Aceites, vinagres y aderezos' },
    { id: 8, name: 'CAFE', description: 'Café, cacao y té' },
    { id: 9, name: 'ARROZ', description: 'Arroz' },
    { id: 10, name: 'YERBAS', description: 'Yerbas' },
    { id: 11, name: 'AZUCAR', description: 'Azúcar' },
    { id: 12, name: 'EDULCORANTES', description: 'Edulcorantes' },
    { id: 13, name: 'PESCADERIA', description: 'Conservas de pescado y mariscos' },
    { id: 14, name: 'PASTAS SECAS', description: 'Fideos y pastas secas' },
    { id: 15, name: 'PAPELES', description: 'Papel higiénico y rollos de cocina' },
    { id: 16, name: 'REGALERIA', description: 'Regalería' },
    { id: 17, name: 'BEBIDAS', description: 'Bebidas con y sin alcohol, gaseosas, aguas, vinos' },
    { id: 18, name: 'NO COMESTIBLES', description: 'Artículos de limpieza y bazar no comestibles' },
    { id: 19, name: 'OTROS', description: 'Otros productos no categorizados' }
  ];

  const dbVersion = localStorage.getItem('db_version');
  let forceReload = false;
  if (dbVersion !== '1.1') {
    forceReload = true;
    localStorage.setItem('db_version', '1.1');
  }

  // Migración para forzar recarga de los nuevos clientes reales y vendedores (Fase 5)
  const personasInStorage = localStorage.getItem('db_personas');
  if (personasInStorage && !forceReload) {
    try {
      const list = JSON.parse(personasInStorage);
      if (list.length < 100) {
        forceReload = true;
      }
    } catch (e) {
      forceReload = true;
    }
  } else {
    forceReload = true;
  }

  const rubrosInStorage = localStorage.getItem('db_rubros');
  if (rubrosInStorage) {
    try {
      const list = JSON.parse(rubrosInStorage);
      const isMismatched = list.length !== categoriesList.length || 
        list.some((r: any) => {
          const matching = categoriesList.find(c => c.name === r.name);
          return !matching || Number(matching.id) !== Number(r.id);
        });
      if (isMismatched || list.some((r: any) => /^\d/.test(r.name))) {
        forceReload = true;
      }
    } catch (e) {
      forceReload = true;
    }
  } else {
    forceReload = true;
  }

  const productsInStorage = localStorage.getItem('db_products');
  if (productsInStorage) {
    try {
      const list = JSON.parse(productsInStorage);
      let changed = false;
      const sanitized = list.map((p: any) => {
        if (p.rubroId !== undefined && p.rubroId !== null && typeof p.rubroId === 'string') {
          p.rubroId = Number(p.rubroId);
          changed = true;
        }
        if (p.providerId !== undefined && p.providerId !== null && typeof p.providerId === 'string') {
          p.providerId = Number(p.providerId);
          changed = true;
        }
        return p;
      });
      if (changed) {
        localStorage.setItem('db_products', JSON.stringify(sanitized));
      }
      if (list.length < 100 || list.some((p: any) => p.rubroId === undefined || p.rubro === undefined)) {
        localStorage.removeItem('db_products');
        localStorage.removeItem('db_product_lots');
        forceReload = true;
      }
    } catch (e) {
      localStorage.removeItem('db_products');
      localStorage.removeItem('db_product_lots');
      forceReload = true;
    }
  } else {
    forceReload = true;
  }

  if (forceReload) {
    localStorage.removeItem('db_users');
    localStorage.removeItem('db_personas');
    localStorage.removeItem('db_orders');
    localStorage.removeItem('db_cash_drawers');
    localStorage.removeItem('db_transactions');
    localStorage.removeItem('db_rubros');
    localStorage.removeItem('db_products');
    localStorage.removeItem('db_product_lots');
    localStorage.removeItem('db_bank_accounts');
    localStorage.removeItem('db_supplier_invoices');
    localStorage.removeItem('db_credit_notes');
  }

  if (!localStorage.getItem('db_users')) {
    localStorage.setItem('db_users', JSON.stringify([
      { id: 1, username: 'admin', role: 'ADMIN', isActive: true },
      { id: 2, username: 'diego', role: 'VENDEDOR', isActive: true },
      { id: 3, username: 'fabian', role: 'VENDEDOR', isActive: true },
      { id: 4, username: 'norberto', role: 'VENDEDOR', isActive: true },
      { id: 5, username: 'maria_jose', role: 'VENDEDOR', isActive: true },
      { id: 6, username: 'dario', role: 'ADMIN', isActive: true },
      { id: 7, username: 'agustin', role: 'ADMIN', isActive: true },
      { id: 8, username: 'miguel', role: 'DEPOSITO', isActive: true },
      { id: 9, username: 'matias', role: 'DEPOSITO', isActive: true },
      { id: 10, username: 'thiago', role: 'DEPOSITO', isActive: true },
      { id: 11, username: 'rocio', role: 'DEPOSITO', isActive: true }
    ]));
  }

  if (!localStorage.getItem('db_personas')) {
    const sellerMap: { [key: string]: number } = {
      'Diego': 2,
      'Fabian': 3,
      'Norberto': 4,
      'Maria Jose': 5
    };

    const seededPersonas = rawClients.map((c: any) => {
      const sellerId = c.sellerName ? sellerMap[c.sellerName] : null;
      return {
        id: c.id,
        name: c.name,
        cuit: c.cuit,
        address: c.address,
        city: c.city,
        phone: c.phone,
        email: c.email,
        sellerId: sellerId,
        creditLimit: c.creditLimit,
        outstandingBalance: c.outstandingBalance,
        priceList: c.priceList,
        discount: c.discount,
        contacts: [],
        isClient: c.isClient,
        isProvider: c.isProvider,
        isSeller: c.isSeller,
        isCommissionAgent: c.isCommissionAgent,
        iibbAliquot: 0.00
      };
    });

    // Add default providers
    seededPersonas.push(
      { id: 1, name: 'Cervecería Quilmes S.A.', cuit: '30-50001000-4', address: 'Av. 12 de Octubre 3300, Quilmes', city: 'Quilmes', phone: '0800-222-7456', email: 'proveedores@quilmes.com.ar', sellerId: null, creditLimit: 0.00, outstandingBalance: -50000.00, priceList: 'A', discount: 0.00, contacts: [], isClient: false, isProvider: true, isSeller: false, isCommissionAgent: false, iibbAliquot: 0.00 },
      { id: 2, name: 'Coca Cola Andina', cuit: '30-60002000-8', address: 'Ruta 9 Km 4.5, Córdoba', city: 'Córdoba', phone: '0800-888-2622', email: 'contacto@coca-cola.com.ar', sellerId: null, creditLimit: 0.00, outstandingBalance: 0.00, priceList: 'A', discount: 0.00, contacts: [], isClient: false, isProvider: true, isSeller: false, isCommissionAgent: false, iibbAliquot: 0.00 }
    );

    localStorage.setItem('db_personas', JSON.stringify(seededPersonas));
  }

  // Migrar cuenta bancaria de prueba vieja si existe
  const oldBankAccounts = localStorage.getItem('db_bank_accounts');
  if (oldBankAccounts && oldBankAccounts.includes('Galicia')) {
    localStorage.removeItem('db_bank_accounts');
  }

  if (!localStorage.getItem('db_bank_accounts')) {
    localStorage.setItem('db_bank_accounts', JSON.stringify([
      { id: 1, name: 'Banco Provincia Corriente', accountNumber: 'CTA-4321/0', balance: 500000.00, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 2, name: 'Mercado Pago Distribuidora', accountNumber: 'CVU-0000003100012345678901', balance: 150000.00, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 3, name: 'QR', accountNumber: 'QR-ARCA', balance: 0.00, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ]));
  } else {
    try {
      const list = JSON.parse(localStorage.getItem('db_bank_accounts') || '[]');
      if (!list.some((a: any) => a.name === 'QR' || a.accountNumber === 'QR-ARCA')) {
        list.push({ id: 3, name: 'QR', accountNumber: 'QR-ARCA', balance: 0.00, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        localStorage.setItem('db_bank_accounts', JSON.stringify(list));
      }
    } catch (e) {
      // Ignorar
    }
  }

  if (!localStorage.getItem('db_cash_drawers')) {
    localStorage.setItem('db_cash_drawers', JSON.stringify([]));
  }

  if (!localStorage.getItem('db_credit_notes')) {
    localStorage.setItem('db_credit_notes', JSON.stringify([]));
  }


  if (!localStorage.getItem('db_rubros')) {
    localStorage.setItem('db_rubros', JSON.stringify(categoriesList));
  }

  if (!localStorage.getItem('db_products')) {
    const productsToSave = rawProducts.map((p, idx) => {
      const categoryName = p.category || "OTROS";
      const cat = categoriesList.find(c => c.name === categoryName);
      const rubroId = cat ? cat.id : 19;

      const providerId = (idx % 2 === 0) ? 1 : 2;

      return {
        id: idx + 1,
        sku: p.sku,
        name: p.name,
        description: p.description,
        barcode: p.barcode,
        costPrice: p.costPrice,
        listPrice: p.listPrice,
        listPriceB: p.listPriceB,
        listPriceC: p.listPriceC,
        stock: p.stock,
        minStock: p.minStock,
        imageUrl: (p as any).imageUrl || null,
        rubroId,
        providerId,
        rubro: p.category || 'OTROS',
        subrubro: p.subcategory || 'OTROS'
      };
    });
    localStorage.setItem('db_products', JSON.stringify(productsToSave));
  }

  if (!localStorage.getItem('db_product_lots')) {
    const lotsToSave = rawProducts.map((p, idx) => ({
      id: idx + 1,
      productId: idx + 1,
      lotNumber: `LOT-${p.sku}`,
      expirationDate: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0],
      stock: p.stock
    }));
    localStorage.setItem('db_product_lots', JSON.stringify(lotsToSave));
  }

  if (!localStorage.getItem('db_orders')) {
    const seedOrders = [
      {
        id: 1,
        personaId: 1,
        clientId: 1,
        sellerId: 2,
        billingType: 'OFFICIAL',
        invoiceType: 'FACTURA_A',
        invoiceNumber: '0001-00000001',
        cae: '12345678901234',
        caeDueDate: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().split('T')[0],
        status: 'DELIVERED',
        totalAmount: 48500.00,
        createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        items: [
          { id: 1, productId: 3, quantity: 50, unitPrice: 650.00, subtotal: 32500.00 },
          { id: 2, productId: 2, quantity: 10, unitPrice: 1600.00, subtotal: 16000.00 }
        ]
      },
      {
        id: 2,
        personaId: 8,
        clientId: 8,
        sellerId: 2,
        billingType: 'INTERNAL',
        invoiceType: 'PRESUPUESTO',
        invoiceNumber: null,
        cae: null,
        caeDueDate: null,
        status: 'DELIVERED',
        totalAmount: 13750.00,
        createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        items: [
          { id: 3, productId: 5, quantity: 25, unitPrice: 550.00, subtotal: 13750.00 }
        ]
      },
      {
        id: 3,
        personaId: 3,
        clientId: 3,
        sellerId: 5,
        billingType: 'OFFICIAL',
        invoiceType: 'FACTURA_A',
        invoiceNumber: '0001-00000002',
        cae: '98765432109876',
        caeDueDate: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().split('T')[0],
        status: 'DELIVERED',
        totalAmount: 76000.00,
        createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
        items: [
          { id: 4, productId: 1, quantity: 40, unitPrice: 1100.00, subtotal: 44000.00 },
          { id: 5, productId: 2, quantity: 20, unitPrice: 1600.00, subtotal: 32000.00 }
        ]
      },
      {
        id: 4,
        personaId: 9,
        clientId: 9,
        sellerId: 5,
        billingType: 'INTERNAL',
        invoiceType: 'PRESUPUESTO',
        invoiceNumber: null,
        cae: null,
        caeDueDate: null,
        status: 'DELIVERED',
        totalAmount: 26000.00,
        createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
        items: [
          { id: 6, productId: 4, quantity: 20, unitPrice: 1000.00, subtotal: 20000.00 },
          { id: 7, productId: 3, quantity: 12, unitPrice: 500.00, subtotal: 6000.00 }
        ]
      }
    ];
    localStorage.setItem('db_orders', JSON.stringify(seedOrders));
  }

  if (!localStorage.getItem('db_transactions')) {
    const seedTransactions = [
      {
        id: 1,
        personaId: 8,
        userId: 1,
        billingType: 'OFFICIAL',
        type: 'INCOME',
        paymentMethod: 'BANK_TRANSFER',
        amount: 48500.00,
        description: 'Cobro de Factura Directa #1 - Transferencia Bco Provincia',
        cashDrawerId: null,
        bankAccountId: 1,
        verified: false,
        createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
      },
      {
        id: 2,
        personaId: 3,
        userId: 1,
        billingType: 'OFFICIAL',
        type: 'INCOME',
        paymentMethod: 'BANK_TRANSFER',
        amount: 76000.00,
        description: 'Cobro de Factura Directa #3 - Transferencia Mercado Pago',
        cashDrawerId: null,
        bankAccountId: 2,
        verified: true,
        createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
      },
      {
        id: 3,
        personaId: 9,
        userId: 2,
        billingType: 'INTERNAL',
        type: 'INCOME',
        paymentMethod: 'BANK_TRANSFER',
        amount: 15400.00,
        description: 'Rendición preventista Diego - Transferencia QR',
        cashDrawerId: null,
        bankAccountId: 3,
        verified: false,
        createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString()
      }
    ];
    localStorage.setItem('db_transactions', JSON.stringify(seedTransactions));
  }

  if (!localStorage.getItem('db_supplier_invoices')) {
    localStorage.setItem('db_supplier_invoices', JSON.stringify([
      { id: 1, personaId: 4, invoiceNumber: '0005-00045612', invoiceType: 'FACTURA_A', issueDate: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(), netAmount: 100000.00, taxAmount: 21000.00, percepcionAmount: 2000.00, totalAmount: 123000.00, createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString() },
      { id: 2, personaId: 5, invoiceNumber: '0010-00098765', invoiceType: 'FACTURA_A', issueDate: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), netAmount: 50000.00, taxAmount: 10500.00, percepcionAmount: 1000.00, totalAmount: 61500.00, createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString() }
    ]));
  }

  if (!localStorage.getItem('db_tax_withholdings')) {
    localStorage.setItem('db_tax_withholdings', JSON.stringify([
      { id: 1, type: 'PERCEPCION_SUFRIDA', taxType: 'IIBB', personaId: 4, number: '0005-00045612', date: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(), amount: 2000.00, jurisdiction: 'AR-B', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 2, type: 'RETENCION_SUFRIDA', taxType: 'IIBB', personaId: 2, number: 'RET-MP-00918', date: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(), amount: 4500.00, jurisdiction: 'AR-C', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ]));
  }

  if (!localStorage.getItem('db_delivery_routes')) {
    localStorage.setItem('db_delivery_routes', JSON.stringify([
      { id: 1, driverName: "Juan Pérez", vehiclePlate: "AA-123-BC", vehicleDescription: "Furgoneta Ford", status: "PENDING", date: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ]));
  }

  if (!localStorage.getItem('db_purchase_orders')) {
    localStorage.setItem('db_purchase_orders', JSON.stringify([
      { id: 1, personaId: 4, status: "PENDING", totalAmount: 120000.00, createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), updatedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), items: [
        { id: 1, purchaseOrderId: 1, productId: 1, quantity: 100, costPrice: 1200.00, subtotal: 120000.00 }
      ]}
    ]));
  }

  if (!localStorage.getItem('db_audit')) {
    localStorage.setItem('db_audit', JSON.stringify([
      { id: 1, userId: 1, action: 'CREATE_SYSTEM', entityType: 'System', entityId: 1, newValues: { info: 'Sistema ERP inicializado' }, createdAt: new Date().toISOString(), user: { username: 'admin', role: 'ADMIN' } }
    ]));
  }
}

// Inicializar Mock si está activo
if (simulationMode) {
  initMockDatabase();
}

// Helpers para base de datos mock
const mockDb = {
  get: (key: string) => JSON.parse(localStorage.getItem(key) || '[]'),
  set: (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data)),
  log: (userId: number, username: string, role: string, action: string, entityType: string, entityId: number, oldValues?: any, newValues?: any) => {
    const logs = mockDb.get('db_audit');
    const newLog = {
      id: logs.length + 1,
      userId,
      action,
      entityType,
      entityId,
      oldValues: oldValues || null,
      newValues: newValues || null,
      createdAt: new Date().toISOString(),
      user: { username, role }
    };
    mockDb.set('db_audit', [newLog, ...logs]);
  }
};

// ==========================================================================
// CLIENTE API CON SOPORTE DE CONMUTACIÓN AUTOMÁTICA O MANUAL A SIMULACIÓN
// ==========================================================================

function getHeaders() {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

async function request(path: string, options: RequestInit = {}) {
  if (simulationMode) {
    throw new Error('Petición API llamada en modo de simulación.');
  }

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
    throw new Error(json.message);
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
    if (simulationMode) {
      const users = mockDb.get('db_users');
      const user = users.find((u: any) => u.username === username);
      if (!user || !user.isActive) {
        throw new Error('Credenciales inválidas o usuario inactivo.');
      }
      
      // Simular login exitoso
      const token = `mock-jwt-token-for-${username}`;
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
      
      return { token, user };
    }

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
    if (simulationMode) return api.getCurrentUser();
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
    if (simulationMode) return;
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
  getProducts: async (search?: string) => {
    if (simulationMode) {
      let prods = mockDb.get('db_products');
      const lots = mockDb.get('db_product_lots');
      if (search) {
        const query = search.toLowerCase();
        prods = prods.filter((p: any) => 
          p.name.toLowerCase().includes(query) || 
          p.sku.toLowerCase().includes(query) ||
          (p.barcode && p.barcode.toLowerCase() === query)
        );
      }
      return prods.map((p: any) => ({
        ...p,
        lots: lots.filter((l: any) => l.productId === p.id).sort((a: any, b: any) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime())
      }));
    }
    const res = await request(search ? `/products?search=${search}` : '/products');
    return res.products;
  },

  createProduct: async (productData: any) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const prods = mockDb.get('db_products');
      if (prods.some((p: any) => p.sku === productData.sku)) {
        throw new Error('El SKU ya está registrado.');
      }
      if (productData.barcode && prods.some((p: any) => p.barcode === productData.barcode.trim())) {
        throw new Error('El código de barras ya está asignado a otro producto.');
      }
      const newProd = {
        id: prods.length + 1,
        ...productData,
        barcode: productData.barcode ? productData.barcode.trim() : null,
        stock: 0,
        costPrice: Number(productData.costPrice),
        listPrice: Number(productData.listPrice),
        listPriceB: Number(productData.listPriceB || 0),
        listPriceC: Number(productData.listPriceC || 0),
        minStock: Number(productData.minStock || 0),
        imageUrl: productData.imageUrl || null,
        rubroId: productData.rubroId ? Number(productData.rubroId) : null,
        providerId: productData.providerId ? Number(productData.providerId) : null,
        createdAt: new Date().toISOString()
      };
      mockDb.set('db_products', [...prods, newProd]);
      mockDb.log(user.id, user.username, user.role, 'CREATE_PRODUCT', 'Product', newProd.id, null, newProd);
      return newProd;
    }
    const res = await request('/products', {
      method: 'POST',
      body: JSON.stringify(productData)
    });
    return res.product;
  },

  updateProduct: async (id: number, productData: any) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const prods = mockDb.get('db_products');
      const idx = prods.findIndex((p: any) => p.id === id);
      if (idx === -1) throw new Error('Producto no encontrado.');
      
      const oldVal = prods[idx];
      if (productData.barcode && productData.barcode !== oldVal.barcode) {
        if (prods.some((p: any) => p.barcode === productData.barcode.trim())) {
          throw new Error('El código de barras ya está asignado a otro producto.');
        }
      }
      const newVal = {
        ...oldVal,
        ...productData,
        barcode: productData.barcode !== undefined ? (productData.barcode ? productData.barcode.trim() : null) : oldVal.barcode,
        costPrice: productData.costPrice !== undefined ? Number(productData.costPrice) : oldVal.costPrice,
        listPrice: productData.listPrice !== undefined ? Number(productData.listPrice) : oldVal.listPrice,
        listPriceB: productData.listPriceB !== undefined ? Number(productData.listPriceB) : (oldVal.listPriceB || 0),
        listPriceC: productData.listPriceC !== undefined ? Number(productData.listPriceC) : (oldVal.listPriceC || 0),
        minStock: productData.minStock !== undefined ? Number(productData.minStock) : oldVal.minStock,
        imageUrl: productData.imageUrl !== undefined ? productData.imageUrl : oldVal.imageUrl,
        rubroId: productData.rubroId !== undefined ? (productData.rubroId ? Number(productData.rubroId) : null) : oldVal.rubroId,
        providerId: productData.providerId !== undefined ? (productData.providerId ? Number(productData.providerId) : null) : oldVal.providerId,
      };
      
      prods[idx] = newVal;
      mockDb.set('db_products', prods);
      mockDb.log(user.id, user.username, user.role, 'UPDATE_PRODUCT', 'Product', id, oldVal, newVal);
      return newVal;
    }
    const res = await request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData)
    });
    return res.product;
  },

  adjustStock: async (id: number, quantityChange: number, reason: string, lotNumber?: string, expirationDate?: string) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const prods = mockDb.get('db_products');
      const idx = prods.findIndex((p: any) => p.id === id);
      if (idx === -1) throw new Error('Producto no encontrado.');

      const prod = prods[idx];
      const change = Number(quantityChange);
      const newStock = prod.stock + change;
      if (newStock < 0) {
        throw new Error(`Ajuste inválido. El stock no puede ser negativo (Stock actual: ${prod.stock}, Cambio solicitado: ${change}).`);
      }

      if (lotNumber) {
        const trimmedLot = lotNumber.trim();
        if (trimmedLot) {
          const lots = mockDb.get('db_product_lots');
          let lotIdx = lots.findIndex((l: any) => l.productId === id && l.lotNumber === trimmedLot);
          let lot;

          if (change > 0) {
            if (lotIdx === -1) {
              if (!expirationDate) {
                throw new Error('La fecha de vencimiento es requerida para crear un lote nuevo.');
              }
              lot = {
                id: lots.length + 1,
                productId: id,
                lotNumber: trimmedLot,
                expirationDate: expirationDate,
                stock: 0
              };
              lots.push(lot);
              lotIdx = lots.length - 1;
            } else {
              lot = lots[lotIdx];
            }
          } else {
            if (lotIdx === -1) {
              throw new Error(`El lote "${trimmedLot}" no existe para este producto.`);
            }
            lot = lots[lotIdx];
            if (lot.stock + change < 0) {
              throw new Error(`Stock insuficiente en el lote "${trimmedLot}" (Disponible: ${lot.stock}, Solicitado: ${change}).`);
            }
          }

          lot.stock += change;
          mockDb.set('db_product_lots', lots);
        }
      }

      const oldStock = prod.stock;
      prod.stock = newStock;
      mockDb.set('db_products', prods);
      
      mockDb.log(user.id, user.username, user.role, 'ADJUST_STOCK', 'Product', id, { stock: oldStock }, { stock: newStock, quantityChange, reason, lotNumber });
      
      const lots = mockDb.get('db_product_lots');
      return {
        ...prod,
        lots: lots.filter((l: any) => l.productId === prod.id).sort((a: any, b: any) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime())
      };
    }
    const res = await request(`/products/${id}/adjust-stock`, {
      method: 'POST',
      body: JSON.stringify({ quantityChange, reason, lotNumber, expirationDate })
    });
    return res.product;
  },

  // --- PERSONAS ---
  getPersonas: async (role?: string, search?: string) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      let personas = mockDb.get('db_personas');
      if (role === 'client') {
        personas = personas.filter((p: any) => p.isClient);
      } else if (role === 'provider') {
        personas = personas.filter((p: any) => p.isProvider);
      } else if (role === 'seller') {
        personas = personas.filter((p: any) => p.isSeller);
      } else if (role === 'commission_agent') {
        personas = personas.filter((p: any) => p.isCommissionAgent);
      }

      if (user && user.role === 'VENDEDOR') {
        personas = personas.filter((p: any) => p.sellerId === user.id && p.isClient);
      }

      if (search) {
        const query = search.toLowerCase();
        personas = personas.filter((p: any) =>
          p.name.toLowerCase().includes(query) || (p.cuit && p.cuit.includes(query))
        );
      }
      return personas;
    }
    let path = '/personas';
    const params = [];
    if (role) params.push(`role=${role}`);
    if (search) params.push(`search=${search}`);
    if (params.length > 0) path += `?${params.join('&')}`;

    const res = await request(path);
    return res.personas;
  },

  getClients: async (search?: string) => {
    return api.getPersonas('client', search);
  },

  getAfipData: async (cuit: string) => {
    if (simulationMode) {
      return {
        name: 'Empresa de Prueba S.A. (Local)',
        address: 'Calle Falsa 123',
        location: 'CABA',
        isClient: true
      };
    }
    const res = await request(`/personas/afip/${cuit}`);
    return res;
  },


  createPersona: async (personaData: any) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const personas = mockDb.get('db_personas');
      const newPersona = {
        id: personas.length + 1,
        ...personaData,
        creditLimit: Number(personaData.creditLimit || 0),
        outstandingBalance: Number(personaData.outstandingBalance || 0),
        discount: Number(personaData.discount || 0),
        sellerId: personaData.sellerId ? Number(personaData.sellerId) : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockDb.set('db_personas', [...personas, newPersona]);
      mockDb.log(user.id, user.username, user.role, 'CREATE_PERSONA', 'Persona', newPersona.id, null, newPersona);
      return newPersona;
    }
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
    const user = api.getCurrentUser();
    if (simulationMode) {
      const personas = mockDb.get('db_personas');
      const idx = personas.findIndex((p: any) => p.id === id);
      if (idx === -1) throw new Error('Persona no encontrada.');

      const oldVal = personas[idx];
      const newVal = {
        ...oldVal,
        ...personaData,
        creditLimit: personaData.creditLimit !== undefined ? Number(personaData.creditLimit) : oldVal.creditLimit,
        outstandingBalance: personaData.outstandingBalance !== undefined ? Number(personaData.outstandingBalance) : oldVal.outstandingBalance,
        discount: personaData.discount !== undefined ? Number(personaData.discount) : oldVal.discount,
        sellerId: personaData.sellerId !== undefined ? (personaData.sellerId ? Number(personaData.sellerId) : null) : oldVal.sellerId,
        updatedAt: new Date().toISOString()
      };

      personas[idx] = newVal;
      mockDb.set('db_personas', personas);
      mockDb.log(user.id, user.username, user.role, 'UPDATE_PERSONA', 'Persona', id, oldVal, newVal);
      return newVal;
    }
    const res = await request(`/personas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(personaData)
    });
    return res.persona;
  },

  updateClient: async (id: number, clientData: any) => {
    return api.updatePersona(id, clientData);
  },

  registerPayment: async (personaId: number, paymentData: { amount: number, paymentMethod: string, description?: string, branch?: string, type?: string, supplierInvoiceId?: number }) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const personas = mockDb.get('db_personas');
      const idx = personas.findIndex((p: any) => p.id === personaId);
      if (idx === -1) throw new Error('Persona no encontrada.');

      const persona = personas[idx];
      const amount = Number(paymentData.amount);

      let type: 'INCOME' | 'OUTCOME' = 'INCOME';
      if (paymentData.type === 'OUTCOME') {
        type = 'OUTCOME';
        persona.outstandingBalance = Number(persona.outstandingBalance || 0) + amount;
      } else if (paymentData.type === 'INCOME') {
        type = 'INCOME';
        persona.outstandingBalance = Number(persona.outstandingBalance || 0) - amount;
      } else if (persona.isProvider && !persona.isClient) {
        type = 'OUTCOME';
        persona.outstandingBalance = Number(persona.outstandingBalance || 0) + amount;
      } else {
        type = 'INCOME';
        persona.outstandingBalance = Number(persona.outstandingBalance || 0) - amount;
      }

      personas[idx] = persona;
      mockDb.set('db_personas', personas);

      let invoiceNumberToLog = '';
      if (paymentData.supplierInvoiceId) {
        const invoices = mockDb.get('db_supplier_invoices') || [];
        const invIdx = invoices.findIndex((i: any) => i.id === Number(paymentData.supplierInvoiceId));
        if (invIdx !== -1) {
          const inv = invoices[invIdx];
          const curPaid = Number(inv.paidAmount || 0);
          const newPaid = curPaid + amount;
          inv.paidAmount = newPaid;
          inv.status = newPaid >= Number(inv.totalAmount) ? 'PAID' : 'PARTIALLY_PAID';
          invoices[invIdx] = inv;
          mockDb.set('db_supplier_invoices', invoices);
          invoiceNumberToLog = inv.invoiceNumber;
        }
      }

      let cashDrawerId = null;
      let bankAccountId = null;

      if (paymentData.paymentMethod === 'CASH') {
        const drawers = mockDb.get('db_cash_drawers');
        const activeDrawer = drawers.find((d: any) => d.userId === user.id && d.status === 'OPEN');
        if (!activeDrawer) {
          throw new Error(`Debe abrir la Caja Grande antes de registrar cobros/pagos en efectivo.`);
        }
        cashDrawerId = activeDrawer.id;
      } else if (paymentData.paymentMethod === 'BANK_TRANSFER' || paymentData.paymentMethod === 'CHECK') {
        const banks = mockDb.get('db_bank_accounts');
        const defaultBank = banks[0];
        if (!defaultBank) {
          throw new Error('No se encontró ninguna cuenta bancaria configurada en el sistema.');
        }
        bankAccountId = defaultBank.id;
        if (type === 'INCOME') {
          defaultBank.balance = Number(defaultBank.balance || 0) + amount;
        } else {
          defaultBank.balance = Number(defaultBank.balance || 0) - amount;
        }
        mockDb.set('db_bank_accounts', banks);
      }

      const trans = mockDb.get('db_transactions') || [];
      const newTran = {
        id: trans.length + 1,
        personaId,
        userId: user.id,
        billingType: (paymentData.branch || 'X') === 'A' ? 'OFFICIAL' : 'INTERNAL',
        type,
        paymentMethod: paymentData.paymentMethod,
        amount,
        description: paymentData.description || (paymentData.supplierInvoiceId
          ? `Pago de Factura Nro ${invoiceNumberToLog}`
          : `${type === 'OUTCOME' ? 'Pago' : 'Cobro'} a cuenta de ${persona.name}`),
        cashDrawerId,
        bankAccountId,
        supplierInvoiceId: paymentData.supplierInvoiceId ? Number(paymentData.supplierInvoiceId) : null,
        createdAt: new Date().toISOString()
      };
      trans.push(newTran);
      mockDb.set('db_transactions', trans);

      mockDb.log(user.id, user.username, user.role, 'RECORD_PERSONA_PAYMENT', 'Persona', personaId, null, {
        amount,
        paymentMethod: paymentData.paymentMethod,
        newBalance: persona.outstandingBalance
      });

      return { transaction: newTran, persona };
    }
    const res = await request(`/personas/${personaId}/payments`, {
      method: 'POST',
      body: JSON.stringify(paymentData)
    });
    return res;
  },

  getPersonaLedger: async (personaId: number) => {
    if (simulationMode) {
      const personas = mockDb.get('db_personas');
      const persona = personas.find((p: any) => p.id === personaId);
      if (!persona) throw new Error('Persona no encontrada.');

      const orders = mockDb.get('db_orders').filter((o: any) => (o.personaId === personaId || o.clientId === personaId) && o.status === 'DELIVERED');
      const transactions = mockDb.get('db_transactions').filter((t: any) => t.personaId === personaId);
      const supplierInvoices = (mockDb.get('db_supplier_invoices') || []).filter((si: any) => si.personaId === personaId);

      const ledgerItems: any[] = [];
      orders.forEach((o: any) => {
        ledgerItems.push({
          id: `order-${o.id}`,
          date: o.createdAt,
          type: 'DEBIT',
          reference: `Pedido #${o.id}`,
          description: `Factura ${o.invoiceNumber || 'INT-' + String(o.id).padStart(8, '0')}`,
          amount: Number(o.totalAmount)
        });
      });

      transactions.forEach((t: any) => {
        ledgerItems.push({
          id: `transaction-${t.id}`,
          date: t.createdAt,
          type: t.type === 'INCOME' ? 'CREDIT' : 'DEBIT',
          reference: `Recibo #${t.id}`,
          description: `${t.type === 'INCOME' ? 'Cobro' : 'Pago'} - ${t.paymentMethod} (${t.description || 'Cuenta corriente'})`,
          amount: Number(t.amount)
        });
      });

      supplierInvoices.forEach((si: any) => {
        ledgerItems.push({
          id: `supplier-invoice-${si.id}`,
          date: si.issueDate,
          type: 'CREDIT',
          reference: `Factura Nro ${si.invoiceNumber}`,
          description: `Compra - Factura ${si.invoiceType.replace('_', ' ')}`,
          amount: Number(si.totalAmount)
        });
      });

      ledgerItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let runningBalance = 0;
      const ledger = ledgerItems.map((item) => {
        if (item.type === 'DEBIT') {
          runningBalance += item.amount;
        } else {
          runningBalance -= item.amount;
        }
        return {
          ...item,
          balance: runningBalance
        };
      });

      return { persona, ledger };
    }
    const res = await request(`/personas/${personaId}/ledger`);
    return res;
  },

  getClientLedger: async (clientId: number) => {
    const res = await api.getPersonaLedger(clientId);
    return { client: res.persona, ledger: res.ledger };
  },

  // --- PEDIDOS ---
  getOrders: async (billingType?: BillingType, status?: OrderStatus) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      let orders = mockDb.get('db_orders');
      const personas = mockDb.get('db_personas');
      const products = mockDb.get('db_products');
      
      // Filtros de vendedor
      if (user && user.role === 'VENDEDOR') {
        orders = orders.filter((o: any) => o.sellerId === user.id);
      }
      if (billingType) {
        orders = orders.filter((o: any) => o.billingType === billingType);
      }
      if (status) {
        orders = orders.filter((o: any) => o.status === status);
      }

      // Enriquecer objetos
      return orders.map((o: any) => ({
        ...o,
        client: personas.find((c: any) => c.id === (o.personaId || o.clientId)) || { name: 'Persona Desconocida' },
        items: o.items.map((i: any) => ({
          ...i,
          product: products.find((p: any) => p.id === i.productId) || { name: 'Producto Eliminado' }
        }))
      }));
    }
    
    let path = '/orders';
    const params = [];
    if (billingType) params.push(`billingType=${billingType}`);
    if (status) params.push(`status=${status}`);
    if (params.length > 0) path += `?${params.join('&')}`;

    const res = await request(path);
    return res.orders;
  },

  createOrder: async (orderData: { clientId: number, items: { productId: number, quantity: number }[], notes?: string }) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const orders = mockDb.get('db_orders');
      const products = mockDb.get('db_products');
      const personas = mockDb.get('db_personas');
      const persona = personas.find((c: any) => c.id === orderData.clientId);

      if (!persona) throw new Error('Persona no encontrada.');

      // Validar y descontar stock preventivo, aplicando listas y descuento
      let totalAmount = 0;
      const orderItems = [];

      for (const item of orderData.items) {
        const prodIdx = products.findIndex((p: any) => p.id === item.productId);
        if (prodIdx === -1) throw new Error('Producto no encontrado.');
        const prod = products[prodIdx];

        if (prod.stock < item.quantity) {
          throw new Error(`Stock insuficiente para "${prod.name}" (Disponible: ${prod.stock}).`);
        }

        // Determinar precio según lista
        let selectedPrice = Number(prod.listPrice);
        let itemDiscount = Number(persona.discount || 0);

        if (persona.priceList === 'B') {
          const isMelincue = prod.description?.toUpperCase() === 'MELINCUE' || prod.name?.toUpperCase().includes('MELINCUE');
          if (isMelincue) {
            itemDiscount = 3;
          } else {
            itemDiscount = 0;
          }
        }

        // Aplicar descuento y redondear al entero más cercano
        const finalUnitPrice = Math.round(selectedPrice * (1 - itemDiscount / 100));
        
        // Calculate based on weight if weighable
        const actualQuantityForPrice = prod.isPesable
          ? (item.quantity * Number(prod.approximateWeight || 1))
          : item.quantity;
          
        const subtotal = Math.round(finalUnitPrice * actualQuantityForPrice);
        totalAmount += subtotal;

        prod.stock -= item.quantity;

        orderItems.push({
          productId: prod.id,
          quantity: item.quantity,
          weight: null,
          unitPrice: finalUnitPrice,
          subtotal
        });
      }

      // Validar límite de crédito
      const creditLimit = Number(persona.creditLimit || 0);
      const outstandingBalance = Number(persona.outstandingBalance || 0);
      if (creditLimit > 0 && (outstandingBalance + totalAmount) > creditLimit) {
        if (user.role !== 'ADMIN') {
          throw new Error(
            `Límite de crédito excedido. Saldo actual: $${outstandingBalance.toLocaleString()}, Disponible: $${(creditLimit - outstandingBalance).toLocaleString()}, Requerido: $${totalAmount.toLocaleString()}.`
          );
        }
      }

      // Guardar productos con stock actualizado
      mockDb.set('db_products', products);

      const newOrder = {
        id: orders.length + 1,
        personaId: orderData.clientId,
        clientId: orderData.clientId,
        sellerId: user.id,
        billingType: BillingType.INTERNAL,
        invoiceType: InvoiceType.PRESUPUESTO,
        invoiceNumber: null,
        cae: null,
        caeDueDate: null,
        status: OrderStatus.PENDING,
        totalAmount,
        notes: orderData.notes || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: orderItems
      };

      mockDb.set('db_orders', [...orders, newOrder]);

      // Registro de stock movements
      for (const item of orderData.items) {
        mockDb.log(user.id, user.username, user.role, 'STOCK_OUT', 'Product', item.productId, null, { quantity: -item.quantity, reason: `Reserva Venta Pedido #${newOrder.id}` });
      }

      // Log de auditoría
      mockDb.log(user.id, user.username, user.role, 'CREATE_ORDER', 'Order', newOrder.id, null, { totalAmount });

      return newOrder;
    }

    const res = await request('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
    return res.order;
  },

  updateOrder: async (id: number, orderData: { items: { productId: number, quantity: number }[] }) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const orders = mockDb.get('db_orders');
      const idx = orders.findIndex((o: any) => o.id === id);
      if (idx === -1) throw new Error('Pedido no encontrado.');
      const oldOrder = orders[idx];

      if (oldOrder.status !== OrderStatus.PENDING) {
        throw new Error('Solo se pueden editar pedidos en estado Pendiente.');
      }

      const products = mockDb.get('db_products');
      const personas = mockDb.get('db_personas');
      const persona = personas.find((c: any) => c.id === (oldOrder.personaId || oldOrder.clientId));
      if (!persona) throw new Error('Persona no encontrada.');

      // 1. Restaurar stock viejo
      for (const item of oldOrder.items) {
        const prod = products.find((p: any) => p.id === item.productId);
        if (prod) prod.stock += item.quantity;
      }

      // 2. Validar y descontar stock nuevo
      let totalAmount = 0;
      const orderItems = [];

      for (const item of orderData.items) {
        const prod = products.find((p: any) => p.id === item.productId);
        if (!prod) throw new Error('Producto no encontrado.');

        if (prod.stock < item.quantity) {
          throw new Error(`Stock insuficiente para "${prod.name}" (Disponible: ${prod.stock}).`);
        }

        // Determinar precio según lista
        let selectedPrice = Number(prod.listPrice);
        let itemDiscount = Number(persona.discount || 0);

        if (persona.priceList === 'B') {
          const isMelincue = prod.description?.toUpperCase() === 'MELINCUE' || prod.name?.toUpperCase().includes('MELINCUE');
          if (isMelincue) {
            itemDiscount = 3;
          } else {
            itemDiscount = 0;
          }
        }

        // Aplicar descuento
        const finalUnitPrice = selectedPrice * (1 - itemDiscount / 100);
        
        // Calculate based on weight if weighable
        const actualQuantityForPrice = prod.isPesable
          ? (item.quantity * Number(prod.approximateWeight || 1))
          : item.quantity;
          
        const subtotal = finalUnitPrice * actualQuantityForPrice;
        totalAmount += subtotal;

        prod.stock -= item.quantity;

        orderItems.push({
          id: Date.now() + Math.random(),
          productId: prod.id,
          quantity: item.quantity,
          weight: (item as any).weight || null,
          unitPrice: finalUnitPrice,
          subtotal
        });
      }

      // Validar límite de crédito
      const creditLimit = Number(persona.creditLimit || 0);
      const outstandingBalance = Number(persona.outstandingBalance || 0);
      if (creditLimit > 0 && (outstandingBalance + totalAmount) > creditLimit) {
        if (user.role !== 'ADMIN') {
          throw new Error(
            `Límite de crédito excedido. Saldo actual: $${outstandingBalance.toLocaleString()}, Disponible: $${(creditLimit - outstandingBalance).toLocaleString()}, Requerido: $${totalAmount.toLocaleString()}.`
          );
        }
      }

      // Guardar productos con stock actualizado
      mockDb.set('db_products', products);

      const newOrder = {
        ...oldOrder,
        totalAmount,
        updatedAt: new Date().toISOString(),
        items: orderItems
      };

      orders[idx] = newOrder;
      mockDb.set('db_orders', orders);

      // Log de auditoría
      mockDb.log(user.id, user.username, user.role, 'UPDATE_ORDER_ITEMS', 'Order', id, { totalAmount: oldOrder.totalAmount }, { totalAmount });

      return newOrder;
    }

    const res = await request(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(orderData)
    });
    return res.order;
  },

  invoiceOrder: async (id: number, billingType: BillingType, paymentMethod?: PaymentMethod, paymentDescription?: string) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const orders = mockDb.get('db_orders');
      const idx = orders.findIndex((o: any) => o.id === id);
      if (idx === -1) throw new Error('Pedido no encontrado.');

      const oldOrder = orders[idx];
      if (oldOrder.status !== OrderStatus.PREPARED) {
        throw new Error('No se puede facturar. El pedido debe estar armado por depósito primero.');
      }

      const personas = mockDb.get('db_personas');
      const persona = personas.find((c: any) => c.id === (oldOrder.personaId || oldOrder.clientId)) || { name: 'Desconocido', cuit: '', outstandingBalance: 0 };

      // Validar regla de "boleta contra boleta" (deben una y deben pagar la proxima)
      const outstandingBalance = Number(persona.outstandingBalance || 0);
      if (!paymentMethod && outstandingBalance > 0) {
        if (user.role !== 'ADMIN') {
          throw new Error(
            `Regla Boleta contra Boleta: El cliente posee una boleta pendiente ($${outstandingBalance.toLocaleString()}). Debe registrar su cobro para poder facturar este pedido a crédito.`
          );
        }
      }

      let invoiceType: InvoiceType = InvoiceType.PRESUPUESTO;
      let invoiceNumber = `INT-${oldOrder.id.toString().padStart(8, '0')}`;
      let cae = null;
      let caeDueDate = null;

      if (billingType === BillingType.OFFICIAL) {
        invoiceType = (persona.cuit && persona.cuit.replace(/-/g, '').length === 11) ? InvoiceType.FACTURA_A : InvoiceType.FACTURA_B;
        invoiceNumber = `00001-${oldOrder.id.toString().padStart(8, '0')}`;
        cae = '9999' + Math.floor(10000000 + Math.random() * 90000000) + '1';
        const date = new Date();
        date.setDate(date.getDate() + 10);
        caeDueDate = date.toISOString();
      }

      const totalSum = Number(oldOrder.totalAmount);
      let netAmount = totalSum / 1.21;
      let taxAmount = totalSum - netAmount;
      let percepcionAmount = 0;

      if (billingType === BillingType.OFFICIAL) {
        if (invoiceType === InvoiceType.FACTURA_A) {
          const iibbAliquot = Number(persona.iibbAliquot || 0);
          if (iibbAliquot > 0) {
            netAmount = totalSum / (1.21 + (iibbAliquot / 100));
            taxAmount = Math.round(netAmount * 0.21);
            percepcionAmount = Math.round(netAmount * (iibbAliquot / 100));
          }
        }
      }

      const newOrder = {
        ...oldOrder,
        billingType,
        invoiceType,
        invoiceNumber,
        cae,
        caeDueDate,
        netAmount: Number(netAmount.toFixed(2)),
        taxAmount: Number(taxAmount.toFixed(2)),
        percepcionAmount: Number(percepcionAmount.toFixed(2)),
        status: OrderStatus.DELIVERED,
        updatedAt: new Date().toISOString()
      };

      if (percepcionAmount > 0) {
        const withholdings = mockDb.get('db_tax_withholdings') || [];
        const newRecord = {
          id: withholdings.length + 1,
          type: 'PERCEPCION_PRACTICADA',
          taxType: 'IIBB',
          personaId: oldOrder.personaId || oldOrder.clientId,
          number: invoiceNumber,
          date: new Date().toISOString(),
          amount: Number(percepcionAmount.toFixed(2)),
          jurisdiction: (persona.address && persona.address.includes('CABA')) ? 'AR-C' : 'AR-B',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        mockDb.set('db_tax_withholdings', [...withholdings, newRecord]);
      }

      orders[idx] = newOrder;
      mockDb.set('db_orders', orders);

      if (paymentMethod) {
        let cashDrawerId = null;
        let bankAccountId = null;

        if (paymentMethod === 'CASH') {
          const drawers = mockDb.get('db_cash_drawers');
          const activeDrawer = drawers.find((d: any) => d.userId === user.id && d.branch === (billingType === 'OFFICIAL' ? 'A' : 'X') && d.status === 'OPEN');
          if (!activeDrawer) {
            throw new Error(`Debe abrir una caja operativa para la sucursal ${billingType === 'OFFICIAL' ? 'A' : 'X'} antes de registrar cobros en efectivo.`);
          }
          cashDrawerId = activeDrawer.id;
        } else if (paymentMethod === 'BANK_TRANSFER') {
          const banks = mockDb.get('db_bank_accounts');
          const defaultBank = banks[0];
          if (!defaultBank) {
            throw new Error('No se encontró ninguna cuenta bancaria configurada en el sistema.');
          }
          bankAccountId = defaultBank.id;
          // Incrementar saldo
          defaultBank.balance = Number(defaultBank.balance || 0) + Number(newOrder.totalAmount);
          mockDb.set('db_bank_accounts', banks);
        }

        const trans = mockDb.get('db_transactions');
        const newTran = {
          id: trans.length + 1,
          orderId: newOrder.id,
          personaId: newOrder.personaId || newOrder.clientId,
          userId: user.id,
          billingType,
          type: TransactionType.INCOME,
          paymentMethod,
          amount: newOrder.totalAmount,
          description: `Cobro en caja de pedido #${newOrder.id}`,
          cashDrawerId,
          bankAccountId,
          createdAt: new Date().toISOString()
        };
        mockDb.set('db_transactions', [...trans, newTran]);
      } else {
        const dbPersonas = mockDb.get('db_personas');
        const pIdx = dbPersonas.findIndex((c: any) => c.id === (newOrder.personaId || newOrder.clientId));
        if (pIdx !== -1) {
          dbPersonas[pIdx].outstandingBalance = Number(dbPersonas[pIdx].outstandingBalance || 0) + Number(newOrder.totalAmount);
          mockDb.set('db_personas', dbPersonas);
        }
      }

      mockDb.log(user.id, user.username, user.role, 'INVOICE_ORDER', 'Order', id, { status: oldOrder.status }, { status: newOrder.status, billingType });
      return newOrder;
    }

    const res = await request(`/orders/${id}/invoice`, {
      method: 'POST',
      body: JSON.stringify({ billingType, paymentMethod, paymentDescription })
    });
    return res.order;
  },

  updateOrderWeights: async (id: number, items: { orderItemId: number; weight: number }[]) => {
    if (simulationMode) {
      const orders = mockDb.get('db_orders');
      const idx = orders.findIndex((o: any) => o.id === id);
      if (idx === -1) throw new Error('Pedido no encontrado.');
      const order = orders[idx];

      let newTotal = 0;
      const updatedItems = order.items.map((item: any) => {
        const weightUpdate = items.find(i => i.orderItemId === item.id);
        let subtotal = Number(item.subtotal);
        let weight = item.weight || null;

        if (item.product?.isPesable && weightUpdate && weightUpdate.weight > 0) {
          weight = weightUpdate.weight;
          subtotal = Number(item.price || item.unitPrice) * weight;
        }

        newTotal += subtotal;
        return { ...item, weight, subtotal };
      });

      const updatedOrder = { ...order, items: updatedItems, totalAmount: newTotal };
      orders[idx] = updatedOrder;
      mockDb.set('db_orders', orders);
      return updatedOrder;
    }

    const res = await fetch(`${API_BASE_URL}/orders/${id}/weights`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
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
    if (simulationMode) {
      const orders = mockDb.get('db_orders') || [];
      const idx = orders.findIndex((o: any) => o.id === orderId);
      if (idx !== -1) {
        orders[idx].status = OrderStatus.PREPARED;
        mockDb.set('db_orders', orders);
        return { order: orders[idx] };
      }
      throw new Error('Pedido no encontrado');
    }
    const res = await request(`/orders/${orderId}/confirm-armado`, {
      method: 'POST',
      body: JSON.stringify({ items })
    });
    return res.data;
  },

  updateOrderStatus: async (id: number, status: OrderStatus, lotAssignments?: any) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const orders = mockDb.get('db_orders');
      const idx = orders.findIndex((o: any) => o.id === id);
      if (idx === -1) throw new Error('Pedido no encontrado.');

      const oldOrder = orders[idx];
      
      // Depósito no puede cancelar
      if (user.role === 'DEPOSITO' && status === OrderStatus.CANCELLED) {
        throw new Error('Permisos insuficientes para cancelar pedidos.');
      }

      const newOrder = {
        ...oldOrder,
        status,
        updatedAt: new Date().toISOString()
      };

      // Si pasa a PREPARED, validar y procesar lotes
      if (status === OrderStatus.PREPARED) {
        if (!lotAssignments) {
          throw new Error('Las asignaciones de lote son requeridas para marcar el pedido como Armado.');
        }

        const lots = mockDb.get('db_product_lots');
        const updatedItems = oldOrder.items.map((item: any) => {
          const assignments = lotAssignments[item.id] || [];
          const totalAssigned = assignments.reduce((sum: number, a: any) => sum + Number(a.quantity), 0);

          if (totalAssigned !== item.quantity) {
            throw new Error(`Asignación incompleta para el artículo. Cantidad pedida: ${item.quantity}, Asignada: ${totalAssigned}.`);
          }

          const orderItemLots = [];

          for (const assignment of assignments) {
            const { lotId, quantity } = assignment;
            const q = Number(quantity);
            if (q <= 0) continue;

            const lotIdx = lots.findIndex((l: any) => l.id === Number(lotId));
            if (lotIdx === -1) {
              throw new Error(`El lote especificado no existe.`);
            }

            const lot = lots[lotIdx];
            if (lot.productId !== item.productId) {
              throw new Error(`El lote especificado no pertenece al producto.`);
            }

            if (lot.stock < q) {
              throw new Error(`Stock insuficiente en el lote "${lot.lotNumber}" (Disponible: ${lot.stock}, Solicitado: ${q}).`);
            }

            // Decrementar stock del lote
            lot.stock -= q;

            // Registrar asignación
            orderItemLots.push({
              id: Math.floor(Math.random() * 1000000),
              orderItemId: item.id,
              productLotId: lot.id,
              quantity: q,
              productLot: { ...lot }
            });
          }

          return {
            ...item,
            orderItemLots
          };
        });

        mockDb.set('db_product_lots', lots);
        newOrder.items = updatedItems;
      }

      orders[idx] = newOrder;
      mockDb.set('db_orders', orders);

      // Reponer stock y revertir c/c si se cancela
      if (status === OrderStatus.CANCELLED && oldOrder.status !== OrderStatus.CANCELLED) {
        const products = mockDb.get('db_products');
        const lots = mockDb.get('db_product_lots');

        for (const item of oldOrder.items) {
          const prod = products.find((p: any) => p.id === item.productId);
          if (prod) prod.stock += item.quantity;

          // Si el pedido estaba PREPARED o DELIVERED, también tenía lotes asignados. Los devolvemos.
          if (oldOrder.status === OrderStatus.PREPARED || oldOrder.status === OrderStatus.DELIVERED) {
            const itemLots = item.orderItemLots || [];
            for (const itemLot of itemLots) {
              const lot = lots.find((l: any) => l.id === itemLot.productLotId);
              if (lot) {
                lot.stock += itemLot.quantity;
              }
            }
          }
        }
        mockDb.set('db_products', products);
        mockDb.set('db_product_lots', lots);

        // Si estaba entregado, deducir de cuenta corriente si era crédito
        if (oldOrder.status === OrderStatus.DELIVERED) {
          const trans = mockDb.get('db_transactions');
          const hasPayment = trans.some((t: any) => t.orderId === oldOrder.id && t.type === 'INCOME');
          if (!hasPayment) {
            const dbPersonas = mockDb.get('db_personas');
            const cIdx = dbPersonas.findIndex((c: any) => c.id === (oldOrder.personaId || oldOrder.clientId));
            if (cIdx !== -1) {
              dbPersonas[cIdx].outstandingBalance = Number(dbPersonas[cIdx].outstandingBalance || 0) - Number(oldOrder.totalAmount);
              mockDb.set('db_personas', dbPersonas);
            }
          }
        }
      }

      mockDb.log(user.id, user.username, user.role, 'UPDATE_ORDER_STATUS', 'Order', id, { status: oldOrder.status }, { status });
      return newOrder;
    }

    const res = await request(`/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, lotAssignments })
    });
    return res.order;
  },

  // --- ADMINISTRADOR ---
  getFinancialReports: async () => {
    if (simulationMode) {
      const orders = mockDb.get('db_orders');
      const trans = mockDb.get('db_transactions');

      // Ventas
      const officialSales = orders.filter((o: any) => o.billingType === BillingType.OFFICIAL && o.status === OrderStatus.DELIVERED);
      const internalSales = orders.filter((o: any) => o.billingType === BillingType.INTERNAL && o.status === OrderStatus.DELIVERED);
      
      const officialSum = officialSales.reduce((acc: number, o: any) => acc + o.totalAmount, 0);
      const internalSum = internalSales.reduce((acc: number, o: any) => acc + o.totalAmount, 0);

      // Ingresos/Egresos caja
      const officialInc = trans.filter((t: any) => t.billingType === BillingType.OFFICIAL && t.type === TransactionType.INCOME).reduce((acc: number, t: any) => acc + t.amount, 0);
      const officialOut = trans.filter((t: any) => t.billingType === BillingType.OFFICIAL && t.type === TransactionType.OUTCOME).reduce((acc: number, t: any) => acc + t.amount, 0);
      
      const internalInc = trans.filter((t: any) => t.billingType === BillingType.INTERNAL && t.type === TransactionType.INCOME).reduce((acc: number, t: any) => acc + t.amount, 0);
      const internalOut = trans.filter((t: any) => t.billingType === BillingType.INTERNAL && t.type === TransactionType.OUTCOME).reduce((acc: number, t: any) => acc + t.amount, 0);

      // Métodos de pago
      const methods: any[] = [];
      const paymentTrans = trans.filter((t: any) => t.type === TransactionType.INCOME);
      paymentTrans.forEach((t: any) => {
        let entry = methods.find((m: any) => m.channel === t.billingType && m.method === t.paymentMethod);
        if (!entry) {
          entry = { channel: t.billingType, method: t.paymentMethod, total: 0 };
          methods.push(entry);
        }
        entry.total += t.amount;
      });

      return {
        sales: {
          official: officialSum,
          officialCount: officialSales.length,
          internal: internalSum,
          internalCount: internalSales.length,
        },
        cashflow: {
          officialIncome: officialInc,
          officialOutcome: officialOut,
          internalIncome: internalInc,
          internalOutcome: internalOut,
        },
        paymentMethods: methods
      };
    }

    const res = await request('/admin/reports');
    return res.report;
  },

  getZoneReports: async (filters: { city?: string; sellerId?: number; startDate?: string; endDate?: string } = {}) => {
    if (simulationMode) {
      const personas = mockDb.get('db_personas') || [];
      const clients = personas.filter((p: any) => p.isClient);
      
      let filteredClients = [...clients];
      if (filters.sellerId) {
        filteredClients = filteredClients.filter((c: any) => c.sellerId === Number(filters.sellerId));
      }
      if (filters.city) {
        filteredClients = filteredClients.filter((c: any) => c.city && c.city.toLowerCase().includes(filters.city!.toLowerCase()));
      }
      
      const totalClients = filteredClients.length;
      const totalDebt = filteredClients.reduce((acc: number, curr: any) => acc + Number(curr.outstandingBalance || 0), 0);
      
      const availableCities = Array.from(new Set(clients.map((c: any) => c.city).filter(Boolean)));
      
      const users = mockDb.get('db_users') || [];
      const availableSellers = users.filter((u: any) => u.role === 'VENDEDOR').map((u: any) => ({ id: u.id, username: u.username }));
      
      // Simulation metrics calculations
      const filteredClientIds = new Set(filteredClients.map((c: any) => c.id));
      let orders = (mockDb.get('db_orders') || []).filter((o: any) => o.status === 'DELIVERED' && filteredClientIds.has(o.personaId || o.clientId));
      
      // Filter simulation orders by date
      if (filters.startDate) {
        const start = new Date(filters.startDate).getTime();
        orders = orders.filter((o: any) => new Date(o.createdAt).getTime() >= start);
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        const endTime = end.getTime();
        orders = orders.filter((o: any) => new Date(o.createdAt).getTime() <= endTime);
      }

      const products = mockDb.get('db_products') || [];
      const productLookup = new Map<number, any>(products.map((p: any) => [p.id, p]));

      const clientMap = new Map<number, any>();
      const productMap = new Map<number, any>();
      const weeklyMap = new Map<string, any>();

      for (const order of orders) {
        const totalAmount = Number(order.totalAmount) || 0;
        const clientId = order.personaId || order.clientId;
        const client = filteredClients.find((c: any) => c.id === clientId);
        const clientName = client ? client.name : `Cliente ${clientId}`;
        const clientCity = client && client.city ? client.city : 'Sin especificar';

        // 1. Client
        const clientData = clientMap.get(clientId) || {
          id: clientId,
          name: clientName,
          city: clientCity,
          totalSpent: 0,
          ordersCount: 0
        };
        clientData.totalSpent += totalAmount;
        clientData.ordersCount += 1;
        clientMap.set(clientId, clientData);

        // 2. Weekly
        const orderDate = new Date(order.createdAt);
        const day = orderDate.getDay();
        const diff = orderDate.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(orderDate.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        const weekKey = monday.toISOString().split('T')[0];

        const weekData = weeklyMap.get(weekKey) || {
          weekStart: weekKey,
          dateObj: monday,
          total: 0,
          count: 0
        };
        weekData.total += totalAmount;
        weekData.count += 1;
        weeklyMap.set(weekKey, weekData);

        // 3. Products
        for (const item of (order.items || [])) {
          const prodId = item.productId;
          const qty = item.quantity;
          const subtotal = Number(item.subtotal) || (qty * Number(item.unitPrice || 0));

          const product = productLookup.get(prodId);
          const sku = product ? product.sku : `SKU-${prodId}`;
          const name = product ? product.name : `Producto ${prodId}`;

          const prodData = productMap.get(prodId) || {
            id: prodId,
            sku,
            name,
            qty: 0,
            revenue: 0
          };
          prodData.qty += qty;
          prodData.revenue += subtotal;
          productMap.set(prodId, prodData);
        }
      }

      const topClients = Array.from(clientMap.values())
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10);

      const topProducts = Array.from(productMap.values())
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10);

      const bottomProducts = Array.from(productMap.values())
        .sort((a, b) => a.qty - b.qty)
        .slice(0, 10);

      const weeklyInvoicing = Array.from(weeklyMap.values())
        .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
        .map(w => ({
          weekStart: w.weekStart,
          total: w.total,
          count: w.count
        }));

      const activeProductsList = products.filter((p: any) => Number(p.stock) > 0);
      const deadStockProducts = activeProductsList
        .filter((p: any) => !productMap.has(p.id))
        .map((p: any) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          stock: Number(p.stock),
          qty: 0,
          revenue: 0
        }))
        .sort((a: any, b: any) => b.stock - a.stock)
        .slice(0, 10);

      return {
        totalClients,
        totalDebt,
        clients: filteredClients,
        availableCities,
        availableSellers,
        topClients,
        topProducts,
        bottomProducts,
        weeklyInvoicing,
        deadStockProducts
      };
    }
    
    const params = [];
    if (filters.city) params.push(`city=${encodeURIComponent(filters.city)}`);
    if (filters.sellerId) params.push(`sellerId=${filters.sellerId}`);
    if (filters.startDate) params.push(`startDate=${encodeURIComponent(filters.startDate)}`);
    if (filters.endDate) params.push(`endDate=${encodeURIComponent(filters.endDate)}`);
    const query = params.length > 0 ? `?${params.join('&')}` : '';
    
    return await request(`/admin/reports/zones${query}`);
  },

  getAuditLogs: async (page = 1, limit = 50) => {
    if (simulationMode) {
      const logs = mockDb.get('db_audit');
      const start = (page - 1) * limit;
      const paginated = logs.slice(start, start + limit);
      return {
        logs: paginated,
        pagination: {
          total: logs.length,
          page,
          limit,
          totalPages: Math.ceil(logs.length / limit)
        }
      };
    }
    const res = await request(`/admin/audit-logs?page=${page}&limit=${limit}`);
    return res;
  },

  getUsers: async () => {
    if (simulationMode) {
      return mockDb.get('db_users');
    }
    const res = await request('/admin/users');
    return res.users;
  },

  createUser: async (userData: any) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const users = mockDb.get('db_users');
      if (users.some((u: any) => u.username === userData.username)) {
        throw new Error('El nombre de usuario ya existe.');
      }
      const newUser = {
        id: users.length + 1,
        username: userData.username,
        role: userData.role,
        isActive: true,
        createdAt: new Date().toISOString()
      };
      mockDb.set('db_users', [...users, newUser]);
      mockDb.log(user.id, user.username, user.role, 'CREATE_USER', 'User', newUser.id, null, { username: newUser.username, role: newUser.role });
      return newUser;
    }
    const res = await request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    return res.user;
  },

  toggleUserStatus: async (id: number) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const users = mockDb.get('db_users');
      const idx = users.findIndex((u: any) => u.id === id);
      if (idx === -1) throw new Error('Usuario no encontrado.');

      if (id === user.id) {
        throw new Error('No podés desactivar tu propio usuario.');
      }

      const target = users[idx];
      const oldActive = target.isActive;
      target.isActive = !target.isActive;
      mockDb.set('db_users', users);

      mockDb.log(user.id, user.username, user.role, 'TOGGLE_USER_STATUS', 'User', id, { isActive: oldActive }, { isActive: target.isActive });
      return target;
    }
    const res = await request(`/admin/users/${id}/toggle`, {
      method: 'POST'
    });
    return res.user;
  },

  // --- FINANZAS (CAJAS Y BANCOS) ---
  openDrawer: async (branch: string, openingBalance: number) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const drawers = mockDb.get('db_cash_drawers');
      const drawerBranch = branch || 'CONSOLIDADA';
      const active = drawers.find((d: any) => d.status === 'OPEN' && d.branch === drawerBranch);
      if (active) {
        throw new Error(`La caja ${drawerBranch} ya se encuentra abierta.`);
      }

      const newDrawer = {
        id: drawers.length + 1,
        userId: user.id,
        branch: drawerBranch,
        openingBalance: Number(openingBalance),
        closingBalance: null,
        realBalance: null,
        status: 'OPEN',
        openedAt: new Date().toISOString(),
        closedAt: null
      };

      mockDb.set('db_cash_drawers', [...drawers, newDrawer]);
      mockDb.log(user.id, user.username, user.role, 'OPEN_CASH_DRAWER', 'CashDrawer', newDrawer.id, null, newDrawer);
      return newDrawer;
    }

    const res = await request('/finance/drawers/open', {
      method: 'POST',
      body: JSON.stringify({ branch, openingBalance })
    });
    return res.drawer;
  },

  closeDrawer: async (drawerId: number, realBalance: number, receipts?: any[], checks?: any[]) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const drawers = mockDb.get('db_cash_drawers');
      const idx = drawers.findIndex((d: any) => d.id === drawerId);
      if (idx === -1) throw new Error('Caja no encontrada.');

      const drawer = drawers[idx];
      if (drawer.status === 'CLOSED') {
        throw new Error('Esta caja ya se encuentra cerrada.');
      }

      const trans = mockDb.get('db_transactions');
      const cashTrans = trans.filter((t: any) => t.cashDrawerId === drawer.id);
      
      let cashIncome = 0;
      let cashOutcome = 0;
      cashTrans.forEach((t: any) => {
        if (t.type === 'INCOME') {
          cashIncome += Number(t.amount);
        } else {
          cashOutcome += Number(t.amount);
        }
      });


      // Simular recibos
      if (receipts && receipts.length > 0) {
        receipts.forEach((r: any) => {
          trans.push({
            id: trans.length > 0 ? trans[trans.length - 1].id + 1 : 1,
            personaId: Number(r.clientId),
            userId: user.id,
            billingType: r.billingType || 'INTERNAL',
            type: 'INCOME',
            paymentMethod: r.paymentMethod || 'CASH',
            amount: Number(r.amount),
            description: 'Recibo/Cobranza - Arqueo de Caja',
            cashDrawerId: drawer.id,
            createdAt: new Date().toISOString(),
            verified: false
          });
          cashIncome += Number(r.amount);
        });
        mockDb.set('db_transactions', trans);
      }

      const closingBalance = Number(drawer.openingBalance) + cashIncome - cashOutcome;

      drawer.status = 'CLOSED';
      drawer.closingBalance = closingBalance;
      drawer.realBalance = Number(realBalance);
      drawer.closedAt = new Date().toISOString();

      drawers[idx] = drawer;
      mockDb.set('db_cash_drawers', drawers);
      mockDb.log(user.id, user.username, user.role, 'CLOSE_CASH_DRAWER', 'CashDrawer', drawerId, null, drawer);
      return drawer;
    }

    const res = await request('/finance/drawers/close', {
      method: 'POST',
      body: JSON.stringify({ drawerId, realBalance, receipts, checks })
    });
    return res.drawer;
  },

  getActiveDrawer: async () => {
    const user = api.getCurrentUser();
    if (!user) return null;
    if (simulationMode) {
      const drawers = mockDb.get('db_cash_drawers');
      const active = drawers.find((d: any) => d.userId === user.id && d.status === 'OPEN');
      return active || null;
    }

    try {
      const res = await request('/finance/drawers/active');
      return res.drawer;
    } catch {
      return null;
    }
  },

  getActiveDrawers: async () => {
    const user = api.getCurrentUser();
    if (!user) return [];
    if (simulationMode) {
      const drawers = mockDb.get('db_cash_drawers');
      return drawers.filter((d: any) => d.status === 'OPEN');
    }

    try {
      const res = await request('/finance/drawers/active-all');
      return res.drawers || [];
    } catch {
      return [];
    }
  },

  closeJointDrawers: async (payload: { realBalanceA: number; realBalanceX: number }) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const drawers = mockDb.get('db_cash_drawers');
      const activeDrawers = drawers.filter((d: any) => d.userId === user.id && d.status === 'OPEN');
      const trans = mockDb.get('db_transactions');
      const closedList: any[] = [];

      activeDrawers.forEach((drawer: any) => {
        const idx = drawers.findIndex((d: any) => d.id === drawer.id);
        const cashTrans = trans.filter((t: any) => t.cashDrawerId === drawer.id);
        let cashIncome = 0;
        let cashOutcome = 0;
        cashTrans.forEach((t: any) => {
          if (t.type === 'INCOME') cashIncome += Number(t.amount);
          else cashOutcome += Number(t.amount);
        });
        const closingBalance = Number(drawer.openingBalance) + cashIncome - cashOutcome;

        let realBalance = closingBalance;
        if (drawer.branch === 'A' && payload.realBalanceA !== undefined && payload.realBalanceA !== null) {
          realBalance = Number(payload.realBalanceA);
        } else if (drawer.branch === 'X' && payload.realBalanceX !== undefined && payload.realBalanceX !== null) {
          realBalance = Number(payload.realBalanceX);
        } else if (drawer.branch === 'CONSOLIDADA') {
          realBalance = payload.realBalanceA !== undefined && payload.realBalanceA !== null ? Number(payload.realBalanceA) : 
                       (payload.realBalanceX !== undefined && payload.realBalanceX !== null ? Number(payload.realBalanceX) : closingBalance);
        }

        drawer.status = 'CLOSED';
        drawer.closingBalance = closingBalance;
        drawer.realBalance = realBalance;
        drawer.closedAt = new Date().toISOString();

        drawers[idx] = drawer;
        closedList.push(drawer);
        mockDb.log(user.id, user.username, user.role, 'CLOSE_CASH_DRAWER', 'CashDrawer', drawer.id, null, drawer);
      });

      mockDb.set('db_cash_drawers', drawers);
      return { drawers: closedList };
    }

    const res = await request('/finance/drawers/close-joint', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res.data;
  },

  getBankAccounts: async () => {
    if (simulationMode) {
      return mockDb.get('db_bank_accounts');
    }
    const res = await request('/finance/bank-accounts');
    return res.accounts;
  },

  createBankAccount: async (bankData: any) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const banks = mockDb.get('db_bank_accounts');
      const newBank = {
        id: banks.length + 1,
        name: bankData.name,
        accountNumber: bankData.accountNumber || '',
        balance: Number(bankData.balance || 0),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockDb.set('db_bank_accounts', [...banks, newBank]);
      mockDb.log(user.id, user.username, user.role, 'CREATE_BANK_ACCOUNT', 'BankAccount', newBank.id, null, newBank);
      return newBank;
    }
    const res = await request('/finance/bank-accounts', {
      method: 'POST',
      body: JSON.stringify(bankData)
    });
    return res.account;
  },

  transferFunds: async (amount: number, bankAccountId: number, description?: string) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const drawers = mockDb.get('db_cash_drawers');
      const active = drawers.find((d: any) => d.userId === user.id && d.status === 'OPEN');
      if (!active) {
        throw new Error('No tenés ninguna caja abierta. Abrí una caja antes de transferir efectivo.');
      }

      const banks = mockDb.get('db_bank_accounts');
      const bIdx = banks.findIndex((b: any) => b.id === Number(bankAccountId));
      if (bIdx === -1) throw new Error('Cuenta de banco no encontrada.');

      const bank = banks[bIdx];
      const transferAmount = Number(amount);

      const trans = mockDb.get('db_transactions');
      const t1 = {
        id: trans.length + 1,
        userId: user.id,
        billingType: active.branch === 'A' ? 'OFFICIAL' : 'INTERNAL',
        type: 'OUTCOME',
        paymentMethod: 'CASH',
        amount: transferAmount,
        description: description || `Depósito de efectivo a cuenta de banco ${bank.name}`,
        cashDrawerId: active.id,
        createdAt: new Date().toISOString()
      };

      const t2 = {
        id: trans.length + 2,
        userId: user.id,
        billingType: active.branch === 'A' ? 'OFFICIAL' : 'INTERNAL',
        type: 'INCOME',
        paymentMethod: 'BANK_TRANSFER',
        amount: transferAmount,
        description: description || `Depósito recibido desde caja`,
        bankAccountId: bank.id,
        createdAt: new Date().toISOString()
      };

      mockDb.set('db_transactions', [...trans, t1, t2]);

      bank.balance = Number(bank.balance) + transferAmount;
      bank.updatedAt = new Date().toISOString();
      mockDb.set('db_bank_accounts', banks);

      mockDb.log(user.id, user.username, user.role, 'DEPOSIT_CASH_TO_BANK', 'BankAccount', bank.id, null, {
        amount: transferAmount,
        cashDrawerId: active.id
      });

      return {
        drawerTransaction: t1,
        bankTransaction: t2,
        bankAccount: bank
      };
    }

    const res = await request('/finance/bank-accounts/transfer', {
      method: 'POST',
      body: JSON.stringify({ amount, bankAccountId, description })
    });
    return res;
  },

  getTransactions: async (filters?: any) => {
    if (simulationMode) {
      let trans = mockDb.get('db_transactions');
      const personas = mockDb.get('db_personas');
      const users = mockDb.get('db_users');
      const drawers = mockDb.get('db_cash_drawers');
      const banks = mockDb.get('db_bank_accounts');

      if (filters) {
        if (filters.branch) {
          const type = filters.branch === 'A' ? 'OFFICIAL' : 'INTERNAL';
          trans = trans.filter((t: any) => t.billingType === type);
        }
        if (filters.cashDrawerId) {
          trans = trans.filter((t: any) => t.cashDrawerId === Number(filters.cashDrawerId));
        }
        if (filters.bankAccountId) {
          trans = trans.filter((t: any) => t.bankAccountId === Number(filters.bankAccountId));
        }
        if (filters.paymentMethod) {
          trans = trans.filter((t: any) => t.paymentMethod === filters.paymentMethod);
        }
        if (filters.verified !== undefined && filters.verified !== 'ALL') {
          const isVerified = filters.verified === 'true' || filters.verified === true;
          trans = trans.filter((t: any) => !!t.verified === isVerified);
        }
      }

      return trans.map((t: any) => ({
        ...t,
        user: users.find((u: any) => u.id === t.userId) || { username: 'Desconocido' },
        persona: personas.find((p: any) => p.id === t.personaId) || null,
        cashDrawer: drawers.find((d: any) => d.id === t.cashDrawerId) || null,
        bankAccount: banks.find((b: any) => b.id === t.bankAccountId) || null
      }));
    }

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

  getCashDrawers: async () => {
    if (simulationMode) {
      const drawers = mockDb.get('db_cash_drawers') || [];
      const users = mockDb.get('db_users') || [];
      return drawers.map((d: any) => ({
        ...d,
        openedByUser: users.find((u: any) => u.id === d.openedById) || null,
        closedByUser: users.find((u: any) => u.id === d.closedById) || null
      }));
    }
    try {
      const res = await request('/finance/drawers/history');
      return res.drawers || [];
    } catch {
      return [];
    }
  },

  verifyTransaction: async (id: number, verified: boolean) => {
    if (simulationMode) {
      const trans = mockDb.get('db_transactions');
      const idx = trans.findIndex((t: any) => t.id === Number(id));
      if (idx === -1) throw new Error('Transacción no encontrada.');
      trans[idx].verified = Boolean(verified);
      mockDb.set('db_transactions', trans);
      return trans[idx];
    }

    const res = await request(`/finance/transactions/${id}/verify`, {
      method: 'PUT',
      body: JSON.stringify({ verified })
    });
    return res;
  },

  getProductByBarcode: async (barcode: string) => {
    if (simulationMode) {
      const prods = mockDb.get('db_products');
      const lots = mockDb.get('db_product_lots');
      const matched = prods.find((p: any) => p.barcode === barcode.trim());
      if (!matched) throw new Error('Producto no encontrado por código de barras.');
      return {
        ...matched,
        lots: lots.filter((l: any) => l.productId === matched.id).sort((a: any, b: any) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime())
      };
    }
    const res = await request(`/products/barcode/${barcode}`);
    return res.product;
  },

  importPrices: async (rows: any[]) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const prods = mockDb.get('db_products');
      let updatedCount = 0;
      let createdCount = 0;
      const failedItems: { sku: string; error: string }[] = [];

      for (const row of rows) {
        const { sku, name, costPrice, listPrice, listPriceB, listPriceC, barcode } = row;
        if (!sku) {
          failedItems.push({ sku: 'S/D', error: 'SKU es requerido.' });
          continue;
        }

        const idx = prods.findIndex((p: any) => p.sku === sku);
        if (idx !== -1) {
          const oldVal = prods[idx];
          if (barcode && barcode !== oldVal.barcode) {
            if (prods.some((p: any) => p.barcode === barcode)) {
              failedItems.push({ sku, error: `El código de barras ${barcode} ya está asignado.` });
              continue;
            }
          }

          const newVal = {
            ...oldVal,
            name: name !== undefined ? name : oldVal.name,
            costPrice: costPrice !== undefined ? Number(costPrice) : oldVal.costPrice,
            listPrice: listPrice !== undefined ? Number(listPrice) : oldVal.listPrice,
            listPriceB: listPriceB !== undefined ? Number(listPriceB) : (oldVal.listPriceB || 0),
            listPriceC: listPriceC !== undefined ? Number(listPriceC) : (oldVal.listPriceC || 0),
            barcode: barcode !== undefined ? (barcode || null) : oldVal.barcode
          };
          prods[idx] = newVal;
          updatedCount++;
        } else {
          // Crear si tiene mínimos
          if (!name || costPrice === undefined || listPrice === undefined) {
            failedItems.push({ sku, error: 'Datos mínimos insuficientes para crear (Nombre, costo o lista A vacíos).' });
            continue;
          }

          if (barcode) {
            if (prods.some((p: any) => p.barcode === barcode)) {
              failedItems.push({ sku, error: `El código de barras ${barcode} ya está asignado.` });
              continue;
            }
          }

          const newProd = {
            id: prods.length + 1,
            sku,
            name,
            costPrice: Number(costPrice),
            listPrice: Number(listPrice),
            listPriceB: listPriceB !== undefined ? Number(listPriceB) : 0,
            listPriceC: listPriceC !== undefined ? Number(listPriceC) : 0,
            barcode: barcode || null,
            stock: 0,
            minStock: 0,
            createdAt: new Date().toISOString()
          };
          prods.push(newProd);
          createdCount++;
        }
      }

      mockDb.set('db_products', prods);
      mockDb.log(user.id, user.username, user.role, 'IMPORT_PRODUCTS_CSV', 'Product', 0, null, { updatedCount, createdCount, failedCount: failedItems.length });
      return { updatedCount, createdCount, failedItems };
    }

    const res = await request('/products/import-prices', {
      method: 'POST',
      body: JSON.stringify({ products: rows })
    });
    return res.data;
  },

  getRubros: async () => {
    if (simulationMode) {
      return mockDb.get('db_rubros');
    }
    const res = await request('/rubros');
    return res.rubros;
  },

  createRubro: async (rubroData: { name: string; description?: string; profitMargin?: number }) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const rubros = mockDb.get('db_rubros');
      if (rubros.some((r: any) => r.name.toLowerCase() === rubroData.name.toLowerCase())) {
        throw new Error('El rubro ya existe.');
      }
      const newRubro = {
        id: rubros.length + 1,
        name: rubroData.name,
        description: rubroData.description || '',
        profitMargin: rubroData.profitMargin !== undefined ? Number(rubroData.profitMargin) : 1.25,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockDb.set('db_rubros', [...rubros, newRubro]);
      mockDb.log(user.id, user.username, user.role, 'CREATE_RUBRO', 'Rubro', newRubro.id, null, newRubro);
      return newRubro;
    }
    const res = await request('/rubros', {
      method: 'POST',
      body: JSON.stringify(rubroData)
    });
    return res.rubro;
  },

  updateRubro: async (id: number, rubroData: { name?: string; description?: string; profitMargin?: number }) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const rubros = mockDb.get('db_rubros');
      const idx = rubros.findIndex((r: any) => r.id === id);
      if (idx === -1) throw new Error('Rubro no encontrado.');
      const oldVal = rubros[idx];
      if (rubroData.name && rubroData.name.toLowerCase() !== oldVal.name.toLowerCase()) {
        if (rubros.some((r: any) => r.name.toLowerCase() === rubroData.name!.toLowerCase())) {
          throw new Error('El nombre de rubro ya existe.');
        }
      }
      const newVal = {
        ...oldVal,
        ...rubroData,
        updatedAt: new Date().toISOString()
      };
      
      rubros[idx] = newVal;
      mockDb.set('db_rubros', rubros);
      
      if (rubroData.profitMargin !== undefined && Number(rubroData.profitMargin) !== Number(oldVal.profitMargin)) {
        const prods = mockDb.get('db_products');
        const val = Number(rubroData.profitMargin);
        const updatedProds = prods.map((p: any) => {
          if (p.rubroId === id) {
            const cost = Number(p.costPrice);
            const precioFinal = cost * val;
            const precioSinIva = precioFinal / 1.21;
            return {
              ...p,
              listPrice: Math.max(0, Math.round(precioSinIva * 100) / 100)
            };
          }
          return p;
        });
        mockDb.set('db_products', updatedProds);
      }
      
      mockDb.log(user.id, user.username, user.role, 'UPDATE_RUBRO', 'Rubro', id, oldVal, newVal);
      return newVal;
    }
    const res = await request(`/rubros/${id}`, {
      method: 'PUT',
      body: JSON.stringify(rubroData)
    });
    return res.rubro;
  },

  deleteRubro: async (id: number) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const rubros = mockDb.get('db_rubros');
      const idx = rubros.findIndex((r: any) => r.id === id);
      if (idx === -1) throw new Error('Rubro no encontrado.');
      const oldVal = rubros[idx];

      const prods = mockDb.get('db_products');
      const updatedProds = prods.map((p: any) => p.rubroId === id ? { ...p, rubroId: null } : p);
      mockDb.set('db_products', updatedProds);

      const filtered = rubros.filter((r: any) => r.id !== id);
      mockDb.set('db_rubros', filtered);
      mockDb.log(user.id, user.username, user.role, 'DELETE_RUBRO', 'Rubro', id, oldVal, null);
      return { success: true };
    }
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
    const user = api.getCurrentUser();
    if (simulationMode) {
      const prods = mockDb.get('db_products');
      let updatedCount = 0;
      const updatedProds = prods.map((p: any) => {
        if (params.rubroId && p.rubroId !== Number(params.rubroId)) return p;
        if (params.providerId && p.providerId !== Number(params.providerId)) return p;

        const updateData: any = {};
        const fieldsToUpdate = params.priceList === 'all'
          ? ['listPrice', 'listPriceB', 'listPriceC']
          : [params.priceList];

        fieldsToUpdate.forEach((field: string) => {
          const cost = Number(p.costPrice || 0);
          const currentVal = Number(p[field] || 0);
          let newVal = currentVal;

          if (params.type === 'margin') {
            newVal = cost * (1 + params.value / 100);
          } else if (params.type === 'percentage') {
            const base = params.basis === 'cost' ? cost : currentVal;
            newVal = base * (1 + params.value / 100);
          } else if (params.type === 'fixed') {
            newVal = currentVal + params.value;
          }

          updateData[field] = Math.max(0, Math.round(newVal * 100) / 100);
        });

        updatedCount++;
        return { ...p, ...updateData };
      });

      mockDb.set('db_products', updatedProds);
      mockDb.log(user.id, user.username, user.role, 'BULK_UPDATE_PRICES', 'Product', 0, null, {
        rubroId: params.rubroId,
        providerId: params.providerId,
        type: params.type,
        value: params.value,
        priceList: params.priceList,
        updatedCount
      });
      return { updatedCount };
    }

    const res = await request('/products/bulk-update-prices', {
      method: 'POST',
      body: JSON.stringify(params)
    });
    return res;
  },

  getSalesInvoices: async (filters?: any) => {
    if (simulationMode) {
      const orders = mockDb.get('db_orders');
      const personas = mockDb.get('db_personas');
      const users = mockDb.get('db_users');
      
      let filtered = orders.filter((o: any) => o.status === 'DELIVERED' && o.invoiceNumber);

      if (filters) {
        if (filters.startDate && filters.endDate) {
          const start = new Date(filters.startDate).getTime();
          const end = new Date(filters.endDate).getTime();
          filtered = filtered.filter((o: any) => {
            const t = new Date(o.createdAt).getTime();
            return t >= start && t <= end;
          });
        }
        if (filters.query) {
          const q = filters.query.toLowerCase();
          filtered = filtered.filter((o: any) => {
            const p = personas.find((c: any) => c.id === (o.personaId || o.clientId));
            return o.invoiceNumber.toLowerCase().includes(q) || 
                   (p && (p.name.toLowerCase().includes(q) || p.cuit.includes(q)));
          });
        }
      }

      return filtered.map((o: any) => ({
        ...o,
        persona: personas.find((c: any) => c.id === (o.personaId || o.clientId)) || { name: 'Desconocido', cuit: '' },
        seller: users.find((u: any) => u.id === o.sellerId) || { username: 'Desconocido' }
      })).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

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
    if (simulationMode) {
      const invoices = mockDb.get('db_supplier_invoices');
      const personas = mockDb.get('db_personas');
      
      let filtered = [...invoices];

      if (filters) {
        if (filters.startDate && filters.endDate) {
          const start = new Date(filters.startDate).getTime();
          const end = new Date(filters.endDate).getTime();
          filtered = filtered.filter((o: any) => {
            const t = new Date(o.issueDate).getTime();
            return t >= start && t <= end;
          });
        }
        if (filters.query) {
          const q = filters.query.toLowerCase();
          filtered = filtered.filter((o: any) => {
            const p = personas.find((c: any) => c.id === o.personaId);
            return o.invoiceNumber.toLowerCase().includes(q) || 
                   (p && (p.name.toLowerCase().includes(q) || p.cuit.includes(q)));
          });
        }
      }

      return filtered.map((o: any) => ({
        ...o,
        persona: personas.find((c: any) => c.id === o.personaId) || { name: 'Desconocido', cuit: '' }
      })).sort((a: any, b: any) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
    }

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
    const user = api.getCurrentUser();
    if (simulationMode) {
      const invoices = mockDb.get('db_supplier_invoices') || [];
      const personas = mockDb.get('db_personas');
      
      const newInvoice = {
        id: invoices.length + 1,
        ...invoiceData,
        personaId: Number(invoiceData.personaId),
        dueDate: invoiceData.dueDate 
          ? new Date(invoiceData.dueDate).toISOString() 
          : new Date(new Date(invoiceData.issueDate || Date.now()).getTime() + 30 * 24 * 3600 * 1000).toISOString(),
        status: 'PENDING',
        paidAmount: 0.00,
        netAmount: Number(invoiceData.netAmount),
        taxAmount: Number(invoiceData.taxAmount),
        percepcionAmount: Number(invoiceData.percepcionAmount || 0),
        totalAmount: Number(invoiceData.totalAmount),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockDb.set('db_supplier_invoices', [...invoices, newInvoice]);

      // Descontar saldo CC (saldo impositivo negativo proveedor)
      const pIdx = personas.findIndex((p: any) => p.id === newInvoice.personaId);
      if (pIdx !== -1) {
        personas[pIdx].outstandingBalance = Number(personas[pIdx].outstandingBalance || 0) - newInvoice.totalAmount;
        mockDb.set('db_personas', personas);
      }

      // Asentar percepcion sufrida si hay
      if (newInvoice.percepcionAmount > 0) {
        const withholdings = mockDb.get('db_tax_withholdings');
        const prov = personas.find((p: any) => p.id === newInvoice.personaId);
        const newRecord = {
          id: withholdings.length + 1,
          type: 'PERCEPCION_SUFRIDA',
          taxType: 'IIBB',
          personaId: newInvoice.personaId,
          number: newInvoice.invoiceNumber,
          date: newInvoice.issueDate,
          amount: newInvoice.percepcionAmount,
          jurisdiction: (prov && prov.address && prov.address.includes('CABA')) ? 'AR-C' : 'AR-B',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        mockDb.set('db_tax_withholdings', [...withholdings, newRecord]);
      }

      mockDb.log(user.id, user.username, user.role, 'CREATE_SUPPLIER_INVOICE', 'SupplierInvoice', newInvoice.id, null, newInvoice);
      return newInvoice;
    }

    const res = await request('/billing/purchases', {
      method: 'POST',
      body: JSON.stringify(invoiceData)
    });
    return res.invoice;
  },

  getCreditNotes: async (filters?: any) => {
    if (simulationMode) {
      const creditNotes = mockDb.get('db_credit_notes');
      const personas = mockDb.get('db_personas');
      const users = mockDb.get('db_users');
      const orders = mockDb.get('db_orders');

      let filtered = [...creditNotes];

      if (filters) {
        if (filters.startDate && filters.endDate) {
          const start = new Date(filters.startDate).getTime();
          const end = new Date(filters.endDate).getTime();
          filtered = filtered.filter((cn: any) => {
            const t = new Date(cn.createdAt).getTime();
            return t >= start && t <= end;
          });
        }
        if (filters.query) {
          const q = filters.query.toLowerCase();
          filtered = filtered.filter((cn: any) => {
            const p = personas.find((c: any) => c.id === cn.personaId);
            return (cn.creditNoteNumber && cn.creditNoteNumber.toLowerCase().includes(q)) ||
                   (p && (p.name.toLowerCase().includes(q) || p.cuit.includes(q)));
          });
        }
      }

      return filtered.map((cn: any) => ({
        ...cn,
        persona: personas.find((c: any) => c.id === cn.personaId) || { name: 'Desconocido', cuit: '' },
        user: users.find((u: any) => u.id === cn.userId) || { username: 'Desconocido' },
        order: cn.orderId ? orders.find((o: any) => o.id === cn.orderId) : null
      })).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    let path = '/billing/credit-notes';
    if (filters) {
      const params = [];
      if (filters.startDate) params.push(`startDate=${filters.startDate}`);
      if (filters.endDate) params.push(`endDate=${filters.endDate}`);
      if (filters.query) params.push(`query=${filters.query}`);
      if (params.length > 0) path += `?${params.join('&')}`;
    }
    const res = await request(path);
    return res.creditNotes;
  },

  createCreditNote: async (data: any) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const creditNotes = mockDb.get('db_credit_notes');
      const personas = mockDb.get('db_personas');
      const products = mockDb.get('db_products');
      const productLots = mockDb.get('db_product_lots');
      const orders = mockDb.get('db_orders');
      const stockMovements = mockDb.get('db_stock_movements') || [];

      const persona = personas.find((c: any) => c.id === Number(data.personaId));
      if (!persona) throw new Error('Cliente no encontrado.');

      let totalAmount = 0;
      const cnItems: any[] = [];

      for (const item of data.items) {
        const prod = products.find((p: any) => p.id === Number(item.productId));
        if (!prod) throw new Error(`Producto con ID ${item.productId} no encontrado.`);

        const isPesable = prod.isPesable;
        const actualQtyOrWeight = isPesable
          ? (item.weight ? Number(item.weight) : Number(item.quantity) * Number(prod.approximateWeight || 1))
          : Number(item.quantity);

        const itemTotal = actualQtyOrWeight * Number(item.unitPrice);
        totalAmount += itemTotal;

        cnItems.push({
          productId: prod.id,
          product: prod,
          quantity: Number(item.quantity),
          weight: isPesable ? actualQtyOrWeight : null,
          unitPrice: Number(item.unitPrice),
          subtotal: itemTotal
        });

        // Si es devolución física, asentar stock
        if (data.reason === 'DEVOLUCION') {
          prod.stock = Number(prod.stock || 0) + Number(item.quantity);

          // Agregar StockMovement
          stockMovements.push({
            id: stockMovements.length + 1,
            productId: prod.id,
            quantity: Number(item.quantity),
            type: 'IN',
            referenceId: `NC-MOCK`,
            userId: user.id,
            reason: `Devolución de cliente (Simulada): ${persona.name}`,
            createdAt: new Date().toISOString()
          });

          // Devolver al lote si hay orden
          if (data.orderId) {
            const order = orders.find((o: any) => o.id === Number(data.orderId));
            if (order && order.items) {
              const lot = productLots.find((l: any) => l.productId === prod.id);
              if (lot) {
                lot.stock = Number(lot.stock || 0) + Number(item.quantity);
              }
            }
          }
        }
      }

      let creditNoteType = 'NOTA_CREDITO_INTERNA';
      let creditNoteNumber = '';
      let cae = null;
      let caeDueDate = null;

      if (data.billingType === 'OFFICIAL') {
        const cuitLimpio = persona.cuit ? persona.cuit.replace(/-/g, '') : '';
        let isA = cuitLimpio.length === 11;
        creditNoteType = isA ? 'NOTA_CREDITO_A' : 'NOTA_CREDITO_B';

        const mockInvoiceNum = Math.floor(100000 + Math.random() * 900000);
        creditNoteNumber = `00001-${mockInvoiceNum.toString().padStart(8, '0')}`;
        cae = '9999' + Math.floor(10000000 + Math.random() * 90000000) + '2';
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 10);
        caeDueDate = dueDate.toISOString();
      } else {
        const count = creditNotes.filter((cn: any) => cn.billingType === 'INTERNAL').length;
        creditNoteNumber = `NCI-${(count + 1).toString().padStart(8, '0')}`;
      }

      const newCreditNote = {
        id: creditNotes.length + 1,
        personaId: Number(data.personaId),
        orderId: data.orderId ? Number(data.orderId) : null,
        userId: user.id,
        billingType: data.billingType,
        creditNoteType,
        creditNoteNumber,
        cae,
        caeDueDate,
        totalAmount,
        netAmount: totalAmount / 1.21,
        taxAmount: totalAmount - (totalAmount / 1.21),
        reason: data.reason,
        comments: data.comments || '',
        items: cnItems,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockDb.set('db_credit_notes', [...creditNotes, newCreditNote]);
      mockDb.set('db_products', products);
      mockDb.set('db_product_lots', productLots);
      mockDb.set('db_stock_movements', stockMovements);

      // Decrementar Cuenta Corriente del cliente
      const pIdx = personas.findIndex((p: any) => p.id === persona.id);
      if (pIdx !== -1) {
        personas[pIdx].outstandingBalance = Number(personas[pIdx].outstandingBalance || 0) - totalAmount;
        mockDb.set('db_personas', personas);
      }

      mockDb.log(user.id, user.username, user.role, 'CREATE_CREDIT_NOTE', 'CreditNote', newCreditNote.id, null, newCreditNote);
      return newCreditNote;
    }

    const res = await request('/billing/credit-notes', {
      method: 'POST',
      body: JSON.stringify(data)
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
    const user = api.getCurrentUser();
    if (simulationMode) {
      const orders = mockDb.get('db_orders');
      const products = mockDb.get('db_products');
      const productLots = mockDb.get('db_product_lots');
      const personas = mockDb.get('db_personas');
      const transactions = mockDb.get('db_transactions');
      const withholdings = mockDb.get('db_tax_withholdings');
      const drawers = mockDb.get('db_cash_drawers') || [];

      const persona = personas.find((c: any) => c.id === payload.personaId);
      if (!persona) throw new Error('Cliente no encontrado.');

      let totalSum = 0;
      const orderItems: any[] = [];

      // 1. Procesar items, precios y stock general
      for (const item of payload.items) {
        const prodIdx = products.findIndex((p: any) => p.id === item.productId);
        if (prodIdx === -1) throw new Error('Producto no encontrado.');
        const prod = products[prodIdx];

        if (prod.stock < item.quantity) {
          throw new Error(`Stock insuficiente para "${prod.name}" (Disponible: ${prod.stock}).`);
        }

        // Determinar precio según lista
        let selectedPrice = Number(prod.listPrice);
        let itemDiscount = Number(persona.discount || 0);

        if (persona.priceList === 'B') {
          const isMelincue = prod.description?.toUpperCase() === 'MELINCUE' || prod.name?.toUpperCase().includes('MELINCUE');
          if (isMelincue) {
            itemDiscount = 3;
          } else {
            itemDiscount = 0;
          }
        }

        // Aplicar descuento
        const finalUnitPrice = selectedPrice * (1 - itemDiscount / 100);
        const subtotal = finalUnitPrice * item.quantity;
        totalSum += subtotal;

        // Restar stock general
        prod.stock -= item.quantity;

        orderItems.push({
          id: orderItems.length + 1,
          productId: prod.id,
          product: { id: prod.id, name: prod.name, sku: prod.sku },
          quantity: item.quantity,
          unitPrice: finalUnitPrice,
          subtotal,
          orderItemLots: [] as any[]
        });
      }

      // 2. Validar limite de crédito
      const creditLimit = Number(persona.creditLimit || 0);
      const outstandingBalance = Number(persona.outstandingBalance || 0);
      if (creditLimit > 0 && (outstandingBalance + totalSum) > creditLimit) {
        if (user.role !== 'ADMIN') {
          throw new Error(
            `Límite de crédito excedido. Saldo actual: $${outstandingBalance.toLocaleString()}, Disponible: $${(creditLimit - outstandingBalance).toLocaleString()}, Requerido: $${totalSum.toLocaleString()}.`
          );
        }
      }

      // Validar regla de boleta contra boleta
      if (!payload.paymentMethod && outstandingBalance > 0) {
        if (user.role !== 'ADMIN') {
          throw new Error(
            `Regla Boleta contra Boleta: El cliente posee una boleta pendiente ($${outstandingBalance.toLocaleString()}). Debe registrar su cobro para poder facturar a crédito.`
          );
        }
      }

      // 3. Numeración impositiva mock
      let finalInvoiceType = 'PRESUPUESTO';
      let finalInvoiceNumber = `INT-${String(orders.length + 1).padStart(8, '0')}`;
      let finalCae = null;
      let finalCaeDueDate = null;

      let net = totalSum / 1.21;
      let tax = totalSum - net;
      let percepcion = 0;

      if (payload.billingType === 'OFFICIAL') {
        const cuitLimpio = persona.cuit ? persona.cuit.replace(/-/g, '') : '';
        if (cuitLimpio.length === 11) {
          finalInvoiceType = 'FACTURA_A';
        } else {
          finalInvoiceType = 'FACTURA_B';
        }
        finalInvoiceNumber = `00001-${String(orders.length + 1).padStart(8, '0')}`;
        finalCae = `CAE-MOCK-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
        finalCaeDueDate = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();

        if (finalInvoiceType === 'FACTURA_A') {
          const iibbAliquot = Number(persona.iibbAliquot || 0);
          if (iibbAliquot > 0) {
            net = totalSum / (1.21 + (iibbAliquot / 100));
            tax = Math.round(net * 0.21);
            percepcion = Math.round(net * (iibbAliquot / 100));
            totalSum = Math.round(net + tax + percepcion);
          }
        }
      }

      // 4. Asignación de lotes FIFO local
      for (const orderItem of orderItems) {
        let remainingToAssign = orderItem.quantity;
        const activeLots = productLots
          .filter((l: any) => l.productId === orderItem.productId && l.stock > 0)
          .sort((a: any, b: any) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime());

        for (const lot of activeLots) {
          if (remainingToAssign <= 0) break;
          const allocatedQty = Math.min(lot.stock, remainingToAssign);
          remainingToAssign -= allocatedQty;

          // Restar del lote
          lot.stock -= allocatedQty;

          // Agregar al item
          orderItem.orderItemLots.push({
            id: Math.floor(Math.random() * 1000000),
            orderItemId: orderItem.id,
            productLotId: lot.id,
            productLot: { ...lot },
            quantity: allocatedQty
          });
        }

        if (remainingToAssign > 0) {
          throw new Error(`Inconsistencia de stock por lotes para "${orderItem.product.name}". Faltaron asignar ${remainingToAssign} unidades en lotes.`);
        }
      }

      // 5. Registrar percepción IIBB practicada
      if (percepcion > 0) {
        const newRecord = {
          id: withholdings.length + 1,
          type: 'PERCEPCION_PRACTICADA',
          taxType: 'IIBB',
          personaId: payload.personaId,
          number: finalInvoiceNumber,
          date: new Date().toISOString(),
          amount: Number(percepcion.toFixed(2)),
          jurisdiction: persona.address?.includes('CABA') ? 'AR-C' : 'AR-B',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        mockDb.set('db_tax_withholdings', [...withholdings, newRecord]);
      }

      // 6. Cobro o C/C
      if (payload.paymentMethod) {
        let cashDrawerId: number | null = null;
        let bankAccountId: number | null = null;
        let txAmount = totalSum;
        let txDescription = `Cobro en el acto de factura directa #${orders.length + 1} (${finalInvoiceNumber})`;

        if (payload.paymentMethod === 'CASH') {
          const activeDrawer = drawers.find((d: any) => d.userId === user.id && d.status === 'OPEN' && d.branch === (payload.billingType === 'OFFICIAL' ? 'A' : 'X'));
          if (!activeDrawer) {
            throw new Error(`Debe abrir una caja operativa para la sucursal ${payload.billingType === 'OFFICIAL' ? 'A' : 'X'} antes de registrar cobros en efectivo.`);
          }
          cashDrawerId = activeDrawer.id;
        } else if (payload.paymentMethod === 'BANK_TRANSFER') {
          bankAccountId = payload.bankAccountId || 1;
          const accounts = mockDb.get('db_bank_accounts') || [];
          const accIdx = accounts.findIndex((a: any) => a.id === bankAccountId);
          if (accIdx !== -1) {
            accounts[accIdx].balance = Number(accounts[accIdx].balance || 0) + totalSum;
            mockDb.set('db_bank_accounts', accounts);
          }
        } else if (payload.paymentMethod === 'CHECK') {
          const accounts = mockDb.get('db_bank_accounts') || [];
          const defaultBank = accounts[0] || { id: 1 };
          bankAccountId = defaultBank.id;

          const accIdx = accounts.findIndex((a: any) => a.id === bankAccountId);
          txAmount = payload.checkAmount ?? totalSum;
          txDescription = `Cobro con Cheque N° ${payload.checkNumber || 'S/N'} (Emisor: ${payload.checkIssuer || 'Desconocido'}) - Comprobante ${finalInvoiceNumber}`;

          if (accIdx !== -1) {
            accounts[accIdx].balance = Number(accounts[accIdx].balance || 0) + txAmount;
            mockDb.set('db_bank_accounts', accounts);
          }
        }

        const newTx = {
          id: transactions.length + 1,
          orderId: orders.length + 1,
          personaId: payload.personaId,
          userId: user.id,
          billingType: payload.billingType,
          type: 'INCOME',
          paymentMethod: payload.paymentMethod,
          amount: txAmount,
          description: txDescription,
          cashDrawerId,
          bankAccountId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        mockDb.set('db_transactions', [...transactions, newTx]);
      } else {
        const pIdx = personas.findIndex((p: any) => p.id === payload.personaId);
        if (pIdx !== -1) {
          personas[pIdx].outstandingBalance = Number(personas[pIdx].outstandingBalance || 0) + totalSum;
        }
      }

      // 7. Crear la orden en db_orders
      const newOrder = {
        id: orders.length + 1,
        personaId: payload.personaId,
        persona: { ...persona },
        sellerId: user.id,
        seller: { id: user.id, username: user.username },
        billingType: payload.billingType,
        invoiceType: finalInvoiceType,
        invoiceNumber: finalInvoiceNumber,
        cae: finalCae,
        caeDueDate: finalCaeDueDate,
        status: 'DELIVERED',
        totalAmount: totalSum,
        netAmount: Number(net.toFixed(2)),
        taxAmount: Number(tax.toFixed(2)),
        percepcionAmount: Number(percepcion.toFixed(2)),
        items: orderItems,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockDb.set('db_orders', [...orders, newOrder]);
      mockDb.set('db_products', products);
      mockDb.set('db_product_lots', productLots);
      mockDb.set('db_personas', personas);

      mockDb.log(user.id, user.username, user.role, 'CREATE_DIRECT_INVOICE', 'Order', newOrder.id, null, newOrder);
      return newOrder;
    }

    const res = await request('/orders/direct', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res.order;
  },

  getTaxWithholdings: async (filters?: any) => {
    if (simulationMode) {
      const withholdings = mockDb.get('db_tax_withholdings');
      const personas = mockDb.get('db_personas');
      
      let filtered = [...withholdings];

      if (filters) {
        if (filters.type) filtered = filtered.filter((w: any) => w.type === filters.type);
        if (filters.taxType) filtered = filtered.filter((w: any) => w.taxType === filters.taxType);
        if (filters.startDate && filters.endDate) {
          const start = new Date(filters.startDate).getTime();
          const end = new Date(filters.endDate).getTime();
          filtered = filtered.filter((w: any) => {
            const t = new Date(w.date).getTime();
            return t >= start && t <= end;
          });
        }
      }

      return filtered.map((w: any) => ({
        ...w,
        persona: personas.find((c: any) => c.id === w.personaId) || { name: 'Desconocido', cuit: '' }
      })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

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
    const user = api.getCurrentUser();
    if (simulationMode) {
      const withholdings = mockDb.get('db_tax_withholdings');
      const personas = mockDb.get('db_personas');

      const newRecord = {
        id: withholdings.length + 1,
        ...withholdingData,
        personaId: Number(withholdingData.personaId),
        amount: Number(withholdingData.amount),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockDb.set('db_tax_withholdings', [...withholdings, newRecord]);

      // Actualizar cuenta corriente si es una retención
      const pIdx = personas.findIndex((p: any) => p.id === newRecord.personaId);
      if (pIdx !== -1) {
        if (newRecord.type === 'RETENCION_SUFRIDA') {
          personas[pIdx].outstandingBalance = Number(personas[pIdx].outstandingBalance || 0) - newRecord.amount;
        } else if (newRecord.type === 'RETENCION_PRACTICADA') {
          personas[pIdx].outstandingBalance = Number(personas[pIdx].outstandingBalance || 0) + newRecord.amount;
        }
        mockDb.set('db_personas', personas);
      }

      mockDb.log(user.id, user.username, user.role, 'CREATE_TAX_WITHHOLDING', 'TaxWithholding', newRecord.id, null, newRecord);
      return newRecord;
    }

    const res = await request('/billing/tax-withholdings', {
      method: 'POST',
      body: JSON.stringify(withholdingData)
    });
    return res.withholding;
  },

  getDeliveryRoutes: async (filters?: any) => {
    if (simulationMode) {
      const routes = mockDb.get('db_delivery_routes');
      const orders = mockDb.get('db_orders');
      const personas = mockDb.get('db_personas');
      
      let filtered = [...routes];
      if (filters) {
        if (filters.status) filtered = filtered.filter((r: any) => r.status === filters.status);
      }

      return filtered.map((r: any) => ({
        ...r,
        orders: orders.filter((o: any) => o.deliveryRouteId === r.id).map((o: any) => ({
          ...o,
          persona: personas.find((p: any) => p.id === (o.personaId || o.clientId))
        }))
      })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    let path = '/logistics';
    if (filters && filters.status) path += `?status=${filters.status}`;
    const res = await request(path);
    return res.routes;
  },

  createDeliveryRoute: async (routeData: any) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const routes = mockDb.get('db_delivery_routes');
      const orders = mockDb.get('db_orders');

      const newRoute = {
        id: routes.length + 1,
        driverName: routeData.driverName,
        vehiclePlate: routeData.vehiclePlate,
        vehicleDescription: routeData.vehicleDescription || '',
        status: 'PENDING',
        date: routeData.date || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockDb.set('db_delivery_routes', [...routes, newRoute]);

      // Vincular pedidos
      if (routeData.orderIds && Array.isArray(routeData.orderIds)) {
        const orderIdsSet = new Set(routeData.orderIds.map(Number));
        const updatedOrders = orders.map((o: any) => {
          if (orderIdsSet.has(o.id)) {
            return { ...o, deliveryRouteId: newRoute.id };
          }
          return o;
        });
        mockDb.set('db_orders', updatedOrders);
      }

      mockDb.log(user.id, user.username, user.role, 'CREATE_DELIVERY_ROUTE', 'DeliveryRoute', newRoute.id, null, newRoute);
      return newRoute;
    }

    const res = await request('/logistics', {
      method: 'POST',
      body: JSON.stringify(routeData)
    });
    return res.route;
  },

  updateRouteStatus: async (id: number, status: string) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const routes = mockDb.get('db_delivery_routes');
      const orders = mockDb.get('db_orders');

      const idx = routes.findIndex((r: any) => r.id === id);
      if (idx === -1) throw new Error('Hoja de ruta no encontrada.');

      routes[idx].status = status;
      routes[idx].updatedAt = new Date().toISOString();
      mockDb.set('db_delivery_routes', routes);

      // Si se completa la ruta, marcar pedidos como entregados masivamente (DELIVERED)
      if (status === 'COMPLETED') {
        const updatedOrders = orders.map((o: any) => {
          if (o.deliveryRouteId === id && o.status !== 'CANCELLED') {
            return { ...o, status: 'DELIVERED', updatedAt: new Date().toISOString() };
          }
          return o;
        });
        mockDb.set('db_orders', updatedOrders);
      }

      mockDb.log(user.id, user.username, user.role, 'UPDATE_DELIVERY_ROUTE_STATUS', 'DeliveryRoute', id, null, { status });
      return routes[idx];
    }

    const res = await request(`/logistics/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    return res.route;
  },

  settleDeliveryRoute: async (id: number, settleData: { settlements: any[], cashDeclared: number, checksDeclared: number, transfersDeclared: number }) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const routes = mockDb.get('db_delivery_routes');
      const orders = mockDb.get('db_orders');
      const personas = mockDb.get('db_personas');
      const transactions = mockDb.get('db_transactions');
      const bankAccounts = mockDb.get('db_bank_accounts');
      const cashDrawers = mockDb.get('db_cash_drawers');

      const routeIdx = routes.findIndex((r: any) => r.id === id);
      if (routeIdx === -1) throw new Error('Hoja de ruta no encontrada.');

      const route = routes[routeIdx];
      if (route.status === 'COMPLETED') throw new Error('La hoja de ruta ya está completada.');

      // Procesar órdenes
      const routeOrders = orders.filter((o: any) => o.deliveryRouteId === id);
      const updatedOrders = [...orders];

      routeOrders.forEach((order: any) => {
        const set = settleData.settlements.find((s: any) => s.orderId === order.id);
        if (!set) return;

        const totalAmount = Number(order.totalAmount);
        const personaIdx = personas.findIndex((p: any) => p.id === (order.personaId || order.clientId));
        if (personaIdx === -1) return;

        const persona = personas[personaIdx];

        // 1. Invoicing if PREPARED
        if (order.status === 'PREPARED') {
          const ordIdx = updatedOrders.findIndex((o: any) => o.id === order.id);
          if (ordIdx !== -1) {
            updatedOrders[ordIdx].status = 'DELIVERED';
            updatedOrders[ordIdx].invoiceType = 'PRESUPUESTO';
            updatedOrders[ordIdx].invoiceNumber = `INT-${order.id.toString().padStart(8, '0')}`;
            updatedOrders[ordIdx].updatedAt = new Date().toISOString();
          }

          if (set.paymentMethod === 'CREDITO') {
            persona.outstandingBalance = Number(persona.outstandingBalance || 0) + totalAmount;
          }
        }

        // 2. Register collections
        if (set.paymentMethod && set.paymentMethod !== 'CREDITO') {
          if (order.status === 'DELIVERED') {
            persona.outstandingBalance = Number(persona.outstandingBalance || 0) - totalAmount;
          }

          let cashDrawerId = null;
          let bankAccountId = null;
          let txDescription = `Rendición Reparto - Chofer: ${route.driverName} - Ruta #${route.id} - Pago de ${persona.name}`;

          if (set.paymentMethod === 'CASH') {
            const branch = order.billingType === 'OFFICIAL' ? 'A' : 'X';
            const activeDrawer = cashDrawers.find((d: any) => d.userId === user.id && d.status === 'OPEN' && d.branch === branch);
            if (activeDrawer) {
              cashDrawerId = activeDrawer.id;
            }
          } else if (set.paymentMethod === 'BANK_TRANSFER') {
            const defaultBank = bankAccounts[0];
            if (defaultBank) {
              bankAccountId = defaultBank.id;
              defaultBank.balance = Number(defaultBank.balance || 0) + totalAmount;
            }
          } else if (set.paymentMethod === 'CHECK') {
            const defaultBank = bankAccounts[0];
            if (defaultBank) {
              bankAccountId = defaultBank.id;
              defaultBank.balance = Number(defaultBank.balance || 0) + Number(set.checkAmount || totalAmount);
            }
            txDescription = `Rendición Reparto - Cheque N° ${set.checkNumber || 'S/N'} (Emisor: ${set.checkIssuer || 'Desconocido'}) - Chofer: ${route.driverName} - Ruta #${route.id}`;
          }

          // Crear Transacción
          const newTran = {
            id: transactions.length + 1,
            orderId: order.id,
            personaId: persona.id,
            userId: user.id,
            billingType: order.billingType || 'INTERNAL',
            type: 'INCOME',
            paymentMethod: set.paymentMethod,
            amount: totalAmount,
            description: txDescription,
            cashDrawerId,
            bankAccountId,
            createdAt: new Date().toISOString()
          };
          transactions.push(newTran);
        }
      });

      // Guardar estados
      routes[routeIdx].status = 'COMPLETED';
      routes[routeIdx].updatedAt = new Date().toISOString();

      mockDb.set('db_delivery_routes', routes);
      mockDb.set('db_orders', updatedOrders);
      mockDb.set('db_personas', personas);
      mockDb.set('db_transactions', transactions);
      mockDb.set('db_bank_accounts', bankAccounts);

      mockDb.log(user.id, user.username, user.role, 'SETTLE_DELIVERY_ROUTE', 'DeliveryRoute', id, null, settleData);
      return routes[routeIdx];
    }

    const res = await request(`/logistics/${id}/settle`, {
      method: 'POST',
      body: JSON.stringify(settleData)
    });
    return res;
  },

  getPurchaseOrders: async (filters?: any) => {
    if (simulationMode) {
      const orders = mockDb.get('db_purchase_orders');
      const personas = mockDb.get('db_personas');
      const products = mockDb.get('db_products');

      let filtered = [...orders];
      if (filters) {
        if (filters.status) filtered = filtered.filter((o: any) => o.status === filters.status);
      }

      return filtered.map((o: any) => ({
        ...o,
        persona: personas.find((p: any) => p.id === o.personaId) || { name: 'Proveedor Desconocido', cuit: '' },
        items: o.items.map((i: any) => ({
          ...i,
          product: products.find((p: any) => p.id === i.productId) || { name: 'Artículo Desconocido', sku: '' }
        }))
      })).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    let path = '/purchases';
    if (filters && filters.status) path += `?status=${filters.status}`;
    const res = await request(path);
    return res.orders;
  },

  createPurchaseOrder: async (orderData: any) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const orders = mockDb.get('db_purchase_orders');

      let totalSum = 0;
      const newItems = orderData.items.map((item: any, idx: number) => {
        const subtotal = Number(item.quantity) * Number(item.costPrice);
        totalSum += subtotal;
        return {
          id: idx + 1,
          productId: Number(item.productId),
          productIdRef: Number(item.productId),
          quantity: Number(item.quantity),
          costPrice: Number(item.costPrice),
          subtotal: Number(subtotal.toFixed(2))
        };
      });

      const newOrder = {
        id: orders.length + 1,
        personaId: Number(orderData.personaId),
        status: 'PENDING',
        totalAmount: Number(totalSum.toFixed(2)),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: newItems
      };

      mockDb.set('db_purchase_orders', [...orders, newOrder]);
      mockDb.log(user.id, user.username, user.role, 'CREATE_PURCHASE_ORDER', 'PurchaseOrder', newOrder.id, null, newOrder);
      return newOrder;
    }

    const res = await request('/purchases', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
    return res.order;
  },

  receivePurchaseOrder: async (id: number, payload: { invoiceNumber?: string, lotAssignments?: any }) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const orders = mockDb.get('db_purchase_orders');
      const products = mockDb.get('db_products');
      const lots = mockDb.get('db_product_lots') || [];
      const movements = mockDb.get('db_stock_movements') || [];
      const supplierInvoices = mockDb.get('db_supplier_invoices') || [];
      const personas = mockDb.get('db_personas');

      const oIdx = orders.findIndex((o: any) => o.id === id);
      if (oIdx === -1) throw new Error('Orden de compra no encontrada.');
      if (orders[oIdx].status !== 'PENDING') throw new Error('Esta orden ya fue procesada.');

      orders[oIdx].status = 'RECEIVED';
      orders[oIdx].updatedAt = new Date().toISOString();

      // Recibir mercadería
      for (const item of orders[oIdx].items) {
        const qty = Number(item.quantity);
        const cost = Number(item.costPrice);

        // a. Incrementar stock y actualizar costo del producto
        const pIdx = products.findIndex((p: any) => p.id === item.productId);
        if (pIdx !== -1) {
          products[pIdx].stock = Number(products[pIdx].stock || 0) + qty;
          products[pIdx].costPrice = cost;
        }

        // b. Crear o buscar lote si se asigna
        let lotId = null;
        const assignment = payload.lotAssignments ? payload.lotAssignments[item.productId] : null;
        if (assignment && assignment.lotNumber && assignment.expirationDate) {
          const lIdx = lots.findIndex((l: any) => l.productId === item.productId && l.lotNumber === assignment.lotNumber);
          if (lIdx !== -1) {
            lots[lIdx].stock = Number(lots[lIdx].stock || 0) + qty;
            lotId = lots[lIdx].id;
          } else {
            const newLot = {
              id: lots.length + 1,
              productId: item.productId,
              lotNumber: assignment.lotNumber,
              expirationDate: new Date(assignment.expirationDate).toISOString(),
              stock: qty,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            lots.push(newLot);
            lotId = newLot.id;
          }
        }

        // c. Movimiento de stock
        movements.push({
          id: movements.length + 1,
          productId: item.productId,
          quantity: qty,
          type: 'IN',
          referenceId: `PO-${id}`,
          userId: user.id,
          reason: 'Recepción de Orden de Compra',
          productLotId: lotId,
          createdAt: new Date().toISOString()
        });
      }

      mockDb.set('db_products', products);
      mockDb.set('db_product_lots', lots);
      mockDb.set('db_stock_movements', movements);
      mockDb.set('db_purchase_orders', orders);

      // d. Auto-generar factura de compra
      const neto = Math.round(Number(orders[oIdx].totalAmount));
      const iva = Math.round(neto * 0.21);
      const total = Math.round(neto + iva);
      const invoiceNum = payload.invoiceNumber || `COMP-${id.toString().padStart(8, '0')}`;

      const newInv = {
        id: supplierInvoices.length + 1,
        personaId: orders[oIdx].personaId,
        invoiceNumber: invoiceNum,
        invoiceType: 'FACTURA_A',
        issueDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(), // 30 días de plazo por defecto
        status: 'PENDING',
        paidAmount: 0.00,
        netAmount: neto,
        taxAmount: iva,
        percepcionAmount: 0,
        totalAmount: total,
        createdAt: new Date().toISOString()
      };
      supplierInvoices.push(newInv);
      mockDb.set('db_supplier_invoices', supplierInvoices);

      // e. Decrementar saldo cuenta corriente del proveedor
      const provIdx = personas.findIndex((p: any) => p.id === orders[oIdx].personaId);
      if (provIdx !== -1) {
        personas[provIdx].outstandingBalance = Number(personas[provIdx].outstandingBalance || 0) - total;
        mockDb.set('db_personas', personas);
      }

      mockDb.log(user.id, user.username, user.role, 'RECEIVE_PURCHASE_ORDER', 'PurchaseOrder', id, null, orders[oIdx]);
      return orders[oIdx];
    }

    const res = await request(`/purchases/${id}/receive`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res.order;
  },

  getCrmAlerts: async () => {
    if (simulationMode) {
      const orders = mockDb.get('db_orders');
      const personas = mockDb.get('db_personas');
      const products = mockDb.get('db_products');

      // 1. Clientes inactivos (sin órdenes en los últimos 15 días)
      const fifteenDaysMs = 15 * 24 * 3600 * 1000;
      const cutoff = Date.now() - fifteenDaysMs;

      const inactive = personas.filter((p: any) => {
        if (!p.isClient) return false;
        const clientOrders = orders.filter((o: any) => (o.personaId || o.clientId) === p.id);
        if (clientOrders.length === 0) return true;
        const lastOrderTime = new Date(clientOrders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt).getTime();
        return lastOrderTime < cutoff;
      }).map((p: any) => {
        const clientOrders = orders.filter((o: any) => (o.personaId || o.clientId) === p.id);
        const lastOrder = clientOrders.length > 0 ? clientOrders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : null;
        return {
          id: p.id,
          name: p.name,
          cuit: p.cuit,
          phone: p.phone,
          outstandingBalance: Number(p.outstandingBalance || 0),
          lastOrderDate: lastOrder ? lastOrder.createdAt : null
        };
      });

      // 2. Recomendaciones de reabastecimiento (minStock)
      const lowStock = products.filter((p: any) => Number(p.stock) <= Number(p.minStock));
      const replenishment = lowStock.map((p: any) => {
        let suggestedProviderName = 'Cervecería Quilmes S.A.';
        let suggestedProviderId = 4;

        if (p.name.toLowerCase().includes('cola') || p.name.toLowerCase().includes('sprite') || p.name.toLowerCase().includes('agua')) {
          suggestedProviderName = 'Coca Cola Andina';
          suggestedProviderId = 5;
        }

        return {
          productId: p.id,
          sku: p.sku,
          productName: p.name,
          currentStock: p.stock,
          minStock: p.minStock,
          suggestedQuantity: p.minStock * 2 - p.stock,
          suggestedProviderId,
          suggestedProviderName,
          costPrice: Number(p.costPrice)
        };
      });

      // 3. Sugerencias de consumo personalizadas
      const consumer = personas.filter((p: any) => p.isClient).map((p: any) => {
        const clientOrders = orders.filter((o: any) => (o.personaId || o.clientId) === p.id);
        if (clientOrders.length === 0) {
          return { clientId: p.id, clientName: p.name, suggestedProducts: [] };
        }

        const frequencyMap: { [key: number]: { product: any, count: number } } = {};
        clientOrders.forEach((o: any) => {
          if (o.items) {
            o.items.forEach((item: any) => {
              if (!frequencyMap[item.productId]) {
                const prod = products.find((pr: any) => pr.id === item.productId);
                if (prod) frequencyMap[item.productId] = { product: prod, count: 0 };
              }
              if (frequencyMap[item.productId]) {
                frequencyMap[item.productId].count += Number(item.quantity);
              }
            });
          }
        });

        // Último pedido
        const lastOrder = clientOrders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        const lastProductIds = new Set(lastOrder?.items?.map((i: any) => i.productId) || []);

        const suggestions = Object.values(frequencyMap)
          .filter((item: any) => !lastProductIds.has(item.product.id))
          .sort((a: any, b: any) => b.count - a.count)
          .slice(0, 3)
          .map((item: any) => ({
            productId: item.product.id,
            name: item.product.name,
            sku: item.product.sku,
            listPrice: Number(item.product.listPrice),
            frequency: item.count
          }));

        return {
          clientId: p.id,
          clientName: p.name,
          suggestedProducts: suggestions
        };
      }).filter((c: any) => c.suggestedProducts.length > 0);

      return {
        inactiveClients: inactive,
        replenishmentSuggestions: replenishment,
        consumerSuggestions: consumer
      };
    }

    const res = await request('/crm/alerts');
    return res.data;
  },

  uploadPurchaseDocument: async (file: File) => {
    if (simulationMode) {
      throw new Error('Esta función no está disponible en modo simulación.');
    }
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
    return data;
  },

  confirmPurchaseDocument: async (payload: any) => {
    if (simulationMode) {
      throw new Error('Esta función no está disponible en modo simulación.');
    }
    const res = await request('/purchases/confirm-document', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res.data;
  }
};
