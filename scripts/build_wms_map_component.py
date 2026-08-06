import re

wms_map_code = '''      {subTab === 'wms-map' && !selectedOrder && !showConsolidatedView && (
        <div className="wms-container">
          {/* Card del Mapa Interactivo */}
          <div className="wms-map-card" style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 600 }}>Plano Interactivo WMS (Distribución Física)</h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Hacé clic en cualquier slot o cámara para ver su stock real, lote y fecha de vencimiento.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  type="button"
                  className={`btn ${selectedWarehouse === 'D1' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.8rem', padding: '6px 14px', borderRadius: '6px', fontWeight: 600 }}
                  onClick={() => { setSelectedWarehouse('D1'); setSelectedMapLocation(''); }}
                >
                  🏢 Depósito 1 (10 x 20m)
                </button>
                <button 
                  type="button"
                  className={`btn ${selectedWarehouse === 'D2' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.8rem', padding: '6px 14px', borderRadius: '6px', fontWeight: 600 }}
                  onClick={() => { setSelectedWarehouse('D2'); setSelectedMapLocation(''); }}
                >
                  🏢 Depósito 2 (16 x 25m)
                </button>
                <button 
                  type="button"
                  className={`btn ${selectedWarehouse === 'D3' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.8rem', padding: '6px 14px', borderRadius: '6px', fontWeight: 600 }}
                  onClick={() => { setSelectedWarehouse('D3'); setSelectedMapLocation(''); }}
                >
                  🔄 Depósito 3 (10 x 10m)
                </button>
              </div>
            </div>
            
            <div className="wms-svg-wrapper" style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', backgroundColor: '#ffffff' }}>
              {selectedWarehouse === 'D1' && (
                <svg viewBox="0 0 850 500" width="100%" height="100%" style={{ maxHeight: '460px' }}>
                  {/* Fondo Depósito 1 */}
                  <rect x="0" y="0" width="850" height="500" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" rx="8" />
                  
                  {/* ZONA FRENTE: OFICINAS & RECEPCION / DESPACHO */}
                  <g>
                    <rect x="15" y="15" width="220" height="40" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" rx="4" />
                    <text x="25" y="40" fill="#334155" fontSize="10px" fontWeight="bold">OFICINA 1: ADMINISTRACIÓN</text>
                    
                    <rect x="245" y="15" width="150" height="40" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" rx="4" />
                    <text x="255" y="40" fill="#334155" fontSize="10px" fontWeight="bold">OFICINA 2: GERENCIA</text>
                    
                    <rect x="15" y="62" width="180" height="35" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" rx="4" />
                    <text x="25" y="83" fill="#475569" fontSize="9.5px" fontWeight="bold">RECEPCIÓN & ENTRADA</text>

                    <rect x="205" y="62" width="190" height="35" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" rx="4" />
                    <text x="215" y="83" fill="#475569" fontSize="9.5px" fontWeight="bold">ZONA DESPACHO Y CONTROL</text>
                  </g>

                  {/* CÁMARA 2 - FRÍO (REFRIGERADO 2° A 5°C - QUESOS Y FIAMBRES) */}
                  <g>
                    <rect x="410" y="15" width="425" height="220" fill="rgba(0, 122, 255, 0.04)" stroke="#007AFF" strokeWidth="2" rx="6" />
                    <text x="420" y="34" fill="#007AFF" fontSize="11px" fontWeight="bold">❄️ CÁMARA 2 FRÍO (QUESOS MELINCUÉ & REMOTTI)</text>
                    
                    {/* Racks Pared Izquierda */}
                    <text x="420" y="52" fill="#475569" fontSize="9px" fontWeight="bold">Rack Negro Izq:</text>
                    {[
                      { code: 'D1-CAM2-R01-A', label: 'R01-A (Tybo Pick)', x: 420, y: 58, w: 90, h: 26 },
                      { code: 'D1-CAM2-R01-B', label: 'R01-B (Tybo Pulmón)', x: 420, y: 88, w: 90, h: 26 },
                      { code: 'D1-CAM2-R02-A', label: 'R02-A (Gouda Pick)', x: 420, y: 122, w: 90, h: 26 },
                      { code: 'D1-CAM2-R02-B', label: 'R02-B (Gouda Pulmón)', x: 420, y: 152, w: 90, h: 26 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#007AFF' : '#ffffff'} stroke="#007AFF" strokeWidth={active ? 2 : 1} rx="3" />
                          <text x={slot.x + 6} y={slot.y + 17} fill={active ? '#ffffff' : '#007AFF'} fontSize="8.5px" fontWeight="bold">{slot.label}</text>
                        </g>
                      );
                    })}

                    {/* Slots de Piso Centrales */}
                    <text x="525" y="52" fill="#475569" fontSize="9px" fontWeight="bold">Slots de Piso Centrales:</text>
                    {[
                      { code: 'D1-CAM2-P01', label: 'P01 (Melincué Barra)', x: 525, y: 58, w: 180, h: 24 },
                      { code: 'D1-CAM2-P02', label: 'P02 (Melincué Mozzarella)', x: 525, y: 86, w: 180, h: 24 },
                      { code: 'D1-CAM2-P03', label: 'P03 (Cremoso Remotti)', x: 525, y: 114, w: 180, h: 24 },
                      { code: 'D1-CAM2-P04', label: 'P04 (Fiambres/Embutidos)', x: 525, y: 142, w: 180, h: 24 },
                      { code: 'D1-CAM2-P05', label: 'P05 (Queso Sardo)', x: 525, y: 170, w: 180, h: 24 },
                      { code: 'D1-CAM2-P06', label: 'P06 (Por Salut/Fresco)', x: 525, y: 198, w: 180, h: 24 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#0284c7' : '#f0f9ff'} stroke="#0284c7" strokeWidth={active ? 2 : 1} rx="3" />
                          <text x={slot.x + 8} y={slot.y + 16} fill={active ? '#ffffff' : '#0369a1'} fontSize="9px" fontWeight="bold">{slot.label}</text>
                        </g>
                      );
                    })}

                    {/* Racks Pared Derecha */}
                    <text x="715" y="52" fill="#475569" fontSize="9px" fontWeight="bold">Rack Negro Der:</text>
                    {[
                      { code: 'D1-CAM2-R03-A', label: 'R03-A (Fiambres)', x: 715, y: 58, w: 110, h: 26 },
                      { code: 'D1-CAM2-R03-B', label: 'R03-B (Fiambre Res)', x: 715, y: 88, w: 110, h: 26 },
                      { code: 'D1-CAM2-R04-A', label: 'R04-A (Mantecas)', x: 715, y: 122, w: 110, h: 26 },
                      { code: 'D1-CAM2-R04-B', label: 'R04-B (Manteca Res)', x: 715, y: 152, w: 110, h: 26 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#007AFF' : '#ffffff'} stroke="#007AFF" strokeWidth={active ? 2 : 1} rx="3" />
                          <text x={slot.x + 6} y={slot.y + 17} fill={active ? '#ffffff' : '#007AFF'} fontSize="8.5px" fontWeight="bold">{slot.label}</text>
                        </g>
                      );
                    })}
                  </g>

                  {/* CÁMARA 1 - FRÍO (LÁCTEOS FRESCOS Y FRACCIONADOS) */}
                  <g>
                    <rect x="410" y="250" width="220" height="235" fill="rgba(14, 165, 233, 0.04)" stroke="#0ea5e9" strokeWidth="2" rx="6" />
                    <text x="420" y="268" fill="#0284c7" fontSize="10.5px" fontWeight="bold">❄️ CÁMARA 1 FRÍO (LÁCTEOS)</text>
                    
                    <text x="420" y="285" fill="#475569" fontSize="8.5px" fontWeight="bold">Estantería Roja 5 Niveles:</text>
                    {[
                      { code: 'D1-CAM1-EST-N1', label: 'N1: Por Salut/Azul', y: 292 },
                      { code: 'D1-CAM1-EST-N2', label: 'N2: Quesos Potes', y: 316 },
                      { code: 'D1-CAM1-EST-N3', label: 'N3: Yogures Potes', y: 340 },
                      { code: 'D1-CAM1-EST-N4', label: 'N4: Postres/Sodecar', y: 364 },
                      { code: 'D1-CAM1-EST-N5', label: 'N5: Reposición Potes', y: 388 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x="420" y={slot.y} width={200} height="20" fill={active ? '#0ea5e9' : '#ffffff'} stroke="#0ea5e9" strokeWidth={active ? 2 : 1} rx="3" />
                          <text x="428" y={slot.y + 14} fill={active ? '#ffffff' : '#0284c7'} fontSize="8.5px" fontWeight="bold">{slot.label}</text>
                        </g>
                      );
                    })}

                    <text x="420" y="423" fill="#475569" fontSize="8.5px" fontWeight="bold">Slots Piso Mozzarella:</text>
                    {[
                      { code: 'D1-CAM1-P01', label: 'P01 Mozzarella', x: 420, y: 428, w: 96, h: 22 },
                      { code: 'D1-CAM1-P02', label: 'P02 Por Salut', x: 524, y: 428, w: 96, h: 22 },
                      { code: 'D1-CAM1-P03', label: 'P03 Sodecar', x: 420, y: 454, w: 96, h: 22 },
                      { code: 'D1-CAM1-P04', label: 'P04 Reserva', x: 524, y: 454, w: 96, h: 22 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#0284c7' : '#f0f9ff'} stroke="#0284c7" strokeWidth={active ? 2 : 1} rx="3" />
                          <text x={slot.x + 6} y={slot.y + 15} fill={active ? '#ffffff' : '#0369a1'} fontSize="8px" fontWeight="bold">{slot.label}</text>
                        </g>
                      );
                    })}
                  </g>

                  {/* CÁMARA 3 - SECO (CONSERVAS CUMANÁ Y ACEITES) */}
                  <g>
                    <rect x="645" y="250" width="190" height="235" fill="rgba(239, 68, 68, 0.04)" stroke="#ef4444" strokeWidth="2" rx="6" />
                    <text x="655" y="268" fill="#dc2626" fontSize="10.5px" fontWeight="bold">📦 CÁMARA 3 SECO (CUMANÁ)</text>

                    {[
                      { code: 'D1-CAM3-R01-A', label: 'R01-A: Cumaná Tomate Pick', y: 285 },
                      { code: 'D1-CAM3-R01-B', label: 'R01-B: Cumaná Reserva', y: 312 },
                      { code: 'D1-CAM3-EST-N1', label: 'EST-N1: Aceites Fraccionados', y: 339 },
                      { code: 'D1-CAM3-EST-N2', label: 'EST-N2: Fraccionado Seco', y: 366 },
                      { code: 'D1-CAM3-EST-N3', label: 'EST-N3: Galletitas/Especias', y: 393 },
                      { code: 'D1-CAM3-P01', label: 'P01: Pallet Conservas', y: 420 },
                      { code: 'D1-CAM3-P02', label: 'P02: Pallet Aceites Secos', y: 447 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x="655" y={slot.y} width="170" height="23" fill={active ? '#ef4444' : '#ffffff'} stroke="#ef4444" strokeWidth={active ? 2 : 1} rx="3" />
                          <text x="663" y={slot.y + 15} fill={active ? '#ffffff' : '#b91c1c'} fontSize="8.5px" fontWeight="bold">{slot.label}</text>
                        </g>
                      );
                    })}
                  </g>

                  {/* NAVE SECA ENTRADA: RACK 1 & ESTANTERÍA LICORES */}
                  <g>
                    <rect x="15" y="110" width="380" height="260" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 4" rx="6" />
                    <text x="25" y="128" fill="#334155" fontSize="11px" fontWeight="bold">📦 RACK 1 ENTRADA (HEAVY DUTY 3 NIVELES)</text>

                    {[
                      { code: 'D1-RACK1-M01-A', label: 'M01-A (Bebidas Pick)', x: 25, y: 140, w: 85, h: 32 },
                      { code: 'D1-RACK1-M01-B', label: 'M01-B (Reserva 1)', x: 25, y: 178, w: 85, h: 32 },
                      { code: 'D1-RACK1-M01-C', label: 'M01-C (Reserva 2)', x: 25, y: 216, w: 85, h: 32 },
                      
                      { code: 'D1-RACK1-M02-A', label: 'M02-A (Sernova Pick)', x: 118, y: 140, w: 85, h: 32 },
                      { code: 'D1-RACK1-M02-B', label: 'M02-B (Reserva 1)', x: 118, y: 178, w: 85, h: 32 },
                      { code: 'D1-RACK1-M02-C', label: 'M02-C (Reserva 2)', x: 118, y: 216, w: 85, h: 32 },
                      
                      { code: 'D1-RACK1-M03-A', label: 'M03-A (Vinos Pick)', x: 211, y: 140, w: 85, h: 32 },
                      { code: 'D1-RACK1-M03-B', label: 'M03-B (Reserva 1)', x: 211, y: 178, w: 85, h: 32 },
                      { code: 'D1-RACK1-M03-C', label: 'M03-C (Reserva 2)', x: 211, y: 216, w: 85, h: 32 },
                      
                      { code: 'D1-RACK1-M04-A', label: 'M04-A (Jugos Pick)', x: 304, y: 140, w: 85, h: 32 },
                      { code: 'D1-RACK1-M04-B', label: 'M04-B (Reserva 1)', x: 304, y: 178, w: 85, h: 32 },
                      { code: 'D1-RACK1-M04-C', label: 'M04-C (Reserva 2)', x: 304, y: 216, w: 85, h: 32 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#475569' : '#f8fafc'} stroke="#64748b" strokeWidth={active ? 2 : 1} rx="3" />
                          <text x={slot.x + 4} y={slot.y + 19} fill={active ? '#ffffff' : '#334155'} fontSize="8px" fontWeight="bold">{slot.label}</text>
                        </g>
                      );
                    })}

                    <text x="25" y="270" fill="#d97706" fontSize="10px" fontWeight="bold">🍾 ESTANTERÍA LICORES Y APERITIVOS:</text>
                    {[
                      { code: 'D1-EST-LIC-N1', label: 'LIC-N1: Botellas Aperitivos Alta Rotación', x: 25, y: 278, w: 364, h: 24 },
                      { code: 'D1-EST-LIC-N2', label: 'LIC-N2: Licores / Fernet / Aperitivos', x: 25, y: 306, w: 364, h: 24 },
                      { code: 'D1-EST-LIC-N3', label: 'LIC-N3: Botellas Sueltas & Packs Especiales', x: 25, y: 334, w: 364, h: 24 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#d97706' : '#fffbeb'} stroke="#f59e0b" strokeWidth={active ? 2 : 1} rx="3" />
                          <text x={slot.x + 10} y={slot.y + 16} fill={active ? '#ffffff' : '#b45309'} fontSize="9px" fontWeight="bold">{slot.label}</text>
                        </g>
                      );
                    })}
                  </g>

                  {/* BAÑOS & COCINA */}
                  <g>
                    <rect x="15" y="380" width="180" height="105" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" rx="4" />
                    <text x="25" y="405" fill="#475569" fontSize="10px" fontWeight="bold">🚾 BAÑOS Y COCINA</text>
                  </g>
                </svg>
              )}

              {selectedWarehouse === 'D2' && (
                <svg viewBox="0 0 850 500" width="100%" height="100%" style={{ maxHeight: '460px' }}>
                  <rect x="0" y="0" width="850" height="500" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" rx="8" />
                  <text x="25" y="30" fill="#5856D6" fontSize="13px" fontWeight="bold">🏢 DEPÓSITO 2 (16 X 25 METROS - PASTAS, ACEITES Y CONSERVAS)</text>

                  {/* RACKS ESTRUCTURALES AZULES */}
                  <g>
                    <rect x="25" y="50" width="380" height="420" fill="rgba(88, 86, 214, 0.04)" stroke="#5856D6" strokeWidth="2" rx="6" />
                    <text x="35" y="72" fill="#5856D6" fontSize="11px" fontWeight="bold">RACKS ESTRUCTURALES AZULES (CUMANÁ / PURE / CANAL SECO)</text>

                    {[
                      { code: 'D2-RACK-AZUL-M01-A', label: 'M01-A (Cumaná Tomate Pick)', x: 35, y: 88, w: 360, h: 32 },
                      { code: 'D2-RACK-AZUL-M01-B', label: 'M01-B (Cumaná Tomate Reserva)', x: 35, y: 126, w: 360, h: 32 },
                      { code: 'D2-RACK-AZUL-M01-C', label: 'M01-C (Cumaná Tomate Reserva Masiva)', x: 35, y: 164, w: 360, h: 32 },

                      { code: 'D2-RACK-AZUL-M02-A', label: 'M02-A (Latas Durazno/Ensalada Pick)', x: 35, y: 210, w: 360, h: 32 },
                      { code: 'D2-RACK-AZUL-M02-B', label: 'M02-B (Latas Reserva)', x: 35, y: 248, w: 360, h: 32 },
                      { code: 'D2-RACK-AZUL-M02-C', label: 'M02-C (Latas Reserva Masiva)', x: 35, y: 286, w: 360, h: 32 },

                      { code: 'D2-RACK-AZUL-M03-A', label: 'M03-A (Harinas / Arroz / Legumbres Pick)', x: 35, y: 332, w: 360, h: 32 },
                      { code: 'D2-RACK-AZUL-M03-B', label: 'M03-B (Harinas / Arroz Reserva)', x: 35, y: 370, w: 360, h: 32 },
                      { code: 'D2-RACK-AZUL-M03-C', label: 'M03-C (Harinas / Arroz Reserva Masiva)', x: 35, y: 408, w: 360, h: 32 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#5856D6' : '#ffffff'} stroke="#5856D6" strokeWidth={active ? 2 : 1} rx="4" />
                          <text x={slot.x + 12} y={slot.y + 20} fill={active ? '#ffffff' : '#4338ca'} fontSize="9.5px" fontWeight="bold">{slot.label}</text>
                        </g>
                      );
                    })}
                  </g>

                  {/* PATIO PISO FIDEOS 308 */}
                  <g>
                    <rect x="430" y="50" width="395" height="200" fill="#fdf4ff" stroke="#c084fc" strokeWidth="1.5" rx="6" />
                    <text x="440" y="72" fill="#9333ea" fontSize="11px" fontWeight="bold">🍝 PATIO DE PISO FIDEOS 308 & PASTAS</text>

                    {[
                      { code: 'D2-PISO-FID-01', label: 'FID-01: Fideos 308 Tallarín', x: 440, y: 85, w: 180, h: 42 },
                      { code: 'D2-PISO-FID-02', label: 'FID-02: Fideos 308 Guisero', x: 630, y: 85, w: 185, h: 42 },
                      { code: 'D2-PISO-FID-03', label: 'FID-03: Fideos 308 Moñito', x: 440, y: 135, w: 180, h: 42 },
                      { code: 'D2-PISO-FID-04', label: 'FID-04: Fideos 308 Nido', x: 630, y: 135, w: 185, h: 42 },
                      { code: 'D2-PISO-FID-05', label: 'FID-05: Fideos Reserva 1', x: 440, y: 185, w: 180, h: 42 },
                      { code: 'D2-PISO-FID-06', label: 'FID-06: Fideos Reserva 2', x: 630, y: 185, w: 185, h: 42 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#9333ea' : '#ffffff'} stroke="#c084fc" strokeWidth={active ? 2 : 1} rx="4" />
                          <text x={slot.x + 8} y={slot.y + 25} fill={active ? '#ffffff' : '#7e22ce'} fontSize="9.5px" fontWeight="bold">{slot.label}</text>
                        </g>
                      );
                    })}
                  </g>

                  {/* PATIO PISO ACEITES NATURA */}
                  <g>
                    <rect x="430" y="270" width="395" height="200" fill="#fefce8" stroke="#eab308" strokeWidth="1.5" rx="6" />
                    <text x="440" y="292" fill="#ca8a04" fontSize="11px" fontWeight="bold">🌻 PATIO DE PISO ACEITES NATURA & PESADOS</text>

                    {[
                      { code: 'D2-PISO-ACE-01', label: 'ACE-01: Aceite Natura 900ml', x: 440, y: 305, w: 180, h: 42 },
                      { code: 'D2-PISO-ACE-02', label: 'ACE-02: Aceite Natura 1.5L', x: 630, y: 305, w: 185, h: 42 },
                      { code: 'D2-PISO-ACE-03', label: 'ACE-03: Aceite Cañuelas', x: 440, y: 355, w: 180, h: 42 },
                      { code: 'D2-PISO-ACE-04', label: 'ACE-04: Aceite Mezcla / Bidón', x: 630, y: 355, w: 185, h: 42 },
                      { code: 'D2-PISO-ACE-05', label: 'ACE-05: Aceite Natura Res 1', x: 440, y: 405, w: 180, h: 42 },
                      { code: 'D2-PISO-ACE-06', label: 'ACE-06: Aceite Natura Res 2', x: 630, y: 405, w: 185, h: 42 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#ca8a04' : '#ffffff'} stroke="#eab308" strokeWidth={active ? 2 : 1} rx="4" />
                          <text x={slot.x + 8} y={slot.y + 25} fill={active ? '#ffffff' : '#854d0e'} fontSize="9.5px" fontWeight="bold">{slot.label}</text>
                        </g>
                      );
                    })}
                  </g>
                </svg>
              )}

              {selectedWarehouse === 'D3' && (
                <svg viewBox="0 0 850 500" width="100%" height="100%" style={{ maxHeight: '460px' }}>
                  <rect x="0" y="0" width="850" height="500" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" rx="8" />
                  <text x="25" y="30" fill="#FF2D55" fontSize="13px" fontWeight="bold">🔄 DEPÓSITO 3 (10 X 10 METROS - LECHES UAT & VOLUMINOSOS)</text>

                  {/* PATIO LECHES UAT CREMIGAL */}
                  <g>
                    <rect x="25" y="50" width="380" height="200" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.5" rx="6" />
                    <text x="35" y="72" fill="#1d4ed8" fontSize="11px" fontWeight="bold">🥛 PATIO LECHES UAT CREMIGAL</text>

                    {[
                      { code: 'D3-PISO-UAT-01', label: 'UAT-01: Leche Entera Sachet x LT', x: 35, y: 85, w: 175, h: 65 },
                      { code: 'D3-PISO-UAT-02', label: 'UAT-02: Leche Descremada Sachet', x: 220, y: 85, w: 175, h: 65 },
                      { code: 'D3-PISO-UAT-03', label: 'UAT-03: Leche Chocolatada', x: 35, y: 165, w: 175, h: 65 },
                      { code: 'D3-PISO-UAT-04', label: 'UAT-04: Leches UAT Reserva Masiva', x: 220, y: 165, w: 175, h: 65 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#2563eb' : '#ffffff'} stroke="#3b82f6" strokeWidth={active ? 2 : 1} rx="4" />
                          <text x={slot.x + 8} y={slot.y + 36} fill={active ? '#ffffff' : '#1e40af'} fontSize="9.5px" fontWeight="bold">{slot.label}</text>
                        </g>
                      );
                    })}
                  </g>

                  {/* PATIO PAPELERÍA Y VOLUMINOSOS */}
                  <g>
                    <rect x="25" y="270" width="380" height="200" fill="#fdf2f8" stroke="#ec4899" strokeWidth="1.5" rx="6" />
                    <text x="35" y="292" fill="#be185d" fontSize="11px" fontWeight="bold">📦 PATIO PAPELERÍA & VOLUMINOSOS (FELPITA / ROLMAYOR)</text>

                    {[
                      { code: 'D3-PISO-PAPEL-01', label: 'PAP-01: Papel Higiénico Felpita', x: 35, y: 305, w: 175, h: 65 },
                      { code: 'D3-PISO-PAPEL-02', label: 'PAP-02: Rollos Cocina RolMayor', x: 220, y: 305, w: 175, h: 65 },
                      { code: 'D3-PISO-PAPEL-03', label: 'PAP-03: Servilletas / Bobinas', x: 35, y: 385, w: 175, h: 65 },
                      { code: 'D3-PISO-PAPEL-04', label: 'PAP-04: Papelería Reserva', x: 220, y: 385, w: 175, h: 65 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#db2777' : '#ffffff'} stroke="#ec4899" strokeWidth={active ? 2 : 1} rx="4" />
                          <text x={slot.x + 8} y={slot.y + 36} fill={active ? '#ffffff' : '#9d174d'} fontSize="9.5px" fontWeight="bold">{slot.label}</text>
                        </g>
                      );
                    })}
                  </g>

                  {/* RACKS DE FONDO DEPÓSITO 3 */}
                  <g>
                    <rect x="430" y="50" width="395" height="420" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 4" rx="6" />
                    <text x="440" y="72" fill="#334155" fontSize="11px" fontWeight="bold">📦 RACKS DE FONDO DEPÓSITO 3 (STOCK RESERVA)</text>

                    {[
                      { code: 'D3-RACK-FONDO-M01-A', label: 'M01-A: Reserva Papelería / Fideos (Piso)', x: 440, y: 95, w: 375, h: 75 },
                      { code: 'D3-RACK-FONDO-M01-B', label: 'M01-B: Reserva Masiva Nivel 1 (Alto)', x: 440, y: 185, w: 375, h: 75 },
                      { code: 'D3-RACK-FONDO-M02-A', label: 'M02-A: Reserva Envases / Rollos (Piso)', x: 440, y: 275, w: 375, h: 75 },
                      { code: 'D3-RACK-FONDO-M02-B', label: 'M02-B: Reserva Masiva Nivel 2 (Alto)', x: 440, y: 365, w: 375, h: 75 },
                    ].map(slot => {
                      const active = selectedMapLocation === slot.code;
                      return (
                        <g key={slot.code} style={{ cursor: 'pointer' }} onClick={() => setSelectedMapLocation(active ? '' : slot.code)}>
                          <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={active ? '#475569' : '#ffffff'} stroke="#64748b" strokeWidth={active ? 2 : 1} rx="4" />
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
          <div className="wms-detail-card" style={{ width: '340px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', backgroundColor: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              📍 Detalle de Ubicación
            </h4>
            
            {selectedMapLocation ? (
              <div>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '6px', marginBottom: '14px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {selectedMapLocation}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {LOCATION_MAP[selectedMapLocation]?.description || 'Posición física en depósito'}
                  </div>
                </div>

                {/* Obtener lotes en este slot */}
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
                      <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>⚪</div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Slot Vacío / Disponible</div>
                        <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>No hay stock registrado en esta posición.</div>
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>STOCK REGISTRADO ({matchingProducts.length})</span>
                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>🟢 OCUPADO</span>
                      </div>

                      {matchingProducts.map(({ product, lot }, idx) => (
                        <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', backgroundColor: '#fafafa' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                            [{product.sku}] {product.name}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            <div>Lote: <strong style={{ color: 'var(--text-primary)' }}>{lot.lotNumber}</strong></div>
                            <div>Stock: <strong style={{ color: 'var(--color-primary)' }}>{lot.stock} un.</strong></div>
                            {lot.expirationDate && (
                              <div style={{ gridColumn: 'span 2' }}>
                                Vence: <strong style={{ color: '#d97706' }}>{new Date(lot.expirationDate).toLocaleDateString('es-AR')}</strong>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ width: '100%', marginTop: '8px', fontSize: '0.75rem', padding: '4px' }}
                            onClick={() => {
                              setStockModal({
                                open: true,
                                product: product,
                                quantityChange: 0,
                                reason: 'Ajuste desde Mapa WMS',
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
              <div style={{ padding: '40px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👆</div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Seleccioná una posición</div>
                <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Hacé clic en cualquier slot del mapa de la izquierda para inspeccionar.</div>
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

print("EXITO: Renderizado del Mapa WMS 2D interactivo reemplazado exitosamente.")
