import re

dashboard_path = 'frontend/src/components/DepositoDashboard.tsx'

with open(dashboard_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Reemplazar imports de modales viejos por RackLevelViewerModal
content = re.sub(
    r"import SimpleStockLoadModal from './SimpleStockLoadModal';\nimport Rack3DViewerModal from './Rack3DViewerModal';",
    "import RackLevelViewerModal from './RackLevelViewerModal';",
    content
)
content = re.sub(
    r"import SimpleStockLoadModal from './SimpleStockLoadModal';",
    "import RackLevelViewerModal from './RackLevelViewerModal';",
    content
)
content = re.sub(
    r"import Rack3DViewerModal from './Rack3DViewerModal';",
    "import RackLevelViewerModal from './RackLevelViewerModal';",
    content
)

# 2. Reemplazar estados de modales por isLevelModalOpen
content = content.replace("const [isSimpleStockModalOpen, setIsSimpleStockModalOpen] = useState(false);", "")
content = content.replace("const [is3DModalOpen, setIs3DModalOpen] = useState(false);", "")

if "const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);" not in content:
    content = content.replace(
        "const [isMapModalOpen, setIsMapModalOpen] = useState(false);",
        "const [isMapModalOpen, setIsMapModalOpen] = useState(false);\n  const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);"
    )

# 3. Reemplazar llamados setIsSimpleStockModalOpen y setIs3DModalOpen por setIsLevelModalOpen
content = content.replace("setIsSimpleStockModalOpen(true);", "setIsLevelModalOpen(true);")
content = content.replace("setIs3DModalOpen(true);", "setIsLevelModalOpen(true);")

# 4. Reemplazar botones en el panel lateral por un único botón limpio de estantería
old_buttons_pattern = r'<div style=\{\{ display: \'flex\', flexDirection: \'column\', gap: \'8px\', marginTop: \'14px\' \}\}>.*?</div>\n                          </div>'
new_buttons_jsx = '''<div style={{ marginTop: '14px' }}>
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ width: '100%', fontSize: '0.86rem', padding: '10px 14px', fontWeight: 800, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                              onClick={() => setIsLevelModalOpen(true)}
                            >
                              📦 Abrir Estantería & Cargar Mercadería
                            </button>
                          </div>
                        </div>'''

content = re.sub(old_buttons_pattern, new_buttons_jsx, content, flags=re.DOTALL)

# Reemplazar botón cuando hay productos
old_occupied_btn = r'<button\n\s+type="button"\n\s+className="btn btn-primary"\n\s+style=\{\{ width: \'100%\', fontSize: \'0\.84rem\', padding: \'9px 14px\', fontWeight: 700, borderRadius: \'8px\', display: \'flex\', alignItems: \'center\', justifyContent: \'center\', gap: \'6px\' \}\}\n\s+onClick=\{\(\) => setIsLevelModalOpen\(true\)\}\n\s+>\n\s+🧊 Ver Rack Tridimensional 3D \(Niveles \{selectedSlot\.nivel\}\)\n\s+</button>'
new_occupied_btn = '''<button
                          type="button"
                          className="btn btn-primary"
                          style={{ width: '100%', fontSize: '0.86rem', padding: '10px 14px', fontWeight: 800, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          onClick={() => setIsLevelModalOpen(true)}
                        >
                          📦 Inspeccionar / Cargar Estantería ({selectedSlot.nivel})
                        </button>'''

content = re.sub(old_occupied_btn, new_occupied_btn, content)

# 5. Reemplazar JSX de modales al final por el nuevo RackLevelViewerModal
old_modals_jsx = r'<SimpleStockLoadModal.*?/>\s*<Rack3DViewerModal.*?/>'
new_single_modal = '''<RackLevelViewerModal
        isOpen={isLevelModalOpen}
        onClose={() => setIsLevelModalOpen(false)}
        slot={selectedSlot}
        allProducts={allProducts}
        onRefresh={fetchData}
      />'''

content = re.sub(old_modals_jsx, new_single_modal, content, flags=re.DOTALL)

with open(dashboard_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("OK: DepositoDashboard.tsx unificado con RackLevelViewerModal.")
