export interface SellerGroup {
  user: {
    id: number;
    username: string;
    role: string;
  };
  totalToCollect: number;
  totalBranchA: number;
  totalBranchX: number;
  totalCash: number;
  totalChecks: number;
  totalTransfers: number;
  transactions: any[];
}

export interface RouteGroup {
  routeId: number;
  driverName: string;
  vehiclePlate: string;
  totalToCollect: number;
  totalBranchA: number;
  totalBranchX: number;
  totalCash: number;
  totalChecks: number;
  totalTransfers: number;
  transactions: any[];
}

export type RendicionesTabType = 'sellers' | 'routes' | 'diaria';

export interface AuditTarget {
  type: 'seller' | 'route';
  data: any;
}

export interface DeclaredCheckItem {
  number: string;
  bank: string;
  amount: number;
}

export interface CajaActionModalState {
  open: boolean;
  branch: string;
  mode: 'open' | 'close';
  drawerId?: number;
}

export const formatCurrency = (val: number): string => {
  return val.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
};

export const getWhatsAppSendLink = (
  phone: string,
  clientName: string,
  receiptNumber: string,
  amount: number,
  receiptId: number
): string => {
  const cleanPhone = phone.replace(/\D/g, '');
  const receiptLink = `${window.location.origin}/recibo/${receiptId}`;
  const text = `Hola ${clientName}! Tu pago por $${amount.toLocaleString('es-AR')} (Comprobante: ${receiptNumber}) ha sido verificado y acreditado formalmente en tu cuenta corriente. Comprobante digital: ${receiptLink}`;
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
};

export const getDetectedRoutesAndCities = (
  transactions: any[]
): { primary: string; list: Array<{ name: string; count: number }> } => {
  if (!transactions || transactions.length === 0) return { primary: '', list: [] };

  const counts: Record<string, number> = {};

  transactions.forEach((tx: any) => {
    const loc = tx.persona?.city || tx.persona?.route || tx.persona?.saleRoute?.name;
    if (loc && loc.trim()) {
      const cleanLoc = loc.trim();
      counts[cleanLoc] = (counts[cleanLoc] || 0) + 1;
    }
  });

  const list = Object.keys(counts)
    .map((key) => ({ name: key, count: counts[key] }))
    .sort((a, b) => b.count - a.count);

  if (list.length === 0) return { primary: '', list: [] };

  return {
    primary: list.map((item) => item.name).join(', '),
    list
  };
};
