export const portalAccountOrdersStyles: { [key: string]: any } = {
  tabContent: {
    maxWidth: '1650px',
    width: '100%',
    margin: '0 auto',
    padding: '24px 28px',
    boxSizing: 'border-box'
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
  accountCardHeader: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px'
  },
  accountMetricBox: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  accountMetricLabel: {
    fontSize: '12px',
    color: '#64748b',
    textTransform: 'uppercase'
  },
  accountMetricValue: {
    fontSize: '28px',
    fontWeight: 800,
    marginTop: '6px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    textAlign: 'left',
    padding: '12px 14px',
    fontSize: '12px',
    color: '#64748b',
    borderBottom: '1px solid #e2e8f0'
  },
  td: {
    padding: '14px',
    fontSize: '13px',
    color: '#334155',
    borderBottom: '1px solid #e2e8f0'
  },
  statusPill: (status: string) => {
    let bg = '#f1f5f9';
    let color = '#64748b';
    if (status === 'PENDING') {
      bg = '#fffbeb';
      color = '#d97706';
    } else if (status === 'PREPARED' || status === 'DELIVERED') {
      bg = '#ecfdf5';
      color = '#059669';
    }
    return {
      background: bg,
      color,
      padding: '4px 10px',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: 600
    };
  },
  orderHistoryCard: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  orderHistoryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '14px',
    marginBottom: '14px'
  },
  orderHistoryItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  orderItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px'
  },
  orderHistoryFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '14px',
    paddingTop: '14px',
    borderTop: '1px dashed #e2e8f0'
  }
};
