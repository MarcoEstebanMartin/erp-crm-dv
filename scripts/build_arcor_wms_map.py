import re

wms_map_code = '''      {subTab === 'wms-map' && !selectedOrder && !showConsolidatedView && (
        <div className="wms-container" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
          {/* Card Principal del Mapa Estilo Arcor / WMS Profesional */}
          <div className="wms-map-card" style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            
            {/* Header de Navegación e Indicadores KPI de Capacidad */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>Layout WMS de Almacenamiento</h4>
                  <span className="badge" style={{ backgroundColor: '#007AFF', color: '#fff', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px' }}>Grilla Arcor Logistics</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Plano limpio 100% operativo de almacenamiento (sin áreas administrativas ni baños).
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button"
                  className={`btn ${selectedWarehouse === 'D1' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.82rem', padding: '7px 16px', borderRadius: '6px', fontWeight: 600 }}
                  onClick={() => { setSelectedWarehouse('D1'); setSelectedMapLocation(''); }}
                >
                  ❄️ Nave 1: Frío & Alta Rotación (10x20m)
                </button>
                <button 
                  type="button"
                  className={`btn ${selectedWarehouse === 'D2' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.82rem', padding: '7px 16px', borderRadius: '6px', fontWeight: 600 }}
                  onClick={() => { setSelectedWarehouse('D2'); setSelectedMapLocation(''); }}
                >
                  🏢 Nave 2: Secos & Pastas (16x25m)
                </button>
                <button 
                  type="button"
                  className={`btn ${selectedWarehouse === 'D3' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.82rem', padding: '7px 16px', borderRadius: '6px', fontWeight: 600 }}
                  onClick={() => { setSelectedWarehouse('D3'); setSelectedMapLocation(''); }}
                >
                  📦 Nave 3: Voluminosos & UAT (10x10m)
                </button>
              </div>
            </div>

            {/* Barra de Leyendas y Estado de Capacidad */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: '#22c55e', borderRadius: '50%', display: 'inline-block' }}></span>
                <span><strong>🟢 Ocupado con Lote</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: '#ffffff', stroke: '#cbd5e1', border: '1.5px solid #94a3b8', borderRadius: '2px', display: 'inline-block' }}></span>
                <span>⚪ Slot Disponible</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#007AFF', fontWeight: 600 }}>❄️ Cámaras de Frío (2° - 5°C)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#d97706', fontWeight: 600 }}>🍾 Zona Licores</span>
              </div>
              <div style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--text-primary)' }}>
                78 Slots Totales en Sistema
              </div>
            </div>

            {/* Motor Gráfico SVG - Fiel al Mapa Físico sin Oficinas */}
            <div className="wms-svg-wrapper" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', backgroundColor: '#ffffff' }}>
              {selectedWarehouse === 'D1' && (
                <svg viewBox="0 0 850 480" width="100%" height="100%" style={{ maxHeight: '480px' }}>
                  <rect x="0" y="0" width="850" height="480" fill="#fafafa" stroke="#e2e8f0" strokeWidth="1.5" rx="8" />

                  {/* CÁMARA 2 - FRÍO (REFRIGERADO 2° A 5°C - QUESOS Y FIAMBRES) */}
                  <g>
                    <rect x="20" y="20" width="410" height="215" fill="rgba(0, 122, 255, 0.03)" stroke="#007AFF" strokeWidth="2" rx="6" />
                    <text x="30" y="40" fill="#007AFF" fontSize="11px" fontWeight="bold">❄️ CÁMARA 2 FRÍO (QUESOS MELINCUÉ & REMOTTI)</text>
                    
                    {/* Racks Pared Izquierda */}
                    <text x="30" y="58" fill="#64748b" fontSize="8.5px" fontWeight="bold">Rack Izq:</text>
                    {[
                      { code: 'D1-CAM2-R01-A', label: 'R01-A (Tybo Pick)', x: 30, y: 64, w: 90, h: 26 },
                      { code: 'D1-CAM2-R01-B', label: 'R01-B (Tybo Pulmón)', x: 30, y: 94, w: 90, h: 26 },
                      { code: 'D1-CAM2-R02-A', label: 'R02-A (Gouda Pick)', x: 30, y: 128, w: 90, h: 26 },
                      { code: 'D1-CAM2-R02-B', label: 'R02-B (Gouda Pulmón)', x: 30, y: 158, w: 90, h: 26 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      const hasStock = ['D1-CAM2-R01-A'].includes(slot.code);
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#007AFF' : hasStock ? '#e0f2fe' : '#ffffff'} stroke={hasStock ? '#0284c7' : '#007AFF'} strokeWidth={active ? 2.5 : 1} rx="3" />
                          <text x={slot.x + 6} y={slot.y + 17} fill={active ? '#ffffff' : '#007AFF'} fontSize="8.5px" fontWeight="bold">{slot.label}</text>
                          {hasStock && <circle cx={slot.x + slot.w - 8} cy={slot.y + 8} r="3" fill="#22c55e" />}
                        </g>
                      );
                    })}

                    {/* Slots de Piso Centrales */}
                    <text x="135" y="58" fill="#64748b" fontSize="8.5px" fontWeight="bold">Pasillo Central (Slots Piso):</text>
                    {[
                      { code: 'D1-CAM2-P01', label: 'P01 (Melincué Barra Tybo)', x: 135, y: 64, w: 175, h: 24, hasStock: true },
                      { code: 'D1-CAM2-P02', label: 'P02 (Melincué Mozzarella)', x: 135, y: 92, w: 175, h: 24, hasStock: true },
                      { code: 'D1-CAM2-P03', label: 'P03 (Cremoso Remotti)', x: 135, y: 120, w: 175, h: 24, hasStock: false },
                      { code: 'D1-CAM2-P04', label: 'P04 (Fiambres/Embutidos)', x: 135, y: 148, w: 175, h: 24, hasStock: false },
                      { code: 'D1-CAM2-P05', label: 'P05 (Queso Sardo Bloque)', x: 135, y: 176, w: 175, h: 24, hasStock: false },
                      { code: 'D1-CAM2-P06', label: 'P06 (Por Salut / Fresco)', x: 135, y: 204, w: 175, h: 24, hasStock: false },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#0284c7' : slot.hasStock ? '#e0f2fe' : '#ffffff'} stroke="#0284c7" strokeWidth={active ? 2.5 : 1} rx="3" />
                          <text x={slot.x + 8} y={slot.y + 16} fill={active ? '#ffffff' : '#0369a1'} fontSize="9px" fontWeight="bold">{slot.label}</text>
                          {slot.hasStock && <circle cx={slot.x + slot.w - 10} cy={slot.y + 12} r="3.5" fill="#22c55e" />}
                        </g>
                      );
                    })}

                    {/* Racks Pared Derecha */}
                    <text x="320" y="58" fill="#64748b" fontSize="8.5px" fontWeight="bold">Rack Der:</text>
                    {[
                      { code: 'D1-CAM2-R03-A', label: 'R03-A (Fiambres)', x: 320, y: 64, w: 100, h: 26 },
                      { code: 'D1-CAM2-R03-B', label: 'R03-B (Fiambre Res)', x: 320, y: 94, w: 100, h: 26 },
                      { code: 'D1-CAM2-R04-A', label: 'R04-A (Mantecas)', x: 320, y: 128, w: 100, h: 26 },
                      { code: 'D1-CAM2-R04-B', label: 'R04-B (Manteca Res)', x: 320, y: 158, w: 100, h: 26 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#007AFF' : '#ffffff'} stroke="#007AFF" strokeWidth={active ? 2.5 : 1} rx="3" />
                          <text x={slot.x + 6} y={slot.y + 17} fill={active ? '#ffffff' : '#007AFF'} fontSize="8.5px" fontWeight="bold">{slot.label}</text>
                        </g>
                      );
                    })}
                  </g>

                  {/* CÁMARA 1 - FRÍO (LÁCTEOS FRESCOS Y FRACCIONADOS) */}
                  <g>
                    <rect x="450" y="20" width="380" height="215" fill="rgba(14, 165, 233, 0.03)" stroke="#0ea5e9" strokeWidth="2" rx="6" />
                    <text x="460" y="40" fill="#0284c7" fontSize="11px" fontWeight="bold">❄️ CÁMARA 1 FRÍO (LÁCTEOS & MOZZARELLA)</text>
                    
                    <text x="460" y="58" fill="#64748b" fontSize="8.5px" fontWeight="bold">Estantería Roja 5 Niveles:</text>
                    {[
                      { code: 'D1-CAM1-EST-N1', label: 'N1: Por Salut / Azul (Picking)', y: 64, hasStock: true },
                      { code: 'D1-CAM1-EST-N2', label: 'N2: Quesos Potes / Fraccionados', y: 88, hasStock: false },
                      { code: 'D1-CAM1-EST-N3', label: 'N3: Yogures Potes / Cremas', y: 112, hasStock: false },
                      { code: 'D1-CAM1-EST-N4', label: 'N4: Postres / Sodecar', y: 136, hasStock: false },
                      { code: 'D1-CAM1-EST-N5', label: 'N5: Reposición Potes (Pulmón)', y: 160, hasStock: false },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x="460" y={slot.y} width="180" height="20" fill={active ? '#0ea5e9' : slot.hasStock ? '#e0f2fe' : '#ffffff'} stroke="#0ea5e9" strokeWidth={active ? 2.5 : 1} rx="3" />
                          <text x="468" y={slot.y + 14} fill={active ? '#ffffff' : '#0284c7'} fontSize="8.5px" fontWeight="bold">{slot.label}</text>
                          {slot.hasStock && <circle cx="630" cy={slot.y + 10} r="3" fill="#22c55e" />}
                        </g>
                      );
                    })}

                    <text x="655" y="58" fill="#64748b" fontSize="8.5px" fontWeight="bold">Slots Piso Pallet:</text>
                    {[
                      { code: 'D1-CAM1-P01', label: 'P01 Mozzarella Cremigal', x: 655, y: 64, w: 165, h: 26, hasStock: true },
                      { code: 'D1-CAM1-P02', label: 'P02 Por Salut Melincué', x: 655, y: 96, w: 165, h: 26, hasStock: false },
                      { code: 'D1-CAM1-P03', label: 'P03 Sodecar Embutidos', x: 655, y: 128, w: 165, h: 26, hasStock: false },
                      { code: 'D1-CAM1-P04', label: 'P04 Reserva Frío', x: 655, y: 160, w: 165, h: 26, hasStock: false },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#0284c7' : slot.hasStock ? '#e0f2fe' : '#ffffff'} stroke="#0284c7" strokeWidth={active ? 2.5 : 1} rx="3" />
                          <text x={slot.x + 8} y={slot.y + 17} fill={active ? '#ffffff' : '#0369a1'} fontSize="8.5px" fontWeight="bold">{slot.label}</text>
                          {slot.hasStock && <circle cx={slot.x + slot.w - 10} cy={slot.y + 13} r="3" fill="#22c55e" />}
                        </g>
                      );
                    })}
                  </g>

                  {/* CÁMARA 3 - SECO (CONSERVAS CUMANÁ Y ACEITES) */}
                  <g>
                    <rect x="450" y="250" width="380" height="215" fill="rgba(239, 68, 68, 0.03)" stroke="#ef4444" strokeWidth="2" rx="6" />
                    <text x="460" y="270" fill="#dc2626" fontSize="11px" fontWeight="bold">📦 CÁMARA 3 SECO (CONSERVAS CUMANÁ)</text>

                    {[
                      { code: 'D1-CAM3-R01-A', label: 'R01-A: Cumaná Tomate Perita (Picking)', x: 460, y: 282, w: 360, h: 24, hasStock: true },
                      { code: 'D1-CAM3-R01-B', label: 'R01-B: Cumaná Tomate (Reserva Pulmón)', x: 460, y: 310, w: 360, h: 24, hasStock: false },
                      { code: 'D1-CAM3-EST-N1', label: 'EST-N1: Aceites Fraccionados', x: 460, y: 338, w: 360, h: 24, hasStock: false },
                      { code: 'D1-CAM3-EST-N2', label: 'EST-N2: Fraccionado Seco Pequeño', x: 460, y: 366, w: 360, h: 24, hasStock: false },
                      { code: 'D1-CAM3-EST-N3', label: 'EST-N3: Galletitas / Especias', x: 460, y: 394, w: 360, h: 24, hasStock: false },
                      { code: 'D1-CAM3-P01', label: 'P01: Pallet Conservas Cumaná', x: 460, y: 422, w: 175, h: 24, hasStock: false },
                      { code: 'D1-CAM3-P02', label: 'P02: Pallet Aceites Secos', x: 645, y: 422, w: 175, h: 24, hasStock: false },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#ef4444' : slot.hasStock ? '#fee2e2' : '#ffffff'} stroke="#ef4444" strokeWidth={active ? 2.5 : 1} rx="3" />
                          <text x={slot.x + 10} y={slot.y + 16} fill={active ? '#ffffff' : '#b91c1c'} fontSize="8.5px" fontWeight="bold">{slot.label}</text>
                          {slot.hasStock && <circle cx={slot.x + slot.w - 12} cy={slot.y + 12} r="3" fill="#22c55e" />}
                        </g>
                      );
                    })}
                  </g>

                  {/* NAVE SECA ENTRADA: RACK 1 HEAVY DUTY & LICORES */}
                  <g>
                    <rect x="20" y="250" width="410" height="215" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" rx="6" />
                    <text x="30" y="270" fill="#334155" fontSize="11px" fontWeight="bold">📦 PASILLO 1: RACK 1 & GÓNDOLA LICORES</text>

                    {[
                      { code: 'D1-RACK1-M01-A', label: 'M01-A (Bebidas)', x: 30, y: 282, w: 90, h: 26 },
                      { code: 'D1-RACK1-M01-B', label: 'M01-B (Res 1)', x: 30, y: 312, w: 90, h: 26 },
                      { code: 'D1-RACK1-M01-C', label: 'M01-C (Res 2)', x: 30, y: 342, w: 90, h: 26 },
                      
                      { code: 'D1-RACK1-M02-A', label: 'M02-A (Sernova)', x: 126, y: 282, w: 90, h: 26, hasStock: true },
                      { code: 'D1-RACK1-M02-B', label: 'M02-B (Res 1)', x: 126, y: 312, w: 90, h: 26 },
                      { code: 'D1-RACK1-M02-C', label: 'M02-C (Res 2)', x: 126, y: 342, w: 90, h: 26 },
                      
                      { code: 'D1-RACK1-M03-A', label: 'M03-A (Vinos)', x: 222, y: 282, w: 90, h: 26 },
                      { code: 'D1-RACK1-M03-B', label: 'M03-B (Res 1)', x: 222, y: 312, w: 90, h: 26 },
                      { code: 'D1-RACK1-M03-C', label: 'M03-C (Res 2)', x: 222, y: 342, w: 90, h: 26 },
                      
                      { code: 'D1-RACK1-M04-A', label: 'M04-A (Jugos)', x: 318, y: 282, w: 102, h: 26 },
                      { code: 'D1-RACK1-M04-B', label: 'M04-B (Res 1)', x: 318, y: 312, w: 102, h: 26 },
                      { code: 'D1-RACK1-M04-C', label: 'M04-C (Res 2)', x: 318, y: 342, w: 102, h: 26 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#475569' : slot.hasStock ? '#f1f5f9' : '#ffffff'} stroke="#64748b" strokeWidth={active ? 2.5 : 1} rx="3" />
                          <text x={slot.x + 6} y={slot.y + 17} fill={active ? '#ffffff' : '#334155'} fontSize="8.5px" fontWeight="bold">{slot.label}</text>
                          {slot.hasStock && <circle cx={slot.x + slot.w - 8} cy={slot.y + 8} r="3" fill="#22c55e" />}
                        </g>
                      );
                    })}

                    <text x="30" y="386" fill="#d97706" fontSize="9.5px" fontWeight="bold">🍾 ESTANTERÍA APERITIVOS & BEBIDAS:</text>
                    {[
                      { code: 'D1-EST-LIC-N1', label: 'LIC-N1: Botellas Aperitivos (Gordon’s / Fernet)', y: 394 },
                      { code: 'D1-EST-LIC-N2', label: 'LIC-N2: Licores y Aperitivos', y: 418 },
                      { code: 'D1-EST-LIC-N3', label: 'LIC-N3: Botellas Sueltas & Packs Especiales', y: 442 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x="30" y={slot.y} width="390" height="20" fill={active ? '#d97706' : '#fffbeb'} stroke="#f59e0b" strokeWidth={active ? 2.5 : 1} rx="3" />
                          <text x="38" y={slot.y + 14} fill={active ? '#ffffff' : '#b45309'} fontSize="8.5px" fontWeight="bold">{slot.label}</text>
                        </g>
                      );
                    })}
                  </g>
                </svg>
              )}

              {selectedWarehouse === 'D2' && (
                <svg viewBox="0 0 850 480" width="100%" height="100%" style={{ maxHeight: '480px' }}>
                  <rect x="0" y="0" width="850" height="480" fill="#fafafa" stroke="#e2e8f0" strokeWidth="1.5" rx="8" />
                  <text x="25" y="30" fill="#5856D6" fontSize="12px" fontWeight="bold">🏢 NAVE 2 (16 X 25 METROS - SECOS, PASTAS Y ACEITES MASIVOS)</text>

                  {/* RACKS ESTRUCTURALES AZULES */}
                  <g>
                    <rect x="20" y="45" width="400" height="415" fill="rgba(88, 86, 214, 0.03)" stroke="#5856D6" strokeWidth="2" rx="6" />
                    <text x="30" y="65" fill="#5856D6" fontSize="11px" fontWeight="bold">PASILLO 2: RACKS ESTRUCTURALES AZULES (CUMANÁ / HARINAS)</text>

                    {[
                      { code: 'D2-RACK-AZUL-M01-A', label: 'M01-A (Cumaná Tomate Pick)', x: 30, y: 80, w: 380, h: 32 },
                      { code: 'D2-RACK-AZUL-M01-B', label: 'M01-B (Cumaná Tomate Reserva)', x: 30, y: 118, w: 380, h: 32 },
                      { code: 'D2-RACK-AZUL-M01-C', label: 'M01-C (Cumaná Tomate Reserva Masiva)', x: 30, y: 156, w: 380, h: 32 },

                      { code: 'D2-RACK-AZUL-M02-A', label: 'M02-A (Latas Durazno/Ensalada Pick)', x: 30, y: 202, w: 380, h: 32 },
                      { code: 'D2-RACK-AZUL-M02-B', label: 'M02-B (Latas Reserva)', x: 30, y: 240, w: 380, h: 32 },
                      { code: 'D2-RACK-AZUL-M02-C', label: 'M02-C (Latas Reserva Masiva)', x: 30, y: 278, w: 380, h: 32 },

                      { code: 'D2-RACK-AZUL-M03-A', label: 'M03-A (Harinas / Arroz / Legumbres Pick)', x: 30, y: 324, w: 380, h: 32 },
                      { code: 'D2-RACK-AZUL-M03-B', label: 'M03-B (Harinas / Arroz Reserva)', x: 30, y: 362, w: 380, h: 32 },
                      { code: 'D2-RACK-AZUL-M03-C', label: 'M03-C (Harinas / Arroz Reserva Masiva)', x: 30, y: 400, w: 380, h: 32 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#5856D6' : '#ffffff'} stroke="#5856D6" strokeWidth={active ? 2.5 : 1} rx="4" />
                          <text x={slot.x + 12} y={slot.y + 20} fill={active ? '#ffffff' : '#4338ca'} fontSize="9.5px" fontWeight="bold">{slot.label}</text>
                        </g>
                      );
                    })}
                  </g>

                  {/* PATIO PISO FIDEOS 308 */}
                  <g>
                    <rect x="440" y="45" width="390" height="200" fill="#fdf4ff" stroke="#c084fc" strokeWidth="1.5" rx="6" />
                    <text x="450" y="65" fill="#9333ea" fontSize="11px" fontWeight="bold">🍝 PASILLO 3: PATIO DE PISO FIDEOS 308 & PASTAS</text>

                    {[
                      { code: 'D2-PISO-FID-01', label: 'FID-01: Fideos 308 Tallarín', x: 450, y: 78, w: 175, h: 44 },
                      { code: 'D2-PISO-FID-02', label: 'FID-02: Fideos 308 Guisero', x: 640, y: 78, w: 180, h: 44 },
                      { code: 'D2-PISO-FID-03', label: 'FID-03: Fideos 308 Moñito', x: 450, y: 130, w: 175, h: 44 },
                      { code: 'D2-PISO-FID-04', label: 'FID-04: Fideos 308 Nido', x: 640, y: 130, w: 180, h: 44 },
                      { code: 'D2-PISO-FID-05', label: 'FID-05: Fideos Reserva 1', x: 450, y: 182, w: 175, h: 44 },
                      { code: 'D2-PISO-FID-06', label: 'FID-06: Fideos Reserva 2', x: 640, y: 182, w: 180, h: 44 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#9333ea' : '#ffffff'} stroke="#c084fc" strokeWidth={active ? 2.5 : 1} rx="4" />
                          <text x={slot.x + 8} y={slot.y + 26} fill={active ? '#ffffff' : '#7e22ce'} fontSize="9.5px" fontWeight="bold">{slot.label}</text>
                        </g>
                      );
                    })}
                  </g>

                  {/* PATIO PISO ACEITES NATURA */}
                  <g>
                    <rect x="440" y="260" width="390" height="200" fill="#fefce8" stroke="#eab308" strokeWidth="1.5" rx="6" />
                    <text x="450" y="280" fill="#ca8a04" fontSize="11px" fontWeight="bold">🌻 PASILLO 4: PATIO DE PISO ACEITES NATURA & PESADOS</text>

                    {[
                      { code: 'D2-PISO-ACE-01', label: 'ACE-01: Aceite Natura 900ml', x: 450, y: 293, w: 175, h: 44, hasStock: true },
                      { code: 'D2-PISO-ACE-02', label: 'ACE-02: Aceite Natura 1.5L', x: 640, y: 293, w: 180, h: 44, hasStock: false },
                      { code: 'D2-PISO-ACE-03', label: 'ACE-03: Aceite Cañuelas', x: 450, y: 345, w: 175, h: 44, hasStock: false },
                      { code: 'D2-PISO-ACE-04', label: 'ACE-04: Aceite Mezcla Bidón', x: 640, y: 345, w: 180, h: 44, hasStock: false },
                      { code: 'D2-PISO-ACE-05', label: 'ACE-05: Aceite Reserva 1', x: 450, y: 397, w: 175, h: 44, hasStock: false },
                      { code: 'D2-PISO-ACE-06', label: 'ACE-06: Aceite Reserva 2', x: 640, y: 397, w: 180, h: 44, hasStock: false },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#ca8a04' : slot.hasStock ? '#fef08a' : '#ffffff'} stroke="#eab308" strokeWidth={active ? 2.5 : 1} rx="4" />
                          <text x={slot.x + 8} y={slot.y + 26} fill={active ? '#ffffff' : '#854d0e'} fontSize="9.5px" fontWeight="bold">{slot.label}</text>
                          {slot.hasStock && <circle cx={slot.x + slot.w - 10} cy={slot.y + 12} r="3.5" fill="#22c55e" />}
                        </g>
                      );
                    })}
                  </g>
                </svg>
              )}

              {selectedWarehouse === 'D3' && (
                <svg viewBox="0 0 850 480" width="100%" height="100%" style={{ maxHeight: '480px' }}>
                  <rect x="0" y="0" width="850" height="480" fill="#fafafa" stroke="#e2e8f0" strokeWidth="1.5" rx="8" />
                  <text x="25" y="30" fill="#FF2D55" fontSize="12px" fontWeight="bold">📦 NAVE 3 (10 X 10 METROS - LECHES UAT & PAPELERÍA VOLUMINOSA)</text>

                  {/* PATIO LECHES UAT CREMIGAL */}
                  <g>
                    <rect x="20" y="45" width="395" height="200" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.5" rx="6" />
                    <text x="30" y="65" fill="#1d4ed8" fontSize="11px" fontWeight="bold">🥛 PASILLO 5: PATIO LECHES UAT CREMIGAL</text>

                    {[
                      { code: 'D3-PISO-UAT-01', label: 'UAT-01: Leche Entera Sachet x LT', x: 30, y: 78, w: 180, h: 68, hasStock: true },
                      { code: 'D3-PISO-UAT-02', label: 'UAT-02: Leche Descremada Sachet', x: 220, y: 78, w: 185, h: 68, hasStock: false },
                      { code: 'D3-PISO-UAT-03', label: 'UAT-03: Leche Chocolatada', x: 30, y: 160, w: 180, h: 68, hasStock: false },
                      { code: 'D3-PISO-UAT-04', label: 'UAT-04: Leches UAT Reserva Masiva', x: 220, y: 160, w: 185, h: 68, hasStock: false },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#2563eb' : slot.hasStock ? '#dbeafe' : '#ffffff'} stroke="#3b82f6" strokeWidth={active ? 2.5 : 1} rx="4" />
                          <text x={slot.x + 8} y={slot.y + 38} fill={active ? '#ffffff' : '#1e40af'} fontSize="9.5px" fontWeight="bold">{slot.label}</text>
                          {slot.hasStock && <circle cx={slot.x + slot.w - 10} cy={slot.y + 14} r="3.5" fill="#22c55e" />}
                        </g>
                      );
                    })}
                  </g>

                  {/* PATIO PAPELERÍA Y VOLUMINOSOS */}
                  <g>
                    <rect x="20" y="260" width="395" height="200" fill="#fdf2f8" stroke="#ec4899" strokeWidth="1.5" rx="6" />
                    <text x="30" y="280" fill="#be185d" fontSize="11px" fontWeight="bold">📦 PASILLO 6: PATIO PAPELERÍA FELPITA & ROLMAYOR</text>

                    {[
                      { code: 'D3-PISO-PAPEL-01', label: 'PAP-01: Papel Higiénico Felpita', x: 30, y: 293, w: 180, h: 68 },
                      { code: 'D3-PISO-PAPEL-02', label: 'PAP-02: Rollos Cocina RolMayor', x: 220, y: 293, w: 185, h: 68 },
                      { code: 'D3-PISO-PAPEL-03', label: 'PAP-03: Servilletas / Bobinas', x: 30, y: 375, w: 180, h: 68 },
                      { code: 'D3-PISO-PAPEL-04', label: 'PAP-04: Papelería Reserva', x: 220, y: 375, w: 185, h: 68 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#db2777' : '#ffffff'} stroke="#ec4899" strokeWidth={active ? 2.5 : 1} rx="4" />
                          <text x={slot.x + 8} y={slot.y + 38} fill={active ? '#ffffff' : '#9d174d'} fontSize="9.5px" fontWeight="bold">{slot.label}</text>
                        </g>
                      );
                    })}
                  </g>

                  {/* RACKS DE FONDO DEPÓSITO 3 */}
                  <g>
                    <rect x="440" y="45" width="390" height="415" fill="#fafafa" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 4" rx="6" />
                    <text x="450" y="65" fill="#334155" fontSize="11px" fontWeight="bold">PASILLO 7: RACKS DE FONDO (STOCK RESERVA)</text>

                    {[
                      { code: 'D3-RACK-FONDO-M01-A', label: 'M01-A: Reserva Papelería / Fideos (Piso)', x: 450, y: 85, w: 370, h: 75 },
                      { code: 'D3-RACK-FONDO-M01-B', label: 'M01-B: Reserva Masiva Nivel 1 (Alto)', x: 450, y: 175, w: 370, h: 75 },
                      { code: 'D3-RACK-FONDO-M02-A', label: 'M02-A: Reserva Envases / Rollos (Piso)', x: 450, y: 265, w: 370, h: 75 },
                      { code: 'D3-RACK-FONDO-M02-B', label: 'M02-B: Reserva Masiva Nivel 2 (Alto)', x: 450, y: 355, w: 370, h: 75 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#475569' : '#ffffff'} stroke="#64748b" strokeWidth={active ? 2.5 : 1} rx="4" />
                          <text x={slot.x + 14} y={slot.y + 42} fill={active ? '#ffffff' : '#1e293b'} fontSize="10.5px" fontWeight="bold">{slot.label}</text>
                        </g>
                      );
                    })}
                  </g>
                </svg>
              )}
            </div>
          </div>

          {/* Panel Lateral Minimalista del Slot Seleccionado */}
          <div className="wms-detail-card" style={{ width: '340px', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '18px', backgroundColor: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
              📍 Ubicación Seleccionada
            </h4>
            
            {selectedMapLocation ? (
              <div>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {selectedMapLocation}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {LOCATION_MAP[selectedMapLocation]?.description || 'Posición física en depósito'}
                  </div>
                </div>

                {/* Consulta de lotes en esta ubicación */}
                {(() => {
                  const matchingProducts: { product: any; lot: any }[] = [];
                  allProducts.forEach(p => {
                    if (p.lots && p.lots.length > 0) {
                      p.lots.forEach((l: any) => {
                        if (l.location === selectedMapLocation && l.stock > 0) {
                          matchingProducts.push({ product: p, lot: l });
                        }
                      });
                    } else if (p.defaultLocation === selectedMapLocation && p.stock > 0) {
                      matchingProducts.push({ product: p, lot: { lotNumber: 'S/L', expirationDate: null, stock: p.stock, location: p.defaultLocation } });
                    }
                  });

                  if (matchingProducts.length === 0) {
                    return (
                      <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚪</div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Slot Disponible (Vacío)</div>
                        <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Posición lista para recibir palets o mercadería.</div>
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>PRODUCTOS REGISTRADOS ({matchingProducts.length})</span>
                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>🟢 OCUPADO</span>
                      </div>

                      {matchingProducts.map(({ product, lot }, idx) => (
                        <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', backgroundColor: '#fafafa' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)', marginBottom: '6px' }}>
                            [{product.sku}] {product.name}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            <div>Lote: <strong style={{ color: 'var(--text-primary)' }}>{lot.lotNumber}</strong></div>
                            <div>Stock: <strong style={{ color: 'var(--color-primary)' }}>{lot.stock} un.</strong></div>
                            {lot.expirationDate && (
                              <div style={{ gridColumn: 'span 2', marginTop: '2px' }}>
                                Vencimiento: <strong style={{ color: '#d97706' }}>{new Date(lot.expirationDate).toLocaleDateString('es-AR')}</strong>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ width: '100%', marginTop: '10px', fontSize: '0.78rem', padding: '5px', borderRadius: '6px' }}
                            onClick={() => {
                              setStockModal({
                                open: true,
                                product: product,
                                quantityChange: 0,
                                reason: 'Ajuste desde Layout WMS',
                                lotNumber: lot.lotNumber !== 'S/L' ? lot.lotNumber : '',
                                isNewLot: false,
                                expirationDate: lot.expirationDate ? new Date(lot.expirationDate).toISOString().split('T')[0] : '',
                                location: selectedMapLocation
                              });
                            }}
                          >
                            ✏️ Ajustar / Mover Stock
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div style={{ padding: '50px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>👆</div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Seleccioná una ubicación</div>
                <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Hacé clic en cualquier slot del mapa WMS para inspeccionar la mercadería.</div>
              </div>
            )}
          </div>
        </div>
      )}'''

dashboard_path = 'frontend/src/components/DepositoDashboard.tsx'

with open(dashboard_path, 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'\{subTab === \'wms-map\' && !selectedOrder && !showConsolidatedView && \(.*?\n      \)\}'
updated_content = re.sub(pattern, wms_map_code, content, flags=re.DOTALL)

with open(dashboard_path, 'w', encoding='utf-8') as f:
    f.write(updated_content)

print("EXITO: Renderizado WMS estilo Arcor instalado exitosamente en DepositoDashboard.tsx.")
