import { useState, useEffect, useRef } from 'react';
import { Search, X, Package } from 'lucide-react';
import { api } from '../../utils/api';

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
    const onKey = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

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
        console.error('Error fetching products for quick search', err);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchProducts, 200);
    return () => clearTimeout(debounce);
  }, [query, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '10vh', zIndex: 2500, animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-color)',
          width: '92%', maxWidth: '620px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-light)', gap: '12px' }}>
          <Search size={20} style={{ color: '#E30613' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Consulta fonética rápida (ej: 'melincue tibo', 'boka', '0001')..."
            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '1rem', fontWeight: 500, outline: 'none', color: 'var(--text-primary)' }}
          />
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '8px', minHeight: '110px', maxHeight: '420px', overflowY: 'auto' }}>
          {loading && products.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Buscando productos...</div>
          )}

          {!loading && query.trim().length >= 2 && products.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              No se encontraron productos para "{query}"
            </div>
          )}

          {!loading && query.trim().length < 2 && (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)', fontSize: '0.88rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Package size={30} style={{ opacity: 0.4 }} />
              <span>Escribí al menos 2 letras o números para consultar precios al instante (Atajo: Ctrl + Q).</span>
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
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border-color)', borderRadius: '8px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {imgSrc && (
                    <img
                      src={imgSrc}
                      alt={p.name}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      style={{ width: '38px', height: '38px', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: '#fff', padding: '2px' }}
                    />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</span>
                    <span style={{ fontSize: '0.74rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      SKU: {p.sku} • Stock: {p.stock} u. {p.unitsPerBox > 1 ? `• ${p.unitsPerBox} u/caja` : ''}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.08rem', fontWeight: 800, fontFamily: 'monospace', color: '#059669' }}>
                    ${Math.round(Number(p.listPrice || 0)).toLocaleString('es-AR')}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    Lista 4 Oficial {p.isPesable ? '(x Kg)' : '(x Un.)'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
