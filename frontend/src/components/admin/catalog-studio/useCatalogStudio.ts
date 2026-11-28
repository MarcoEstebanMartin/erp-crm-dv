import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  catalogStudioApi,
  type CatalogBadgeType,
  type CatalogCombo,
  type CatalogResumenMode,
  type CatalogStudioProduct,
  type CatalogStudioState,
} from '../../../utils/api/catalog-studio.api';
import { buildEffectiveCategoryOrder } from './catalogCategoryOrder.helper';

export type FilterMode = 'all' | 'ofertones' | 'destacados' | 'no_photo' | 'hidden';
const CATALOG_STUDIO_QUERY_KEY = ['catalog-studio'] as const;

const EMPTY_STATE: CatalogStudioState = {
  title: 'OFERTAS SEMANALES',
  subtitle: '',
  hideOutOfStock: true,
  categoryOrder: [],
  itemOrder: [],
  combos: [],
  updatedAt: null,
};

export function useCatalogStudio() {
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
    if (studioData) {
      setState(studioData.state);
      setProducts(studioData.products);
    }
    if (queryError) setError((queryError as Error)?.message || 'Error al cargar el catálogo.');
  }, [studioData, queryError]);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const [savingState, setSavingState] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState<'magazine' | 'resumen' | null>(null);
  const [editingProduct, setEditingProduct] = useState<CatalogStudioProduct | null>(null);
  const [photoProduct, setPhotoProduct] = useState<CatalogStudioProduct | null>(null);
  const [comboDialogOpen, setComboDialogOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<CatalogCombo | null>(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
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

  const handleProductImageUpdated = useCallback(
    (productId: number, imageUrl: string | null) => {
      const applyImage = (list: CatalogStudioProduct[]) =>
        list.map((p) => (p.id === productId ? { ...p, imageUrl } : p));
      setProducts((prev) => applyImage(prev));
      setPhotoProduct((prev) => (prev && prev.id === productId ? { ...prev, imageUrl } : prev));
      queryClient.setQueryData(CATALOG_STUDIO_QUERY_KEY, (prev: typeof studioData) =>
        prev ? { ...prev, products: applyImage(prev.products) } : prev,
      );
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    [queryClient],
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

  const handleSaveCategoryOrder = (nextOrder: string[]) => {
    const nextState = { ...state, categoryOrder: nextOrder };
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

  const defaultCategoryOrder = useMemo(
    () => buildEffectiveCategoryOrder([], categories, activeProducts.map((p) => p.category)),
    [categories, activeProducts],
  );

  const effectiveCategoryOrder = useMemo(
    () => buildEffectiveCategoryOrder(state.categoryOrder, categories, activeProducts.map((p) => p.category)),
    [state.categoryOrder, categories, activeProducts],
  );

  const countsByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of activeProducts) {
      if (!p.catalogVisible) continue;
      if (state.hideOutOfStock && p.stock <= 0) continue;
      map.set(p.category, (map.get(p.category) ?? 0) + 1);
    }
    return map;
  }, [activeProducts, state.hideOutOfStock]);

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

    const result: Array<{ name: string; items: CatalogStudioProduct[] }> = [];
    for (const c of effectiveCategoryOrder) {
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
  }, [filteredProducts, effectiveCategoryOrder]);

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

  return {
    loading,
    error,
    state,
    setState,
    products,
    categories,
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    filterMode,
    setFilterMode,
    savingState,
    downloadingPdf,
    editingProduct,
    setEditingProduct,
    photoProduct,
    setPhotoProduct,
    comboDialogOpen,
    setComboDialogOpen,
    editingCombo,
    setEditingCombo,
    orderDialogOpen,
    setOrderDialogOpen,
    resumenMenuRef,
    persistState,
    handlePatchProduct,
    handleToggleBadge,
    handleToggleVisible,
    handleProductImageUpdated,
    handleSaveCombo,
    handleDeleteCombo,
    handleSaveCategoryOrder,
    handleDownload,
    defaultCategoryOrder,
    effectiveCategoryOrder,
    countsByCategory,
    groupedSections,
    ofertonesCount,
    destacadosCount,
    highlightedCount,
  };
}
