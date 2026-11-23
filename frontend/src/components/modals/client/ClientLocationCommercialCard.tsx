import React from 'react';
import { ClientGpsPickerSection } from './ClientGpsPickerSection';

const BARRIO_SUGGESTIONS = [
  'CENTRO 1', 'CENTRO 2', 'CENTRO 3', 'CENTRO 4', 'TROCHA',
  'FONAVI', 'PARQUE', 'FEDERAL', 'PROGRESO', 'CICLON', 'CRUCE',
];

const DELIVERY_ROUTES = [
  'BUNGE Y CHARLONE', 'BUNGE Y BUCHARDO', 'VILLEGAS FABIAN', 'VILLEGAS NORBERTO',
  'VILLEGAS DIEGO', 'AMEGHINO Y BLAQUIER', 'CUENCA', 'TEJEDOR', 'ALVEAR',
  'SAUCE Y SANSINENA', 'PIEDRITAS', 'BANDERALO Y LARROUDÉ', 'AMERICA Y FORTIN', 'TODOS',
];

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
  fontSize: '0.78rem',
  fontWeight: 600,
  marginBottom: '5px',
  display: 'block',
  color: 'var(--text-secondary)',
};

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  height: '38px',
  fontSize: '0.9rem',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minInlineSize: 0 }}>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="client-address" style={LABEL_STYLE}>Dirección</label>
        <input
          id="client-address"
          ref={addressInputRef}
          type="text"
          className="input"
          placeholder="Dirección"
          value={data.address || ''}
          onChange={(e) => onChangeData({ address: e.target.value })}
          style={INPUT_STYLE}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '12px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="client-city" style={LABEL_STYLE}>Localidad</label>
          <input
            id="client-city"
            type="text"
            className="input"
            placeholder="Localidad"
            value={data.city || ''}
            onChange={(e) => onChangeData({ city: e.target.value })}
            style={INPUT_STYLE}
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
            style={INPUT_STYLE}
          />
          <datalist id="barrio-suggestions">
            {BARRIO_SUGGESTIONS.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: data.isSeller && !data.isClient ? '1fr 1fr' : '1fr', gap: '12px' }}>
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

        {data.isSeller && !data.isClient && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="seller-sale-route" style={LABEL_STYLE}>Ruta de preventa</label>
            <select
              id="seller-sale-route"
              className="select"
              value={data.saleRouteId || ''}
              onChange={(e) => handleSaleRouteChange(e.target.value)}
              style={SELECT_STYLE}
            >
              <option value="">Sin ruta</option>
              {availableSaleRoutes.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <ClientGpsPickerSection data={data} onChangeData={onChangeData} />

      {Boolean(data.isClient) && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="client-seller" style={LABEL_STYLE}>Vendedor</label>
              <select
                id="client-seller"
                className="select"
                value={data.sellerId || ''}
                onChange={(e) => onChangeData({ sellerId: e.target.value ? Number(e.target.value) : null })}
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
                style={SELECT_STYLE}
              >
                <option value="">Sin ruta</option>
                {availableSaleRoutes.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.seller?.username || '-'})</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.55fr', gap: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="client-credit-limit" style={LABEL_STYLE}>Límite Cta Cte</label>
              <select
                id="client-credit-limit"
                className="select"
                value={Math.min(Number(data.maxUnpaidInvoices ?? 0), 2)}
                onChange={(e) => onChangeData({ maxUnpaidInvoices: Number(e.target.value) })}
                style={SELECT_STYLE}
              >
                <option value={0}>Contado</option>
                <option value={0.5}>1/2 Boleta</option>
                <option value={1}>1 Boleta</option>
                <option value={2}>2 Boletas</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="client-price-list" style={LABEL_STYLE}>Lista de precios</label>
              <select
                id="client-price-list"
                className="select"
                value={data.priceList || 'A'}
                onChange={(e) => onChangeData({ priceList: e.target.value })}
                style={SELECT_STYLE}
              >
                <option value="A">Lista 4 (General)</option>
                <option value="B">Lista Especial</option>
                <option value="C">Lista Especial 2</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="client-discount" style={LABEL_STYLE}>Dto. %</label>
              <input
                id="client-discount"
                type="number"
                min={0}
                max={100}
                step="0.5"
                className="input tabular-nums"
                value={data.discount ?? 0}
                onChange={(e) => onChangeData({ discount: e.target.value === '' ? 0 : Number(e.target.value) })}
                style={INPUT_STYLE}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
