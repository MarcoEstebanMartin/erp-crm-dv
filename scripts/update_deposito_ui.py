import re

dashboard_path = 'frontend/src/components/DepositoDashboard.tsx'

with open(dashboard_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Simplificar los subtabs de navegación (3 subtabs minimalistas)
old_subtabs = r'<div className="subtabs-nav no-print">.*?</div>'
new_subtabs = '''<div className="subtabs-nav no-print">
          <button
            className={`subtab-btn ${subTab === 'picking' ? 'active' : ''}`}
            onClick={() => setSubTab('picking')}
          >
            <ClipboardList size={16} />
            <span>📦 Armado de Pedidos (Picking)</span>
          </button>
          <button
            className={`subtab-btn ${subTab === 'wms-map' ? 'active' : ''}`}
            onClick={() => setSubTab('wms-map')}
          >
            <Map size={16} />
            <span>🗺️ Plano Interactivo WMS</span>
          </button>
          <button
            className={`subtab-btn ${subTab === 'stock-list' ? 'active' : ''}`}
            onClick={() => setSubTab('stock-list')}
          >
            <Warehouse size={16} />
            <span>📋 Control de Stock y Lotes</span>
          </button>
        </div>'''

content = re.sub(old_subtabs, new_subtabs, content, flags=re.DOTALL)

# Write modified file
with open(dashboard_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("EXITO: Subtabs de DepositoDashboard simplificados a 3 pestañas minimalistas.")
