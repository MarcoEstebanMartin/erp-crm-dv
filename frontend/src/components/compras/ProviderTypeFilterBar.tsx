import type { FC } from 'react';

export type ProviderTypeFilter = 'ALL' | 'MERCADERIA' | 'RODADOS' | 'SERVICIOS';

export const PROVIDER_TYPE_LABELS: Record<'MERCADERIA' | 'RODADOS' | 'SERVICIOS', string> = {
  MERCADERIA: 'Mercadería',
  RODADOS: 'Rodados',
  SERVICIOS: 'Servicios',
};

const OPTIONS: Array<{ id: ProviderTypeFilter; label: string }> = [
  { id: 'ALL', label: 'Todos' },
  { id: 'MERCADERIA', label: 'Mercadería' },
  { id: 'RODADOS', label: 'Rodados' },
  { id: 'SERVICIOS', label: 'Servicios' },
];

export const ProviderTypeFilterBar: FC<{
  value: ProviderTypeFilter;
  onChange: (value: ProviderTypeFilter) => void;
}> = ({ value, onChange }) => (
  <div role="group" aria-label="Filtrar por tipo de proveedor" style={{ display: 'inline-flex', gap: '3px', backgroundColor: '#F3F4F6', padding: '3px', borderRadius: '8px', height: '38px', alignItems: 'center' }}>
    {OPTIONS.map((opt) => {
      const active = value === opt.id;
      return (
        <button
          key={opt.id}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(opt.id)}
          style={{
            border: 'none',
            borderRadius: '6px',
            padding: '5px 10px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: active ? '#fff' : 'transparent',
            color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);
