import { FULFILLMENT_STAGE_TONES, type FulfillmentStageKey } from '../../utils/fulfillmentCardMeta.helper';

export type FulfillmentListStageFilter = 'ALL' | FulfillmentStageKey;

interface FulfillmentStageFilterBarProps {
  stageFilter: FulfillmentListStageFilter;
  onSelectStage: (stage: FulfillmentListStageFilter) => void;
  totalCount: number;
  pendingCount: number;
  preparingCount: number;
  billedCount: number;
  pendingCaeCount: number;
}

/**
 * Barra de filtros rápidos por etapa para la vista Lista de Armado y Facturación.
 */
export function FulfillmentStageFilterBar({
  stageFilter,
  onSelectStage,
  totalCount,
  pendingCount,
  preparingCount,
  billedCount,
  pendingCaeCount,
}: FulfillmentStageFilterBarProps) {
  const stageTabs: Array<{
    key: FulfillmentListStageFilter;
    label: string;
    count: number;
    dotColor?: string;
    accentColor: string;
  }> = [
    { key: 'ALL', label: 'Todos', count: totalCount, accentColor: '#111827' },
    {
      key: 'PENDING',
      label: 'Pendientes',
      count: pendingCount,
      dotColor: FULFILLMENT_STAGE_TONES.PENDING.dot,
      accentColor: FULFILLMENT_STAGE_TONES.PENDING.dot,
    },
    {
      key: 'PREPARING',
      label: 'En Armado',
      count: preparingCount,
      dotColor: FULFILLMENT_STAGE_TONES.PREPARING.dot,
      accentColor: FULFILLMENT_STAGE_TONES.PREPARING.dot,
    },
    {
      key: 'BILLED',
      label: 'Facturados',
      count: billedCount,
      dotColor: FULFILLMENT_STAGE_TONES.BILLED.dot,
      accentColor: FULFILLMENT_STAGE_TONES.BILLED.dot,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="Filtrar lista por etapa de armado"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        overflowX: 'auto',
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '10px',
        padding: '6px 10px',
      }}
    >
      {stageTabs.map((tab) => {
        const isSelected = stageFilter === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelectStage(tab.key)}
            style={{
              flex: 'none',
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '30px',
              padding: '0 10px',
              borderRadius: '6px',
              border: isSelected ? '1px solid #D1D5DB' : '1px solid transparent',
              borderBottom: isSelected ? `2px solid ${tab.accentColor}` : '1px solid transparent',
              backgroundColor: isSelected ? '#F9FAFB' : 'transparent',
              color: isSelected ? '#111827' : '#6B7280',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.dotColor && (
              <span
                aria-hidden="true"
                style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: tab.dotColor }}
              />
            )}
            <span>
              {tab.label} ({tab.count})
            </span>
            {tab.key === 'BILLED' && pendingCaeCount > 0 && (
              <span className="badge-minimal badge-minimal--danger" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                {pendingCaeCount} sin CAE
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
