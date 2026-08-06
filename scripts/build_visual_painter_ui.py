import json
import re

with open('scripts/depositomapa_layout.json', 'r', encoding='utf-8') as f:
    layout_data = json.load(f)

with open('scripts/depositomapa_exact_chambers.json', 'r', encoding='utf-8') as f:
    slots_data = json.load(f)

dashboard_path = 'frontend/src/components/DepositoDashboard.tsx'

with open(dashboard_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Import de SimpleStockLoadModal e Iconos extra si se requieren
if 'import SimpleStockLoadModal' not in content:
    content = content.replace(
        "import ExcelSpatialMapModal from './ExcelSpatialMapModal';",
        "import ExcelSpatialMapModal from './ExcelSpatialMapModal';\nimport SimpleStockLoadModal from './SimpleStockLoadModal';"
    )

# 2. Agregar estados del Editor Visual de Mapa si no existen
states_to_add = '''  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  
  // Estado del Editor Visual de Mapa y Sectores
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeBrush, setActiveBrush] = useState<string>('ESTANTERIA');
  const [chamberMap, setChamberMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('wms_custom_chamber_map_v2');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [slotTypeMap, setSlotTypeMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('wms_custom_slottype_map_v2');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });'''

if 'const [isEditMode, setIsEditMode] = useState' not in content:
    content = content.replace("const [isMapModalOpen, setIsMapModalOpen] = useState(false);", states_to_add)

# 3. Código JSX del componente WMS con el Editor Visual Incorporado
wms_painter_jsx = '''      {subTab === 'wms-map' && !selectedOrder && !showConsolidatedView && (
        <div className="wms-container" style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
          {/* Header Principal Responsivo */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>🗺️ Plano Gráfico 2D de Depósito (WMS Interactivo)</h4>
                <span className="badge badge-success" style={{ fontSize: '0.72rem', padding: '3px 9px' }}>210 Slots Limpios</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Hacé clic en las cámaras para filtrar o activá el <strong>Modo Edición 🎨</strong> para pintar y reasignar sectores manualmente.
              </p>
            </div>

            {/* Selector de Depósitos, Modo Edición y Pantalla Completa */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn ${isEditMode ? 'btn-danger' : 'btn-outline'}`}
                style={{
                  fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px', fontWeight: 700,
                  backgroundColor: isEditMode ? '#be185d' : '#fdf2f8',
                  color: isEditMode ? '#ffffff' : '#be185d',
                  border: '1.5px solid #be185d',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: isEditMode ? '0 0 10px rgba(190, 24, 93, 0.35)' : 'none'
                }}
                onClick={() => setIsEditMode(!isEditMode)}
              >
                <span>{isEditMode ? '❌ Salir Modo Edición' : '🎨 Modo Edición / Pintar Sectores'}</span>
              </button>

              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => { setSelectedWarehouse('ALL'); setSelectedSector('ALL'); }}
              >
                🌐 Planta Completa
              </button>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'D1' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => { setSelectedWarehouse('D1'); setSelectedSector('ALL'); }}
              >
                🏢 Depósito 1
              </button>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'D2' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => { setSelectedWarehouse('D2'); setSelectedSector('ALL'); }}
              >
                🏢 Depósito 2
              </button>
              <button 
                type="button"
                className={`btn ${selectedWarehouse === 'D3' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => { setSelectedWarehouse('D3'); setSelectedSector('ALL'); }}
              >
                🔄 Depósito 3
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setIsMapModalOpen(true)}
              >
                🖥️ Pantalla Completa
              </button>
            </div>
          </div>

          {/* PALETA DE PINCELES EN MODO EDICIÓN */}
          {isEditMode ? (
            <div style={{
              padding: '12px 18px', backgroundColor: '#fff1f2', border: '1.5px solid #fda4af', borderRadius: '8px',
              display: 'flex', gap: '10px', fontSize: '0.8rem', flexWrap: 'wrap', alignItems: 'center',
              boxShadow: '0 4px 12px rgba(244, 63, 94, 0.08)'
            }}>
              <div style={{ fontWeight: 800, color: '#9f1239', marginRight: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>🖌️ Elegir Pincel para Pintar Slots:</span>
              </div>

              {[
                { id: 'ESTANTERIA', label: '📦 Estanterías', bg: '#be185d', text: '#fff', border: '#be185d' },
                { id: 'RACK_ENTRADA', label: '🚪 Rack Entrada', bg: '#d97706', text: '#fff', border: '#d97706' },
                { id: 'CAMARA_2', label: '❄️ Cámara 2 Frío', bg: '#0284c7', text: '#fff', border: '#0284c7' },
                { id: 'CAMARA_1', label: '❄️ Cámara 1 Frío', bg: '#0891b2', text: '#fff', border: '#0891b2' },
                { id: 'CAMARA_3', label: '📦 Cámara 3 Seco', bg: '#7e22ce', text: '#fff', border: '#7e22ce' },
                { id: 'BANO', label: '🚻 Baño', bg: '#e11d48', text: '#fff', border: '#e11d48' },
                { id: 'GENERAL', label: '⚪ Sin Sector (General)', bg: '#64748b', text: '#fff', border: '#64748b' },
                { id: 'TOGGLE_LEVEL', label: '🔲 Cambiar Nivel (A/A-B/A-B-C)', bg: '#0f172a', text: '#fff', border: '#0f172a' }
              ].map(brush => (
                <button
                  key={brush.id}
                  type="button"
                  className="btn btn-sm"
                  style={{
                    backgroundColor: activeBrush === brush.id ? brush.bg : '#ffffff',
                    color: activeBrush === brush.id ? brush.text : brush.bg,
                    border: `1.5px solid ${brush.border}`,
                    fontWeight: 700, fontSize: '0.78rem', padding: '5px 11px', borderRadius: '6px',
                    boxShadow: activeBrush === brush.id ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
                    transform: activeBrush === brush.id ? 'scale(1.04)' : 'scale(1)',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => setActiveBrush(brush.id)}
                >
                  {brush.label}
                </button>
              ))}

              <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  style={{ fontSize: '0.74rem', padding: '4px 10px', fontWeight: 600 }}
                  onClick={() => {
                    if (window.confirm('¿Seguro que deseas restablecer la distribución a los valores por defecto del Excel?')) {
                      localStorage.removeItem('wms_custom_chamber_map_v2');
                      localStorage.removeItem('wms_custom_slottype_map_v2');
                      setChamberMap({});
                      setSlotTypeMap({});
                    }
                  }}
                >
                  🔄 Restablecer a Excel Original
                </button>
              </div>
            </div>
          ) : (
            /* Botones Interactivos Normales para Seleccionar Cámaras Exactas */
            <div style={{ padding: '10px 16px', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', gap: '8px', fontSize: '0.78rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginRight: '4px' }}>Seleccionar Sector / Cámara:</span>
              
              <button
                type="button"
                className={`btn btn-sm ${selectedSector === 'ESTANTERIA' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ backgroundColor: selectedSector === 'ESTANTERIA' ? '#be185d' : '#fce7f3', color: selectedSector === 'ESTANTERIA' ? '#fff' : '#9d174d', border: '1.5px solid #be185d', fontWeight: 600, fontSize: '0.78rem' }}
                onClick={() => { setSelectedSector(selectedSector === 'ESTANTERIA' ? 'ALL' : 'ESTANTERIA'); setSelectedWarehouse('D1'); }}
              >
                📦 Estanterías
              </button>

              <button
                type="button"
                className={`btn btn-sm ${selectedSector === 'RACK_ENTRADA' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ backgroundColor: selectedSector === 'RACK_ENTRADA' ? '#d97706' : '#fef3c7', color: selectedSector === 'RACK_ENTRADA' ? '#fff' : '#92400e', border: '1.5px solid #d97706', fontWeight: 600, fontSize: '0.78rem' }}
                onClick={() => { setSelectedSector(selectedSector === 'RACK_ENTRADA' ? 'ALL' : 'RACK_ENTRADA'); setSelectedWarehouse('D1'); }}
              >
                🚪 Rack Entrada
              </button>

              <button
                type="button"
                className={`btn btn-sm ${selectedSector === 'CAMARA_2' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ backgroundColor: selectedSector === 'CAMARA_2' ? '#0284c7' : '#e0f2fe', color: selectedSector === 'CAMARA_2' ? '#fff' : '#0369a1', border: '1.5px solid #0284c7', fontWeight: 600, fontSize: '0.78rem' }}
                onClick={() => { setSelectedSector(selectedSector === 'CAMARA_2' ? 'ALL' : 'CAMARA_2'); setSelectedWarehouse('D1'); }}
              >
                ❄️ Cámara 2 Frío (Quesos)
              </button>

              <button
                type="button"
                className={`btn btn-sm ${selectedSector === 'CAMARA_1' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ backgroundColor: selectedSector === 'CAMARA_1' ? '#0891b2' : '#ecfeff', color: selectedSector === 'CAMARA_1' ? '#fff' : '#0e7490', border: '1.5px solid #0891b2', fontWeight: 600, fontSize: '0.78rem' }}
                onClick={() => { setSelectedSector(selectedSector === 'CAMARA_1' ? 'ALL' : 'CAMARA_1'); setSelectedWarehouse('D1'); }}
              >
                ❄️ Cámara 1 Frío (Lácteos)
              </button>

              <button
                type="button"
                className={`btn btn-sm ${selectedSector === 'CAMARA_3' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ backgroundColor: selectedSector === 'CAMARA_3' ? '#7e22ce' : '#f3e8ff', color: selectedSector === 'CAMARA_3' ? '#fff' : '#6b21a8', border: '1.5px solid #7e22ce', fontWeight: 600, fontSize: '0.78rem' }}
                onClick={() => { setSelectedSector(selectedSector === 'CAMARA_3' ? 'ALL' : 'CAMARA_3'); setSelectedWarehouse('D1'); }}
              >
                📦 Cámara 3 Seco (Conservas)
              </button>

              <button
                type="button"
                className={`btn btn-sm ${selectedSector === 'BANO' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ backgroundColor: selectedSector === 'BANO' ? '#e11d48' : '#ffe4e6', color: selectedSector === 'BANO' ? '#fff' : '#9f1239', border: '1.5px solid #e11d48', fontWeight: 600, fontSize: '0.78rem' }}
                onClick={() => { setSelectedSector(selectedSector === 'BANO' ? 'ALL' : 'BANO'); setSelectedWarehouse('D1'); }}
              >
                🚻 Baño
              </button>

              <button
                type="button"
                className={`btn btn-sm ${selectedSector === 'ALL' ? 'btn-secondary' : 'btn-outline'}`}
                style={{ fontSize: '0.75rem', marginLeft: 'auto' }}
                onClick={() => setSelectedSector('ALL')}
              >
                🔄 Limpiar Selección
              </button>
            </div>
          )}

          {/* Vista Principal Ajustada 100% Responsiva Sin Cortar */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', width: '100%' }}>
            
            {/* Contenedor del Mapa con Ajuste Responsivo Fluido */}
            <div style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', overflowX: 'auto', maxWidth: '100%' }}>
              <div style={{
                display: 'block',
                width: '100%',
                backgroundColor: '#ffffff',
                border: isEditMode ? '2px dashed #f43f5e' : '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '10px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
              }}>
                <table style={{ borderCollapse: 'separate', borderSpacing: '1.5px', width: '100%', tableLayout: 'fixed', fontSize: '0.65rem', fontFamily: 'sans-serif' }}>
                  <tbody>
                    {(() => {
                      const allRows = ''' + json.dumps(layout_data['matrix'], ensure_ascii=False) + ''';
                      let filteredRows = allRows;

                      if (selectedWarehouse === 'D1') {
                        filteredRows = allRows.slice(0, 11);
                      } else if (selectedWarehouse === 'D2') {
                        filteredRows = allRows.slice(11, 27);
                      } else if (selectedWarehouse === 'D3') {
                        filteredRows = allRows.slice(27, 39);
                      }

                      const defaultSlots = ''' + json.dumps(slots_data['all_slots'], ensure_ascii=False) + ''';

                      return filteredRows.map((row: any[], rIdx: number) => (
                        <tr key={rIdx}>
                          {row.map((cell: any, cIdx: number) => {
                            const isSlot = cell.is_storage;
                            const rStr = cell.r < 10 ? '0' + cell.r : cell.r;
                            const cStr = cell.c < 10 ? '0' + cell.c : cell.c;
                            const cellPosKey = `${cell.dep_id}-R${rStr}-C${cStr}`;
                            
                            let cellText = cell.val;
                            if (slotTypeMap[cellPosKey]) {
                              cellText = slotTypeMap[cellPosKey];
                            }

                            let bg = '#ffffff';
                            let color = '#334155';
                            let border = '1px solid #e2e8f0';

                            if (cellText.includes('BAÑO')) {
                              bg = '#fce7f3'; color = '#881337'; border = '1.5px solid #f43f5e';
                            } else if (cellText.includes('CAMARA 2')) {
                              bg = '#e0f2fe'; color = '#0369a1'; border = '2px solid #0284c7';
                            } else if (cellText.includes('CAMARA 1')) {
                              bg = '#ecfeff'; color = '#0e7490'; border = '2px solid #0891b2';
                            } else if (cellText.includes('CAMARA 3')) {
                              bg = '#f3e8ff'; color = '#6b21a8'; border = '2px solid #7e22ce';
                            }

                            if (isSlot) {
                              if (cellText === 'A') { bg = '#ffffff'; color = '#334155'; border = '1px solid #94a3b8'; }
                              else if (cellText === 'A-B') { bg = '#fef3c7'; color = '#92400e'; border = '1.5px solid #f59e0b'; }
                              else if (cellText === 'A-B-C') { bg = '#dbeafe'; color = '#1e40af'; border = '1.5px solid #3b82f6'; }
                              else if (cellText === 'A-B-C-D-E-F') { bg = '#dcfce7'; color = '#166534'; border = '2px solid #22c55e'; }
                            }

                            let hasStock = false;
                            let foundSlotObj: any = defaultSlots.find((s: any) => s.row === cell.r && s.col === cell.c);
                            if (foundSlotObj) {
                              const effChamber = chamberMap[cellPosKey] || foundSlotObj.chamber;
                              foundSlotObj = { ...foundSlotObj, chamber: effChamber, nivel: cellText };

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

                            const currentChamber = chamberMap[cellPosKey] || (foundSlotObj ? foundSlotObj.chamber : 'GENERAL');
                            const isChamberSelected = selectedSector !== 'ALL' && currentChamber === selectedSector;
                            const isSelected = selectedSlot && foundSlotObj && selectedSlot.code === foundSlotObj.code;

                            // Colores de sector en modo edición o filtrado
                            if (currentChamber === 'ESTANTERIA') {
                              bg = '#fce7f3'; color = '#be185d'; border = '1.5px solid #be185d';
                            } else if (currentChamber === 'RACK_ENTRADA') {
                              bg = '#fef3c7'; color = '#d97706'; border = '1.5px solid #d97706';
                            } else if (currentChamber === 'CAMARA_2') {
                              bg = '#e0f2fe'; color = '#0284c7'; border = '1.5px solid #0284c7';
                            } else if (currentChamber === 'CAMARA_1') {
                              bg = '#ecfeff'; color = '#0891b2'; border = '1.5px solid #0891b2';
                            } else if (currentChamber === 'CAMARA_3') {
                              bg = '#f3e8ff'; color = '#7e22ce'; border = '1.5px solid #7e22ce';
                            } else if (currentChamber === 'BANO') {
                              bg = '#ffe4e6'; color = '#e11d48'; border = '1.5px solid #e11d48';
                            }

                            return (
                              <td
                                key={cIdx}
                                onClick={() => {
                                  if (isEditMode) {
                                    // MODO EDICIÓN: PINTAR O CAMBIAR NIVEL
                                    if (activeBrush === 'TOGGLE_LEVEL') {
                                      const levelsSeq = ['A', 'A-B', 'A-B-C', 'A-B-C-D-E-F'];
                                      const curIdx = levelsSeq.indexOf(cellText);
                                      const nextNivel = curIdx === -1 || curIdx === levelsSeq.length - 1 ? 'A' : levelsSeq[curIdx + 1];
                                      const newTypeMap = { ...slotTypeMap, [cellPosKey]: nextNivel };
                                      setSlotTypeMap(newTypeMap);
                                      localStorage.setItem('wms_custom_slottype_map_v2', JSON.stringify(newTypeMap));
                                    } else {
                                      const newChamberMap = { ...chamberMap, [cellPosKey]: activeBrush };
                                      setChamberMap(newChamberMap);
                                      localStorage.setItem('wms_custom_chamber_map_v2', JSON.stringify(newChamberMap));
                                    }
                                  } else {
                                    // MODO INSPECCIÓN NORMAL
                                    if (isSlot && foundSlotObj) {
                                      setSelectedSlot(foundSlotObj);
                                      setSelectedMapLocation(foundSlotObj.code);
                                    }
                                  }
                                }}
                                onDoubleClick={() => {
                                  if (!isEditMode && isSlot && foundSlotObj) {
                                    setSelectedSlot(foundSlotObj);
                                    setIsSimpleStockModalOpen(true);
                                  }
                                }}
                                style={{
                                  border: isSelected 
                                    ? '2.5px solid #007AFF' 
                                    : isChamberSelected 
                                    ? '2.5px solid #be185d' 
                                    : hasStock 
                                    ? '2px solid #22c55e' 
                                    : border,
                                  backgroundColor: isSelected 
                                    ? '#e0f2fe' 
                                    : isChamberSelected 
                                    ? '#fbcfe8' 
                                    : hasStock 
                                    ? '#dcfce7' 
                                    : bg,
                                  color: isSelected ? '#007AFF' : isChamberSelected ? '#831843' : hasStock ? '#15803d' : color,
                                  fontWeight: isSlot || cellText.length > 2 ? 'bold' : 'normal',
                                  padding: '2px 3px',
                                  textAlign: 'center',
                                  height: '28px',
                                  cursor: isEditMode ? 'crosshair' : (isSlot ? 'pointer' : 'default'),
                                  userSelect: 'none',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  borderRadius: isSlot ? '3px' : '1px',
                                  boxShadow: isEditMode ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                                }}
                                title={isEditMode ? `Pintar ${cellPosKey} con ${activeBrush}` : (isSlot && foundSlotObj ? `${foundSlotObj.code} (${foundSlotObj.deposito} - ${currentChamber})` : cellText)}
                              >
                                {isSlot ? (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                    <span>{cellText}</span>
                                    {hasStock && <span style={{ color: '#22c55e', fontSize: '0.6rem' }}>🟢</span>}
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
            <div style={{ width: '350px', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                📍 {isEditMode ? 'Pintador de Sectores Activo' : 'Detalle de Selección'}
              </h4>

              {isEditMode ? (
                <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fda4af', padding: '14px', borderRadius: '8px', marginBottom: '12px' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#9f1239', marginBottom: '6px' }}>
                    🎨 Pincel Seleccionado:
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#be185d', marginBottom: '8px' }}>
                    {activeBrush === 'ESTANTERIA' && '📦 Estanterías (Rosa)'}
                    {activeBrush === 'RACK_ENTRADA' && '🚪 Rack Entrada (Naranja)'}
                    {activeBrush === 'CAMARA_2' && '❄️ Cámara 2 Frío - Quesos (Azul)'}
                    {activeBrush === 'CAMARA_1' && '❄️ Cámara 1 Frío - Lácteos (Cyan)'}
                    {activeBrush === 'CAMARA_3' && '📦 Cámara 3 Seco - Conservas (Púrpura)'}
                    {activeBrush === 'BANO' && '🚻 Baño (Rosa Suave)'}
                    {activeBrush === 'GENERAL' && '⚪ Sin Sector (Gris)'}
                    {activeBrush === 'TOGGLE_LEVEL' && '🔲 Alternar Nivel (A -> A-B -> A-B-C)'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#be185d', lineHeight: '1.4' }}>
                    Hacé clic en cualquier casilla de la grilla para asignarle este sector o tipo al instante. Los cambios quedan guardados automáticamente.
                  </div>
                </div>
              ) : (
                selectedSector !== 'ALL' && !selectedSlot && (
                  <div style={{ backgroundColor: '#fce7f3', border: '1px solid #fbcfe8', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#9d174d', marginBottom: '4px' }}>
                      {selectedSector === 'ESTANTERIA' && '📦 Estanterías generales'}
                      {selectedSector === 'RACK_ENTRADA' && '🚪 Rack Entrada'}
                      {selectedSector === 'CAMARA_2' && '❄️ Cámara 2 Frío - Quesos'}
                      {selectedSector === 'CAMARA_1' && '❄️ Cámara 1 Frío - Lácteos'}
                      {selectedSector === 'CAMARA_3' && '📦 Cámara 3 Seco - Conservas'}
                      {selectedSector === 'BANO' && '🚻 Baño'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#be185d' }}>
                      Los slots exactos de este sector están resaltados. Tocá cualquier slot para inspeccionar o cargar productos.
                    </div>
                  </div>
                )
              )}

              {selectedSlot && !isEditMode ? (
                <div>
                  <div style={{ backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '8px', marginBottom: '14px', border: '1px solid #cbd5e1' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.02rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {selectedSlot.code}
                    </div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#2563eb', marginBottom: '2px' }}>
                      📍 {selectedSlot.deposito} - Sector: <span style={{ color: '#be185d' }}>{selectedSlot.chamber}</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Fila {selectedSlot.row}, Columna {selectedSlot.col} de depositomapa.xlsx. Nivel: <strong>{selectedSlot.nivel}</strong>.
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
                        <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          <div style={{ fontSize: '2rem', marginBottom: '6px' }}>⚪</div>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Slot Vacío (Disponible)</div>
                          <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                            Posición sin productos asignados.
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '14px', fontSize: '0.84rem', padding: '9px 14px', fontWeight: 700, borderRadius: '8px' }}
                            onClick={() => setIsSimpleStockModalOpen(true)}
                          >
                            ➕ Cargar Mercadería en este Slot
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>MERCADERÍA ASIGNADA</span>
                          <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>🟢 OCUPADO</span>
                        </div>

                        {matchingProducts.map(({ product, lot }, idx) => (
                          <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', backgroundColor: '#fafafa' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
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
                          className="btn btn-primary"
                          style={{ width: '100%', marginTop: '8px', fontSize: '0.84rem', padding: '9px 14px', fontWeight: 700, borderRadius: '8px' }}
                          onClick={() => setIsSimpleStockModalOpen(true)}
                        >
                          ➕ Cargar / Añadir Más Stock
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                !isEditMode && (
                  <div style={{ padding: '35px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👆</div>
                    <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>Seleccioná un sector o slot</div>
                    <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Tocá los botones de sectores/cámaras o cualquier celda A, A-B para inspeccionar.</div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}'''

pattern = r'\{subTab === \'wms-map\' && !selectedOrder && !showConsolidatedView && \(.*?\n      \)\}'
content = re.sub(pattern, wms_painter_jsx, content, flags=re.DOTALL)

with open(dashboard_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("OK: DepositoDashboard.tsx actualizado con el PINTADOR VISUAL INTERACTIVO DE SLOTS Y SECTORES.")
