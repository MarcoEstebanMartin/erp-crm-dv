import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Download, FileText, Plus, Save, Search, Trash2, Edit3 } from 'lucide-react';
import {
  catalogStudioApi,
  type CatalogBadgeType,
  type CatalogCombo,
  type CatalogResumenMode,
  type CatalogStudioProduct,
  type CatalogStudioState,
} from '../../../utils/api/catalog-studio.api';
import { CatalogProductCard } from './CatalogProductCard';
import { CatalogProductEditDialog } from './CatalogProductEditDialog';
import { CatalogComboDialog } from './CatalogComboDialog';
import './catalogStudio.css';

type FilterMode = 'all' | 'ofertones' | 'destacados' | 'no_photo' | 'hidden';
const CATALOG_STUDIO_QUERY_KEY = ['catalog-studio'] as const;

const EMPTY_STATE: CatalogStudioState = {
  title: 'OFERTAS SEMANALES', subtitle: '', hideOutOfStock: true,
  categoryOrder: [], itemOrder: [], combos: [], updatedAt: null,
};

export default function CatalogStudioTab() {
  const queryClient = useQueryClient();
  const { data: studioData, isLoading: loading, error: queryError } = useQuery({
    queryKey: CATALOG_STUDIO_QUERY_KEY,
    queryFn: () => catalogStudioApi.getStudio(),
    staleTime: 60_000,
  });

  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<CatalogStudioState>(() => studioData?.state ?? EMPTY_STATE);
  const [products, setProducts] = useState<CatalogStudioProduct[]>(() => studioData?.products ?? []);
  const categories = studioData?.canonicalCategories ?? [];

  useEffect(() => {
    if (studioData) { setState(studioData.state); setProducts(studioData.products); }
    if (queryError) setError((queryError as Error)?.message || 'Error al cargar el catálogo.');
  }, [studioData, queryError]);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const [savingState, setSavingState] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState<'magazine' | 'resumen' | null>(null);
  const [editingProduct, setEditingProduct] = useState<CatalogStudioProduct | null>(null);
  const [comboDialogOpen, setComboDialogOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<CatalogCombo | null>(null);
  const resumenMenuRef = useRef<HTMLDetailsElement>(null);

  const persistState = async (next: CatalogStudioState, silent = false) => {
    if (!silent) setSavingState(true);
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
      queryClient.setQueryData(CATALOG_STUDIO_QUERY_KEY, (prev: typeof studioData) =>
        prev ? { ...prev, state: saved } : prev,
      );
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar el estado.');
    } finally {
      if (!silent) setSavingState(false);
    }
  };

  const handlePatchProduct = useCallback(
    async (productId: number, payload: Parameters<typeof catalogStudioApi.patchProduct>[1]) => {
      setError(null);
      let snapshot: CatalogStudioProduct[] = [];
      const applyPatch = (list: CatalogStudioProduct[]) =>
        list.map((p) => {
          if (p.id !== productId) return p;
          return {
            ...p,
            badge: payload.catalogBadge !== undefined ? payload.catalogBadge : p.badge,
            varieties: payload.catalogVarieties !== undefined ? payload.catalogVarieties : p.varieties,
            minQty: payload.catalogMinQtyLabel !== undefined ? payload.catalogMinQtyLabel : p.minQty,
            showOldPrice: payload.catalogShowOldPrice ?? p.showOldPrice,
            oldPrice:
              payload.catalogOldPrice !== undefined
                ? (payload.catalogOldPrice ?? p.previousListPrice)
                : p.oldPrice,
            catalogVisible: payload.catalogVisible ?? p.catalogVisible,
            category: payload.commercialCategory || p.category,
          };
        });

      setProducts((prev) => {
        snapshot = prev;
        return applyPatch(prev);
      });
      queryClient.setQueryData(CATALOG_STUDIO_QUERY_KEY, (prev: typeof studioData) =>
        prev ? { ...prev, products: applyPatch(prev.products) } : prev,
      );

      try {
        await catalogStudioApi.patchProduct(productId, payload);
        if (payload.catalogBadge !== undefined) {
          queryClient.invalidateQueries({ queryKey: ['products'] });
        }
      } catch (err: any) {
        setProducts(snapshot);
        queryClient.setQueryData(CATALOG_STUDIO_QUERY_KEY, (prev: typeof studioData) =>
          prev ? { ...prev, products: snapshot } : prev,
        );
        setError(err?.message || 'No se pudo actualizar el producto.');
      }
    },
    [queryClient],
  );

  const handleToggleBadge = useCallback(
    (product: CatalogStudioProduct, badge: CatalogBadgeType) => handlePatchProduct(product.id, { catalogBadge: badge }),
    [handlePatchProduct],
  );

  const handleToggleVisible = useCallback(
    (product: CatalogStudioProduct) => handlePatchProduct(product.id, { catalogVisible: !product.catalogVisible }),
    [handlePatchProduct],
  );

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

  const handleDownload = async (type: 'magazine' | 'resumen', resumenMode: CatalogResumenMode = 'all') => {
    if (resumenMenuRef.current) resumenMenuRef.current.open = false;
    setDownloadingPdf(type);
    setError(null);
    try {
      await persistState(state, true);
      if (type === 'magazine') {
        await catalogStudioApi.downloadMagazinePdf();
      } else {
        await catalogStudioApi.downloadResumenPdf(resumenMode);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al descargar el PDF.');
    } finally {
      setDownloadingPdf(null);
    }
  };

  const deferredSearch = useDeferredValue(search);

  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);

  const filteredProducts = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return activeProducts.filter((p) => {
      if (state.hideOutOfStock && p.stock <= 0 && filterMode !== 'hidden') return false;
      if (selectedCategory && p.category !== selectedCategory) return false;
      if (filterMode === 'ofertones' && p.badge !== 'OFERTON') return false;
      if (filterMode === 'destacados' && p.badge !== 'DESTACADO') return false;
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
  }, [activeProducts, deferredSearch, selectedCategory, filterMode, state.hideOutOfStock]);

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

  const { ofertonesCount, destacadosCount, highlightedCount } = useMemo(() => {
    let ofertones = 0;
    let destacados = 0;
    for (const p of activeProducts) {
      if (!p.catalogVisible) continue;
      if (p.badge === 'OFERTON') ofertones++;
      else if (p.badge === 'DESTACADO') destacados++;
    }
    return { ofertonesCount: ofertones, destacadosCount: destacados, highlightedCount: ofertones + destacados };
  }, [activeProducts]);

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
              checked={!state.hideOutOfStock}
              onChange={(e) => {
                const next = { ...state, hideOutOfStock: !e.target.checked };
                setState(next);
                persistState(next, true);
              }}
            />
            <span>Ver sin stock</span>
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
          <details ref={resumenMenuRef} className="cs-dropdown">
            <summary className="cs-btn cs-btn-dark">
              <FileText size={14} />
              <span>{downloadingPdf === 'resumen' ? 'Generando...' : `Resumen (${highlightedCount})`}</span>
              <ChevronDown size={13} />
            </summary>
            <div className="cs-dropdown-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                className="cs-dropdown-item"
                disabled={downloadingPdf !== null}
                onClick={() => handleDownload('resumen', 'ofertones')}
              >
                <span className="cs-dot cs-dot-red" />
                <span>Solo Ofertones</span>
                <span className="cs-dropdown-count">{ofertonesCount}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="cs-dropdown-item"
                disabled={downloadingPdf !== null}
                onClick={() => handleDownload('resumen', 'destacados')}
              >
                <span className="cs-dot cs-dot-dark" />
                <span>Solo Destacados</span>
                <span className="cs-dropdown-count">{destacadosCount}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="cs-dropdown-item"
                disabled={downloadingPdf !== null}
                onClick={() => handleDownload('resumen', 'all')}
              >
                <span className="cs-dot cs-dot-split" />
                <span>Juntos (1 hoja)</span>
                <span className="cs-dropdown-count">{highlightedCount}</span>
              </button>
            </div>
          </details>
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
              ['ofertones', `Ofertones (${ofertonesCount})`],
              ['destacados', `Destacados (${destacadosCount})`],
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
                  saving={false}
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
