export const portalCartStyles: { [key: string]: any } = {
  drawerOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.6)',
    display: 'flex',
    justifyContent: 'flex-end',
    zIndex: 9999
  },
  drawerCard: {
    width: '100%',
    maxWidth: '460px',
    background: '#ffffff',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-10px 0 35px rgba(0,0,0,0.15)'
  },
  drawerHeader: {
    padding: '24px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  btnCloseDrawer: {
    background: 'none',
    border: 'none',
    color: '#0f172a',
    fontSize: '20px',
    cursor: 'pointer'
  },
  drawerBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px'
  },
  cartItemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: '#f8fafc',
    padding: '14px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0'
  },
  qtyControllerSmall: {
    display: 'flex',
    alignItems: 'center',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '2px'
  },
  btnQtySmall: {
    background: '#f1f5f9',
    color: '#0f172a',
    border: 'none',
    width: '26px',
    height: '26px',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  notesTextarea: {
    width: '100%',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '12px',
    color: '#0f172a',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  drawerFooter: {
    padding: '24px',
    borderTop: '1px solid #e2e8f0',
    background: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    color: '#64748b'
  },
  btnSubmitOrder: {
    background: '#E30613',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '16px',
    fontWeight: 700,
    fontSize: '15px',
    cursor: 'pointer',
    marginTop: '6px'
  },
  whatsappLink: {
    display: 'block',
    textAlign: 'center',
    color: '#059669',
    fontSize: '13px',
    textDecoration: 'none',
    marginTop: '4px',
    fontWeight: 600
  },
  floatingCartBar: {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'calc(100% - 32px)',
    maxWidth: '520px',
    background: '#0f172a',
    color: '#ffffff',
    borderRadius: '16px',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
    zIndex: 9990,
    cursor: 'pointer',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    backdropFilter: 'blur(12px)',
    transition: 'all 0.2s ease'
  },
  floatingCartInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  floatingCartBadge: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#94a3b8'
  },
  floatingCartTotal: {
    fontSize: '16px',
    fontWeight: 800,
    color: '#10b981'
  },
  btnFloatingCartAction: {
    background: '#E30613',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(227, 6, 19, 0.4)',
    whiteSpace: 'nowrap'
  }
};
