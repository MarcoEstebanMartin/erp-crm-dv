export const portalProductCardStyles: { [key: string]: any } = {
  productCard: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
  },
  productImageArea: {
    height: '150px',
    background: '#ffffff',
    borderBottom: '1px solid #f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden'
  },
  productImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    padding: '8px',
    mixBlendMode: 'multiply'
  },
  productPlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%'
  },
  offerBadge: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    background: '#E30613',
    color: '#fff',
    fontSize: '10px',
    fontWeight: 800,
    padding: '4px 8px',
    borderRadius: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  specialTagBadge: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    background: 'linear-gradient(135deg, #E30613 0%, #b91c1c 100%)',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 800,
    padding: '4px 10px',
    borderRadius: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    boxShadow: '0 2px 6px rgba(227, 6, 19, 0.4)',
    zIndex: 2
  },
  discountBadge: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    background: '#16a34a',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 800,
    padding: '4px 8px',
    borderRadius: '4px',
    boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)',
    zIndex: 2
  },
  previousPriceValue: {
    textDecoration: 'line-through',
    color: '#94a3b8',
    fontSize: '13px',
    fontWeight: 600
  },
  productCardBody: {
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    flex: 1
  },
  productHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '6px'
  },
  productSku: {
    fontSize: '11px',
    color: '#94a3b8'
  },
  productCommercialTag: {
    fontSize: '11px',
    color: '#2563eb',
    fontWeight: 600
  },
  productTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 6px 0',
    lineHeight: '1.3'
  },
  productPriceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: '12px 0 8px 0'
  },
  productPriceLabel: {
    fontSize: '11px',
    color: '#64748b'
  },
  productPriceValue: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#0f172a'
  },
  unitsBoxTag: {
    fontSize: '11px',
    background: '#f1f5f9',
    color: '#334155',
    padding: '4px 8px',
    borderRadius: '6px',
    fontWeight: 600
  },
  stockStatusRow: {
    margin: '6px 0 14px 0'
  },
  stockTagGreen: {
    fontSize: '11px',
    color: '#059669',
    fontWeight: 600,
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    padding: '4px 10px',
    borderRadius: '6px',
    display: 'inline-block'
  },
  stockTagAmber: {
    fontSize: '11px',
    color: '#d97706',
    fontWeight: 600,
    background: '#fffbeb',
    border: '1px solid #fde68a',
    padding: '4px 10px',
    borderRadius: '6px',
    display: 'inline-block'
  },
  stockTagRed: {
    fontSize: '11px',
    color: '#dc2626',
    fontWeight: 600,
    background: '#fef2f2',
    border: '1px solid #fca5a5',
    padding: '4px 10px',
    borderRadius: '6px',
    display: 'inline-block'
  },
  cardActions: {
    marginTop: 'auto'
  },
  btnAddCart: {
    flex: 1,
    background: '#E30613',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  btnAddBox: {
    background: '#1e293b',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '12px',
    cursor: 'pointer'
  },
  qtyControllerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '4px'
  },
  btnQty: {
    background: '#ffffff',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  btnQtyBox: {
    background: '#1e293b',
    color: '#fff',
    border: 'none',
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    cursor: 'pointer',
    marginLeft: 'auto'
  },
  qtyDisplay: {
    flex: 1,
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: 700,
    color: '#0f172a'
  }
};
