import { Search, History } from 'lucide-react';
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
  { id: 'located', label: '🟢 En Mapa', activeColor: 'var(--color-success)' },
  { id: 'unassigned', label: '📦 Sin Ubicar (S/U)', activeColor: '#475569' },
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
  onToggleGlobalMovements
}: StockFiltersBarProps) {
  return (
    <div
      className="actions-bar"
      style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: '20px',
        backgroundColor: 'var(--bg-card)',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <div className="search-input-wrapper" style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
        <Search
          size={18}
          style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
        />
        <input
          type="text"
          className="input"
          placeholder="Buscar SKU, nombre del producto o código..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ borderRadius: '8px', padding: '10px 14px 10px 42px' }}
        />
      </div>

      <select
        className="select"
        style={{ minWidth: '175px', borderRadius: '8px' }}
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

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-app)',
          padding: '2px'
        }}
      >
        {FILTER_OPTIONS.map((opt) => {
          const active = stockFilter === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              style={{
                padding: '6px 11px',
                fontSize: '0.78rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: active ? 'var(--bg-card)' : 'transparent',
                color: active ? opt.activeColor : 'var(--text-secondary)',
                fontWeight: active ? 600 : 400,
                boxShadow: active ? 'var(--shadow-sm)' : 'none',
                cursor: 'pointer'
              }}
              onClick={() => onStockFilterChange(opt.id)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <button
        className="btn"
        type="button"
        style={{
          borderRadius: '8px',
          padding: '10px 14px',
          backgroundColor: isQuickInventoryMode ? '#FEF3C7' : 'var(--bg-app)',
          color: isQuickInventoryMode ? '#B45309' : 'var(--text-primary)',
          border: isQuickInventoryMode ? '1px solid #F59E0B' : '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontWeight: 600,
          cursor: 'pointer'
        }}
        onClick={onToggleQuickInventory}
        title="Modificar múltiples stocks en 1 sola transacción atómica"
      >
        <span>{isQuickInventoryMode ? '🚫 Cancelar Inventario' : '📝 Modo Inventario Rápido'}</span>
      </button>

      {isQuickInventoryMode && (
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '0 12px',
            height: '38px',
            backgroundColor: 'var(--bg-muted)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            userSelect: 'none'
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
        className="btn btn-secondary"
        style={{ borderRadius: '8px', padding: '10px 14px' }}
        onClick={onToggleGlobalMovements}
        title="Ver Auditoría Global de Movimientos"
      >
        <History size={16} />
        <span>{showGlobalMovements ? 'Ocultar Auditoría' : 'Auditoría Global'}</span>
      </button>
    </div>
  );
}
