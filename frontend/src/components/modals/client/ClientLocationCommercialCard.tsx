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
  padding: '20px',
  backgroundColor: 'rgba(249, 250, 251, 0.35)',
  boxShadow: 'var(--shadow-sm)',
};

const HEADER_STYLE: React.CSSProperties = {
  margin: '0 0 16px 0',
  fontSize: '0.88rem',
  fontWeight: 700,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid var(--border-color)',
  paddingBottom: '10px',
};

const SELECT_STYLE: React.CSSProperties = {
  height: '40px',
  padding: '8px 12px',
  fontSize: '0.92rem',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={CARD_STYLE}>
        <h4 style={HEADER_STYLE}>📍 Dirección Fiscal / Entrega y Logística</h4>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={LABEL_STYLE}>Dirección de Entrega / Domicilio Fiscal</label>
          <input
            ref={addressInputRef}
            type="text"
            className="input"
            placeholder="ej: Pringles 120"
            value={data.address || ''}
            onChange={(e) => onChangeData({ address: e.target.value })}
            style={{ width: '100%', height: '40px', fontSize: '0.92rem' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '16px', marginBottom: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={LABEL_STYLE}>Localidad / Ciudad</label>
            <input
              type="text"
              className="input"
              placeholder="ej: General Villegas"
              value={data.city || ''}
              onChange={(e) => onChangeData({ city: e.target.value })}
              style={{ width: '100%', height: '40px', fontSize: '0.92rem' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={LABEL_STYLE}>Barrio (en General Villegas)</label>
            <input
              type="text"
              list="barrio-suggestions"
              className="input"
              placeholder="ej: CENTRO 1, TROCHA..."
              value={data.barrio || ''}
              onChange={(e) => onChangeData({ barrio: e.target.value })}
              style={{ width: '100%', height: '40px', fontSize: '0.92rem' }}
            />
            <datalist id="barrio-suggestions">
              {BARRIO_SUGGESTIONS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={LABEL_STYLE}>Ruta de Reparto y Despacho</label>
          <select
            className="select"
            value={data.route || ''}
            onChange={(e) => onChangeData({ route: e.target.value })}
            style={SELECT_STYLE}
          >
            <option value="">Sin Ruta de Reparto Asignada</option>
            {DELIVERY_ROUTES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ ...CARD_STYLE, opacity: data.isClient ? 1 : 0.65, transition: 'var(--transition-medium)' }}>
        <h4 style={{ ...HEADER_STYLE, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>💼 Condiciones Comerciales</span>
          {!data.isClient && (
            <small style={{ textTransform: 'none', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 500 }}>
              (Habilitá el rol Cliente para editar estas opciones)
            </small>
          )}
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.15fr', gap: '16px', marginBottom: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={LABEL_STYLE}>Vendedor Asignado</label>
            <select
              className="select"
              value={data.sellerId || ''}
              onChange={(e) => onChangeData({ sellerId: e.target.value ? Number(e.target.value) : null })}
              disabled={!data.isClient}
              style={SELECT_STYLE}
            >
              <option value="">Sin Vendedor Asignado</option>
              {availableSellers.map((s) => (
                <option key={s.id} value={s.id}>{s.username.replace('_', ' ').toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={LABEL_STYLE}>Ruta de Venta (Preventista)</label>
            <select
              className="select"
              value={data.saleRouteId || ''}
              onChange={(e) => handleSaleRouteChange(e.target.value)}
              disabled={!data.isClient}
              style={SELECT_STYLE}
            >
              <option value="">Sin Ruta de Venta Asignada</option>
              {availableSaleRoutes.map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.seller?.username || 'Sin Vendedor'})</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={LABEL_STYLE}>Límite de Cuenta Corriente</label>
            <select
              className="select"
              value={data.maxUnpaidInvoices ?? 0}
              onChange={(e) => onChangeData({ maxUnpaidInvoices: Number(e.target.value) })}
              disabled={!data.isClient}
              style={SELECT_STYLE}
            >
              <option value={0}>Sin Cuenta Corriente (Contado)</option>
              <option value={0.5}>Media Boleta Pendiente</option>
              <option value={1}>Hasta 1 Boleta Pendiente</option>
              <option value={2}>Hasta 2 Boletas Pendientes</option>
              <option value={3}>Hasta 3 Boletas Pendientes</option>
              <option value={4}>Hasta 4 Boletas Pendientes (Máximo)</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={LABEL_STYLE}>Lista de Precios Asignada</label>
            <select
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
