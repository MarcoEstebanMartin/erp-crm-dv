import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, Plus, Save, Search, Trash2, Edit3 } from 'lucide-react';
import {
  catalogStudioApi,
  type CatalogBadgeType,
  type CatalogCombo,
  type CatalogStudioProduct,
  type CatalogStudioState,
} from '../../../utils/api/catalog-studio.api';
import { CatalogProductCard } from './CatalogProductCard';
import { CatalogProductEditDialog } from './CatalogProductEditDialog';
import { CatalogComboDialog } from './CatalogComboDialog';
import './catalogStudio.css';

type FilterMode = 'all' | 'highlighted' | 'no_photo' | 'hidden';

export default function CatalogStudioTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<CatalogStudioState>({
    title: 'OFERTAS SEMANALES',
    subtitle: '',
    hideOutOfStock: false,
    categoryOrder: [],
    itemOrder: [],
    combos: [],
    updatedAt: null,
  });
  const [products, setProducts] = useState<CatalogStudioProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const [savingState, setSavingState] = useState(false);
  const [savingProductId, setSavingProductId] = useState<number | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<'magazine' | 'resumen' | null>(null);
  const [editingProduct, setEditingProduct] = useState<CatalogStudioProduct | null>(null);
  const [comboDialogOpen, setComboDialogOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<CatalogCombo | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await catalogStudioApi.getStudio();
      setState(data.state);
      setProducts(data.products);
      setCategories(data.canonicalCategories);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar el catálogo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const persistState = async (next: CatalogStudioState) => {
    setSavingState(true);
    setError(null);
    try {
      const saved = await catalogStudioApi.saveState({
        title: next.title,
        subtitle: next.subtitle,
        hideOutOfStock: next.hideOutOfStock,
        categoryOrder: next.categoryOrder,
        itemOrder: next.itemOrder,
        combos: next.combos,
      });
      setState(saved);
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar el estado.');
    } finally {
      setSavingState(false);
    }
  };

  const handlePatchProduct = async (
    productId: number,
    payload: Parameters<typeof catalogStudioApi.patchProduct>[1],
  ) => {
    setSavingProductId(productId);
    setError(null);
    try {
      await catalogStudioApi.patchProduct(productId, payload);
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== productId) return p;
          return {
            ...p,
            badge: payload.catalogBadge !== undefined ? payload.catalogBadge : p.badge,
            varieties: payload.catalogVarieties !== undefined ? payload.catalogVarieties : p.varieties,
            minQty: payload.catalogMinQtyLabel !== undefined ? payload.catalogMinQtyLabel : p.minQty,
            showOldPrice:
              payload.catalogShowOldPrice !== undefined ? payload.catalogShowOldPrice : p.showOldPrice,
            oldPrice:
              payload.catalogOldPrice !== undefined
                ? payload.catalogOldPrice ?? p.previousListPrice
                : p.oldPrice,
            catalogVisible:
              payload.catalogVisible !== undefined ? payload.catalogVisible : p.catalogVisible,
            category:
              payload.commercialCategory !== undefined && payload.commercialCategory
                ? payload.commercialCategory
                : p.category,
          };
        }),
      );
    } catch (err: any) {
      setError(err?.message || 'No se pudo actualizar el producto.');
    } finally {
      setSavingProductId(null);
    }
  };

  const handleToggleBadge = (product: CatalogStudioProduct, badge: CatalogBadgeType) => {
    handlePatchProduct(product.id, { catalogBadge: badge });
  };

  const handleToggleVisible = (product: CatalogStudioProduct) => {
    handlePatchProduct(product.id, { catalogVisible: !product.catalogVisible });
  };

  const handleSaveCombo = (combo: CatalogCombo) => {
    const exists = state.combos.some((c) => c.id === combo.id);
    const nextCombos = exists
      ? state.combos.map((c) => (c.id === combo.id ? combo : c))
      : [...state.combos, combo];
    const nextState = { ...state, combos: nextCombos };
    setState(nextState);
    persistState(nextState);
  };

  const handleDeleteCombo = (comboId: string) => {
    const nextState = { ...state, combos: state.combos.filter((c) => c.id !== comboId) };
    setState(nextState);
    persistState(nextState);
  };

  const handleDownload = async (type: 'magazine' | 'resumen') => {
    setDownloadingPdf(type);
    setError(null);
    try {
      await persistState(state);
      if (type === 'magazine') {
        await catalogStudioApi.downloadMagazinePdf();
      } else {
        await catalogStudioApi.downloadResumenPdf(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al descargar el PDF.');
    } finally {
      setDownloadingPdf(null);
    }
  };

  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return activeProducts.filter((p) => {
      if (state.hideOutOfStock && p.stock <= 0 && filterMode !== 'hidden') return false;
      if (selectedCategory && p.category !== selectedCategory) return false;
      if (filterMode === 'highlighted' && !p.badge) return false;
      if (filterMode === 'no_photo' && p.imageUrl) return false;
      if (filterMode === 'hidden' && p.catalogVisible) return false;
      if (filterMode !== 'hidden' && !p.catalogVisible) return false;
      if (!term) return true;
      return (
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.varieties || '').toLowerCase().includes(term)
      );
    });
  }, [activeProducts, search, selectedCategory, filterMode, state.hideOutOfStock]);

  const groupedSections = useMemo(() => {
    const map = new Map<string, CatalogStudioProduct[]>();
    for (const p of filteredProducts) {
      const list = map.get(p.category) || [];
      list.push(p);
      map.set(p.category, list);
    }

    const order = state.categoryOrder.length > 0 ? state.categoryOrder : categories;
    const result: Array<{ name: string; items: CatalogStudioProduct[] }> = [];
    for (const c of order) {
      const items = map.get(c);
      if (items && items.length > 0) {
        result.push({ name: c, items });
        map.delete(c);
      }
    }
    for (const [name, items] of map.entries()) {
      result.push({ name, items });
    }
    return result;
  }, [filteredProducts, categories, state.categoryOrder]);

  const highlightedCount = useMemo(
    () => activeProducts.filter((p) => p.catalogVisible && Boolean(p.badge)).length,
    [activeProducts],
  );

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#71717a', fontSize: 13 }}>
        Cargando catálogo...
      </div>
    );
  }

  return (
    <div className="cs-root">
      <div className="cs-topbar">
        <div className="cs-edition-inputs">
          <input
            aria-label="Título de edición"
            className="cs-title-input"
            value={state.title}
            onChange={(e) => setState((prev) => ({ ...prev, title: e.target.value }))}
          />
          <input
            aria-label="Subtítulo de edición"
            className="cs-subtitle-input"
            value={state.subtitle}
            onChange={(e) => setState((prev) => ({ ...prev, subtitle: e.target.value }))}
            placeholder="EDICION 25/11"
          />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#52525b', marginLeft: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={state.hideOutOfStock}
              onChange={(e) => {
                const next = { ...state, hideOutOfStock: e.target.checked };
                setState(next);
                persistState(next);
              }}
            />
            <span>Ocultar sin stock</span>
          </label>
        </div>

        <div className="cs-actions">
          <button
            type="button"
            className="cs-btn"
            onClick={() => {
              setEditingCombo(null);
              setComboDialogOpen(true);
            }}
          >
            <Plus size={14} />
            <span>Combo</span>
          </button>
          <button
            type="button"
            className="cs-btn"
            disabled={savingState}
            onClick={() => persistState(state)}
          >
            <Save size={14} />
            <span>{savingState ? 'Guardando...' : 'Guardar'}</span>
          </button>
          <button
            type="button"
            className="cs-btn cs-btn-dark"
            disabled={downloadingPdf !== null}
            onClick={() => handleDownload('resumen')}
          >
            <FileText size={14} />
            <span>{downloadingPdf === 'resumen' ? 'Generando...' : `Resumen (${highlightedCount})`}</span>
          </button>
          <button
            type="button"
            className="cs-btn cs-btn-primary"
            disabled={downloadingPdf !== null}
            onClick={() => handleDownload('magazine')}
          >
            <Download size={14} />
            <span>{downloadingPdf === 'magazine' ? 'Generando...' : 'Catálogo PDF'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="cs-toolbar">
        <div className="cs-search-wrap">
          <Search size={14} className="cs-search-icon" />
          <input
            type="search"
            className="cs-input cs-search-input"
            placeholder="Buscar producto, SKU o sabor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          aria-label="Filtrar por sección"
          className="cs-select"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">Todas las secciones</option>
          {categories
            .filter((c) => c !== 'COMBOS')
            .map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
        </select>

        <div className="cs-segmented" role="group" aria-label="Filtro rápido">
          {(
            [
              ['all', 'Visibles'],
              ['highlighted', 'Destacados'],
              ['no_photo', 'Sin foto'],
              ['hidden', 'Ocultos'],
            ] as Array<[FilterMode, string]>
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`cs-seg-btn ${filterMode === mode ? 'active' : ''}`}
              onClick={() => setFilterMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {state.combos.length > 0 && (
        <section className="cs-section">
          <div className="cs-section-header">
            <span>Combos</span>
            <span>{state.combos.length}</span>
          </div>
          <div className="cs-grid">
            {state.combos.map((combo) => (
              <div key={combo.id} className="cs-card" style={{ borderColor: '#18181b' }}>
                <div className="cs-card-top">
                  <span className="cs-pill" style={{ background: '#18181b', color: '#ffffff' }}>
                    {combo.comboNum}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      className="cs-icon-btn"
                      aria-label="Editar combo"
                      onClick={() => {
                        setEditingCombo(combo);
                        setComboDialogOpen(true);
                      }}
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      type="button"
                      className="cs-icon-btn"
                      aria-label="Eliminar combo"
                      onClick={() => handleDeleteCombo(combo.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <strong style={{ fontSize: 13 }}>{combo.title}</strong>
                <div style={{ fontSize: 12, color: '#3f3f46' }}>
                  {combo.product1.name} — <strong>${Math.round(combo.product1.price).toLocaleString('es-AR')}</strong> ({combo.product1.condition})
                </div>
                <div style={{ fontSize: 12, color: '#3f3f46' }}>
                  + {combo.product2.name} —{' '}
                  <strong>
                    {combo.product2.isFree
                      ? combo.product2.freeLabel || 'SIN CARGO'
                      : `$${Math.round(combo.product2.price).toLocaleString('es-AR')}`}
                  </strong>{' '}
                  ({combo.product2.condition})
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {groupedSections.length === 0 ? (
        <div style={{ padding: 36, textAlign: 'center', color: '#71717a', fontSize: 13, background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 10 }}>
          Sin productos para este filtro.
        </div>
      ) : (
        groupedSections.map((sec) => (
          <section key={sec.name} className="cs-section">
            <div className="cs-section-header">
              <span>{sec.name}</span>
              <span>{sec.items.length}</span>
            </div>
            <div className="cs-grid">
              {sec.items.map((p) => (
                <CatalogProductCard
                  key={p.id}
                  product={p}
                  saving={savingProductId === p.id}
                  onToggleBadge={handleToggleBadge}
                  onToggleVisible={handleToggleVisible}
                  onOpenEdit={setEditingProduct}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <CatalogProductEditDialog
        product={editingProduct}
        categories={categories}
        onClose={() => setEditingProduct(null)}
        onSave={handlePatchProduct}
      />

      <CatalogComboDialog
        open={comboDialogOpen}
        editingCombo={editingCombo}
        products={products}
        nextComboNumber={state.combos.length + 1}
        onClose={() => {
          setComboDialogOpen(false);
          setEditingCombo(null);
        }}
        onSave={handleSaveCombo}
      />
    </div>
  );
}
