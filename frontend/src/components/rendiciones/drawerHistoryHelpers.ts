import { formatResponsibleName } from '../../utils/formatters';

export type DrawerKind = 'CENTRAL' | 'DEPOSITO' | 'REPARTIDOR' | 'ADMINISTRACION' | 'VENDEDOR';

export interface DrawerClassification {
  kind: DrawerKind;
  isCentral: boolean;
  isDepo: boolean;
  isRep: boolean;
  isAdmin: boolean;
  badgeLabel: string;
  badgeBg: string;
  badgeColor: string;
  responsibleName: string;
  showRouteNote: boolean;
}

export interface DrawerDateSummary {
  isoDateTime: string;
  primaryLabel: string;
  rangeLabel: string | null;
}

const ADMIN_BRANCH_PATTERN = /^ADMINISTRACI[OÓ]N\b/i;
const LEGACY_ADMIN_SELLER_PATTERN = /^VENDEDOR:\s*(ADMIN|ADMINISTRADOR)\b/i;

export function classifyDrawerHistoryRow(d: any): DrawerClassification {
  const branch = String(d?.branch || '').trim();
  const drawerType = String(d?.drawerType || '').trim().toUpperCase();
  const responsibleName = formatResponsibleName(d);

  const isCentral =
    drawerType === 'CENTRAL' || branch === 'CENTRAL' || branch === 'CONSOLIDADA';
  const isDepo = !isCentral && (drawerType === 'DEPOSITO' || branch === 'DEPOSITO');
  const isRep =
    !isCentral && !isDepo && (drawerType === 'REPARTIDOR' || branch.toUpperCase().startsWith('REPARTIDOR'));

  const isAdmin =
    !isCentral &&
    !isDepo &&
    !isRep &&
    (drawerType === 'ADMINISTRACION' ||
      ADMIN_BRANCH_PATTERN.test(branch) ||
      LEGACY_ADMIN_SELLER_PATTERN.test(branch) ||
      responsibleName.toLowerCase() === 'admin');

  if (isCentral) {
    return {
      kind: 'CENTRAL',
      isCentral: true,
      isDepo: false,
      isRep: false,
      isAdmin: false,
      badgeLabel: 'Caja Grande',
      badgeBg: '#fef3c7',
      badgeColor: '#92400e',
      responsibleName,
      showRouteNote: false,
    };
  }

  if (isDepo) {
    return {
      kind: 'DEPOSITO',
      isCentral: false,
      isDepo: true,
      isRep: false,
      isAdmin: false,
      badgeLabel: 'Oficina',
      badgeBg: '#f1f5f9',
      badgeColor: '#475569',
      responsibleName,
      showRouteNote: false,
    };
  }

  if (isRep) {
    return {
      kind: 'REPARTIDOR',
      isCentral: false,
      isDepo: false,
      isRep: true,
      isAdmin: false,
      badgeLabel: 'Repartidor',
      badgeBg: '#ecfdf5',
      badgeColor: '#047857',
      responsibleName,
      showRouteNote: Boolean(d?.routeNote && String(d.routeNote).trim()),
    };
  }

  if (isAdmin) {
    return {
      kind: 'ADMINISTRACION',
      isCentral: false,
      isDepo: false,
      isRep: false,
      isAdmin: true,
      badgeLabel: 'Administración',
      badgeBg: '#eef2ff',
      badgeColor: '#3730a3',
      responsibleName,
      showRouteNote: false,
    };
  }

  return {
    kind: 'VENDEDOR',
    isCentral: false,
    isDepo: false,
    isRep: false,
    isAdmin: false,
    badgeLabel: 'Vendedor',
    badgeBg: '#eff6ff',
    badgeColor: '#1d4ed8',
    responsibleName,
    showRouteNote: false,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatShortDate(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${String(date.getFullYear()).slice(-2)}`;
}

function formatDayMonth(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;
}

function formatTime24(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Formatea la fecha principal del arqueo y, únicamente para Caja Diaria (Oficina),
 * devuelve el rango de apertura -> cierre cuando ambos horarios difieren.
 */
export function formatDrawerDateSummary(
  d: { openedAt?: string | Date | null; closedAt?: string | Date | null },
  isDepo: boolean,
): DrawerDateSummary {
  const closeDate = d.closedAt ? new Date(d.closedAt) : d.openedAt ? new Date(d.openedAt) : null;
  const openDate = d.openedAt ? new Date(d.openedAt) : null;

  if (!closeDate || Number.isNaN(closeDate.getTime())) {
    return { isoDateTime: '', primaryLabel: '—', rangeLabel: null };
  }

  const primaryLabel = `${formatShortDate(closeDate)} · ${formatTime24(closeDate)}`;
  const isoDateTime = closeDate.toISOString();

  if (!isDepo || !openDate || Number.isNaN(openDate.getTime())) {
    return { isoDateTime, primaryLabel, rangeLabel: null };
  }

  const sameDay = isSameCalendarDay(openDate, closeDate);
  const openTime = formatTime24(openDate);
  const closeTime = formatTime24(closeDate);

  if (sameDay && openTime === closeTime) {
    return { isoDateTime, primaryLabel, rangeLabel: null };
  }

  const rangeLabel = sameDay
    ? `${openTime} → ${closeTime}`
    : `${formatDayMonth(openDate)} ${openTime} → ${formatDayMonth(closeDate)} ${closeTime}`;

  return { isoDateTime, primaryLabel, rangeLabel };
}
