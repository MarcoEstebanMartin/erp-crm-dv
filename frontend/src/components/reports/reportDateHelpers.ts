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
