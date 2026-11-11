import { useState, useEffect, useMemo } from 'react';
import { X, Printer, Check, FileText } from 'lucide-react';
import { api } from '../utils/api';
import {
  getFontScaleConfig,
  groupPriceListProducts,
  isQueso,
  isQuesoRemotti,
  roundIntegerPeso,
  type PriceListGroupBy,
  type PriceListProduct,
} from './modals/priceListHelpers';
import { PriceListTableRenderer } from './modals/PriceListTableRenderer';

interface PriceListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PriceListModal({ isOpen, onClose }: PriceListModalProps) {
  const [products, setProducts] = useState<PriceListProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [groupBy, setGroupBy] = useState<PriceListGroupBy>('category');
  const [priceListType, setPriceListType] = useState<'A' | 'B' | 'C'>('A');
  const [targetType, setTargetType] = useState<'client' | 'staff'>('client');
  const [fontScale, setFontScale] = useState<'small' | 'medium' | 'large'>('medium');
  const [listDate, setListDate] = useState(() => {
    const today = new Date();
    return `${today.getDate()} - ${today.getMonth() + 1} - ${today.getFullYear()}`;
  });

  const fontScaleConfig = useMemo(() => getFontScaleConfig(fontScale), [fontScale]);

  useEffect(() => {
    if (isOpen) {
      const fetchAllProducts = async () => {
        setLoading(true);
        setError(null);
        try {
          const data = await api.getProducts('');
          setProducts(data);
        } catch (err) {
          setError('Error al obtener la lista de productos.');
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      fetchAllProducts();
    }
  }, [isOpen]);

  const groupedData = useMemo(() => groupPriceListProducts(products, groupBy), [products, groupBy]);
  const totalVisibleProducts = useMemo(
    () => groupedData.reduce((acc, g) => acc + g.totalCount, 0),
    [groupedData],
  );

  const getProductPrice = (prod: PriceListProduct) => {
    const basePrice = roundIntegerPeso(Number(prod.listPrice) || 0);
    if (priceListType === 'B') return isQueso(prod) ? roundIntegerPeso(basePrice * 0.97) : basePrice;
    if (priceListType === 'C') return isQuesoRemotti(prod) ? roundIntegerPeso(basePrice * 0.95) : basePrice;
    return basePrice;
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="no-print"
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px', animation: 'fadeIn 0.2s ease-out' }}
      >
        <div
          style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', width: '96%', maxWidth: '1240px', height: '92vh', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}
        >
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} style={{ color: 'var(--text-secondary)' }} />
              <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>Generar Lista de Precios PDF</h2>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', flex: 1, overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-light)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agrupar por</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', backgroundColor: 'var(--border-color)', padding: '2px', borderRadius: '6px' }}>
                  {([
                    { id: 'category', label: 'Categorías' },
                    { id: 'rubro', label: 'Rubros' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setGroupBy(opt.id)}
                      style={{
                        padding: '6px 4px', fontSize: '0.78rem', fontWeight: groupBy === opt.id ? 600 : 500, border: 'none', borderRadius: '4px',
                        backgroundColor: groupBy === opt.id ? 'var(--bg-card)' : 'transparent', color: groupBy === opt.id ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Destinatario</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', backgroundColor: 'var(--border-color)', padding: '2px', borderRadius: '6px' }}>
                  {(['client', 'staff'] as const).map((tt) => (
                    <button
                      key={tt}
                      type="button"
                      onClick={() => setTargetType(tt)}
                      style={{
                        padding: '6px 4px', fontSize: '0.78rem', fontWeight: targetType === tt ? 600 : 500, border: 'none', borderRadius: '4px',
                        backgroundColor: targetType === tt ? 'var(--bg-card)' : 'transparent', color: targetType === tt ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer',
                      }}
                    >
                      {tt === 'client' ? 'Clientes' : 'Interna'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tarifa</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(['A', 'B', 'C'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPriceListType(t)}
                      style={{
                        padding: '8px 10px', fontSize: '0.8rem', fontWeight: priceListType === t ? 600 : 500,
                        border: priceListType === t ? '1.5px solid var(--text-primary)' : '1px solid var(--border-color)',
                        borderRadius: '6px', backgroundColor: priceListType === t ? 'var(--bg-card)' : 'transparent',
                        textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}
                    >
                      <span>{t === 'A' ? 'Lista 4 Oficial' : t === 'B' ? 'Lista Especial' : 'Lista Especial 2'}</span>
                      {priceListType === t && <Check size={13} style={{ color: 'var(--text-primary)' }} />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="listDateInput" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fecha</label>
                <input id="listDateInput" type="text" className="input" style={{ fontSize: '0.82rem', padding: '6px 8px' }} value={listDate} onChange={(e) => setListDate(e.target.value)} />
              </div>

              <div>
                <label htmlFor="fontScaleSelect" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tamaño de Letra</label>
                <select
                  id="fontScaleSelect"
                  className="input"
                  value={fontScale}
                  onChange={(e) => setFontScale(e.target.value as 'small' | 'medium' | 'large')}
                  style={{ fontSize: '0.82rem', padding: '6px 8px', height: '34px', width: '100%', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-card)' }}
                >
                  <option value="small">Chico (7.5pt)</option>
                  <option value="medium">Mediano (9pt)</option>
                  <option value="large">Grande (11pt)</option>
                </select>
              </div>

              {!loading && totalVisibleProducts > 0 && (
                <div style={{ marginTop: 'auto', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                    {groupedData.length} {groupBy === 'category' ? 'categorías comerciales' : 'rubros'}
                  </div>
                  <div>{totalVisibleProducts} productos activos incluidos</div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#4e5256', padding: '16px 20px' }}>
              <div style={{ backgroundColor: '#ffffff', color: '#000000', padding: '32px 36px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', borderRadius: '2px', flex: 1, overflowY: 'auto', width: '100%', maxWidth: '820px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '0.88rem', color: '#666' }}>Cargando catálogo de productos...</div>
                ) : error ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'red', fontSize: '0.88rem' }}>{error}</div>
                ) : (
                  <PriceListTableRenderer groupedData={groupedData} groupBy={groupBy} targetType={targetType} listDate={listDate} fontScaleConfig={fontScaleConfig} getProductPrice={getProductPrice} isPrintMode={false} />
                )}
              </div>
            </div>
          </div>

          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: 'var(--bg-light)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={loading || products.length === 0} onClick={() => setTimeout(() => window.print(), 150)} style={{ padding: '8px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Printer size={15} /><span>Imprimir / Guardar PDF</span>
            </button>
          </div>
        </div>
      </div>

      <div className="print-only" style={{ color: '#000', backgroundColor: '#fff', width: '100%', fontFamily: 'system-ui, sans-serif' }}>
        <PriceListTableRenderer groupedData={groupedData} groupBy={groupBy} targetType={targetType} listDate={listDate} fontScaleConfig={fontScaleConfig} getProductPrice={getProductPrice} isPrintMode={true} />
      </div>
    </>
  );
}
