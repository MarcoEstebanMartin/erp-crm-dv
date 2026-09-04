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

export const OFFICIAL_MASTER_ROUTES = [
  "BUNGE Y CHARLONE",
  "BUNGE Y BUCHARDO",
  "VILLEGAS FABIAN",
  "VILLEGAS NORBERTO",
  "VILLEGAS DIEGO",
  "AMEGHINO Y BLAQUIER",
  "CUENCA",
  "TEJEDOR",
  "ALVEAR",
  "SAUCE Y SANSINENA",
  "PIEDRITAS",
  "BANDERALO Y LARROUDÉ",
  "AMERICA Y FORTIN",
  "TODOS"
];

export const VILLEGAS_BARRIOS = [
  "CENTRO 1",
  "CENTRO 2",
  "CENTRO 3",
  "CENTRO 4",
  "TROCHA",
  "FONAVI",
  "PARQUE",
  "FEDERAL",
  "PROGRESO",
  "CICLON",
  "CRUCE"
];

export function removeAccents(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

export function isVillegasBarrio(routeOrBarrio: string | null | undefined): boolean {
  if (!routeOrBarrio) return false;
  const norm = removeAccents(routeOrBarrio);
  return VILLEGAS_BARRIOS.some(b => norm.includes(b));
}

export function standardizeBarrioName(barrio: string | null | undefined): string | null {
  if (!barrio) return null;
  const norm = removeAccents(barrio);
  const found = VILLEGAS_BARRIOS.find(b => norm.includes(b));
  return found || barrio.trim().toUpperCase();
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

  if (norm.includes('BANDERALO') && norm.includes('LARROUDE')) return 'BANDERALO Y LARROUDÉ';
  if (norm.includes('BUNGE') && norm.includes('BUCHARDO')) return 'BUNGE Y BUCHARDO';
  if (norm.includes('BUNGE') && norm.includes('CHARLONE')) return 'BUNGE Y CHARLONE';
  if (norm.includes('SAUCE') || norm.includes('SAUZE') || norm.includes('SANSINENA')) return 'SAUCE Y SANSINENA';
  if (norm.includes('AMEGHINO') && norm.includes('BLAQUIER')) return 'AMEGHINO Y BLAQUIER';
  if (norm.includes('AMERICA') || norm.includes('FORTIN')) return 'AMERICA Y FORTIN';
  if (norm.includes('ALVEAR')) return 'ALVEAR';
  if (norm.includes('CUENCA') || norm.includes('TRES ALGARROBOS')) return 'CUENCA';
  if (norm.includes('PIEDRITAS')) return 'PIEDRITAS';
  if (norm.includes('TEJEDOR')) return 'TEJEDOR';
  if (norm.includes('VILLEGAS') && norm.includes('FABIAN')) return 'VILLEGAS FABIAN';
  if (norm.includes('VILLEGAS') && norm.includes('NORBERTO')) return 'VILLEGAS NORBERTO';
  if (norm.includes('VILLEGAS') && norm.includes('DIEGO')) return 'VILLEGAS DIEGO';

  // Si no coincide con ninguna específica pero es una oficial
  const officialFound = OFFICIAL_MASTER_ROUTES.find(r => removeAccents(r) === norm);
  if (officialFound) return officialFound;

  return route.trim().toUpperCase();
}

