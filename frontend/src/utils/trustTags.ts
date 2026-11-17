export type TrustTagCode =
  | 'CONFIABLE'
  | 'OBSERVADO'
  | 'ATRASO_FRECUENTE'
  | 'SOLO_CONTADO'
  | 'CONFLICTIVO';

export type PersonaNoteCategory = 'GENERAL' | 'COBRANZA' | 'INCIDENTE' | 'COMERCIAL';

export interface TrustTagMeta {
  code: TrustTagCode;
  label: string;
  bg: string;
  color: string;
  border: string;
  isWarning: boolean;
}

export const TRUST_TAGS: readonly TrustTagMeta[] = [
  {
    code: 'CONFIABLE',
    label: 'Confiable',
    bg: '#E6F4EA',
    color: '#137333',
    border: '#CEEAD6',
    isWarning: false,
  },
  {
    code: 'OBSERVADO',
    label: 'Observado',
    bg: '#F3F4F6',
    color: '#374151',
    border: '#D1D5DB',
    isWarning: false,
  },
  {
    code: 'ATRASO_FRECUENTE',
    label: 'Atraso frecuente',
    bg: '#FEF3C7',
    color: '#92400E',
    border: '#FDE68A',
    isWarning: true,
  },
  {
    code: 'SOLO_CONTADO',
    label: 'Solo Contado',
    bg: '#FCE8E6',
    color: '#C5221F',
    border: '#FAD2CF',
    isWarning: true,
  },
  {
    code: 'CONFLICTIVO',
    label: 'Conflictivo',
    bg: '#FCE8E6',
    color: '#C5221F',
    border: '#FAD2CF',
    isWarning: true,
  },
] as const;

export const TRUST_TAG_MAP: Record<string, TrustTagMeta> = Object.fromEntries(
  TRUST_TAGS.map((tag) => [tag.code, tag]),
);

export const NOTE_CATEGORIES: readonly { value: PersonaNoteCategory; label: string }[] = [
  { value: 'GENERAL', label: 'General' },
  { value: 'COBRANZA', label: 'Cobranza' },
  { value: 'INCIDENTE', label: 'Incidente' },
  { value: 'COMERCIAL', label: 'Comercial' },
] as const;

export const NOTE_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  NOTE_CATEGORIES.map((c) => [c.value, c.label]),
);
