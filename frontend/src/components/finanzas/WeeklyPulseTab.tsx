import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, RefreshCw } from 'lucide-react';
import { api } from '../../utils/api';
import { WeeklyPulseKpiStrip } from './WeeklyPulseKpiStrip';
import { WeeklyPulsePurchasesCard } from './WeeklyPulsePurchasesCard';
import { WeeklyPulseSalesCard } from './WeeklyPulseSalesCard';
import {
  buildWeeklyPulseTsv,
  formatPeso,
  formatWeekRangeLabel,
  getCurrentMondayArIso,
  shiftMondayIso,
  type SaveWeeklyPulsePayload,
  type WeeklyPulseData,
} from './weeklyPulseTypes';

export default function WeeklyPulseTab() {
  const currentMonday = getCurrentMondayArIso();
  const [weekStart, setWeekStart] = useState<string>(currentMonday);
  const [data, setData] = useState<WeeklyPulseData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const loadWeek = useCallback(async (targetWeek: string) => {
    setLoading(true);
    setError(null);
    try {
      const pulse = await api.getWeeklyPulse(targetWeek);
      setData(pulse);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar el pulso semanal');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWeek(weekStart);
  }, [weekStart, loadWeek]);

  const persistUpdate = useCallback(
    async (mutate: (current: SaveWeeklyPulsePayload) => SaveWeeklyPulsePayload) => {
      if (!data) return;
      setSaving(true);
      setError(null);
      try {
        const basePayload: SaveWeeklyPulsePayload = {
          weekStart: data.weekStart,
          resultBuffer: data.summary.resultBuffer,
          manualOpeningCredit: data.manualOpeningCredit,
          manualPurchases: data.purchases
            .filter((p) => p.source === 'MANUAL')
            .map((p) => ({ id: p.id, company: p.company, date: p.date, amount: p.amount })),
          manualSales: data.sales
            .filter((s) => s.source === 'MANUAL')
            .map((s) => ({ id: s.id, locality: s.locality, date: s.date, amountA: s.amountA, amountX: s.amountX })),
          excludedSourceKeys: data.excludedSourceKeys,
        };
        const updated = await api.saveWeeklyPulse(mutate(basePayload));
        setData(updated);
      } catch (err: any) {
        setError(err?.message || 'Error al guardar cambios');
      } finally {
        setSaving(false);
      }
    },
    [data],
  );

  const handleCopyTsv = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(buildWeeklyPulseTsv(data));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('No se pudo copiar al portapapeles');
    }
  };

  const isCurrentWeek = weekStart === currentMonday;
  const summary = data?.summary;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '3px',
            }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              aria-label="Semana anterior"
              onClick={() => setWeekStart((w) => shiftMondayIso(w, -1))}
              style={{ padding: '5px 7px', minHeight: 'auto' }}
            >
              <ChevronLeft size={15} aria-hidden="true" />
            </button>
            <span className="tabular-nums" style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', padding: '0 8px', whiteSpace: 'nowrap' }}>
              {data ? formatWeekRangeLabel(data.weekStart, data.weekEnd) : weekStart}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              aria-label="Semana siguiente"
              onClick={() => setWeekStart((w) => shiftMondayIso(w, 1))}
              style={{ padding: '5px 7px', minHeight: 'auto' }}
            >
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </div>

          {!isCurrentWeek && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setWeekStart(currentMonday)}
              style={{ padding: '6px 10px', fontSize: '0.78rem', minHeight: 'auto' }}
            >
              Esta semana
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleCopyTsv}
            disabled={!data}
            style={{ padding: '6px 10px', fontSize: '0.8rem', minHeight: 'auto', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            {copied ? <Check size={14} color="#16a34a" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void loadWeek(weekStart)}
            disabled={loading || saving}
            style={{ padding: '6px 10px', fontSize: '0.8rem', minHeight: 'auto', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <RefreshCw size={14} className={loading || saving ? 'animate-spin' : ''} aria-hidden="true" />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            fontSize: '0.84rem',
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
          Cargando pulso semanal...
        </div>
      ) : data && summary ? (
        <>
          <WeeklyPulseKpiStrip
            summary={summary}
            isManualOpeningCredit={data.isManualOpeningCredit}
            saving={saving}
            onSaveBuffer={(value) => void persistUpdate((curr) => ({ ...curr, resultBuffer: value }))}
            onSaveOpeningCredit={(value) => void persistUpdate((curr) => ({ ...curr, manualOpeningCredit: value }))}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '16px', alignItems: 'start' }}>
            <WeeklyPulsePurchasesCard
              weekStart={data.weekStart}
              purchases={data.purchases}
              summary={summary}
              saving={saving}
              onAddManual={(item) =>
                void persistUpdate((curr) => ({
                  ...curr,
                  manualPurchases: [...curr.manualPurchases, { id: `mp-${Date.now()}`, ...item }],
                }))
              }
              onRemoveManual={(id) =>
                void persistUpdate((curr) => ({
                  ...curr,
                  manualPurchases: curr.manualPurchases.filter((p) => p.id !== id),
                }))
              }
              onToggleExcluded={(id) =>
                void persistUpdate((curr) => {
                  const exists = curr.excludedSourceKeys.includes(id);
                  return {
                    ...curr,
                    excludedSourceKeys: exists
                      ? curr.excludedSourceKeys.filter((k) => k !== id)
                      : [...curr.excludedSourceKeys, id],
                  };
                })
              }
            />

            <WeeklyPulseSalesCard
              weekStart={data.weekStart}
              sales={data.sales}
              summary={summary}
              saving={saving}
              onAddManual={(item) =>
                void persistUpdate((curr) => ({
                  ...curr,
                  manualSales: [...curr.manualSales, { id: `ms-${Date.now()}`, ...item }],
                }))
              }
              onRemoveManual={(id) =>
                void persistUpdate((curr) => ({
                  ...curr,
                  manualSales: curr.manualSales.filter((s) => s.id !== id),
                }))
              }
            />
          </div>

          {data.history.length > 1 && (
            <section className="card" style={{ padding: '16px 20px' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Últimas semanas
              </h3>
              <div tabIndex={0} role="region" aria-label="Historial de pulso semanal" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.73rem', textTransform: 'uppercase' }}>
                      <th style={{ textAlign: 'left', padding: '7px 6px', fontWeight: 600 }}>Semana</th>
                      <th style={{ textAlign: 'right', padding: '7px 6px', fontWeight: 600 }}>Venta</th>
                      <th style={{ textAlign: 'right', padding: '7px 6px', fontWeight: 600 }}>Compras</th>
                      <th style={{ textAlign: 'right', padding: '7px 6px', fontWeight: 600 }}>Resultado</th>
                      <th style={{ textAlign: 'right', padding: '7px 6px', fontWeight: 600 }}>Crédito cierre</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((row) => {
                      const isSelected = row.weekStart === data.weekStart;
                      return (
                        <tr
                          key={row.weekStart}
                          onClick={() => setWeekStart(row.weekStart)}
                          style={{
                            borderBottom: '1px solid var(--border-light, #f1f5f9)',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? '#f8fafc' : 'transparent',
                            fontWeight: isSelected ? 600 : 400,
                          }}
                        >
                          <td className="tabular-nums" style={{ padding: '8px 6px', color: 'var(--text-primary)' }}>
                            {formatWeekRangeLabel(row.weekStart, row.weekEnd)}
                          </td>
                          <td className="tabular-nums" style={{ padding: '8px 6px', textAlign: 'right' }}>
                            {formatPeso(row.salesTotal)}
                          </td>
                          <td className="tabular-nums" style={{ padding: '8px 6px', textAlign: 'right' }}>
                            {formatPeso(row.weekPurchasesTotal)}
                          </td>
                          <td className="tabular-nums" style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                            {formatPeso(row.resultBuffer)}
                          </td>
                          <td
                            className="tabular-nums"
                            style={{
                              padding: '8px 6px',
                              textAlign: 'right',
                              fontWeight: 600,
                              color: row.status === 'OVERBOUGHT' ? '#E30613' : row.status === 'AVAILABLE' ? '#15803d' : 'var(--text-primary)',
                            }}
                          >
                            {formatPeso(row.closingCredit)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
