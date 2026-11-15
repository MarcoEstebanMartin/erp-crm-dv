import { useEffect, useMemo, useState } from 'react';
import { Check, Printer, X } from 'lucide-react';
import { api } from '../utils/api';
import {
  getFontScaleConfig,
  groupPriceListProducts,
  isQueso,
  isQuesoRemotti,
  roundIntegerPeso,
  type PriceListProduct,
} from './modals/priceListHelpers';
import { PriceListTableRenderer } from './modals/PriceListTableRenderer';

interface PriceListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PriceListModal({ isOpen, onClose }: PriceListModalProps) {
  const [products, setProducts] = useState<PriceListProduct[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [priceListType, setPriceListType] = useState<'A' | 'B' | 'C'>('A');
  const [targetType, setTargetType] = useState<'client' | 'staff'>('client');
  const [fontScale, setFontScale] = useState<'small' | 'medium' | 'large'>('medium');
  const [listDate, setListDate] = useState(() => {
    const today = new Date();
    return `${today.getDate()} - ${today.getMonth() + 1} - ${today.getFullYear()}`;
  });

  const fontScaleConfig = useMemo(() => getFontScaleConfig(fontScale), [fontScale]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchLivePriceList = async () => {
      setLoading(true);
      setError(null);
      try {
        const catalog = await api.getPriceListCatalog();
        if (catalog && Array.isArray(catalog.products)) {
          setProducts(catalog.products);
          setCategoryOrder(Array.isArray(catalog.categoryOrder) ? catalog.categoryOrder : []);
        } else {
          const fallbackData = await api.getProducts('');
          setProducts(fallbackData);
          setCategoryOrder([]);
        }
      } catch {
        try {
          const fallbackData = await api.getProducts('');
          setProducts(fallbackData);
          setCategoryOrder([]);
        } catch (innerErr) {
          setError('Error al cargar productos.');
          console.error(innerErr);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchLivePriceList();
  }, [isOpen]);

  const groupedData = useMemo(
    () => groupPriceListProducts(products, categoryOrder),
    [products, categoryOrder],
  );
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
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            width: '96%',
            maxWidth: '1240px',
            height: '92vh',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-light)',
            }}
          >
            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>
              Lista de precios
            </h2>
            <button
              type="button"
              aria-label="Cerrar"
              className="btn btn-ghost"
              onClick={onClose}
              style={{ padding: '4px' }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', flex: 1, overflow: 'hidden' }}>
            <div
              style={{
                padding: '16px',
                borderRight: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-light)',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Destinatario
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', backgroundColor: 'var(--border-color)', padding: '2px', borderRadius: '6px' }}>
                  {(['client', 'staff'] as const).map((tt) => (
                    <button
                      key={tt}
                      type="button"
                      aria-pressed={targetType === tt}
                      onClick={() => setTargetType(tt)}
                      style={{
                        padding: '6px 4px',
                        fontSize: '0.78rem',
                        fontWeight: targetType === tt ? 600 : 500,
                        border: 'none',
                        borderRadius: '4px',
                        backgroundColor: targetType === tt ? 'var(--bg-card)' : 'transparent',
                        color: targetType === tt ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {tt === 'client' ? 'Clientes' : 'Interna'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Tarifa
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(['A', 'B', 'C'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={priceListType === t}
                      onClick={() => setPriceListType(t)}
                      style={{
                        padding: '8px 10px',
                        fontSize: '0.8rem',
                        fontWeight: priceListType === t ? 600 : 500,
                        border: priceListType === t ? '1.5px solid var(--text-primary)' : '1px solid var(--border-color)',
                        borderRadius: '6px',
                        backgroundColor: priceListType === t ? 'var(--bg-card)' : 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{t === 'A' ? 'Lista Oficial' : t === 'B' ? 'Especial 1' : 'Especial 2'}</span>
                      {priceListType === t && <Check size={13} aria-hidden="true" style={{ color: 'var(--text-primary)' }} />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="listDateInput" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Fecha
                </label>
                <input
                  id="listDateInput"
                  name="listDate"
                  type="text"
                  className="input"
                  style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                  value={listDate}
                  onChange={(e) => setListDate(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="fontScaleSelect" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Tamaño
                </label>
                <select
                  id="fontScaleSelect"
                  name="fontScale"
                  className="select"
                  value={fontScale}
                  onChange={(e) => setFontScale(e.target.value as 'small' | 'medium' | 'large')}
                  style={{ fontSize: '0.82rem', padding: '6px 8px', height: '34px' }}
                >
                  <option value="small">Chico (7.5pt)</option>
                  <option value="medium">Mediano (9pt)</option>
                  <option value="large">Grande (11pt)</option>
                </select>
              </div>

              {!loading && totalVisibleProducts > 0 && (
                <div
                  style={{
                    marginTop: 'auto',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {groupedData.length} rubros · {totalVisibleProducts} productos
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#4e5256', padding: '16px 20px' }}>
              <div
                style={{
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  padding: '32px 36px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  borderRadius: '2px',
                  flex: 1,
                  overflowY: 'auto',
                  width: '100%',
                  maxWidth: '820px',
                  margin: '0 auto',
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '0.88rem', color: '#666' }}>
                    Cargando...
                  </div>
                ) : error ? (
                  <div role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#E30613', fontSize: '0.88rem' }}>
                    {error}
                  </div>
                ) : (
                  <PriceListTableRenderer
                    groupedData={groupedData}
                    targetType={targetType}
                    listDate={listDate}
                    fontScaleConfig={fontScaleConfig}
                    getProductPrice={getProductPrice}
                    isPrintMode={false}
                  />
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              backgroundColor: 'var(--bg-light)',
            }}
          >
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading || products.length === 0}
              onClick={() => setTimeout(() => window.print(), 150)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Printer size={15} aria-hidden="true" />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      <div className="print-only" style={{ color: '#000', backgroundColor: '#fff', width: '100%', fontFamily: 'system-ui, sans-serif' }}>
        <PriceListTableRenderer
          groupedData={groupedData}
          targetType={targetType}
          listDate={listDate}
          fontScaleConfig={fontScaleConfig}
          getProductPrice={getProductPrice}
          isPrintMode={true}
        />
      </div>
    </>
  );
}
