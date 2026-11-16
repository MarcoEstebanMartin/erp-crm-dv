import type { ReactNode } from 'react';
import {
  Receipt,
  UserPlus,
  ShoppingCart,
  Printer,
  Search,
  BookOpen,
  DollarSign,
  Truck,
} from 'lucide-react';

interface HomeQuickActionsGridProps {
  onDirectInvoice: () => void;
  onNewClient: () => void;
  onNewOrder: () => void;
  onOpenPriceList: () => void;
  onOpenQuickPriceSearch: () => void;
  onOpenLedger: () => void;
  onOpenPayment: () => void;
  onOpenFleetExpense: () => void;
}

interface QuickActionItem {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}

export function HomeQuickActionsGrid({
  onDirectInvoice,
  onNewClient,
  onNewOrder,
  onOpenPriceList,
  onOpenQuickPriceSearch,
  onOpenLedger,
  onOpenPayment,
  onOpenFleetExpense,
}: HomeQuickActionsGridProps) {
  const actions: QuickActionItem[] = [
    { label: 'Facturar', icon: <Receipt size={17} aria-hidden="true" />, onClick: onDirectInvoice },
    { label: 'Nuevo cliente', icon: <UserPlus size={17} aria-hidden="true" />, onClick: onNewClient },
    { label: 'Nuevo pedido', icon: <ShoppingCart size={17} aria-hidden="true" />, onClick: onNewOrder },
    { label: 'Lista PDF', icon: <Printer size={17} aria-hidden="true" />, onClick: onOpenPriceList },
    { label: 'Buscar precio', icon: <Search size={17} aria-hidden="true" />, onClick: onOpenQuickPriceSearch },
    { label: 'Cuentas corrientes', icon: <BookOpen size={17} aria-hidden="true" />, onClick: onOpenLedger },
    { label: 'Cobrar', icon: <DollarSign size={17} aria-hidden="true" />, onClick: onOpenPayment },
    { label: 'Gasto flota', icon: <Truck size={17} aria-hidden="true" />, onClick: onOpenFleetExpense },
  ];

  return (
    <div style={{ marginTop: '20px' }}>
      <style>{`
        .quick-actions-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }
        @media (max-width: 900px) {
          .quick-actions-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 550px) {
          .quick-actions-grid {
            grid-template-columns: repeat(1, minmax(0, 1fr));
          }
        }
        .quick-action-card:hover {
          border-color: var(--text-secondary) !important;
          background-color: var(--bg-light, #f9f9fb) !important;
        }
      `}</style>
      <div className="quick-actions-grid">
        {actions.map((act) => (
          <button
            key={act.label}
            type="button"
            onClick={act.onClick}
            className="quick-action-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 12px',
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color, #e5e5e7)',
              borderRadius: '8px',
              cursor: 'pointer',
              width: '100%',
              transition: 'background-color 0.15s ease, border-color 0.15s ease',
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                width: '168px',
                maxWidth: '100%',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-light, #f5f5f7)',
                  border: '1px solid var(--border-color, #e5e5e7)',
                  color: 'var(--text-secondary)',
                  flexShrink: 0,
                }}
              >
                {act.icon}
              </span>
              <span
                style={{
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {act.label}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
