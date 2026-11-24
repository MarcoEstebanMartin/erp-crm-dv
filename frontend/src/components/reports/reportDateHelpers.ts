const AR_ISO_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export type ArDatePresetId =
  | 'this_week'
  | 'prev_week'
  | 'this_month'
  | 'last_month'
  | 'quarter'
  | 'year'
  | 'last_30_days';

export function getLocalArTodayIso(now: Date = new Date()): string {
  return AR_ISO_DATE_FMT.format(now);
}

const toIso = (dt: Date): string => dt.toISOString().slice(0, 10);

export function computeArDatePreset(
  preset: ArDatePresetId,
  now: Date = new Date(),
): { startDate: string; endDate: string } {
  const [y, m, d] = getLocalArTodayIso(now).split('-').map(Number);

  if (preset === 'this_month') {
    return {
      startDate: toIso(new Date(Date.UTC(y, m - 1, 1))),
      endDate: toIso(new Date(Date.UTC(y, m, 0))),
    };
  }
  if (preset === 'last_month') {
    return {
      startDate: toIso(new Date(Date.UTC(y, m - 2, 1))),
      endDate: toIso(new Date(Date.UTC(y, m - 1, 0))),
    };
  }
  if (preset === 'quarter') {
    return {
      startDate: toIso(new Date(Date.UTC(y, m - 3, 1))),
      endDate: toIso(new Date(Date.UTC(y, m, 0))),
    };
  }
  if (preset === 'year') {
    return {
      startDate: toIso(new Date(Date.UTC(y, 0, 1))),
      endDate: toIso(new Date(Date.UTC(y, 11, 31))),
    };
  }
  if (preset === 'last_30_days') {
    return {
      startDate: toIso(new Date(Date.UTC(y, m - 1, d - 30))),
      endDate: toIso(new Date(Date.UTC(y, m - 1, d))),
    };
  }

  const todayUtc = new Date(Date.UTC(y, m - 1, d));
  const dow = todayUtc.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const weekOffset = preset === 'prev_week' ? -7 : 0;
  const monday = new Date(Date.UTC(y, m - 1, d + mondayOffset + weekOffset));
  const sunday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6));
  return { startDate: toIso(monday), endDate: toIso(sunday) };
}

export function formatArDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-');
    return `${d}/${m}/${y}`;
  }
  return new Date(trimmed).toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function shiftArWeekRange(
  anchorIso: string,
  deltaWeeks: number,
): { startDate: string; endDate: string } {
  const [y, m, d] = anchorIso.split('-').map(Number);
  const anchorUtc = new Date(Date.UTC(y, m - 1, d));
  const dow = anchorUtc.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(Date.UTC(y, m - 1, d + mondayOffset + deltaWeeks * 7));
  const sunday = new Date(
    Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6),
  );
  return { startDate: toIso(monday), endDate: toIso(sunday) };
}

export function formatShortArRange(startIso: string, endIso: string): string {
  const short = (iso: string) => {
    const [, m, d] = iso.split('-');
    return d && m ? `${d}/${m}` : iso;
  };
  return `${short(startIso)} – ${short(endIso)}`;
}

export function formatCityLabel(raw: string): string {
  if (!raw) return 'Sin Localidad';
  const trimmed = raw.trim();
  if (trimmed.toLowerCase() === 'sin localidad') return 'Sin Localidad';
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((word) => (word.length <= 2 && word.endsWith('.') ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

export interface WeeklySalesTsvRow {
  cityLabel: string;
  official: number;
  internal: number;
  total: number;
  count: number;
}

export function buildWeeklySalesTsv(
  rows: WeeklySalesTsvRow[],
  totals: { official: number; internal: number; total: number; orders: number },
): string {
  const cleanCell = (value: string) => value.replace(/[\t\r\n]+/g, ' ').trim();
  const lines = ['Localidad\tSucursal A\tSucursal X\tTotal\tPedidos'];
  for (const row of rows) {
    lines.push(
      [
        cleanCell(row.cityLabel),
        Math.round(Number(row.official || 0)),
        Math.round(Number(row.internal || 0)),
        Math.round(Number(row.total || 0)),
        Math.round(Number(row.count || 0)),
      ].join('\t'),
    );
  }
  lines.push(
    [
      'Total',
      Math.round(Number(totals.official || 0)),
      Math.round(Number(totals.internal || 0)),
      Math.round(Number(totals.total || 0)),
      Math.round(Number(totals.orders || 0)),
    ].join('\t'),
  );
  return lines.join('\n');
}
