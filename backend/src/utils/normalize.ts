export const OFFICIAL_CITIES = [
  "GENERAL VILLEGAS",
  "EMILIO V. BUNGE",
  "BANDERALÓ",
  "BERNARDO LARROUDÉ",
  "PIEDRITAS",
  "CORONEL CHARLONE",
  "BUCHARDO",
  "TRES ALGARROBOS",
  "CARLOS TEJEDOR",
  "FLORENTINO AMEGHINO",
  "BLAQUIER",
  "RIVADAVIA",
  "FORTÍN OLAVARRÍA",
  "INTENDENTE ALVEAR",
  "RUFINO",
  "CEBALLOS",
  "REALICÓ",
  "VILLA SAUZE",
  "SANSINENA",
  "SANTA ELEODORA",
  "SANTA REGINA",
  "VILLA SABOYA",
  "CAÑADA SECA",
  "CABA"
];

export function removeAccents(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

export function standardizeCityName(city: string | null | undefined): string {
  if (!city) return 'OTRAS';
  const clean = city.trim();
  const norm = removeAccents(clean);

  // Mapeos y coincidencias inteligentes
  if (norm.includes('VILLEGAS')) return 'GENERAL VILLEGAS';
  if (norm.includes('BUNGE')) return 'EMILIO V. BUNGE';
  if (norm.includes('BANDERALO')) return 'BANDERALÓ';
  if (norm.includes('LARROUDE')) return 'BERNARDO LARROUDÉ';
  if (norm.includes('PIEDRITAS') || norm.includes('PIEDRAS PIEDRITAS')) return 'PIEDRITAS';
  if (norm.includes('CHARLONE')) return 'CORONEL CHARLONE';
  if (norm.includes('BUCHARDO') || norm.includes('BOUCHARD')) return 'BUCHARDO';
  if (norm.includes('ALGARROBOS') || norm.includes('CUENCA')) return 'TRES ALGARROBOS';
  if (norm.includes('TEJEDOR')) return 'CARLOS TEJEDOR';
  if (norm.includes('AMEGHINO')) return 'FLORENTINO AMEGHINO';
  if (norm.includes('BLAQUIER')) return 'BLAQUIER';
  if (norm.includes('FORTIN') || norm.includes('OLAVARRIA')) return 'FORTÍN OLAVARRÍA';
  if (norm.includes('ALVEAR')) return 'INTENDENTE ALVEAR';
  if (norm.includes('RUFINO')) return 'RUFINO';
  if (norm.includes('CEBALLOS')) return 'CEBALLOS';
  if (norm.includes('REALICO')) return 'REALICÓ';
  if (norm.includes('SAUZE') || norm.includes('SAUCE')) return 'VILLA SAUZE';
  if (norm.includes('SANSINENA')) return 'SANSINENA';
  if (norm.includes('ELEODORA')) return 'SANTA ELEODORA';
  if (norm.includes('REGINA')) return 'SANTA REGINA';
  if (norm.includes('SABOYA')) return 'VILLA SABOYA';
  if (norm.includes('CAÑADA SECA') || norm.includes('CANADA SECA')) return 'CAÑADA SECA';
  if (norm.includes('AMERICA') || norm.includes('RIVADAVIA')) return 'RIVADAVIA';
  if (norm.includes('CABA') || norm.includes('CAPITAL FEDERAL') || norm.includes('CIUDAD AUTONOMA')) return 'CABA';

  // Si no coincide con ninguna oficial, devolvemos el string original limpio en mayúsculas
  return clean.toUpperCase();
}

export function getOfficialCityOrOther(city: string | null | undefined): string {
  const std = standardizeCityName(city);
  if (OFFICIAL_CITIES.includes(std)) {
    return std;
  }
  return 'OTRAS';
}

export function standardizeRouteName(route: string | null | undefined): string {
  if (!route) return '';
  const norm = removeAccents(route);

  if (norm.includes('BANDERALO') && norm.includes('LARROUDE')) return 'BANDERALÓ Y LARROUDÉ';
  if (norm.includes('BUNGE') && norm.includes('BUCHARDO')) return 'EMILIO V. BUNGE Y BUCHARDO';
  if (norm.includes('BUNGE') && norm.includes('CHARLONE')) return 'EMILIO V. BUNGE Y CORONEL CHARLONE';
  if (norm.includes('SAUCE') || norm.includes('SAUZE') && norm.includes('SANSINENA')) return 'VILLA SAUZE Y SANSINENA';
  if (norm.includes('AMEGHINO') && norm.includes('BLAQUIER')) return 'FLORENTINO AMEGHINO Y BLAQUIER';
  if (norm.includes('AMERICA') || norm.includes('RIVADAVIA') && norm.includes('FORTIN')) return 'RIVADAVIA Y FORTÍN OLAVARRÍA';
  if (norm.includes('ALVEAR')) return 'INTENDENTE ALVEAR';
  if (norm.includes('TRES ALGARROBOS')) return 'TRES ALGARROBOS';
  if (norm.includes('PIEDRITAS')) return 'PIEDRITAS';
  if (norm.includes('CARLOS TEJEDOR')) return 'CARLOS TEJEDOR';

  return route.trim().toUpperCase();
}
