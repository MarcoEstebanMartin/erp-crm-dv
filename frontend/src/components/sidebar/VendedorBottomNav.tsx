import { useEffect, useState, type ReactNode } from 'react';

export interface SidebarMenuItem {
  id: string;
  label: string;
  icon: ReactNode;
}

interface VendedorBottomNavProps {
  menuItems: SidebarMenuItem[];
  currentTab: string;
  vendedorCartCount: number;
  onSelect: (tabId: string) => void;
}

export function VendedorBottomNav({
  menuItems,
  currentTab,
  vendedorCartCount,
  onSelect,
}: VendedorBottomNavProps) {
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  useEffect(() => {
    setPendingTab(null);
  }, [currentTab]);

  const displayedTab = pendingTab ?? currentTab;

  const handleItemClick = (tabId: string) => {
    if (tabId === currentTab) {
      setPendingTab(null);
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }
      return;
    }
    setPendingTab(tabId);
    onSelect(tabId);
  };

  return (
    <nav aria-label="Menú móvil" className="vendedor-bottom-nav">
      {menuItems.map((item) => {
        const isActive = displayedTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            className={`vendedor-bottom-nav-item ${isActive ? 'vendedor-bottom-nav-item-active' : ''}`}
            onClick={() => handleItemClick(item.id)}
          >
            <div className="bottom-nav-icon-wrapper" style={{ position: 'relative' }}>
              {item.icon}
              {item.id === 'orders' && vendedorCartCount > 0 && (
                <span
                  className="tabular-nums"
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-8px',
                    minWidth: '16px',
                    height: '16px',
                    padding: '0 4px',
                    borderRadius: '999px',
                    backgroundColor: 'var(--color-corp-red)',
                    color: '#ffffff',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    lineHeight: '16px',
                    textAlign: 'center',
                  }}
                >
                  {vendedorCartCount}
                </span>
              )}
            </div>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
