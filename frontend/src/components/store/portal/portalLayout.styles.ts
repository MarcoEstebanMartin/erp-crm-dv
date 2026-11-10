export const portalLayoutStyles: { [key: string]: any } = {
  portalContainer: {
    minHeight: '100vh',
    background: '#f8fafc',
    color: '#0f172a',
    fontFamily: "'Outfit', Inter, system-ui, -apple-system, sans-serif",
    paddingBottom: '60px'
  },
  topNavbar: {
    background: '#1e293b',
    borderBottom: '1px solid #0f172a',
    padding: '16px 28px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px'
  },
  navBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  logoBadge: {
    background: '#E30613',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 800,
    padding: '6px 12px',
    borderRadius: '6px',
    letterSpacing: '0.5px'
  },
  clientNameTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#ffffff'
  },
  clientMetaInfo: {
    fontSize: '12px',
    color: '#94a3b8'
  },
  navActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  balanceBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    background: '#0f172a',
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid #334155'
  },
  cartButton: {
    background: '#E30613',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 18px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 4px 12px rgba(227, 6, 19, 0.3)'
  },
  cartCountBadge: {
    background: '#fff',
    color: '#E30613',
    borderRadius: '10px',
    padding: '2px 7px',
    fontSize: '12px',
    fontWeight: 800
  },
  btnSecondarySmall: {
    background: '#334155',
    color: '#f8fafc',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '12px',
    cursor: 'pointer'
  },
  tabNav: {
    display: 'flex',
    gap: '8px',
    background: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    padding: '0 28px',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    whiteSpace: 'nowrap'
  },
  tabItem: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#64748b',
    padding: '16px 20px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer'
  },
  tabItemActive: {
    color: '#0f172a',
    borderBottomColor: '#E30613',
    fontWeight: 700
  },
  tabContent: {
    maxWidth: '1650px',
    width: '100%',
    margin: '0 auto',
    padding: '24px 28px',
    boxSizing: 'border-box'
  },
  successBanner: {
    background: '#ecfdf5',
    color: '#059669',
    borderBottom: '1px solid #a7f3d0',
    padding: '14px 28px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px'
  }
};
