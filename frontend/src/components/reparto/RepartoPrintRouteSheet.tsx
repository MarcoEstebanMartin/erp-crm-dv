import { VILLEGAS_DEPOT } from './repartoGeoHelpers';

export function PrintRouteSheet({ route, locations }: { route: any; locations: any[] }) {
  if (!route) return null;

  const originStr = `${VILLEGAS_DEPOT[0]},${VILLEGAS_DEPOT[1]}`;
  const waypointsStr = locations.map(loc => `${loc.lat},${loc.lng}`).join('|');
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${originStr}&waypoints=${encodeURIComponent(waypointsStr)}&travelmode=driving`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(googleMapsUrl)}`;

  const totalAmount = route.orders?.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0) || 0;

  return (
    <div className="print-only" style={{ padding: '20px', color: '#000', backgroundColor: '#fff', width: '100%' }}>
      <div className="print-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1D1D1F', paddingBottom: '10px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <img
              src="/logo.png"
              alt="Logo DV"
              style={{ height: '50px', width: 'auto', objectFit: 'contain', display: 'block', alignSelf: 'flex-start' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const textEl = e.currentTarget.nextSibling as HTMLElement;
                if (textEl) textEl.style.display = 'block';
              }}
            />
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: '#1D1D1F', display: 'none' }}>DISTRIBUIDORA DV</h1>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#555' }}>Logística y Distribución Mayorista de Alimentos y Bebidas</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-corp-red)' }}>HOJA DE RUTA #{route.id}</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#555' }}>Fecha: {new Date(route.date || route.createdAt).toLocaleDateString('es-AR')}</p>
        </div>
      </div>

      <div className="print-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div className="print-card" style={{ border: '1px solid #ccc', padding: '12px', borderRadius: '4px', backgroundColor: '#fafafa' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', fontWeight: 700, borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>Datos de Logística</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
            <div><strong>Chofer:</strong> {route.driverName}</div>
            <div><strong>Patente:</strong> {route.vehiclePlate}</div>
            <div><strong>Vehículo:</strong> {route.vehicleDescription || 'No especificado'}</div>
            <div><strong>Estado del Viaje:</strong> {route.status === 'PENDING' ? 'Pendiente' : route.status === 'IN_TRANSIT' ? 'En Tránsito' : 'Completado'}</div>
          </div>
        </div>

        <div className="print-card" style={{ border: '1px solid #ccc', padding: '8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#fafafa' }}>
          <img src={qrCodeUrl} alt="QR Google Maps" style={{ width: '80px', height: '80px', border: '1px solid #eee' }} />
          <div style={{ fontSize: '0.72rem', lineHeight: '1.3' }}>
            <strong style={{ display: 'block', marginBottom: '4px', color: '#1D1D1F' }}>📲 GPS GOOGLE MAPS</strong>
            Escanea el código QR para abrir el recorrido y navegar parada por parada en tiempo real.
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 10px 0', borderBottom: '1px solid #1D1D1F', paddingBottom: '4px' }}>Planilla de Entregas y Rendición</h3>
      <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginTop: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f2f2f2' }}>
            <th style={{ width: '40px', textAlign: 'center', border: '1px solid #1D1D1F', padding: '6px' }}>Parada</th>
            <th style={{ width: '180px', border: '1px solid #1D1D1F', padding: '6px' }}>Cliente</th>
            <th style={{ border: '1px solid #1D1D1F', padding: '6px' }}>Dirección</th>
            <th style={{ width: '100px', border: '1px solid #1D1D1F', padding: '6px' }}>Comprobante</th>
            <th style={{ width: '100px', textAlign: 'right', border: '1px solid #1D1D1F', padding: '6px' }}>Importe a Cobrar</th>
            <th style={{ width: '130px', border: '1px solid #1D1D1F', padding: '6px' }}>Cobrado Físico ($)</th>
            <th style={{ width: '110px', textAlign: 'center', border: '1px solid #1D1D1F', padding: '6px' }}>Estado Entrega</th>
            <th style={{ width: '140px', border: '1px solid #1D1D1F', padding: '6px' }}>Firma del Cliente</th>
          </tr>
        </thead>
        <tbody>
          {locations.map((stop, idx) => {
            const order = route.orders?.find((o: any) => o.id === stop.id);
            return (
              <tr key={idx} style={{ pageBreakInside: 'avoid' }}>
                <td style={{ textAlign: 'center', fontWeight: 'bold', border: '1px solid #1D1D1F', padding: '6px' }}>{idx + 1}</td>
                <td style={{ border: '1px solid #1D1D1F', padding: '6px' }}>
                  <div style={{ fontWeight: 'bold' }}>{stop.name}</div>
                  {order?.persona?.phone && <div style={{ fontSize: '0.7rem', color: '#555' }}>Tel: {order.persona.phone}</div>}
                  {order?.persona?.cuit && <div style={{ fontSize: '0.7rem', color: '#555' }}>CUIT: {order.persona.cuit}</div>}
                </td>
                <td style={{ border: '1px solid #1D1D1F', padding: '6px' }}>
                  <div>{stop.address}</div>
                </td>
                <td style={{ fontFamily: 'monospace', border: '1px solid #1D1D1F', padding: '6px' }}>{stop.invoice}</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', border: '1px solid #1D1D1F', padding: '6px' }}>
                  ${Number(order?.totalAmount || 0).toLocaleString('es-AR')}
                </td>
                <td style={{ fontSize: '0.7rem', border: '1px solid #1D1D1F', padding: '6px' }}>
                  <div style={{ display: 'flex', gap: '3px', marginBottom: '2px', alignItems: 'center' }}>
                    <span style={{ border: '1px solid #555', width: '9px', height: '9px', display: 'inline-block' }}></span> Efec: $__________
                  </div>
                  <div style={{ display: 'flex', gap: '3px', marginBottom: '2px', alignItems: 'center' }}>
                    <span style={{ border: '1px solid #555', width: '9px', height: '9px', display: 'inline-block' }}></span> Transf: $________
                  </div>
                  <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                    <span style={{ border: '1px solid #555', width: '9px', height: '9px', display: 'inline-block' }}></span> Cheq: $________
                  </div>
                </td>
                <td style={{ fontSize: '0.72rem', border: '1px solid #1D1D1F', padding: '6px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center', marginBottom: '4px' }}>
                    <span style={{ border: '1px solid #000', width: '9px', height: '9px', display: 'inline-block' }}></span> Entregado
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                    <span style={{ border: '1px solid #000', width: '9px', height: '9px', display: 'inline-block' }}></span> Rechazado
                  </div>
                </td>
                <td style={{ verticalAlign: 'bottom', paddingBottom: '4px', height: '40px', border: '1px solid #1D1D1F', padding: '6px' }}>
                  <div style={{ borderBottom: '1px dotted #555', width: '100%', height: '18px' }}></div>
                  <div style={{ fontSize: '0.6rem', textAlign: 'center', color: '#555', marginTop: '2px' }}>Firma y Aclaración</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '25px', pageBreakInside: 'avoid' }}>
        <div className="print-card" style={{ border: '1px solid #ccc', padding: '12px', borderRadius: '4px', backgroundColor: '#fafafa' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', fontWeight: 700 }}>Resumen de Valores Totales</h4>
          <table style={{ width: '100%', fontSize: '0.75rem' }}>
            <tbody>
              <tr>
                <td style={{ padding: '3px 0' }}>Total Pedidos Planificados:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{route.orders?.length || 0} entregas</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '3px 0' }}>Total a Cobrar Estimado:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.85rem' }}>${totalAmount.toLocaleString('es-AR')}</td>
              </tr>
              <tr>
                <td style={{ padding: '3px 0', paddingTop: '6px' }}>Efectivo Rendido Físico:</td>
                <td style={{ textAlign: 'right', borderBottom: '1px solid #000' }}>$_________________</td>
              </tr>
              <tr>
                <td style={{ padding: '3px 0' }}>Cheques Rendidos Físico:</td>
                <td style={{ textAlign: 'right', borderBottom: '1px solid #000' }}>$_________________</td>
              </tr>
              <tr>
                <td style={{ padding: '3px 0' }}>Comprobantes de Transf.:</td>
                <td style={{ textAlign: 'right', borderBottom: '1px solid #000' }}>$_________________</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="print-card" style={{ border: '1px solid #ccc', padding: '12px', borderRadius: '4px', backgroundColor: '#fafafa', fontSize: '0.75rem' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', fontWeight: 700 }}>Observaciones y Novedades del Viaje</h4>
          <div style={{ height: '80px', border: '1px solid #ddd', borderRadius: '3px', backgroundColor: '#fff', padding: '4px', marginTop: '6px' }} />
        </div>
      </div>
    </div>
  );
}
