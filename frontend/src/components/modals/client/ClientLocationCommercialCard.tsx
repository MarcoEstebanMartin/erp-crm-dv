import React from 'react';

const BARRIO_SUGGESTIONS = [
  'CENTRO 1', 'CENTRO 2', 'CENTRO 3', 'CENTRO 4', 'TROCHA',
  'FONAVI', 'PARQUE', 'FEDERAL', 'PROGRESO', 'CICLON', 'CRUCE',
];

const DELIVERY_ROUTES = [
  'BUNGE Y CHARLONE', 'BUNGE Y BUCHARDO', 'VILLEGAS FABIAN', 'VILLEGAS NORBERTO',
  'VILLEGAS DIEGO', 'AMEGHINO Y BLAQUIER', 'CUENCA', 'TEJEDOR', 'ALVEAR',
  'SAUCE Y SANSINENA', 'PIEDRITAS', 'BANDERALO Y LARROUDÉ', 'AMERICA Y FORTIN', 'TODOS',
];

const CARD_STYLE: React.CSSProperties = {
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  padding: '18px',
  backgroundColor: '#fafafa',
};

const HEADER_STYLE: React.CSSProperties = {
  margin: '0 0 14px 0',
  fontSize: '0.84rem',
  fontWeight: 700,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid var(--border-color)',
  paddingBottom: '8px',
};

const SELECT_STYLE: React.CSSProperties = {
  height: '38px',
  padding: '6px 10px',
  fontSize: '0.9rem',
  borderRadius: '6px',
  border: '1px solid var(--border-color)',
  boxSizing: 'border-box',
  width: '100%',
  backgroundColor: '#fff',
  color: 'var(--text-primary)',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '0.82rem',
  fontWeight: 600,
  marginBottom: '6px',
  display: 'block',
  color: 'var(--text-primary)',
};

interface ClientLocationCommercialCardProps {
  data: any;
  onChangeData: (patch: Record<string, any>) => void;
  availableSellers: any[];
  availableSaleRoutes: any[];
  addressInputRef: React.RefObject<HTMLInputElement | null>;
}

export const ClientLocationCommercialCard: React.FC<ClientLocationCommercialCardProps> = ({
  data,
  onChangeData,
  availableSellers,
  availableSaleRoutes,
  addressInputRef,
}) => {
  const handleSaleRouteChange = (rawVal: string) => {
    const routeId = rawVal ? Number(rawVal) : null;
    const selectedRoute = availableSaleRoutes.find((r) => Number(r.id) === routeId);
    let newSellerId = data.sellerId;
    if (selectedRoute) {
      if (selectedRoute.sellerId) {
        newSellerId = Number(selectedRoute.sellerId);
      } else if (selectedRoute.name.toUpperCase().includes('OFICINA')) {
        const oficinaSeller = availableSellers.find((s: any) => s.username.toUpperCase() === 'OFICINA');
        if (oficinaSeller) newSellerId = oficinaSeller.id;
      }
    }
    onChangeData({ saleRouteId: routeId, sellerId: newSellerId });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={CARD_STYLE}>
        <h4 style={HEADER_STYLE}>Ubicación</h4>

        <div className="form-group" style={{ marginBottom: '14px' }}>
          <label htmlFor="client-address" style={LABEL_STYLE}>Dirección</label>
          <input
            id="client-address"
            ref={addressInputRef}
            type="text"
            className="input"
            placeholder="Dirección"
            value={data.address || ''}
            onChange={(e) => onChangeData({ address: e.target.value })}
            style={{ width: '100%', height: '38px', fontSize: '0.9rem' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '14px', marginBottom: '14px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="client-city" style={LABEL_STYLE}>Localidad</label>
            <input
              id="client-city"
              type="text"
              className="input"
              placeholder="Localidad"
              value={data.city || ''}
              onChange={(e) => onChangeData({ city: e.target.value })}
              style={{ width: '100%', height: '38px', fontSize: '0.9rem' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="client-barrio" style={LABEL_STYLE}>Barrio</label>
            <input
              id="client-barrio"
              type="text"
              list="barrio-suggestions"
              className="input"
              placeholder="Barrio"
              value={data.barrio || ''}
              onChange={(e) => onChangeData({ barrio: e.target.value })}
              style={{ width: '100%', height: '38px', fontSize: '0.9rem' }}
            />
            <datalist id="barrio-suggestions">
              {BARRIO_SUGGESTIONS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="client-delivery-route" style={LABEL_STYLE}>Ruta de reparto</label>
          <select
            id="client-delivery-route"
            className="select"
            value={data.route || ''}
            onChange={(e) => onChangeData({ route: e.target.value })}
            style={SELECT_STYLE}
          >
            <option value="">Sin ruta</option>
            {DELIVERY_ROUTES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ ...CARD_STYLE, opacity: data.isClient ? 1 : 0.6 }}>
        <h4 style={HEADER_STYLE}>Condiciones comerciales</h4>

        <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.15fr', gap: '14px', marginBottom: '14px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="client-seller" style={LABEL_STYLE}>Vendedor</label>
            <select
              id="client-seller"
              className="select"
              value={data.sellerId || ''}
              onChange={(e) => onChangeData({ sellerId: e.target.value ? Number(e.target.value) : null })}
              disabled={!data.isClient}
              style={SELECT_STYLE}
            >
              <option value="">Sin vendedor</option>
              {availableSellers.map((s) => (
                <option key={s.id} value={s.id}>{s.username.replace('_', ' ').toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="client-sale-route" style={LABEL_STYLE}>Ruta de preventa</label>
            <select
              id="client-sale-route"
              className="select"
              value={data.saleRouteId || ''}
              onChange={(e) => handleSaleRouteChange(e.target.value)}
              disabled={!data.isClient}
              style={SELECT_STYLE}
            >
              <option value="">Sin ruta</option>
              {availableSaleRoutes.map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.seller?.username || '-'})</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="client-credit-limit" style={LABEL_STYLE}>Límite Cta Cte</label>
            <select
              id="client-credit-limit"
              className="select"
              value={data.maxUnpaidInvoices ?? 0}
              onChange={(e) => onChangeData({ maxUnpaidInvoices: Number(e.target.value) })}
              disabled={!data.isClient}
              style={SELECT_STYLE}
            >
              <option value={0}>Contado</option>
              <option value={0.5}>1/2 Boleta</option>
              <option value={1}>1 Boleta</option>
              <option value={2}>2 Boletas</option>
              <option value={3}>3 Boletas</option>
              <option value={4}>4 Boletas</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="client-price-list" style={LABEL_STYLE}>Lista de precios</label>
            <select
              id="client-price-list"
              className="select"
              value={data.priceList || 'A'}
              onChange={(e) => onChangeData({ priceList: e.target.value })}
              disabled={!data.isClient}
              style={SELECT_STYLE}
            >
              <option value="A">Lista 4 (General)</option>
              <option value="B">Lista Especial</option>
              <option value="C">Lista Especial 2</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
