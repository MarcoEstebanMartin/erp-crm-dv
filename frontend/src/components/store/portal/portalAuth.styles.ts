export const portalAuthStyles: { [key: string]: any } = {
  loginOverlay: {
    minHeight: '100vh',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px'
  },
  loginCard: {
    width: '100%',
    maxWidth: '520px',
    background: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    padding: '40px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)'
  },
  loginHeader: {
    textAlign: 'center',
    marginBottom: '28px'
  },
  logoTextFallback: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '1px'
  },
  badgeCorpRed: {
    display: 'inline-block',
    background: 'rgba(227, 6, 19, 0.08)',
    color: '#E30613',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
    padding: '4px 12px',
    borderRadius: '20px',
    marginBottom: '14px',
    border: '1px solid rgba(227, 6, 19, 0.2)'
  },
  loginTitle: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 8px 0'
  },
  loginSubtitle: {
    fontSize: '14px',
    color: '#475569',
    margin: 0,
    lineHeight: '1.5'
  },
  loginSearchBox: {
    display: 'flex',
    gap: '10px',
    marginBottom: '16px'
  },
  searchInput: {
    flex: 1,
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '13px 18px',
    color: '#0f172a',
    fontSize: '14px',
    outline: 'none'
  },
  btnPrimary: {
    background: '#E30613',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 22px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer'
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
  clientListContainer: {
    maxHeight: '280px',
    overflowY: 'auto',
    marginTop: '16px'
  },
  clientGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '8px'
  },
  clientCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '14px 18px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  btnLink: {
    background: 'none',
    border: 'none',
    color: '#475569',
    fontSize: '13px',
    cursor: 'pointer',
    textDecoration: 'underline'
  },
  errorBanner: {
    background: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fca5a5',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '13px',
    marginBottom: '16px'
  }
};
