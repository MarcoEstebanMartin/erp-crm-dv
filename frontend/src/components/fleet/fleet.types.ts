import { createElement } from 'react';

export interface Supplier {
  id: number;
  name: string;
}

export interface Maintenance {
  id: number;
  type: 'SERVICE' | 'REPAIR' | 'FUEL' | 'CLEANING' | 'OTHER';
  description: string;
  cost: number;
  odometer: number;
  date: string;
  supplier?: Supplier | null;
  transactionId?: number | null;
}

export interface Expiry {
  id: number;
  type: 'INSURANCE' | 'VTE_ITV' | 'PATENT' | 'CARNET' | 'OTHER';
  description: string;
  expirationDate: string;
  alertSent: boolean;
}

export interface Vehicle {
  id: number;
  plate: string;
  brand: string;
  model: string;
  year: number;
  currentOdometer: number;
  status: 'ACTIVE' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
  trackFuel?: boolean;
  fuelType?: 'NAFTA' | 'DIESEL' | null;
  notes?: string | null;
  maintenances: Maintenance[];
  expirations: Expiry[];
}

export const ALLOWED_FLEET_PROVIDER_NAMES = [
  'Gonzalo Alvarez',
  'Jorge Guerrera',
  'Juan Manuel Ibarra',
  'YPF Boxes',
  'Juan Lopez',
  'Ricardo Beron',
  'Raul',
];

export const getMaintenanceLabel = (type: Maintenance['type']): string => {
  switch (type) {
    case 'SERVICE': return 'Service';
    case 'REPAIR': return 'Reparación';
    case 'FUEL': return 'Combustible';
    case 'CLEANING': return 'Lavado';
    default: return 'Otro';
  }
};

export const GENERAL_ADMIN_PLATE = 'DEP-GRAL';
export const GENERAL_ADMIN_LABEL = 'Adm. Gral';

export const isGeneralAdminVehicle = (vehicle?: Pick<Vehicle, 'plate'> | null): boolean =>
  Boolean(vehicle && vehicle.plate.trim().toUpperCase() === GENERAL_ADMIN_PLATE);

export const getExpiryLabel = (type: Expiry['type']): string => {
  switch (type) {
    case 'INSURANCE': return 'Seguro';
    case 'VTE_ITV': return 'VTE / ITV';
    case 'PATENT': return 'Patente';
    case 'CARNET': return 'Licencia Chofer';
    default: return 'General';
  }
};

export const getExpiryGroupLabel = (type: Expiry['type']): string => {
  switch (type) {
    case 'INSURANCE': return 'Seguros';
    case 'VTE_ITV': return 'VTE / ITV';
    case 'PATENT': return 'Patentes';
    case 'CARNET': return 'Licencias de Chofer';
    default: return 'Generales';
  }
};

export const getExpiryDisplayName = (expiry: Pick<Expiry, 'type' | 'description'>): string =>
  expiry.description?.trim() || getExpiryLabel(expiry.type);

export const cleanGroupedExpiryLabel = (expiry: Pick<Expiry, 'type' | 'description'>): string => {
  const raw = getExpiryDisplayName(expiry);
  if (expiry.type === 'CARNET') {
    return raw.replace(/^(carnet|licencia)(\s+chofer)?\s*[:\-–]\s*/i, '').trim() || raw;
  }
  return raw;
};

export type ExpiryListEntry =
  | { kind: 'group'; key: string; type: Expiry['type']; label: string; items: Expiry[]; nextDate: string }
  | { kind: 'item'; key: string; expiry: Expiry; nextDate: string };

export const buildExpiryEntries = (expirations: Expiry[]): ExpiryListEntry[] => {
  const sorted = [...expirations].sort(
    (a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime(),
  );

  const byGroupableType = new Map<Expiry['type'], Expiry[]>();
  const standalone: Expiry[] = [];

  for (const exp of sorted) {
    if (exp.type === 'OTHER') {
      standalone.push(exp);
    } else {
      const list = byGroupableType.get(exp.type) ?? [];
      list.push(exp);
      byGroupableType.set(exp.type, list);
    }
  }

  const entries: ExpiryListEntry[] = [];

  for (const [type, items] of byGroupableType.entries()) {
    if (items.length >= 2) {
      entries.push({
        kind: 'group',
        key: `group-${type}`,
        type,
        label: getExpiryGroupLabel(type),
        items,
        nextDate: items[0].expirationDate,
      });
    } else {
      entries.push({
        kind: 'item',
        key: `item-${items[0].id}`,
        expiry: items[0],
        nextDate: items[0].expirationDate,
      });
    }
  }

  for (const exp of standalone) {
    entries.push({
      kind: 'item',
      key: `item-${exp.id}`,
      expiry: exp,
      nextDate: exp.expirationDate,
    });
  }

  return entries.sort(
    (a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime(),
  );
};

export const isExpiryClose = (dateStr: string): boolean => {
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return days <= 10;
};

export const isExpiryOverdue = (dateStr: string): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) < today;
};

export function FleetStatusBadge({ status }: { status: Vehicle['status'] }) {
  const dotColor = status === 'MAINTENANCE' ? '#eab308' : status === 'OUT_OF_SERVICE' ? 'var(--color-corp-red)' : '#10b981';
  const label = status === 'MAINTENANCE' ? 'En Taller' : status === 'OUT_OF_SERVICE' ? 'Parado' : 'Activo';
  return createElement(
    'div',
    { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } },
    createElement('span', { 'aria-hidden': true, style: { width: '7px', height: '7px', borderRadius: '50%', backgroundColor: dotColor } }),
    createElement('span', { style: { fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 } }, label),
  );
}
