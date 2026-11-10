export const VILLEGAS_DEPOT: [number, number] = [-35.030, -63.010]; // Moreno 200, Villegas (Base/Depósito)

export const CLIENT_COORDS: { [key: number]: { lat: number; lng: number; address: string } } = {
  1: { lat: -35.032, lng: -63.008, address: 'Moreno 142, General Villegas' },
  2: { lat: -35.028, lng: -63.015, address: 'Rivadavia 350, General Villegas' },
  3: { lat: -35.035, lng: -63.012, address: 'Castelli 580, General Villegas' },
};

export const CITY_BASE_COORDS: { [key: string]: { lat: number; lng: number } } = {
  'general villegas': { lat: -35.030, lng: -63.010 },
  'emilio v. bunge': { lat: -34.764, lng: -63.031 },
  'emilio bunge': { lat: -34.764, lng: -63.031 },
  'piedritas': { lat: -34.887, lng: -62.880 },
  'banderaló': { lat: -35.016, lng: -63.267 },
  'banderalo': { lat: -35.016, lng: -63.267 },
  'coronel charlone': { lat: -34.685, lng: -63.250 },
  'florentino ameghino': { lat: -34.846, lng: -62.468 },
  'blaquier': { lat: -34.680, lng: -62.410 },
  'fortín olavarría': { lat: -35.702, lng: -62.903 },
  'fortin olavarría': { lat: -35.702, lng: -62.903 },
  'fortin': { lat: -35.702, lng: -62.903 },
  'intendente alvear': { lat: -35.238, lng: -63.585 },
  'bernardo larroudé': { lat: -35.027, lng: -63.565 },
  'bernardo larroude': { lat: -35.027, lng: -63.565 },
  'villa sauze': { lat: -35.150, lng: -63.380 },
  'villa saboya': { lat: -34.630, lng: -62.770 },
  'santa regina': { lat: -34.621, lng: -62.969 },
  'tres algarrobos': { lat: -35.185, lng: -62.753 },
  'carlos tejedor': { lat: -35.402, lng: -62.427 },
  'realicó': { lat: -35.037, lng: -64.244 },
  'realico': { lat: -35.037, lng: -64.244 },
  'ceballos': { lat: -35.297, lng: -63.766 },
  'santa eleodora': { lat: -34.851, lng: -62.825 },
  'cañada seca': { lat: -34.805, lng: -62.791 },
  'canada seca': { lat: -34.805, lng: -62.791 },
  'caba': { lat: -34.6037, lng: -58.3816 }
};

const KNOWN_CITIES = [
  { key: 'villegas', name: 'General Villegas' },
  { key: 'bunge', name: 'Emilio V. Bunge' },
  { key: 'piedritas', name: 'Piedritas' },
  { key: 'banderalo', name: 'Banderaló' },
  { key: 'banderaló', name: 'Banderaló' },
  { key: 'charlone', name: 'Coronel Charlone' },
  { key: 'ameghino', name: 'Florentino Ameghino' },
  { key: 'blaquier', name: 'Blaquier' },
  { key: 'fortin', name: 'Fortín Olavarría' },
  { key: 'fortín', name: 'Fortín Olavarría' },
  { key: 'alvear', name: 'Intendente Alvear' },
  { key: 'larroude', name: 'Bernardo Larroudé' },
  { key: 'larroudé', name: 'Bernardo Larroudé' },
  { key: 'sauze', name: 'Villa Sauze' },
  { key: 'saboya', name: 'Villa Saboya' },
  { key: 'regina', name: 'Santa Regina' },
  { key: 'algarrobos', name: 'Tres Algarrobos' },
  { key: 'tejedor', name: 'Carlos Tejedor' },
  { key: 'realico', name: 'Realicó' },
  { key: 'realicó', name: 'Realicó' },
  { key: 'ceballos', name: 'Ceballos' },
  { key: 'eleodora', name: 'Santa Eleodora' },
  { key: 'canada seca', name: 'Cañada Seca' },
  { key: 'cañada seca', name: 'Cañada Seca' },
  { key: 'caba', name: 'CABA' }
];

export function detectRealCity(persona: any): string {
  const city = (persona?.city || '').trim().toLowerCase();
  const route = (persona?.route || '').trim().toLowerCase();
  const address = (persona?.address || '').trim().toLowerCase();

  for (const c of KNOWN_CITIES) {
    if (city.includes(c.key)) return c.name;
  }

  if (city === 'otros' || !city) {
    for (const c of KNOWN_CITIES) {
      if (route.includes(c.key)) return c.name;
    }
    for (const c of KNOWN_CITIES) {
      if (address.includes(c.key)) return c.name;
    }
  }

  return persona?.city || 'General Villegas';
}

