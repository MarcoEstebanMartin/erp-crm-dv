import React from 'react';

export const playBeep = (type: 'success' | 'error') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    console.error('Audio context error:', e);
  }
};

export const LOCATION_MAP: Record<
  string,
  { label: string; icon: string; color: string; bg: string; description: string }
> = {
  'D1-CAM2-R01-A': { label: 'D1-CAM2-R01-A - Quesos Tybo / Barra', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Rack 2 Niveles (A Piso): Picking' },
  'D1-CAM2-R01-B': { label: 'D1-CAM2-R01-B - Quesos Reserva / Pulmón', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Rack 2 Niveles (B Viga 1): Pulmón' },
  'D1-CAM2-R02-A': { label: 'D1-CAM2-R02-A - Mozzarella / Gouda', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Rack 2 Niveles (A Piso): Picking' },
  'D1-CAM2-R02-B': { label: 'D1-CAM2-R02-B - Mozzarella Reserva', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Rack 2 Niveles (B Viga 1): Pulmón' },
  'D1-CAM2-P01': { label: 'D1-CAM2-P01 - Pallet Queso Melincué Barra', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Slot Piso Pallet 1' },
  'D1-CAM2-P02': { label: 'D1-CAM2-P02 - Pallet Queso Melincué Tybo', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Slot Piso Pallet 2' },
  'D1-CAM2-P03': { label: 'D1-CAM2-P03 - Pallet Queso Cremoso Remotti', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Slot Piso Pallet 3' },
  'D1-CAM2-P04': { label: 'D1-CAM2-P04 - Pallet Fiambres / Embutidos', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Slot Piso Pallet 4' },
  'D1-CAM2-P05': { label: 'D1-CAM2-P05 - Pallet Queso Sardo / Bloque', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Slot Piso Pallet 5' },
  'D1-CAM2-P06': { label: 'D1-CAM2-P06 - Pallet Por Salut / Fresco', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Slot Piso Pallet 6' },
  'D1-CAM2-R03-A': { label: 'D1-CAM2-R03-A - Salames / Jamones / Fiambres', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Rack Derecha A' },
  'D1-CAM2-R03-B': { label: 'D1-CAM2-R03-B - Fiambres Reserva / Cajas', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Rack Derecha B' },
  'D1-CAM2-R04-A': { label: 'D1-CAM2-R04-A - Cremas / Mantecas / Lácteos', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Rack Derecha A' },
  'D1-CAM2-R04-B': { label: 'D1-CAM2-R04-B - Mantecas / Cremas Reserva', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámaras Frío 2 - Rack Derecha B' },
  'D1-CAM1-EST-N1': { label: 'D1-CAM1-EST-N1 - Queso Por Salut / Azul Potes', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámara 1 Frío - Estantería Nivel 1' },
  'D1-CAM1-EST-N2': { label: 'D1-CAM1-EST-N2 - Quesos Fraccionados / Potes', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámara 1 Frío - Estantería Nivel 2' },
  'D1-CAM1-EST-N3': { label: 'D1-CAM1-EST-N3 - Yogures Potes / Cremas', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámara 1 Frío - Estantería Nivel 3' },
  'D1-CAM1-EST-N4': { label: 'D1-CAM1-EST-N4 - Postres / Sodecar Fraccionados', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámara 1 Frío - Estantería Nivel 4' },
  'D1-CAM1-EST-N5': { label: 'D1-CAM1-EST-N5 - Reposición Potes / Cajas', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámara 1 Frío - Estantería Nivel 5' },
  'D1-CAM1-P01': { label: 'D1-CAM1-P01 - Pallet Mozzarella Cremigal', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámara 1 Frío - Piso 1' },
  'D1-CAM1-P02': { label: 'D1-CAM1-P02 - Pallet Queso Por Salut Melincu', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámara 1 Frío - Piso 2' },
  'D1-CAM1-P03': { label: 'D1-CAM1-P03 - Pallet Sodecar / Embutidos', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámara 1 Frío - Piso 3' },
  'D1-CAM1-P04': { label: 'D1-CAM1-P04 - Pallet Stock Reserva Frío', icon: '❄️', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)', description: 'Cámara 1 Frío - Piso 4' },
  'D1-CAM3-R01-A': { label: 'D1-CAM3-R01-A - Conservas Cumaná / Puré Tomate', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Cámara 3 Seco - Rack Nivel A' },
  'D1-CAM3-R01-B': { label: 'D1-CAM3-R01-B - Cumaná Reserva / Cajas', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Cámara 3 Seco - Rack Nivel B' },
  'D1-RACK1-M01-A': { label: 'D1-RACK1-M01-A - Bebidas / Aperitivos Rotación', icon: '📦', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Rack 1 Entrada - Módulo 1 A' },
  'D1-EST-LIC-N1': { label: 'D1-EST-LIC-N1 - Botellas Aperitivos Alta Rotac', icon: '🍾', color: '#FF9500', bg: 'rgba(255, 149, 0, 0.08)', description: 'Estantería Licores - Nivel 1' },
  'D2-RACK-AZUL-M01-A': { label: 'D2-RACK-AZUL-M01-A - Cajas Cumaná / Puré / Tomate', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Racks Azules - Módulo 1 Piso' },
  'D2-PISO-FID-01': { label: 'D2-PISO-FID-01 - Pallet Fideos 308 Tallarín', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Patio Fideos 308 - Slot 1' },
  'D2-PISO-ACE-01': { label: 'D2-PISO-ACE-01 - Pallet Aceite Natura 900ml', icon: '🏢', color: '#5856D6', bg: 'rgba(88, 86, 214, 0.08)', description: 'Patio Aceites - Slot 1' },
  'D3-PISO-UAT-01': { label: 'D3-PISO-UAT-01 - Pallet Leche UAT Cremigal Ente', icon: '🥛', color: '#FF2D55', bg: 'rgba(255, 45, 85, 0.08)', description: 'Patio Leches UAT - Slot 1' },
  'D3-PISO-PAPEL-01': { label: 'D3-PISO-PAPEL-01 - Pallet Papel Higiénico Felpita', icon: '📦', color: '#FF2D55', bg: 'rgba(255, 45, 85, 0.08)', description: 'Patio Papelería - Slot 1' },
  'S/U': { label: 'Sin Ubicación', icon: '📍', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.08)', description: 'Artículos sin ubicación física asignada' },
};

export const getProductLocation = (product: any): string => {
  if (!product?.lots || product.lots.length === 0) return product?.defaultLocation || 'S/U';
  const lotWithLocation = product.lots.find((l: any) => l.stock > 0 && l.location && l.location !== 'S/U');
  return lotWithLocation ? lotWithLocation.location : product.lots[0]?.location || product?.defaultLocation || 'S/U';
};

export const renderLocationTag = (locCode: string) => {
  const code = locCode || 'S/U';
  const info = LOCATION_MAP[code] || {
    label: code,
    icon: '📍',
    color: '#8E8E93',
    bg: 'var(--bg-secondary)',
    description: '',
  };
  return (
    <span
      className="badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '0.8rem',
        fontWeight: 600,
        backgroundColor: info.bg,
        color: info.color,
        border: `1px solid ${info.color}30`,
        padding: '3px 8px',
        borderRadius: '4px',
        fontFamily: 'monospace',
      }}
      title={info.description || ''}
    >
      {info.icon} {info.label}
    </span>
  );
};

export const getLocationWeight = (loc: string): number => {
  if (!loc || loc === 'S/U') return 999;
  const cleanLoc = loc.toUpperCase().trim();
  if (cleanLoc.startsWith('D1-RKA') || cleanLoc.startsWith('D1-RKB') || cleanLoc.startsWith('D1-RACK')) return 10;
  if (cleanLoc.startsWith('D1-EST')) return 20;
  if (cleanLoc.startsWith('D1-CAM2')) return 30;
  if (cleanLoc.startsWith('D1-CAM3')) return 35;
  if (cleanLoc.startsWith('D1-CAM1')) return 40;
  if (cleanLoc.startsWith('D2-')) return 50;
  if (cleanLoc.startsWith('D3-')) return 60;
  return 100;
};

export const sortItemsByOptimalRoute = (items: any[]) => {
  return [...items].sort((a, b) => {
    const locA = getProductLocation(a.product || a);
    const locB = getProductLocation(b.product || b);
    const wA = getLocationWeight(locA);
    const wB = getLocationWeight(locB);
    if (wA !== wB) return wA - wB;
    return locA.localeCompare(locB);
  });
};

/**
 * Detector Automático de "Coma Faltante" (Spec 003 / OrderEngine.normalizeScaleWeight)
 * Detecta cuando un operario tipea gramos (ej: 4250) o le falta la coma (ej: 42.5) en vez de kilos (4.250 kg).
 */
export function detectWeightAnomaly(
  inputWeight: number,
  quantity: number,
  approxWeightKg?: number | null,
): {
  isAnomaly: boolean;
  expectedKg: number;
  suggestedKg: number | null;
} {
  if (!inputWeight || inputWeight <= 0) {
    return { isAnomaly: false, expectedKg: 0, suggestedKg: null };
  }
  const unitApprox = Number(approxWeightKg) > 0 ? Number(approxWeightKg) : 4.0;
  const expectedKg = Number((Math.max(1, quantity) * unitApprox).toFixed(3));

  // Caso 1: Ingresó en gramos (>= 100, ej: 4250 -> 4.250 kg)
  if (inputWeight >= 100) {
    const div1000 = Number((inputWeight / 1000).toFixed(3));
    return {
      isAnomaly: true,
      expectedKg,
      suggestedKg: div1000 > 0 ? div1000 : null,
    };
  }

  // Caso 2: Peso supera el doble de lo esperado (ej: 42.5 kg para 1 horma de 4.25 kg)
  if (inputWeight > expectedKg * 2.2) {
    const div10 = Number((inputWeight / 10).toFixed(3));
    const div100 = Number((inputWeight / 100).toFixed(3));
    let suggestedKg: number | null = null;
    if (div10 >= expectedKg * 0.4 && div10 <= expectedKg * 1.8) suggestedKg = div10;
    else if (div100 >= expectedKg * 0.4 && div100 <= expectedKg * 1.8) suggestedKg = div100;
    return {
      isAnomaly: true,
      expectedKg,
      suggestedKg,
    };
  }

  return { isAnomaly: false, expectedKg, suggestedKg: null };
}
