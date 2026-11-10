export const portalCatalogFilterStyles: { [key: string]: any } = {
  tabContent: {
    maxWidth: '1650px',
    width: '100%',
    margin: '0 auto',
    padding: '24px 28px',
    boxSizing: 'border-box'
  },
  filterSection: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px'
  },
  catalogSearchInput: {
    flex: 1,
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '13px 18px',
    color: '#0f172a',
    fontSize: '14px',
    outline: 'none'
  },
  btnFilterOffer: {
    background: '#ffffff',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '0 18px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  btnFilterOfferActive: {
    background: 'rgba(227, 6, 19, 0.08)',
    color: '#E30613',
    borderColor: '#E30613'
  },
  commercialGroupTabsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '8px 10px',
    paddingBottom: '4px',
    marginBottom: '24px'
  },
  commercialGroupTab: {
    background: '#ffffff',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '8px 14px',
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
    transition: 'all 0.15s ease'
  },
  commercialGroupTabActive: {
    background: '#0f172a',
    color: '#ffffff',
    borderColor: '#0f172a',
    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)'
  },
  groupCountBadge: {
    background: 'rgba(148, 163, 184, 0.2)',
    borderRadius: '10px',
    padding: '2px 7px',
    fontSize: '11px',
    fontWeight: 700
  },
  productGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '20px'
  },
  loadingBox: {
    textAlign: 'center',
    padding: '60px',
    color: '#64748b'
  },
  emptyBox: {
    textAlign: 'center',
    padding: '60px',
    color: '#64748b',
    background: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0'
  }
};
