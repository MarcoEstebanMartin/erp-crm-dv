import { Search, History, ClipboardList, X } from 'lucide-react';
import type { StockFilterType } from './types';

interface StockFiltersBarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  selectedRubro: string;
  onRubroChange: (val: string) => void;
  rubrosList: string[];
  stockFilter: StockFilterType;
  onStockFilterChange: (val: StockFilterType) => void;
  isQuickInventoryMode: boolean;
  onToggleQuickInventory: () => void;
  showEmptyLots: boolean;
  onShowEmptyLotsChange: (val: boolean) => void;
  showGlobalMovements: boolean;
  onToggleGlobalMovements: () => void;
}

const FILTER_OPTIONS: { id: StockFilterType; label: string; activeColor: string }[] = [
  { id: 'all', label: 'Todos', activeColor: 'var(--text-primary)' },
  { id: 'located', label: 'En Mapa', activeColor: 'var(--color-success)' },
  { id: 'unassigned', label: 'Sin Ubicar (S/U)', activeColor: 'var(--text-primary)' },
  { id: 'low', label: 'Stock Bajo', activeColor: 'var(--color-warning)' },
  { id: 'out', label: 'Agotados', activeColor: 'var(--color-danger)' },
  { id: 'expiring', label: 'Vencimientos', activeColor: 'var(--color-info)' },
];

export default function StockFiltersBar({
  searchQuery,
  onSearchChange,
  selectedRubro,
  onRubroChange,
  rubrosList,
  stockFilter,
  onStockFilterChange,
  isQuickInventoryMode,
  onToggleQuickInventory,
  showEmptyLots,
  onShowEmptyLotsChange,
  showGlobalMovements,
  onToggleGlobalMovements,
}: StockFiltersBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        marginBottom: '16px',
        backgroundColor: 'var(--bg-card)',
        padding: '14px 16px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Fila 1: Buscador elástico + Rubro compacto + Acciones derechas */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            flex: '1 1 280px',
            maxWidth: 'none',
            minWidth: '220px',
            position: 'relative',
          }}
        >
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            className="input"
            placeholder="Buscar SKU, nombre del producto o código de barras..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              height: '38px',
              borderRadius: '6px',
              padding: '8px 12px 8px 36px',
              fontSize: '0.85rem',
            }}
          />
        </div>

        <select
          className="select"
          style={{
            width: 'auto',
            minWidth: '190px',
            maxWidth: '260px',
            flex: '0 0 auto',
            height: '38px',
            borderRadius: '6px',
            fontSize: '0.85rem',
            padding: '0 12px',
          }}
          value={selectedRubro}
          onChange={(e) => onRubroChange(e.target.value)}
        >
          <option value="">Todos los Rubros</option>
          {rubrosList.map((r) => (
            <option key={String(r)} value={String(r)}>
              {String(r)}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <button
            className={`btn ${isQuickInventoryMode ? 'btn-primary' : 'btn-secondary'}`}
            type="button"
            style={{
              height: '38px',
              borderRadius: '6px',
              padding: '0 14px',
              fontSize: '0.82rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
            onClick={onToggleQuickInventory}
            title="Modificar múltiples stocks en 1 sola transacción atómica"
          >
            {isQuickInventoryMode ? <X size={15} /> : <ClipboardList size={15} />}
            <span>{isQuickInventoryMode ? 'Cancelar Inventario' : 'Inventario Rápido'}</span>
          </button>

          {isQuickInventoryMode && (
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0 10px',
                height: '38px',
                backgroundColor: 'var(--bg-app)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                userSelect: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              <input
                type="checkbox"
                checked={showEmptyLots}
                onChange={(e) => onShowEmptyLotsChange(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>Ver lotes vacíos (0 u.)</span>
            </label>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            style={{
              height: '38px',
              borderRadius: '6px',
              padding: '0 14px',
              fontSize: '0.82rem',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
            onClick={onToggleGlobalMovements}
            title="Ver Auditoría Global de Movimientos"
          >
            <History size={15} />
            <span>{showGlobalMovements ? 'Ocultar Auditoría' : 'Auditoría Global'}</span>
          </button>
        </div>
      </div>

      {/* Fila 2: Segmented control minimalista */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div
          role="group"
          aria-label="Filtro de estado de stock"
          style={{
            display: 'inline-flex',
            flexWrap: 'wrap',
            gap: '2px',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-app)',
            padding: '2px',
          }}
        >
          {FILTER_OPTIONS.map((opt) => {
            const active = stockFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                style={{
                  padding: '5px 11px',
                  fontSize: '0.76rem',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: active ? 'var(--bg-card)' : 'transparent',
                  color: active ? opt.activeColor : 'var(--text-secondary)',
                  fontWeight: active ? 600 : 500,
                  boxShadow: active ? 'var(--shadow-sm)' : 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => onStockFilterChange(opt.id)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
