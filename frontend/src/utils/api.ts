import { BillingType, InvoiceType, OrderStatus, TransactionType, PaymentMethod } from './types';

// Definimos la URL base del API backend
const API_BASE_URL = 'http://localhost:3000/api';

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
  if (!localStorage.getItem('db_users')) {
    localStorage.setItem('db_users', JSON.stringify([
      { id: 1, username: 'admin', role: 'ADMIN', isActive: true },
      { id: 2, username: 'vendedor', role: 'VENDEDOR', isActive: true },
      { id: 3, username: 'deposito', role: 'DEPOSITO', isActive: true },
      { id: 4, username: 'facturacion', role: 'FACTURACION', isActive: true }
    ]));
  }

  if (!localStorage.getItem('db_personas')) {
    localStorage.setItem('db_personas', JSON.stringify([
      { id: 1, name: 'Almacén Don Julio', cuit: '20-22233444-9', address: 'Av. Corrientes 1540, CABA', city: 'CABA', phone: '11-4567-8901', email: 'donjulio@gmail.com', sellerId: 2, creditLimit: 150000.00, outstandingBalance: 12500.00, priceList: 'A', discount: 5.00, contacts: [{ name: 'Julio Pérez', phone: '11-4567-8901', email: 'julio@donjulio.com', role: 'Dueño' }], isClient: true, isProvider: false, isSeller: false, isCommissionAgent: false, iibbAliquot: 2.00 },
      { id: 2, name: 'Supermercado Sol de Mayo', cuit: '30-44455566-9', address: 'Pampa 3200, CABA', city: 'CABA', phone: '11-9876-5432', email: 'soldemayo@gmail.com', sellerId: 2, creditLimit: 300000.00, outstandingBalance: 0.00, priceList: 'B', discount: 0.00, contacts: [{ name: 'María Gómez', phone: '11-9876-5432', email: 'maria@soldemayo.com', role: 'Compras' }], isClient: true, isProvider: false, isSeller: false, isCommissionAgent: false, iibbAliquot: 3.50 },
      { id: 3, name: 'Distribuidora San Telmo', cuit: '27-33322211-9', address: 'Defensa 840, CABA', city: 'CABA', phone: '11-3322-1100', email: 'santelmo@gmail.com', sellerId: 2, creditLimit: 500000.00, outstandingBalance: 145000.00, priceList: 'C', discount: 10.00, contacts: [{ name: 'Esteban Quito', phone: '11-3322-1100', email: 'esteban@santelmo.com', role: 'Gerente' }], isClient: true, isProvider: false, isSeller: false, isCommissionAgent: false, iibbAliquot: 0.00 },
      { id: 4, name: 'Cervecería Quilmes S.A.', cuit: '30-50001000-4', address: 'Av. 12 de Octubre 3300, Quilmes', city: 'Quilmes', phone: '0800-222-7456', email: 'proveedores@quilmes.com.ar', sellerId: null, creditLimit: 0.00, outstandingBalance: -50000.00, priceList: 'A', discount: 0.00, contacts: [{ name: 'Juan Carlos', phone: '11-5555-5555', email: 'juancarlos@quilmes.com', role: 'Ejecutivo de Cuentas' }], isClient: false, isProvider: true, isSeller: false, isCommissionAgent: false, iibbAliquot: 0.00 },
      { id: 5, name: 'Coca Cola Andina', cuit: '30-60002000-8', address: 'Ruta 9 Km 4.5, Córdoba', city: 'Córdoba', phone: '0800-888-2622', email: 'contacto@coca-cola.com.ar', sellerId: null, creditLimit: 0.00, outstandingBalance: 0.00, priceList: 'A', discount: 0.00, contacts: [], isClient: false, isProvider: true, isSeller: false, isCommissionAgent: false, iibbAliquot: 0.00 },
      { id: 6, name: 'Carlos Vendedor', cuit: '20-30444555-2', address: 'Cabildo 2000, CABA', city: 'CABA', phone: '11-6666-7777', email: 'carlos@distribuidora.com', sellerId: null, creditLimit: 0.00, outstandingBalance: 0.00, priceList: 'A', discount: 0.00, contacts: [], isClient: false, isProvider: false, isSeller: true, isCommissionAgent: false, iibbAliquot: 0.00 },
      { id: 7, name: 'Autoservicio Villegas', cuit: '30-11223344-5', address: 'San Martín 450, General Villegas', city: 'General Villegas', phone: '2388-421234', email: 'autovillegas@gmail.com', sellerId: 2, creditLimit: 120000.00, outstandingBalance: 32000.00, priceList: 'A', discount: 0.00, contacts: [], isClient: true, isProvider: false, isSeller: false, isCommissionAgent: false, iibbAliquot: 1.50 },
      { id: 8, name: 'Despensa Villegas', cuit: '20-55667788-9', address: 'Rivadavia 120, General Villegas', city: 'General Villegas', phone: '2388-425678', email: 'despensavillegas@gmail.com', sellerId: 2, creditLimit: 80000.00, outstandingBalance: 15400.00, priceList: 'A', discount: 0.00, contacts: [], isClient: true, isProvider: false, isSeller: false, isCommissionAgent: false, iibbAliquot: 1.50 },
      { id: 9, name: 'Almacén La Esquina', cuit: '27-88990011-2', address: '9 de Julio 560, Trenque Lauquen', city: 'Trenque Lauquen', phone: '2392-411234', email: 'esquinatl@gmail.com', sellerId: 2, creditLimit: 90000.00, outstandingBalance: 18500.00, priceList: 'A', discount: 0.00, contacts: [], isClient: true, isProvider: false, isSeller: false, isCommissionAgent: false, iibbAliquot: 1.50 }
    ]));
  }

  // Migrar cuenta bancaria de prueba vieja si existe
  const oldBankAccounts = localStorage.getItem('db_bank_accounts');
  if (oldBankAccounts && oldBankAccounts.includes('Galicia')) {
    localStorage.removeItem('db_bank_accounts');
  }

  if (!localStorage.getItem('db_bank_accounts')) {
    localStorage.setItem('db_bank_accounts', JSON.stringify([
      { id: 1, name: 'Banco Provincia Corriente', accountNumber: 'CTA-4321/0', balance: 500000.00, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 2, name: 'Mercado Pago Distribuidora', accountNumber: 'CVU-0000003100012345678901', balance: 150000.00, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ]));
  }

  if (!localStorage.getItem('db_cash_drawers')) {
    localStorage.setItem('db_cash_drawers', JSON.stringify([]));
  }

  if (!localStorage.getItem('db_products')) {
    localStorage.setItem('db_products', JSON.stringify([
      { id: 1, sku: 'PROD-CERV-01', name: 'Cerveza Quilmes Clásica 1L (Retornable)', description: 'Cajón de cerveza Quilmes 1L. Bebida nacional.', costPrice: 950.00, listPrice: 1400.00, listPriceB: 1250.00, listPriceC: 1100.00, barcode: '7790123456789', stock: 120, minStock: 24 },
      { id: 2, sku: 'PROD-COCA-02', name: 'Gaseosa Coca Cola Original 1.5L', description: 'Pack x6 botellas de Coca Cola sabor original.', costPrice: 1200.00, listPrice: 1800.00, listPriceB: 1600.00, listPriceC: 1400.00, barcode: '7799876543210', stock: 80, minStock: 18 },
      { id: 3, sku: 'PROD-HARI-03', name: 'Harina de Trigo Favorita 000 1kg', description: 'Bulto x10 unidades de harina 000.', costPrice: 450.00, listPrice: 650.00, listPriceB: 0.00, listPriceC: 500.00, barcode: '7791234567890', stock: 200, minStock: 50 },
      { id: 4, sku: 'PROD-AGUA-04', name: 'Agua Mineral Villavicencio Sin Gas 2L', description: 'Pack x6 botellas de agua mineral natural.', costPrice: 800.00, listPrice: 1150.00, listPriceB: 1000.00, listPriceC: 900.00, barcode: '7790987654321', stock: 150, minStock: 30 },
      { id: 5, sku: 'PROD-FIDE-05', name: 'Fideos Tallarín Lucchetti 500g', description: 'Bulto x20 paquetes de fideos tallarín.', costPrice: 380.00, listPrice: 550.00, listPriceB: 0.00, listPriceC: 0.00, barcode: '7792468135790', stock: 90, minStock: 20 }
    ]));
  }

  if (!localStorage.getItem('db_product_lots')) {
    localStorage.setItem('db_product_lots', JSON.stringify([
      // Cerveza Quilmes (120u total)
      { id: 1, productId: 1, lotNumber: 'L-QUIL-001', expirationDate: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().split('T')[0], stock: 50 },
      { id: 2, productId: 1, lotNumber: 'L-QUIL-002', expirationDate: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0], stock: 70 },
      // Coca Cola (80u total)
      { id: 3, productId: 2, lotNumber: 'L-COCA-001', expirationDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0], stock: 30 },
      { id: 4, productId: 2, lotNumber: 'L-COCA-002', expirationDate: new Date(Date.now() + 120 * 24 * 3600 * 1000).toISOString().split('T')[0], stock: 50 },
      // Harina (200u total)
      { id: 5, productId: 3, lotNumber: 'L-HARI-001', expirationDate: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().split('T')[0], stock: 100 },
      { id: 6, productId: 3, lotNumber: 'L-HARI-002', expirationDate: new Date(Date.now() + 150 * 24 * 3600 * 1000).toISOString().split('T')[0], stock: 100 },
      // Agua Mineral (150u total)
      { id: 7, productId: 4, lotNumber: 'L-AGUA-001', expirationDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0], stock: 150 },
      // Fideos (90u total)
      { id: 8, productId: 5, lotNumber: 'L-FIDE-001', expirationDate: new Date(Date.now() + 240 * 24 * 3600 * 1000).toISOString().split('T')[0], stock: 90 }
    ]));
  }

  if (!localStorage.getItem('db_orders')) {
    localStorage.setItem('db_orders', JSON.stringify([]));
  }

  if (!localStorage.getItem('db_transactions')) {
    localStorage.setItem('db_transactions', JSON.stringify([]));
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
    return res;
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('auth_user');
    return userStr ? JSON.parse(userStr) : null;
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

  registerPayment: async (personaId: number, paymentData: { amount: number, paymentMethod: string, description?: string, branch?: string }) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const personas = mockDb.get('db_personas');
      const idx = personas.findIndex((p: any) => p.id === personaId);
      if (idx === -1) throw new Error('Persona no encontrada.');

      const persona = personas[idx];
      const amount = Number(paymentData.amount);

      let type: 'INCOME' | 'OUTCOME' = 'INCOME';
      if (persona.isProvider && !persona.isClient) {
        type = 'OUTCOME';
        persona.outstandingBalance = Number(persona.outstandingBalance || 0) + amount;
      } else {
        persona.outstandingBalance = Number(persona.outstandingBalance || 0) - amount;
      }

      personas[idx] = persona;
      mockDb.set('db_personas', personas);

      let cashDrawerId = null;
      let bankAccountId = null;

      if (paymentData.paymentMethod === 'CASH') {
        const drawers = mockDb.get('db_cash_drawers');
        const targetBranch = paymentData.branch || 'X';
        const activeDrawer = drawers.find((d: any) => d.userId === user.id && d.status === 'OPEN' && d.branch === targetBranch);
        if (!activeDrawer) {
          throw new Error(`Debe abrir una caja operativa para la Sucursal ${targetBranch} antes de registrar cobros/pagos en efectivo.`);
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

      const trans = mockDb.get('db_transactions');
      const newTran = {
        id: trans.length + 1,
        personaId,
        userId: user.id,
        billingType: 'INTERNAL',
        type,
        paymentMethod: paymentData.paymentMethod,
        amount,
        description: paymentData.description || `${type === 'INCOME' ? 'Cobro' : 'Pago'} a cuenta de ${persona.name}`,
        cashDrawerId,
        bankAccountId,
        createdAt: new Date().toISOString()
      };
      mockDb.set('db_transactions', [...trans, newTran]);

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
    return res.data;
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

  createOrder: async (orderData: { clientId: number, items: { productId: number, quantity: number }[] }) => {
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
        if (persona.priceList === 'B') {
          const priceB = Number(prod.listPriceB);
          if (priceB > 0) {
            selectedPrice = priceB;
          }
        } else if (persona.priceList === 'C') {
          const priceC = Number(prod.listPriceC);
          if (priceC > 0) {
            selectedPrice = priceC;
          }
        }

        // Aplicar descuento
        const discountPercentage = Number(persona.discount || 0);
        const finalUnitPrice = selectedPrice * (1 - discountPercentage / 100);
        const subtotal = finalUnitPrice * item.quantity;
        totalAmount += subtotal;

        prod.stock -= item.quantity;

        orderItems.push({
          productId: prod.id,
          quantity: item.quantity,
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

      // Validar regla de "boleta contra boleta" (deben una y deben pagar la proxima)
      if (outstandingBalance > 0) {
        if (user.role !== 'ADMIN') {
          throw new Error(
            `Regla Boleta contra Boleta: El cliente posee una boleta pendiente ($${outstandingBalance.toLocaleString()}). Debe registrar el pago de la boleta anterior antes de iniciar un nuevo pedido a crédito.`
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
        if (persona.priceList === 'B') {
          const priceB = Number(prod.listPriceB);
          if (priceB > 0) {
            selectedPrice = priceB;
          }
        } else if (persona.priceList === 'C') {
          const priceC = Number(prod.listPriceC);
          if (priceC > 0) {
            selectedPrice = priceC;
          }
        }

        // Aplicar descuento
        const discountPercentage = Number(persona.discount || 0);
        const finalUnitPrice = selectedPrice * (1 - discountPercentage / 100);
        const subtotal = finalUnitPrice * item.quantity;
        totalAmount += subtotal;

        prod.stock -= item.quantity;

        orderItems.push({
          productId: prod.id,
          quantity: item.quantity,
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

  invoiceOrder: async (id: number, billingType: BillingType, paymentMethod?: PaymentMethod) => {
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
            taxAmount = netAmount * 0.21;
            percepcionAmount = netAmount * (iibbAliquot / 100);
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
      body: JSON.stringify({ billingType, paymentMethod })
    });
    return res.order;
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
      const active = drawers.find((d: any) => d.userId === user.id && d.branch === branch && d.status === 'OPEN');
      if (active) {
        throw new Error(`Ya tenés una caja abierta para la Sucursal ${branch}. Debés cerrarla antes de abrir una nueva.`);
      }

      const newDrawer = {
        id: drawers.length + 1,
        userId: user.id,
        branch,
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

  closeDrawer: async (drawerId: number, realBalance: number) => {
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
      body: JSON.stringify({ drawerId, realBalance })
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
      return drawers.filter((d: any) => d.userId === user.id && d.status === 'OPEN');
    }

    try {
      const res = await request('/finance/drawers/active-all');
      return res.data?.drawers || [];
    } catch {
      return [];
    }
  },

  closeJointDrawers: async (payload: { realBalanceA: number; realBalanceX: number }) => {
    const user = api.getCurrentUser();
    if (simulationMode) {
      const drawers = mockDb.get('db_cash_drawers');
      const activeA = drawers.find((d: any) => d.userId === user.id && d.branch === 'A' && d.status === 'OPEN');
      const activeX = drawers.find((d: any) => d.userId === user.id && d.branch === 'X' && d.status === 'OPEN');

      const trans = mockDb.get('db_transactions');
      const closedList = [];

      if (activeA) {
        const idx = drawers.findIndex((d: any) => d.id === activeA.id);
        const cashTransA = trans.filter((t: any) => t.cashDrawerId === activeA.id);
        let cashIncome = 0;
        let cashOutcome = 0;
        cashTransA.forEach((t: any) => {
          if (t.type === 'INCOME') cashIncome += Number(t.amount);
          else cashOutcome += Number(t.amount);
        });
        const closingBalance = Number(activeA.openingBalance) + cashIncome - cashOutcome;
        activeA.status = 'CLOSED';
        activeA.closingBalance = closingBalance;
        activeA.realBalance = Number(payload.realBalanceA);
        activeA.closedAt = new Date().toISOString();
        drawers[idx] = activeA;
        closedList.push(activeA);
        mockDb.log(user.id, user.username, user.role, 'CLOSE_CASH_DRAWER', 'CashDrawer', activeA.id, null, activeA);
      }

      if (activeX) {
        const idx = drawers.findIndex((d: any) => d.id === activeX.id);
        const cashTransX = trans.filter((t: any) => t.cashDrawerId === activeX.id);
        let cashIncome = 0;
        let cashOutcome = 0;
        cashTransX.forEach((t: any) => {
          if (t.type === 'INCOME') cashIncome += Number(t.amount);
          else cashOutcome += Number(t.amount);
        });
        const closingBalance = Number(activeX.openingBalance) + cashIncome - cashOutcome;
        activeX.status = 'CLOSED';
        activeX.closingBalance = closingBalance;
        activeX.realBalance = Number(payload.realBalanceX);
        activeX.closedAt = new Date().toISOString();
        drawers[idx] = activeX;
        closedList.push(activeX);
        mockDb.log(user.id, user.username, user.role, 'CLOSE_CASH_DRAWER', 'CashDrawer', activeX.id, null, activeX);
      }

      mockDb.set('db_cash_drawers', drawers);
      return { drawers: closedList };
    }

    const res = await request('/finance/drawers/close-joint', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res;
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
      if (params.length > 0) path += `?${params.join('&')}`;
    }

    const res = await request(path);
    return res.transactions;
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
      const invoices = mockDb.get('db_supplier_invoices');
      const personas = mockDb.get('db_personas');
      
      const newInvoice = {
        id: invoices.length + 1,
        ...invoiceData,
        personaId: Number(invoiceData.personaId),
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

  createDirectInvoice: async (payload: {
    personaId: number;
    billingType: string;
    paymentMethod?: string;
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
        if (persona.priceList === 'B') {
          const priceB = Number(prod.listPriceB);
          if (priceB > 0) selectedPrice = priceB;
        } else if (persona.priceList === 'C') {
          const priceC = Number(prod.listPriceC);
          if (priceC > 0) selectedPrice = priceC;
        }

        // Aplicar descuento
        const discountPercentage = Number(persona.discount || 0);
        const finalUnitPrice = selectedPrice * (1 - discountPercentage / 100);
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
            tax = net * 0.21;
            percepcion = net * (iibbAliquot / 100);
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
        let cashDrawerId = null;
        let bankAccountId = null;

        if (payload.paymentMethod === 'CASH') {
          const activeDrawer = drawers.find((d: any) => d.userId === user.id && d.status === 'OPEN' && d.branch === (payload.billingType === 'OFFICIAL' ? 'A' : 'X'));
          if (!activeDrawer) {
            throw new Error(`Debe abrir una caja operativa para la sucursal ${payload.billingType === 'OFFICIAL' ? 'A' : 'X'} antes de registrar cobros en efectivo.`);
          }
          cashDrawerId = activeDrawer.id;
        } else {
          bankAccountId = 1;
          const accounts = mockDb.get('db_bank_accounts') || [];
          const accIdx = accounts.findIndex((a: any) => a.id === 1);
          if (accIdx !== -1) {
            accounts[accIdx].balance = Number(accounts[accIdx].balance || 0) + totalSum;
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
          amount: totalSum,
          description: `Cobro en el acto de factura directa #${orders.length + 1} (${finalInvoiceNumber})`,
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
      const neto = Number(orders[oIdx].totalAmount);
      const iva = Number((neto * 0.21).toFixed(2));
      const total = Number((neto + iva).toFixed(2));
      const invoiceNum = payload.invoiceNumber || `COMP-${id.toString().padStart(8, '0')}`;

      const newInv = {
        id: supplierInvoices.length + 1,
        personaId: orders[oIdx].personaId,
        invoiceNumber: invoiceNum,
        invoiceType: 'FACTURA_A',
        issueDate: new Date().toISOString(),
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
  }
};

