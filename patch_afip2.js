const fs = require('fs');
const path = require('path');

const dashboards = [
  'AdminDashboard.tsx',
  'FacturacionDashboard.tsx',
  'VendedorDashboard.tsx'
];

const componentsDir = path.join(__dirname, 'frontend/src/components');

dashboards.forEach(file => {
  const filePath = path.join(componentsDir, file);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // Add api import if missing
  if (!content.includes("import { api } from '../utils/api'")) {
    content = "import { api } from '../utils/api';\n" + content;
  }

  const handleFetchSnippet = (isDataWrapped, isCityOrLocation) => `
                  onBlur={async (e) => {
                    const c = e.target.value;
                    if(c && c.length >= 8) {
                      try {
                        const json = await api.getAfipData(c);
                        if(json && json.status === 'success' && json.data) {
                          setClientModal(prev => (${
                            isDataWrapped
                            ? \`{...prev, data: {...prev.data, name: json.data.name || prev.data.name, address: json.data.address || prev.data.address, \${isCityOrLocation}: json.data.location || prev.data.\${isCityOrLocation}}}\`
                            : \`{...prev, name: json.data.name || prev.name, address: json.data.address || prev.address, \${isCityOrLocation}: json.data.location || prev.\${isCityOrLocation}}\`
                          }));
                        } else if (json && json.name) {
                          // Mock format fallback
                          setClientModal(prev => (${
                            isDataWrapped
                            ? \`{...prev, data: {...prev.data, name: json.name || prev.data.name, address: json.address || prev.data.address, \${isCityOrLocation}: json.location || prev.data.\${isCityOrLocation}}}\`
                            : \`{...prev, name: json.name || prev.name, address: json.address || prev.address, \${isCityOrLocation}: json.location || prev.\${isCityOrLocation}}\`
                          }));
                        }
                      } catch(err) { console.error('Error AFIP', err); }
                    }
                  }}`;

  if (file === 'AdminDashboard.tsx' || file === 'FacturacionDashboard.tsx') {
    content = content.replace(
      /onChange=\{\(e\) => setClientModal\(\{ \.\.\.clientModal, data: \{ \.\.\.clientModal\.data, cuit: e\.target\.value \} \}\)\}/,
      `onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, cuit: e.target.value } })}\n` + handleFetchSnippet(true, 'location')
    );
  } else if (file === 'VendedorDashboard.tsx') {
    content = content.replace(
      /onChange=\{\(e\) => setClientModal\(\{ \.\.\.clientModal, cuit: e\.target\.value \}\)\}/,
      `onChange={(e) => setClientModal({ ...clientModal, cuit: e.target.value })}\n` + handleFetchSnippet(false, 'city')
    );
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Patched', file);
});
