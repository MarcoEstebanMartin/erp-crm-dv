export const OFFICIAL_CITIES = [
  'GENERAL VILLEGAS', 'EMILIO V. BUNGE', 'BANDERALÓ', 'BERNARDO LARROUDÉ', 'PIEDRITAS',
  'CORONEL CHARLONE', 'BUCHARDO', 'TRES ALGARROBOS', 'CARLOS TEJEDOR', 'FLORENTINO AMEGHINO',
  'BLAQUIER', 'RIVADAVIA', 'FORTÍN OLAVARRÍA', 'INTENDENTE ALVEAR', 'RUFINO',
  'CEBALLOS', 'REALICÓ', 'VILLA SAUZE', 'SANSINENA', 'SANTA ELEODORA',
  'SANTA REGINA', 'VILLA SABOYA', 'CAÑADA SECA', 'CABA',
];

export const normalizeString = (str: string | null | undefined): string => {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
};

export const getWhatsAppLink = (phone: string) => {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  if (!cleanPhone) return '';
  const formatted = cleanPhone.startsWith('54') ? cleanPhone : `549${cleanPhone}`;
  return `https://wa.me/${formatted}`;
};
