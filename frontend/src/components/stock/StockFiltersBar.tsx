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
      <div
        className="search-input-wrapper"
        style={{ flex: 1, minWidth: '250px', position: 'relative' }}
      >
        <Search
          size={18}
          style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)'
          }}
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

      {/* Filtro por Rubro */}
      <select
        className="select"
        style={{ minWidth: '180px', borderRadius: '8px' }}
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

      {/* Filtro por Estado Stock */}
      <div
        style={{
          display: 'flex',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-app)',
          padding: '2px'
        }}
      >
        <button
          type="button"
          style={{
            padding: '6px 12px',
            fontSize: '0.8rem',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: stockFilter === 'all' ? 'var(--bg-card)' : 'transparent',
            color: stockFilter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: stockFilter === 'all' ? 600 : 400,
            boxShadow: stockFilter === 'all' ? 'var(--shadow-sm)' : 'none',
            cursor: 'pointer'
          }}
          onClick={() => onStockFilterChange('all')}
        >
          Todos
        </button>
        <button
          type="button"
          style={{
            padding: '6px 12px',
            fontSize: '0.8rem',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: stockFilter === 'low' ? 'var(--bg-card)' : 'transparent',
            color: stockFilter === 'low' ? 'var(--color-warning)' : 'var(--text-secondary)',
            fontWeight: stockFilter === 'low' ? 600 : 400,
            boxShadow: stockFilter === 'low' ? 'var(--shadow-sm)' : 'none',
            cursor: 'pointer'
          }}
          onClick={() => onStockFilterChange('low')}
        >
          Stock Bajo
        </button>
        <button
          type="button"
          style={{
            padding: '6px 12px',
            fontSize: '0.8rem',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: stockFilter === 'out' ? 'var(--bg-card)' : 'transparent',
            color: stockFilter === 'out' ? 'var(--color-danger)' : 'var(--text-secondary)',
            fontWeight: stockFilter === 'out' ? 600 : 400,
            boxShadow: stockFilter === 'out' ? 'var(--shadow-sm)' : 'none',
            cursor: 'pointer'
          }}
          onClick={() => onStockFilterChange('out')}
        >
          Agotados
        </button>
        <button
          type="button"
          style={{
            padding: '6px 12px',
            fontSize: '0.8rem',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: stockFilter === 'expiring' ? 'var(--bg-card)' : 'transparent',
            color: stockFilter === 'expiring' ? 'var(--color-info)' : 'var(--text-secondary)',
            fontWeight: stockFilter === 'expiring' ? 600 : 400,
            boxShadow: stockFilter === 'expiring' ? 'var(--shadow-sm)' : 'none',
            cursor: 'pointer'
          }}
          onClick={() => onStockFilterChange('expiring')}
        >
          Vencimientos
        </button>
      </div>

      {/* Toggle Modo Inventario Rápido */}
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
        title="Modificar múltiples stock a la vez"
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
            userSelect: 'none',
            transition: 'all 0.2s'
          }}
          className="hover-bg-card"
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

      {/* Acciones del Historial Global */}
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
