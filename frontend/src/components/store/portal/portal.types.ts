export interface ClientPortalProps {
  onBackToStaffLogin?: () => void;
}

export interface ClientProfile {
  id: number;
  name: string;
  cuit: string | null;
  address: string | null;
  city: string | null;
  priceList: string;
  discount: number;
  outstandingBalance: number;
  creditLimit: number;
  paymentTermDays?: number;
}

export interface StoreProduct {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  barcode: string | null;
  price: number;
  listPriceA: number;
  listPriceB: number;
  listPriceC: number;
  stock: number;
  isPesable: boolean;
  unitsPerBox: number;
  imageUrl: string | null;
  rubroId: number | null;
  rubroName: string;
  commercialGroupId?: string;
  commercialGroupName?: string;
  commercialGroupIcon?: string;
  isOffer: boolean;
  offerDiscount: number;
  previousPrice?: number | null;
  specialTag?: string | null;
  offerName: string | null;
  minOrderQuantity?: number;
}

export interface CartItem {
  product: StoreProduct;
  quantity: number;
  unitPrice: number;
  isEmergencyOverride?: boolean;
}

export type PortalTab = 'catalog' | 'account' | 'orders';

export interface PendingClientInfo {
  id: number;
  name: string;
  cuit: string;
  hasPin?: boolean;
}

export const formatMoney = (val: number): string =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

export function checkShowAccountBalance(client: ClientProfile | null): boolean {
  if (!client || !client.priceList) return false;
  const listName = client.priceList.toUpperCase().trim();
  return (
    listName === 'A' ||
    listName === 'LISTA A' ||
    listName === 'SUCURSAL A' ||
    listName.includes('OFICIAL')
  );
}

export function filterAndSortStoreProducts(
  products: StoreProduct[],
  selectedGroupId: string,
  selectedRubroId: number | null,
  onlyOffers: boolean,
  searchQuery: string
): StoreProduct[] {
  const list = products.filter((p) => {
    if (selectedGroupId && selectedGroupId !== 'all') {
      if (selectedGroupId === 'bultos') {
        if ((p.unitsPerBox || 1) <= 1) return false;
      } else if (p.commercialGroupId !== selectedGroupId) {
        return false;
      }
    }
    if (selectedRubroId && p.rubroId !== selectedRubroId) return false;
    if (onlyOffers && !p.isOffer) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const matchName = p.name.toLowerCase().includes(q);
      const matchSku = p.sku.toLowerCase().includes(q);
      const matchRubro = p.rubroName.toLowerCase().includes(q);
      const matchGroup = (p.commercialGroupName || '').toLowerCase().includes(q);
      if (!matchName && !matchSku && !matchRubro && !matchGroup) return false;
    }
    return true;
  });

  return list.sort((a, b) => {
    const strA = String(a.sku || '').trim();
    const strB = String(b.sku || '').trim();
    const matchA = strA.match(/\d+/);
    const matchB = strB.match(/\d+/);
    if (matchA && matchB) {
      const numA = parseInt(matchA[0], 10);
      const numB = parseInt(matchB[0], 10);
      if (numA !== numB) return numA - numB;
    }
    return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
  });
}
