import React, { useEffect, useMemo, useState } from 'react';
import { Pause, Play, Plus, Trash2 } from 'lucide-react';
import { api } from '../../../utils/api';
import { useConfirm } from '../../../context/ConfirmContext';
import WeeklyPromoModal from './WeeklyPromoModal';
import {
  type CatalogProduct,
  type PromoVisualStatus,
  type WeeklyPromo,
  type WeeklyPromoType,
  formatPromoConditionSummary,
  formatPromoDateRange,
  resolvePromoVisualStatus,
} from './weeklyPromo.helpers';

interface PricingRulesTabProps {
  setErrorMsg: (msg: string) => void;
  setSuccessMsg: (msg: string) => void;
}

const TYPE_LABEL: Record<WeeklyPromoType, string> = {
  OFFER_PRICE: 'Precio Oferta',
  BUY_X_GET_Y: 'N+M Gratis',
  COMBO: 'Combo',
};

const STATUS_BADGE: Record<PromoVisualStatus, { label: string; bg: string; color: string; border: string }> = {
  VIGENTE: { label: 'Vigente', bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' },
  PROGRAMADA: { label: 'Programada', bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' },
  PAUSADA: { label: 'Pausada', bg: '#F3F4F6', color: '#4B5563', border: '#E5E7EB' },
  VENCIDA: { label: 'Vencida', bg: '#F9FAFB', color: '#6B7280', border: '#E5E7EB' },
};

export default function PricingRulesTab({ setErrorMsg, setSuccessMsg }: PricingRulesTabProps) {
  const confirm = useConfirm();
  const [promos, setPromos] = useState<WeeklyPromo[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'VIGENTES' | 'TODAS'>('VIGENTES');
  const [modalOpen, setModalOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [promoList, productList] = await Promise.all([
        api.getWeeklyPromos(),
        api.getProducts(undefined, false),
      ]);
      setPromos(Array.isArray(promoList) ? promoList : []);
      setProducts(Array.isArray(productList) ? productList : []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al cargar las ofertas semanales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeCount = useMemo(
    () => promos.filter((p) => resolvePromoVisualStatus(p) === 'VIGENTE').length,
    [promos],
  );

  const visiblePromos = useMemo(() => {
    if (filterMode === 'TODAS') return promos;
    return promos.filter((p) => resolvePromoVisualStatus(p) === 'VIGENTE');
  }, [promos, filterMode]);

  const handleToggle = async (promo: WeeklyPromo) => {
    setErrorMsg('');
    setSuccessMsg('');
    setBusyId(promo.id);
    try {
      const updated = await api.toggleWeeklyPromo(promo.id);
      setPromos((prev) => prev.map((p) => (p.id === promo.id ? updated : p)));
      setSuccessMsg(updated.isActive ? 'Oferta activada.' : 'Oferta pausada.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo cambiar el estado de la oferta');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (promo: WeeklyPromo) => {
    const ok = await confirm(`¿Eliminar la oferta "${promo.name}"?`, { type: 'danger' });
    if (!ok) return;
    setErrorMsg('');
    setSuccessMsg('');
    setBusyId(promo.id);
    try {
      await api.deleteWeeklyPromo(promo.id);
      setPromos((prev) => prev.filter((p) => p.id !== promo.id));
      setSuccessMsg('Oferta eliminada.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo eliminar la oferta');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '24px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: '#6B7280', textTransform: 'uppercase' }}>
            Promociones comerciales
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#111827' }}>Ofertas Semanales</h2>
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#374151', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: '999px', padding: '2px 10px' }}>
              {activeCount} {activeCount === 1 ? 'vigente' : 'vigentes'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'inline-flex', background: '#F3F4F6', borderRadius: '8px', padding: '3px', border: '1px solid #E5E7EB' }}>
            {(['VIGENTES', 'TODAS'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilterMode(mode)}
                style={{
                  border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                  background: filterMode === mode ? '#FFFFFF' : 'transparent',
                  color: filterMode === mode ? '#111827' : '#6B7280',
                  boxShadow: filterMode === mode ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {mode === 'VIGENTES' ? 'Vigentes' : `Todas (${promos.length})`}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { setErrorMsg(''); setSuccessMsg(''); setModalOpen(true); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.84rem' }}
          >
            <Plus size={15} /> Nueva oferta
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '36px 16px', textAlign: 'center', color: '#6B7280', fontSize: '0.88rem' }}>
          Cargando ofertas semanales...
        </div>
      ) : visiblePromos.length === 0 ? (
        <div style={{ border: '1px dashed #E5E7EB', borderRadius: '8px', padding: '36px 20px', textAlign: 'center', color: '#6B7280', fontSize: '0.88rem' }}>
          {promos.length === 0
            ? 'No hay ofertas semanales cargadas. Creá una con "+ Nueva oferta".'
            : 'No hay ofertas vigentes en este momento. Cambiá a "Todas" para ver pausadas o programadas.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', color: '#6B7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Tipo</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Detalle</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Vigencia</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Estado</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visiblePromos.map((promo) => {
                const status = resolvePromoVisualStatus(promo);
                const badge = STATUS_BADGE[status];
                const busy = busyId === promo.id;
                return (
                  <tr key={promo.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: '6px', background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#374151', fontSize: '0.76rem', fontWeight: 600 }}>
                        {TYPE_LABEL[promo.type]}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{promo.name}</div>
                      <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '2px' }}>
                        {formatPromoConditionSummary(promo)}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: '#374151', fontSize: '0.82rem' }}>
                      {formatPromoDateRange(promo.startDate, promo.endDate)}
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: '999px', background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, fontSize: '0.75rem', fontWeight: 600 }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busy}
                          onClick={() => handleToggle(promo)}
                          title={promo.isActive ? 'Pausar oferta' : 'Activar oferta'}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#374151', padding: '4px 8px', border: '1px solid #E5E7EB' }}
                        >
                          {promo.isActive ? <><Pause size={13} /> Pausar</> : <><Play size={13} /> Activar</>}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busy}
                          onClick={() => handleDelete(promo)}
                          title="Eliminar oferta"
                          style={{ color: '#E30613', padding: '5px 7px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <WeeklyPromoModal
        open={modalOpen}
        products={products}
        onClose={() => setModalOpen(false)}
        onCreated={(created) => {
          setPromos((prev) => [created, ...prev]);
          setSuccessMsg('Oferta semanal publicada.');
        }}
      />
    </div>
  );
}
