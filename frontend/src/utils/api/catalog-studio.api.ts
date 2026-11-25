import { API_BASE_URL, request } from './httpClient';

export type CatalogBadgeType = 'OFERTON' | 'DESTACADO' | null;

export interface CatalogComboSide {
  productId?: number | null;
  sku?: string | null;
  name: string;
  price: number;
  uxb?: string | null;
  condition: string;
  imageUrl?: string | null;
  isFree?: boolean;
  freeLabel?: string | null;
}

export interface CatalogCombo {
  id: string;
  comboNum: string;
  title: string;
  category?: string;
  product1: CatalogComboSide;
  product2: CatalogComboSide;
}

export interface CatalogStudioState {
  title: string;
  subtitle: string;
  hideOutOfStock: boolean;
  categoryOrder: string[];
  itemOrder: string[];
  combos: CatalogCombo[];
  updatedAt: string | null;
}

export interface CatalogStudioProduct {
  id: number;
  sku: string;
  name: string;
  price: number;
  costPrice: number;
  previousListPrice: number | null;
  oldPrice: number | null;
  showOldPrice: boolean;
  marginPct: number | null;
  category: string;
  rubroName: string | null;
  badge: CatalogBadgeType;
  minQty: string | null;
  minOrderQuantity: number;
  unitsPerBox: number;
  isPesable: boolean;
  varieties: string | null;
  imageUrl: string | null;
  stock: number;
  isActive: boolean;
  catalogVisible: boolean;
}

export interface CatalogStudioResponse {
  state: CatalogStudioState;
  products: CatalogStudioProduct[];
  canonicalCategories: string[];
}

async function downloadPdfEndpoint(endpoint: string, fallbackName: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || 'No se pudo generar el PDF.');
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || fallbackName;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const catalogStudioApi = {
  getStudio: async (): Promise<CatalogStudioResponse> => {
    const res = await request('/catalog-studio');
    return res.data || res;
  },

  saveState: async (payload: Partial<CatalogStudioState>): Promise<CatalogStudioState> => {
    const res = await request('/catalog-studio/state', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.data?.state || res.state || res;
  },

  patchProduct: async (
    productId: number,
    payload: {
      catalogBadge?: CatalogBadgeType;
      catalogVarieties?: string | null;
      catalogMinQtyLabel?: string | null;
      catalogShowOldPrice?: boolean;
      catalogOldPrice?: number | null;
      catalogVisible?: boolean;
      commercialCategory?: string | null;
    },
  ) => {
    const res = await request(`/catalog-studio/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data?.product || res.product || res;
  },

  downloadMagazinePdf: () =>
    downloadPdfEndpoint('/catalog-studio/pdf/magazine', 'OFERTA_SEMANAL_DON_VENANCIO.pdf'),

  downloadResumenPdf: (onlyOferton = false) =>
    downloadPdfEndpoint(
      `/catalog-studio/pdf/resumen${onlyOferton ? '?onlyOferton=true' : ''}`,
      'RESUMEN_OFERTAS_DON_VENANCIO.pdf',
    ),
};
