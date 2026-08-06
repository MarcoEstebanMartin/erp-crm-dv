import json
import re

with open('scripts/excel_layout_clean.json', 'r', encoding='utf-8') as f:
    layout_data = json.load(f)

with open('scripts/exact_slots_intuitive.json', 'r', encoding='utf-8') as f:
    slots_data = json.load(f)

# Generar el nuevo código TSX para DepositoDashboard.tsx que hace que el Plano Gráfico 2D Fiel sea la vista PRINCIPAL Y ÚNICA, filtrable por Depósito 1, 2 y 3.
primary_wms_view = '''      {subTab === 'wms-map' && !selectedOrder && !showConsolidatedView && (
        <div className="wms-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header Principal con Filtros de Depósito */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>🗺️ Plano Gráfico 2D de Depósito (WMS Fiel a Excel)</h4>
                <span className="badge badge-success" style={{ fontSize: '0.75rem', padding: '3px 10px' }}>209 Slots Físicos Exactos</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                Disposición geométrica real de naves, cámaras y pasillos. Hacé clic en cualquier celda A, A-B o A-B-C para gestionar el stock.
              </p>
            </div>

            {/* Selector de Depósitos y Pantalla Completa */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.82rem', padding: '7px 14px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => setSelectedWarehouse('ALL')}
              >
                🌐 Planta Completa (209 Slots)
              </button>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'D1' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.82rem', padding: '7px 14px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => setSelectedWarehouse('D1')}
              >
                🏢 Depósito 1 (44 Slots)
              </button>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'D2' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.82rem', padding: '7px 14px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => setSelectedWarehouse('D2')}
              >
                🏢 Depósito 2 (123 Slots)
              </button>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'D3' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.82rem', padding: '7px 14px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => setSelectedWarehouse('D3')}
              >
                🔄 Depósito 3 (42 Slots)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '7px 14px', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setIsMapModalOpen(true)}
              >
                🖥️ Ampliar Pantalla Completa
              </button>
            </div>
          </div>

          {/* Leyenda de Sectores */}
          <div style={{ padding: '8px 20px', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', gap: '16px', fontSize: '0.78rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Delimitación de Sectores:</span>
            <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#e0f2fe', border: '1.5px solid #0284c7', color: '#0369a1', fontWeight: 600 }}>❄️ Cámara 2 Frío</span>
            <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#ecfeff', border: '1.5px solid #0891b2', color: '#0e7490', fontWeight: 600 }}>❄️ Cámara 1 Frío</span>
            <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#f3e8ff', border: '1.5px solid #7e22ce', color: '#6b21a8', fontWeight: 600 }}>📦 Cámara 3 Seco</span>
            <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#fce7f3', border: '1.5px solid #f43f5e', color: '#881337', fontWeight: 600 }}>🏢 Oficinas & Servicios</span>
            <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Mostrando: {selectedWarehouse === 'ALL' ? 'Todos los Depósitos' : (selectedWarehouse === 'D1' ? 'Depósito 1 (10 x 20m)' : selectedWarehouse === 'D2' ? 'Depósito 2 (16 x 25m)' : 'Depósito 3 (10 x 10m)')}
            </span>
          </div>

          {/* Vista Principal Única del Plano Gráfico 2D + Ficha Lateral */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            
            {/* Contenedor del Mapa Gráfico Fiel con Filtro por Depósito */}
            <div style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '20px', overflowX: 'auto' }}>
              <div style={{
                display: 'inline-block',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '16px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)'
              }}>
                <table style={{ borderCollapse: 'separate', borderSpacing: '2px', fontSize: '0.68rem', fontFamily: 'sans-serif' }}>
                  <tbody>
                    {(() => {
                      // Filtrar filas de la matriz según el depósito seleccionado
                      const allRows = ''' + json.dumps(layout_data['matrix'], ensure_ascii=False) + ''';
                      let filteredRows = allRows;

                      if (selectedWarehouse === 'D1') {
                        // Depósito 1: Filas 1 a 20, Columnas 1 a 19
                        filteredRows = allRows.slice(0, 20).map((row: any[]) => row.slice(0, 19));
                      } else if (selectedWarehouse === 'D2') {
                        // Depósito 2: Filas 1 a 27, Columnas 20 a 45
                        filteredRows = allRows.slice(0, 27).map((row: any[]) => row.slice(19, 45));
                      } else if (selectedWarehouse === 'D3') {
                        // Depósito 3: Filas 21 a 33, Columnas 14 a 32
                        filteredRows = allRows.slice(20, 33).map((row: any[]) => row.slice(14, 32));
                      }

                      return filteredRows.map((row: any[], rIdx: number) => (
                        <tr key={rIdx}>
                          {row.map((cell: any, cIdx: number) => {
                            const isSlot = cell.is_storage;
                            const cellText = cell.val;
                            
                            // Estilos de sala
                            let bg = '#ffffff';
                            let color = '#334155';
                            let border = '1px solid #e2e8f0';

                            if (cellText.includes('OFICINA') || cellText.includes('BAÑO') || cellText.includes('COCINA')) {
                              bg = '#fce7f3'; color = '#881337'; border = '2px solid #f43f5e';
                            } else if (cellText.includes('RECEPCION') || cellText.includes('DESPACHO') || cellText.includes('vereda')) {
                              bg = '#f1f5f9'; color = '#1e293b'; border = '2px solid #64748b';
                            } else if (cellText.includes('CAMARA 2')) {
                              bg = '#e0f2fe'; color = '#0369a1'; border = '2.5px solid #0284c7';
                            } else if (cellText.includes('CAMARA 1')) {
                              bg = '#ecfeff'; color = '#0e7490'; border = '2.5px solid #0891b2';
                            } else if (cellText.includes('CAMARA 3')) {
                              bg = '#f3e8ff'; color = '#6b21a8'; border = '2.5px solid #7e22ce';
                            } else if (cellText.includes('DEPOSITO')) {
                              bg = '#ffffff'; color = '#0f172a'; border = 'none';
                            }

                            if (isSlot) {
                              if (cellText === 'A') { bg = '#ffffff'; color = '#334155'; border = '1px solid #94a3b8'; }
                              else if (cellText === 'A-B') { bg = '#fef3c7'; color = '#92400e'; border = '1.5px solid #f59e0b'; }
                              else if (cellText === 'A-B-C') { bg = '#dbeafe'; color = '#1e40af'; border = '1.5px solid #3b82f6'; }
                              else if (cellText === 'A-B-C-D-E-F') { bg = '#dcfce7'; color = '#166534'; border = '2px solid #22c55e'; }
                            }

                            let hasStock = false;
                            let foundSlotObj: any = null;
                            if (isSlot) {
                              foundSlotObj = ''' + json.dumps(slots_data['all_slots'], ensure_ascii=False) + '''.find((s: any) => s.row === cell.r && s.col === cell.c);
                              if (foundSlotObj) {
                                allProducts.forEach(p => {
                                  if (p.lots && p.lots.length > 0) {
                                    p.lots.forEach((l: any) => {
                                      if ((l.location === foundSlotObj.code || l.location.startsWith(foundSlotObj.code)) && l.stock > 0) hasStock = true;
                                    });
                                  } else if (p.defaultLocation === foundSlotObj.code && p.stock > 0) {
                                    hasStock = true;
                                  }
                                });
                              }
                            }

                            const isSelected = selectedSlot && foundSlotObj && selectedSlot.code === foundSlotObj.code;

                            return (
                              <td
                                key={cIdx}
                                onClick={() => {
                                  if (isSlot && foundSlotObj) {
                                    setSelectedSlot(foundSlotObj);
                                    setSelectedMapLocation(foundSlotObj.code);
                                  }
                                }}
                                style={{
                                  border: isSlot 
                                    ? (isSelected ? '2.5px solid #007AFF' : hasStock ? '2px solid #22c55e' : border) 
                                    : border,
                                  backgroundColor: isSelected ? '#e0f2fe' : hasStock ? '#dcfce7' : bg,
                                  color: isSelected ? '#007AFF' : hasStock ? '#15803d' : color,
                                  fontWeight: isSlot || cellText.length > 2 ? 'bold' : 'normal',
                                  padding: '4px 6px',
                                  textAlign: 'center',
                                  minWidth: isSlot ? '38px' : '26px',
                                  height: '30px',
                                  cursor: isSlot ? 'pointer' : 'default',
                                  userSelect: 'none',
                                  whiteSpace: 'nowrap',
                                  borderRadius: isSlot ? '4px' : '2px'
                                }}
                                title={isSlot && foundSlotObj ? `${foundSlotObj.code} - ${foundSlotObj.sector}` : cellText}
                              >
                                {isSlot ? (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                    <span>{cellText}</span>
                                    {hasStock && <span style={{ color: '#22c55e', fontSize: '0.65rem' }}>🟢</span>}
                                  </div>
                                ) : (
                                  cellText
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Panel Lateral de Inspección y Carga de Stock */}
            <div style={{ width: '380px', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                📍 Detalle de Slot Seleccionado
              </h4>

              {selectedSlot ? (
                <div>
                  <div style={{ backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '8px', marginBottom: '14px', border: '1px solid #cbd5e1' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {selectedSlot.code}
                    </div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#2563eb', marginBottom: '2px' }}>
                      📍 Sector: {selectedSlot.sector}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {selectedSlot.deposito} (Fila {selectedSlot.row}, Columna {selectedSlot.col} de Excel). Nivel: <strong>{selectedSlot.nivel}</strong>.
                    </div>
                  </div>

                  {(() => {
                    const matchingProducts: { product: any; lot: any }[] = [];
                    allProducts.forEach(p => {
                      if (p.lots && p.lots.length > 0) {
                        p.lots.forEach((l: any) => {
                          if ((l.location === selectedSlot.code || l.location.startsWith(selectedSlot.code)) && l.stock > 0) {
                            matchingProducts.push({ product: p, lot: l });
                          }
                        });
                      } else if (p.defaultLocation === selectedSlot.code && p.stock > 0) {
                        matchingProducts.push({ product: p, lot: { lotNumber: 'S/L', stock: p.stock } });
                      }
                    });

                    if (matchingProducts.length === 0) {
                      return (
                        <div style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>⚪</div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Slot Vacío (Disponible)</div>
                          <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                            Posición sin productos asignados. Queda lista para la carga inicial.
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '14px', fontSize: '0.82rem', padding: '8px 14px', fontWeight: 600 }}
                            onClick={() => setIsMapModalOpen(true)}
                          >
                            ➕ Cargar Mercadería en este Slot
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>MERCADERÍA ASIGNADA</span>
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
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ width: '100%', marginTop: '6px', fontSize: '0.8rem', padding: '7px 12px' }}
                          onClick={() => setIsMapModalOpen(true)}
                        >
                          ✏️ Modificar / Cargar Más Stock
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div style={{ padding: '40px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👆</div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Seleccioná un recuadro A, A-B o A-B-C</div>
                  <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Hacé clic en cualquier celda del plano para ver su estado.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}'''

dashboard_path = 'frontend/src/components/DepositoDashboard.tsx'

with open(dashboard_path, 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'\{subTab === \'wms-map\' && !selectedOrder && !showConsolidatedView && \(.*?\n      \)\}'
updated_content = re.sub(pattern, primary_wms_view, content, flags=re.DOTALL)

with open(dashboard_path, 'w', encoding='utf-8') as f:
    f.write(updated_content)

print("EXITO: Plano Gráfico 2D Fiel instalado como VISTA PRINCIPAL ÚNICA con filtros por Depósito 1, 2 y 3.")