export function getCityBaseCoords(persona: any): { lat: number; lng: number } {
  const cityName = detectRealCity(persona).toLowerCase();
  for (const key in CITY_BASE_COORDS) {
    if (cityName.includes(key) || key.includes(cityName)) {
      return CITY_BASE_COORDS[key];
    }
  }
  return { lat: -35.030, lng: -63.010 };
}

export function cleanStreetAddress(address: string, cityName: string): string {
  if (!address) return '';
  let clean = address.trim();

  clean = clean.replace(/,\s*buenos\s*aires/gi, '');
  const escapedCity = cityName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const cityRegex = new RegExp(`,\\s*${escapedCity}`, 'gi');
  clean = clean.replace(cityRegex, '');

  const placeholders = [
    'zona urbana', 'zona rural', 's/n', 'sin numero', 'sin nro',
    'rural', 'acceso', 'zona quintas', 'conocido', 'acceso principal'
  ];

  const lower = clean.toLowerCase();
  for (const p of placeholders) {
    if (lower === p || lower === `${p}.`) return '';
  }

  return clean;
}

export function applyJitter(lat: number, lng: number, id: number): { lat: number; lng: number } {
  if (!id) return { lat, lng };
  const offsetIndex = id % 8;
  const angle = (offsetIndex * Math.PI) / 4;
  const radius = 0.00045;
  return {
    lat: lat + Math.sin(angle) * radius,
    lng: lng + Math.cos(angle) * radius
  };
}

export function getClientCoords(
  clientId: number,
  clientName: string,
  persona?: any,
  cache?: { [key: number]: { lat: number; lng: number; address: string } }
) {
  if (persona && typeof persona.latitude === 'number' && typeof persona.longitude === 'number') {
    return { lat: persona.latitude, lng: persona.longitude, address: persona.address || '' };
  }
  if (CLIENT_COORDS[clientId]) return CLIENT_COORDS[clientId];
  if (cache && cache[clientId]) return cache[clientId];

  const hash = clientName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const base = getCityBaseCoords(persona);
  const lat = base.lat + ((hash % 100 - 50) * 0.0003);
  const lng = base.lng + (((hash * 7) % 100 - 50) * 0.0003);

  const street = persona?.address;
  const city = detectRealCity(persona);

  let realAddress = street || 'Acceso Villegas S/N';
  if (city && !realAddress.toLowerCase().includes(city.toLowerCase())) {
    realAddress += `, ${city}`;
  }

  return { lat, lng, address: realAddress };
}

export function solveTSP<T extends { lat: number; lng: number }>(start: [number, number], targets: T[]): T[] {
  const unvisited = [...targets];
  const route: T[] = [];
  let currentPos = start;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = Math.hypot(unvisited[i].lat - currentPos[0], unvisited[i].lng - currentPos[1]);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    }

    const nextNode = unvisited.splice(nearestIdx, 1)[0];
    route.push(nextNode);
    currentPos = [nextNode.lat, nextNode.lng];
  }

  return route;
}

export async function fetchOSRMRoute(points: [number, number][]): Promise<[number, number][]> {
  if (points.length < 2) return points;
  try {
    const coordinatesStr = points.map(p => `${p[1]},${p[0]}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordinatesStr}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error en API OSRM');
    const data = await response.json();
    if (data.code === 'Ok' && data.routes && data.routes[0]) {
      const coords = data.routes[0].geometry.coordinates;
      return coords.map((c: [number, number]) => [c[1], c[0]]);
    }
  } catch (error) {
    console.error('Error al obtener la ruta de OSRM, usando líneas rectas:', error);
  }
  return points;
}

export const loadGoogleMapsScript = (apiKey: string, callback: () => void) => {
  if ((window as any).google && (window as any).google.maps) {
    callback();
    return;
  }
  const id = 'google-maps-js';
  const existingScript = document.getElementById(id);
  if (existingScript) {
    const interval = setInterval(() => {
      if ((window as any).google && (window as any).google.maps) {
        clearInterval(interval);
        callback();
      }
    }, 100);
    return;
  }
  const script = document.createElement('script');
  script.id = id;
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
  script.async = true;
  script.defer = true;
  script.onload = () => {
    if (callback) callback();
  };
  document.head.appendChild(script);
};
