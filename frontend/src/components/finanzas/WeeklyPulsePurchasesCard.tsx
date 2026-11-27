import { useState } from 'react';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import {
  formatPeso,
  formatShortArDate,
  type WeeklyPulsePurchaseItem,
  type WeeklyPulseSummary,
} from './weeklyPulseTypes';

interface WeeklyPulsePurchasesCardProps {
  weekStart: string;
  purchases: WeeklyPulsePurchaseItem[];
  summary: WeeklyPulseSummary;
  saving: boolean;
  onAddManual: (item: { company: string; date: string; amount: number }) => void;
  onRemoveManual: (id: string) => void;
  onToggleExcluded: (id: string) => void;
}

const QUICK_PRESETS = [
  { label: '+ Comisión MP', company: 'COMISION M.PAGO' },
  { label: '+ Perc. IIBB', company: 'PERC-ING.BRUTOS' },
];

export function WeeklyPulsePurchasesCard({
  weekStart,
  purchases,
  summary,
  saving,
  onAddManual,
  onRemoveManual,
  onToggleExcluded,
}: WeeklyPulsePurchasesCardProps) {
  const [adding, setAdding] = useState(false);
  const [company, setCompany] = useState('');
  const [date, setDate] = useState(weekStart);
  const [amountRaw, setAmountRaw] = useState('');

  const openForm = (presetCompany = '') => {
    setCompany(presetCompany);
    setDate(weekStart);
    setAmountRaw('');
    setAdding(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = Number(amountRaw.replace(/\./g, '').replace(',', '.'));
    if (!company.trim() || !Number.isFinite(cleaned) || cleaned === 0) return;
    onAddManual({ company: company.trim(), date: date || weekStart, amount: Math.round(cleaned) });
    setAdding(false);
    setCompany('');
    setAmountRaw('');
  };

  return (
    <section
      className="card"
      style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Compras y gastos
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {QUICK_PRESETS.map((preset) => (
            <button
              key={preset.company}
              type="button"
              className="btn btn-ghost"
              disabled={saving}
              onClick={() => openForm(preset.company)}
              style={{ padding: '4px 8px', fontSize: '0.76rem', minHeight: 'auto' }}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={saving}
            onClick={() => openForm('')}
            style={{ padding: '4px 10px', fontSize: '0.76rem', minHeight: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <Plus size={13} aria-hidden="true" />
            Agregar
          </button>
        </div>
      </div>

      {adding && (
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(140px, 1.4fr) 115px minmax(110px, 1fr) auto',
            gap: '8px',
            alignItems: 'center',
            padding: '10px',
            borderRadius: '8px',
            backgroundColor: '#f8fafc',
            border: '1px solid var(--border-color)',
          }}
        >
          <input
            type="text"
            className="input"
            aria-label="Proveedor o concepto"
            placeholder="Proveedor o gasto"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            autoFocus
            style={{ fontSize: '0.82rem', padding: '6px 8px' }}
          />
          <input
            type="date"
            className="input"
            aria-label="Fecha"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ fontSize: '0.8rem', padding: '6px 8px' }}
          />
          <input
            type="number"
            step="1"
            className="input tabular-nums"
            aria-label="Importe en pesos"
            placeholder="Importe $"
            value={amountRaw}
            onChange={(e) => setAmountRaw(e.target.value)}
            style={{ fontSize: '0.82rem', padding: '6px 8px', textAlign: 'right' }}
          />
          <div style={{ display: 'flex', gap: '4px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '6px 10px', fontSize: '0.78rem', minHeight: 'auto' }}>
              Sumar
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)} style={{ padding: '6px 8px', fontSize: '0.78rem', minHeight: 'auto' }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div
        tabIndex={0}
        role="region"
        aria-label="Tabla de compras y gastos de la semana"
        style={{ overflowX: 'auto' }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.74rem', textTransform: 'uppercase' }}>
              <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600 }}>Proveedor / Concepto</th>
              <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600, width: '72px' }}>Recepción</th>
              <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>Importe</th>
              <th style={{ width: '36px', padding: '8px 4px' }} aria-label="Acción" />
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '18px 6px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Sin compras recibidas esta semana
                </td>
              </tr>
            ) : (
              purchases.map((item) => {
                const isManual = item.source === 'MANUAL';
                const isExcluded = Boolean(item.excluded);
                const tooltip = item.invoiceNumber
                  ? `Fact. ${item.invoiceNumber}${item.invoiceDate ? ` (${formatShortArDate(item.invoiceDate)})` : ''}`
                  : undefined;

                return (
                  <tr
                    key={item.id}
                    title={tooltip}
                    style={{
                      borderBottom: '1px solid var(--border-light, #f1f5f9)',
                      opacity: isExcluded ? 0.45 : 1,
                    }}
                  >
                    <td style={{ padding: '8px 6px', fontWeight: 500, color: 'var(--text-primary)', textDecoration: isExcluded ? 'line-through' : 'none' }}>
                      <span>{item.company}</span>
                      {isManual && (
                        <span
                          style={{
                            marginLeft: '6px',
                            fontSize: '0.68rem',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: '#f1f5f9',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="tabular-nums" style={{ padding: '8px 6px', color: 'var(--text-secondary)' }}>
                      {formatShortArDate(item.date)}
                    </td>
                    <td className="tabular-nums" style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, textDecoration: isExcluded ? 'line-through' : 'none' }}>
                      {formatPeso(item.amount)}
                    </td>
                    <td style={{ padding: '4px', textAlign: 'right' }}>
                      {isManual ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={saving}
                          aria-label={`Eliminar ${item.company}`}
                          title="Eliminar"
                          onClick={() => onRemoveManual(item.id)}
                          style={{ padding: '4px', minHeight: 'auto', color: 'var(--text-muted)' }}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={saving}
                          aria-label={isExcluded ? `Incluir ${item.company}` : `Ocultar ${item.company} de esta semana`}
                          title={isExcluded ? 'Incluir en el pulso' : 'Excluir del pulso esta semana'}
                          onClick={() => onToggleExcluded(item.id)}
                          style={{ padding: '4px', minHeight: 'auto', color: isExcluded ? 'var(--color-primary)' : 'var(--text-muted)' }}
                        >
                          {isExcluded ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <td colSpan={2} style={{ padding: '8px 6px', fontWeight: 500 }}>Crédito anterior</td>
              <td className="tabular-nums" style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: summary.openingCredit > 0 ? '#E30613' : summary.openingCredit < 0 ? '#15803d' : 'var(--text-primary)' }}>
                {formatPeso(summary.openingCredit)}
              </td>
              <td />
            </tr>
            <tr style={{ borderTop: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
              <td colSpan={2} style={{ padding: '9px 6px', fontWeight: 700, color: 'var(--text-primary)' }}>Total compras + crédito</td>
              <td className="tabular-nums" style={{ padding: '9px 6px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatPeso(summary.totalPurchasesWithCredit)}
              </td>
              <td />
            </tr>
            <tr>
              <td colSpan={2} style={{ padding: '8px 6px', fontWeight: 600, color: 'var(--text-secondary)' }}>Resultado fijo</td>
              <td className="tabular-nums" style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                {formatPeso(summary.resultBuffer)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
