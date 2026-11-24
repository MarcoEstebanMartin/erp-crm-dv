import type { FC } from 'react';
import { Banknote, CheckCircle, ExternalLink, MapPin, Navigation } from 'lucide-react';
import { buildGoogleMapsMultiStopRouteUrl, buildGoogleMapsSingleUrl } from '../../utils/geoUtils';
import { canCollectStop, getStopOutstandingBalance } from './repartoRouteHelpers';

interface RepartoDriverRoutePanelProps {
  selectedRoute: any | null;
  stops: any[];
  handleOpenCollectForStop: (stop: any) => void;
}

export const RepartoDriverRoutePanel: FC<RepartoDriverRoutePanelProps> = ({
  selectedRoute,
  stops,
  handleOpenCollectForStop,
}) => {
  if (!selectedRoute) {
    return (
      <div
        className="card"
        style={{
          padding: '32px 20px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Navigation size={24} aria-hidden="true" style={{ color: 'var(--text-secondary)' }} />
        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Elegí un viaje</span>
      </div>
    );
  }

  let cashTotal = 0;
  let checkTotal = 0;
  let transferTotal = 0;
  let otherTotal = 0;
  let totalCollected = 0;

  const receiptsByClientId: Record<number, { total: number; count: number }> = {};
  for (const r of selectedRoute.fieldReceipts || []) {
    if (r.status === 'VOIDED') continue;
    const pid = Number(r.personaId);
    const rTotal = Math.round(Number(r.totalAmount || 0));
    if (!receiptsByClientId[pid]) receiptsByClientId[pid] = { total: 0, count: 0 };
    receiptsByClientId[pid].total += rTotal;
    receiptsByClientId[pid].count += 1;
    totalCollected += rTotal;

    const payments = Array.isArray(r.payments) ? r.payments : [];
    for (const p of payments) {
      if (p.status === 'VOIDED' || p.status === 'REJECTED') continue;
      const amt = Math.round(Number(p.amount || 0));
      if (p.paymentMethod === 'CASH') cashTotal += amt;
      else if (p.paymentMethod === 'CHECK' || p.paymentMethod === 'ECHEQ') checkTotal += amt;
      else if (p.paymentMethod === 'BANK_TRANSFER' || p.paymentMethod === 'TRANSFER') transferTotal += amt;
      else otherTotal += amt;
    }
  }

  const methodBreakdown = [
    { label: 'Efectivo', amount: cashTotal },
    { label: 'Cheques', amount: checkTotal },
    { label: 'Transf.', amount: transferTotal },
    { label: 'Otros', amount: otherTotal },
  ].filter((m) => m.amount > 0);

  const validRouteStops = stops
    .filter((s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)))
    .map((s) => ({ lat: Number(s.lat), lng: Number(s.lng), title: s.name }));

  const fullRouteMapsUrl =
    validRouteStops.length > 0
      ? buildGoogleMapsMultiStopRouteUrl(validRouteStops, { roundTrip: true })
      : null;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <h3
          className="tabular-nums"
          style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            margin: 0,
            textWrap: 'balance',
          }}
        >
          Viaje #{selectedRoute.id}
        </h3>

        {fullRouteMapsUrl && (
          <a
            href={fullRouteMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{
              minBlockSize: '44px',
              padding: '0 14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.84rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <MapPin size={16} aria-hidden="true" />
            <span>Google Maps</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        )}
      </div>

      <div
        style={{
          backgroundColor: '#f8fafc',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Cobrado
          </span>
          <span
            className="tabular-nums"
            style={{
              fontSize: '1.15rem',
              fontWeight: 800,
              color: totalCollected > 0 ? '#15803d' : 'var(--text-primary)',
            }}
          >
            ${totalCollected.toLocaleString('es-AR')}
          </span>
        </div>

        {methodBreakdown.length > 0 && (
          <div
            className="tabular-nums"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px 14px',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
            }}
          >
            {methodBreakdown.map((m) => (
              <span key={m.label}>
                {m.label} <strong style={{ color: 'var(--text-primary)' }}>${m.amount.toLocaleString('es-AR')}</strong>
              </span>
            ))}
          </div>
        )}
      </div>

      {stops.length === 0 ? (
        <div style={{ padding: '20px 8px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          Sin clientes en este viaje
        </div>
      ) : (
        <ol
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {stops.map((stop, idx) => {
            const clientReceipt = receiptsByClientId[Number(stop.clientId)];
            const outstandingBalance = getStopOutstandingBalance(stop);
            const showCollectButton = canCollectStop(selectedRoute.status, stop);
            const hasCoords = Number.isFinite(Number(stop.lat)) && Number.isFinite(Number(stop.lng));
            const stopMapsUrl = hasCoords
              ? buildGoogleMapsSingleUrl(Number(stop.lat), Number(stop.lng))
              : null;
            const amount = Math.round(Number(stop.totalAmount || 0));

            return (
              <li
                key={stop.id ?? idx}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  backgroundColor: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span
                    className="tabular-nums"
                    aria-hidden="true"
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: '#111827',
                      color: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      flexShrink: 0,
                      marginTop: '1px',
                    }}
                  >
                    {idx + 1}
                  </span>

                  <div style={{ flex: 1, minWidth: 0, overflowWrap: 'break-word' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)' }}>
                      {stop.name}
                    </div>
                    {stop.address && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {stop.address}
                      </div>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                        marginTop: '6px',
                      }}
                    >
                      {amount > 0 && (
                        <span
                          className="tabular-nums"
                          style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}
                        >
                          ${amount.toLocaleString('es-AR')}
                        </span>
                      )}
                      {clientReceipt && (
                        <span
                          className="tabular-nums"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            backgroundColor: '#dcfce7',
                            color: '#15803d',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                          }}
                        >
                          <CheckCircle size={12} aria-hidden="true" />
                          Cobrado · ${clientReceipt.total.toLocaleString('es-AR')}
                        </span>
                      )}
                      {!clientReceipt && outstandingBalance <= 0 && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                          }}
                        >
                          Sin saldo
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {(showCollectButton || stopMapsUrl) && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {showCollectButton && (
                      <button
                        type="button"
                        className={clientReceipt ? 'btn btn-secondary' : 'btn btn-primary'}
                        onClick={() => handleOpenCollectForStop(stop)}
                        style={{
                          flex: '1 1 130px',
                          minBlockSize: '44px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          fontSize: '0.86rem',
                          fontWeight: 600,
                          ...(clientReceipt
                            ? {}
                            : { backgroundColor: '#15803d', borderColor: '#15803d' }),
                        }}
                      >
                        <Banknote size={16} aria-hidden="true" />
                        <span>{clientReceipt ? '+ Recibo' : 'Cobrar'}</span>
                      </button>
                    )}

                    {stopMapsUrl && (
                      <a
                        href={stopMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                        aria-label={`Abrir ${stop.name} en Google Maps`}
                        style={{
                          minBlockSize: '44px',
                          padding: '0 14px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          fontSize: '0.84rem',
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        <MapPin size={15} aria-hidden="true" />
                        <span>Maps</span>
                      </a>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
