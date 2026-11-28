import { ArrowUpDown, ChevronDown, Download, FileText, Plus, Save, Search, Trash2, Edit3 } from 'lucide-react';
import { CatalogProductCard } from './CatalogProductCard';
import { CatalogProductEditDialog } from './CatalogProductEditDialog';
import { CatalogProductPhotoDialog } from './CatalogProductPhotoDialog';
import { CatalogComboDialog } from './CatalogComboDialog';
import { CatalogCategoryOrderDialog } from './CatalogCategoryOrderDialog';
import { useCatalogStudio, type FilterMode } from './useCatalogStudio';
import './catalogStudio.css';

export default function CatalogStudioTab() {
  const {
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
  } = useCatalogStudio();

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
            onClick={() => setOrderDialogOpen(true)}
          >
            <ArrowUpDown size={14} />
            <span>Orden</span>
          </button>
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
          {effectiveCategoryOrder.map((c) => (
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
                  onOpenPhoto={setPhotoProduct}
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

      <CatalogProductPhotoDialog
        product={photoProduct}
        onClose={() => setPhotoProduct(null)}
        onImageUpdated={handleProductImageUpdated}
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

      <CatalogCategoryOrderDialog
        open={orderDialogOpen}
        currentOrder={effectiveCategoryOrder}
        defaultOrder={defaultCategoryOrder}
        countsByCategory={countsByCategory}
        onClose={() => setOrderDialogOpen(false)}
        onSave={handleSaveCategoryOrder}
      />
    </div>
  );
}
