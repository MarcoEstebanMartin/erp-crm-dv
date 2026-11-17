import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { api } from '../../utils/api';
import { NativeModalDialog } from './NativeModalDialog';

interface QuickPriceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickPriceSearchModal({ isOpen, onClose }: QuickPriceSearchModalProps) {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setProducts([]);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || query.trim().length < 2) {
      setProducts([]);
      return;
    }

    const fetchProducts = async () => {
      setLoading(true);
      try {
        const data = await api.getProducts(query);
        setProducts((data || []).slice(0, 10));
      } catch (err) {
        console.error('Error al buscar precios:', err);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchProducts, 200);
    return () => clearTimeout(debounce);
  }, [query, isOpen]);

  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Buscar precio"
      style={{ maxWidth: '620px', width: '92vw', borderRadius: '12px' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-light)',
          gap: '10px',
        }}
      >
        <Search size={18} aria-hidden="true" style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          name="quickPriceSearch"
          aria-label="Buscar producto o SKU"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Producto o SKU"
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            fontSize: '0.98rem',
            fontWeight: 500,
            outline: 'none',
            color: 'var(--text-primary)',
          }}
        />
        <button
          type="button"
          aria-label="Cerrar"
          className="btn btn-ghost"
          style={{ padding: '4px' }}
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div style={{ padding: '8px', minHeight: '96px', maxHeight: '420px', overflowY: 'auto' }}>
        {loading && products.length === 0 && (
          <div style={{ textAlign: 'center', padding: '26px', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
            Buscando...
          </div>
        )}

        {!loading && query.trim().length >= 2 && products.length === 0 && (
          <div style={{ textAlign: 'center', padding: '26px', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
            Sin resultados
          </div>
        )}

        {!loading && query.trim().length < 2 && (
          <div style={{ textAlign: 'center', padding: '26px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            Ctrl + Q
          </div>
        )}

        {products.map((p) => {
          const imgSrc = p.imageUrl
            ? p.imageUrl.startsWith('http')
              ? p.imageUrl
              : p.imageUrl.startsWith('/')
                ? p.imageUrl
                : `/uploads/products/${p.imageUrl}`
            : null;

          return (
            <div
              key={p.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderBottom: '1px solid var(--border-color)',
                borderRadius: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {imgSrc && (
                  <img
                    src={imgSrc}
                    alt={p.name}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                    style={{
                      width: '36px',
                      height: '36px',
                      objectFit: 'contain',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: '#fff',
                      padding: '2px',
                    }}
                  />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                  <span style={{ fontSize: '0.74rem', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
                    SKU: {p.sku} · Stock: {p.stock} {p.unitsPerBox > 1 ? `· ${p.unitsPerBox}/caja` : ''}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                <div style={{ fontSize: '1.04rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  ${Math.round(Number(p.listPrice || 0)).toLocaleString('es-AR')}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {p.isPesable ? 'Por kg' : 'Por unidad'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </NativeModalDialog>
  );
}
