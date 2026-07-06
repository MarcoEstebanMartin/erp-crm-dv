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
      setTimeout(() => inputRef.current?.focus(), 100);
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
        setProducts(data.slice(0, 8)); // Mostrar solo los primeros 8 resultados rápidos
      } catch (err) {
        console.error('Error fetching products for quick search', err);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchProducts, 300);
    return () => clearTimeout(debounce);
  }, [query, isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: '10vh',
      zIndex: 2000,
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        width: '90%',
        maxWidth: '600px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header / Input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-light)',
          gap: '12px'
        }}>
          <Search size={24} style={{ color: 'var(--text-secondary)' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por código (SKU) o descripción..."
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              fontSize: '1.1rem',
              fontWeight: 500,
              outline: 'none',
              color: 'var(--text-primary)'
            }}
          />
          <button 
            onClick={onClose} 
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border-color)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Results */}
        <div style={{ padding: '8px', minHeight: '100px', maxHeight: '400px', overflowY: 'auto' }}>
          {loading && products.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Buscando productos...
            </div>
          )}
          
          {!loading && query.trim().length >= 2 && products.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              No se encontraron productos para "{query}"
            </div>
          )}

          {!loading && query.trim().length < 2 && (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Package size={32} style={{ opacity: 0.5 }} />
              <span>Escriba al menos 2 letras o números para buscar.</span>
            </div>
          )}

          {products.map((p) => (
            <div key={p.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color)',
              borderRadius: '8px',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-light)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>SKU: {p.sku}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  ${Number(p.listPrice).toLocaleString('es-AR')}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Precio Final (Lista A)</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
