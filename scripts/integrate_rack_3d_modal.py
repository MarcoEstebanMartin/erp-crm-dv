import json
import re

dashboard_path = 'frontend/src/components/DepositoDashboard.tsx'

with open(dashboard_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Asegurar import de Rack3DViewerModal
if 'import Rack3DViewerModal' not in content:
    content = content.replace(
        "import SimpleStockLoadModal from './SimpleStockLoadModal';",
        "import SimpleStockLoadModal from './SimpleStockLoadModal';\nimport Rack3DViewerModal from './Rack3DViewerModal';"
    )

# 2. Agregar estado is3DModalOpen si no existe
if 'const [is3DModalOpen, setIs3DModalOpen] = useState(false);' not in content:
    content = content.replace(
        "const [isSimpleStockModalOpen, setIsSimpleStockModalOpen] = useState(false);",
        "const [isSimpleStockModalOpen, setIsSimpleStockModalOpen] = useState(false);\n  const [is3DModalOpen, setIs3DModalOpen] = useState(false);"
    )

# 3. Cambiar el handler del doble clic o botón en la grilla para abrir la vista 3D
if 'setIs3DModalOpen(true)' not in content:
    content = content.replace(
        "setIsSimpleStockModalOpen(true);",
        "setIs3DModalOpen(true);"
    )

# 4. Incluir el modal <Rack3DViewerModal ... /> al final del componente
rack_3d_jsx = '''      {/* Modal 3D Isométrico de Rack y Vigas en Altura */}
      <Rack3DViewerModal
        isOpen={is3DModalOpen}
        onClose={() => setIs3DModalOpen(false)}
        slot={selectedSlot}
        allProducts={allProducts}
        onRefresh={fetchData}
      />
    </div>
  );
}'''

if '<Rack3DViewerModal' not in content:
    content = content.replace('    </div>\n  );\n}', rack_3d_jsx)

with open(dashboard_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("OK: DepositoDashboard.tsx actualizado con Rack3DViewerModal.")
