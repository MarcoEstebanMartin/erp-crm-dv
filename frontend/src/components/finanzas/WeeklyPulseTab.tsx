import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, RefreshCw } from 'lucide-react';
import { api } from '../../utils/api';
import { WeeklyPulseSheetGrid } from './WeeklyPulseSheetGrid';
import {
  buildWeeklyPulseTsv,
  formatWeekRangeLabel,
  getCurrentMondayArIso,
  normalizePulseCompanyKey,
  shiftMondayIso,
  type SaveWeeklyPulsePayload,
  type WeeklyPulseData,
} from './weeklyPulseTypes';

const CELL_BORDER = '1px solid var(--border-color, #e5e7eb)';

export default function WeeklyPulseTab() {
  const currentMonday = getCurrentMondayArIso();
  const [weekStart, setWeekStart] = useState<string>(currentMonday);
  const [data, setData] = useState<WeeklyPulseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadWeek = useCallback(async (targetWeek: string) => {
    setLoading(true);
    setError(null);
    try {
      const pulse = await api.getWeeklyPulse(targetWeek);
      setData(pulse);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar la planilla');
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
        setError(err?.message || 'Error al guardar');
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
      setError('No se pudo copiar');
    }
  };

  const isCurrentWeek = weekStart === currentMonday;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '1080px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', backgroundColor: '#fff', border: CELL_BORDER, borderRadius: '6px', padding: '2px' }}>
            <button type="button" className="btn btn-ghost" aria-label="Semana anterior" onClick={() => setWeekStart((w) => shiftMondayIso(w, -1))} style={{ padding: '4px 6px', minHeight: 'auto' }}>
              <ChevronLeft size={15} aria-hidden="true" />
            </button>
            <span className="tabular-nums" style={{ fontSize: '0.84rem', fontWeight: 600, padding: '0 8px', whiteSpace: 'nowrap' }}>
              {data ? formatWeekRangeLabel(data.weekStart, data.weekEnd) : weekStart}
            </span>
            <button type="button" className="btn btn-ghost" aria-label="Semana siguiente" onClick={() => setWeekStart((w) => shiftMondayIso(w, 1))} style={{ padding: '4px 6px', minHeight: 'auto' }}>
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </div>
          {!isCurrentWeek && (
            <button type="button" className="btn btn-secondary" onClick={() => setWeekStart(currentMonday)} style={{ padding: '5px 9px', fontSize: '0.78rem', minHeight: 'auto' }}>
              Esta semana
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button type="button" className="btn btn-ghost" onClick={handleCopyTsv} disabled={!data} style={{ padding: '5px 9px', fontSize: '0.8rem', minHeight: 'auto', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            {copied ? <Check size={14} color="#16a34a" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void loadWeek(weekStart)} disabled={loading || saving} style={{ padding: '5px 9px', fontSize: '0.8rem', minHeight: 'auto', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <RefreshCw size={14} className={loading || saving ? 'animate-spin' : ''} aria-hidden="true" />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.82rem' }}>
          {error}
        </div>
      )}

      {loading && !data ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', border: CELL_BORDER, borderRadius: '8px', backgroundColor: '#fff' }}>
          Cargando...
        </div>
      ) : data ? (
        <WeeklyPulseSheetGrid
          data={data}
          saving={saving}
          onSaveCredit={(value) => void persistUpdate((c) => ({ ...c, manualOpeningCredit: value }))}
          onSaveBuffer={(value) => void persistUpdate((c) => ({ ...c, resultBuffer: value }))}
          onAddPurchase={(item) =>
            void persistUpdate((c) => ({
              ...c,
              manualPurchases: [...c.manualPurchases, { id: `mp-${Date.now()}`, ...item }],
            }))
          }
          onUpdatePurchase={(id, patch) =>
            void persistUpdate((c) => ({
              ...c,
              manualPurchases: c.manualPurchases.map((x) =>
                x.id === id
                  ? {
                      ...x,
                      date: patch.date ?? x.date,
                      amount: patch.amount !== undefined ? patch.amount : x.amount,
                    }
                  : x,
              ),
            }))
          }
          onLoadHabituals={() =>
            void persistUpdate((c) => {
              const existingKeys = new Set(data.purchases.map((p) => normalizePulseCompanyKey(p.company)));
              const toAppend = (data.habitualCompanies ?? [])
                .map(normalizePulseCompanyKey)
                .filter((key) => key && !existingKeys.has(key))
                .map((key, i) => ({
                  id: `hab-${Date.now()}-${i}`,
                  company: key,
                  date: data.weekStart,
                  amount: 0,
                }));
              if (toAppend.length === 0) return c;
              return { ...c, manualPurchases: [...toAppend, ...c.manualPurchases] };
            })
          }
          onRemovePurchase={(id) =>
            void persistUpdate((c) => ({
              ...c,
              manualPurchases: c.manualPurchases.filter((x) => x.id !== id),
            }))
          }
          onToggleExcludePurchase={(id) =>
            void persistUpdate((c) => ({
              ...c,
              excludedSourceKeys: c.excludedSourceKeys.includes(id)
                ? c.excludedSourceKeys.filter((k) => k !== id)
                : [...c.excludedSourceKeys, id],
            }))
          }
          onAddSale={(item) =>
            void persistUpdate((c) => ({
              ...c,
              manualSales: [...c.manualSales, { id: `ms-${Date.now()}`, ...item }],
            }))
          }
          onRemoveSale={(id) =>
            void persistUpdate((c) => ({
              ...c,
              manualSales: c.manualSales.filter((x) => x.id !== id),
            }))
          }
        />
      ) : null}
    </div>
  );
}
