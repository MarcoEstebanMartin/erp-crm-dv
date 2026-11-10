/**
 * Motor Nuclear de Búsqueda Fonética Argentina (Regla Constitucional).
 * Normaliza tildes, dobles letras y equivalencias fonéticas locales (b/v, s/z/ce/ci)
 * para búsquedas instantáneas en mostrador y preventa.
 */
export function normalizePhoneticText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/v/g, 'b')
    .replace(/z/g, 's')
    .replace(/[cs]?c([ei])/g, 's$1')
    .replace(/y/g, 'i')
    .replace(/ss+/g, 's')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifica si un texto objetivo (o conjunto de campos como SKU + Nombre + Rubro)
 * coincide con todos los términos buscados por el operador sin importar el orden,
 * tildes ni confusiones entre b/v o s/z/c.
 */
export function matchesPhoneticQuery(targetText: string, rawQuery: string): boolean {
  const normalizedQuery = normalizePhoneticText(rawQuery);
  if (!normalizedQuery) {
    return true;
  }

  const normalizedTarget = normalizePhoneticText(targetText);
  const tokens = normalizedQuery.split(' ');

  return tokens.every((token) => normalizedTarget.includes(token));
}
