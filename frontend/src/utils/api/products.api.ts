import { API_BASE_URL, request } from './httpClient';

export const productsApi = {
  // --- PRODUCTOS e INVENTARIO ---
  getProducts: async (search?: string, all?: boolean, light?: boolean) => {
    let url = '/products?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (all) url += `all=true&`;
    if (light) url += `light=true&`;
    const res = await request(url);
    return res.products;
  },

  getPriceListCatalog: async () => {
    return await request('/products/price-list-catalog');
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
    
    const response = await fetch(`${API_BASE_URL}/products/${productId}/image`, {
      method: 'POST',
      credentials: 'include',
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
    
    const response = await fetch(`${API_BASE_URL}/products/import-images-zip`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    
    const json = await response.json();
    if (json.status === 'error') {
      throw new Error(json.message);
    }
    return json.data;
  },

  adjustStock: async (
    id: number,
    quantityChange:
      | number
      | {
          quantityChange?: number;
          targetStock?: number;
          mode?: 'DELTA' | 'VACATE_LOT';
          reason?: string;
          lotNumber?: string;
          isNewLot?: boolean;
          expirationDate?: string;
          location?: string | null;
          lotId?: number | null;
        },
    reason?: string,
    lotNumber?: string,
    expirationDate?: string,
    location?: string,
    lotId?: number
  ) => {
    let payload: any;
    if (typeof quantityChange === 'object' && quantityChange !== null) {
      payload = quantityChange;
    } else {
      payload = { quantityChange, reason, lotNumber, expirationDate, location, lotId };
    }
    const res = await request(`/products/${id}/adjust-stock`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res?.updatedProduct || res?.product || res;
  },

  adjustStockBatch: async (
    items: Array<{
      productId: number;
      quantityChange?: number;
      targetStock?: number;
      mode?: 'DELTA' | 'VACATE_LOT';
      reason?: string;
      lotNumber?: string;
      expirationDate?: string;
      location?: string | null;
      lotId?: number | null;
    }>
  ) => {
    return request('/products/adjust-stock-batch', {
      method: 'POST',
      body: JSON.stringify({ items })
    });
  },

  clearWmsLocation: async (
    input:
      | string
      | {
          locationCode: string;
          productId?: number | null;
          lotId?: number | null;
          mode?: 'UNASSIGN' | 'WRITE_OFF';
          reason?: string;
        }
  ) => {
    const payload = typeof input === 'string' ? { locationCode: input } : input;
    return request('/products/wms/clear-location', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  assignWmsLocation: async (data: {
    productId: number;
    locationCode: string;
    quantity: number;
    lotNumber?: string;
    sourceLotId?: number | null;
    expirationDate?: string;
    reason?: string;
    mode?: 'RELOCATE' | 'STOCK_IN';
  }) => {
    return request('/products/wms/assign-location', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  moveWmsSlot: async (data: {
    fromSlotCode: string;
    toSlotCode: string;
    reason?: string;
  }) => {
    return request('/products/wms/move-slot', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getWarehouseCells: async () => {
    const res = await request('/products/wms/cells');
    return res?.cells || [];
  },

  upsertWarehouseCell: async (data: {
    depId: 'D1' | 'D2' | 'D3';
    row: number;
    col: number;
    isStorage: boolean;
    levels?: string;
    chamber?: string;
    label?: string | null;
    fill?: string | null;
    isBlocked?: boolean;
    maxUnits?: number | null;
  }) => {
    const res = await request('/products/wms/cells', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res?.cell || res;
  },

  resetWarehouseCell: async (
    code: string,
    fallbackBlueprint?: { isStorage: boolean; levels: string }
  ) => {
    return request(`/products/wms/cells/${encodeURIComponent(code)}`, {
      method: 'DELETE',
      body: JSON.stringify(fallbackBlueprint ? { fallbackBlueprint } : {}),
    });
  },

  auditStockDrift: async (): Promise<{ count: number; products: any[] }> => {
    const res = await request('/products/stock/reconcile-audit');
    return res || { count: 0, products: [] };
  },

  reconcileStockDrift: async () => {
    return request('/products/stock/reconcile', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  downloadStockInicialTemplate: async (): Promise<Blob> => {
    const res = await fetch(`${API_BASE_URL}/admin/excel/template/stock-inicial`, {
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error('No se pudo descargar la plantilla Excel de Stock Inicial.');
    }
    return res.blob();
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

  transferLotStock: async (
    productId: number,
    transferData: {
      fromLotId: number;
      toLotId?: number;
      toLotNumber?: string;
      toExpirationDate?: string;
      toLocation?: string;
      quantity: number;
    },
  ) => {
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
  }
};
