import { ChevronRight, Eye } from 'lucide-react';

export interface FinanzasKpiCardItem {
  key: 'CASH' | 'CHECK' | 'TRANSFER' | 'EXPENSE' | 'NET';
  label: string;
  val: number;
  items: any[];
  bg: string;
  border: string;
  color: string;
}

interface FinanzasPeriodKpiCardsProps {
  kpiCards: FinanzasKpiCardItem[];
  onSelectCard: (card: FinanzasKpiCardItem) => void;
  showSalesCard: boolean;
  salesReport?: any;
  onOpenSalesModal: () => void;
}

export function FinanzasPeriodKpiCards({
  kpiCards,
  onSelectCard,
  showSalesCard,
  salesReport,
  onOpenSalesModal,
}: FinanzasPeriodKpiCardsProps) {
  const officialSales = Number(salesReport?.sales?.official || 0);
  const internalSales = Number(salesReport?.sales?.internal || 0);
  const totalSales = Number(salesReport?.summary?.netSales ?? officialSales + internalSales);
  const citiesCount = Array.isArray(salesReport?.salesByCity) ? salesReport.salesByCity.length : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '14px' }}>
      {showSalesCard && (
        <button
          type="button"
          onClick={onOpenSalesModal}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'space-between',
            gap: '10px', padding: '16px 18px', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe',
            borderRadius: '12px', cursor: 'pointer', textAlign: 'left', font: 'inherit', width: '100%', minWidth: 0, boxShadow: 'none',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', width: '100%' }}>
            <span style={{ fontSize: '0.82rem', color: '#4338ca', fontWeight: 600, lineHeight: 1.25 }}>Ventas</span>
            <Eye size={15} color="#4338ca" aria-hidden="true" style={{ flexShrink: 0, opacity: 0.8 }} />
          </div>
          <div className="tabular-nums" style={{ fontSize: 'clamp(1.25rem, 1.5vw, 1.55rem)', lineHeight: 1.15, fontWeight: 700, color: '#4338ca', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
            ${Math.round(totalSales).toLocaleString('es-AR')}
          </div>
          <div className="tabular-nums" style={{ fontSize: '0.75rem', color: '#4338ca', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, opacity: 0.9 }}>
            <span>{citiesCount} {citiesCount === 1 ? 'localidad' : 'localidades'}</span>
            <ChevronRight size={13} aria-hidden="true" />
          </div>
        </button>
      )}

      {kpiCards.map((card) => (
        <button
          key={card.key}
          type="button"
          onClick={() => onSelectCard(card)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'space-between',
            gap: '10px', padding: '16px 18px', backgroundColor: card.bg, border: `1px solid ${card.border}`,
            borderRadius: '12px', cursor: 'pointer', textAlign: 'left', font: 'inherit', width: '100%', minWidth: 0, boxShadow: 'none',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', width: '100%' }}>
            <span style={{ fontSize: '0.82rem', color: card.color, fontWeight: 600, lineHeight: 1.25 }}>{card.label}</span>
            <Eye size={15} color={card.color} aria-hidden="true" style={{ flexShrink: 0, opacity: 0.8 }} />
          </div>
          <div className="tabular-nums" style={{ fontSize: 'clamp(1.25rem, 1.5vw, 1.55rem)', lineHeight: 1.15, fontWeight: 700, color: card.color, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
            ${Math.round(card.val).toLocaleString('es-AR')}
          </div>
          <div className="tabular-nums" style={{ fontSize: '0.75rem', color: card.color, display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, opacity: 0.9 }}>
            <span>{card.items.length} movimientos</span><ChevronRight size={13} aria-hidden="true" />
          </div>
        </button>
      ))}
    </div>
  );
}
