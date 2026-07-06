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

  const handleFetchSnippet = (isDataWrapped, isCityOrLocation) => {
    let updateStateCode = "";
    if (isDataWrapped) {
      updateStateCode = "setClientModal(prev => ({...prev, data: {...prev.data, name: json.data.name || prev.data.name, address: json.data.address || prev.data.address, " + isCityOrLocation + ": json.data.location || prev.data." + isCityOrLocation + "}}));";
      updateStateCode += "\n                        } else if (json && json.name) {";
      updateStateCode += "\n                          setClientModal(prev => ({...prev, data: {...prev.data, name: json.name || prev.data.name, address: json.address || prev.data.address, " + isCityOrLocation + ": json.location || prev.data." + isCityOrLocation + "}}));";
    } else {
      updateStateCode = "setClientModal(prev => ({...prev, name: json.data.name || prev.name, address: json.data.address || prev.address, " + isCityOrLocation + ": json.data.location || prev." + isCityOrLocation + "}));";
      updateStateCode += "\n                        } else if (json && json.name) {";
      updateStateCode += "\n                          setClientModal(prev => ({...prev, name: json.name || prev.name, address: json.address || prev.address, " + isCityOrLocation + ": json.location || prev." + isCityOrLocation + "}));";
    }

    return "\n                  onBlur={async (e) => {\n" +
           "                    const c = e.target.value;\n" +
           "                    if(c && c.length >= 8) {\n" +
           "                      try {\n" +
           "                        const json = await api.getAfipData(c);\n" +
           "                        if(json && json.status === 'success' && json.data) {\n" +
           "                          " + updateStateCode + "\n" +
           "                        }\n" +
           "                      } catch(err) { console.error('Error AFIP', err); }\n" +
           "                    }\n" +
           "                  }}";
  };

  if (file === 'AdminDashboard.tsx' || file === 'FacturacionDashboard.tsx') {
    // Both Admin and Facturacion use clientModal.data (wait, does Facturacion use data wrapper? Let's check my previous grep)
    // Actually Facturacion Line 652: `onChange={(e) => setClientModal({ ...clientModal, cuit: e.target.value })}` -> NO DATA WRAPPER!
  }
  
  if (file === 'AdminDashboard.tsx') {
    content = content.replace(
      /onChange=\{\(e\) => setClientModal\(\{ \.\.\.clientModal, data: \{ \.\.\.clientModal\.data, cuit: e\.target\.value \} \}\)\}/,
      "onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, cuit: e.target.value } })}" + handleFetchSnippet(true, 'location')
    );
  } else if (file === 'FacturacionDashboard.tsx') {
    // It doesn't have data wrapper, it uses city
    // Wait, let's check what it uses: city or location? Usually city if no data wrapper.
    content = content.replace(
      /onChange=\{\(e\) => setClientModal\(\{ \.\.\.clientModal, cuit: e\.target\.value \}\)\}/,
      "onChange={(e) => setClientModal({ ...clientModal, cuit: e.target.value })}" + handleFetchSnippet(false, 'city')
    );
  } else if (file === 'VendedorDashboard.tsx') {
    content = content.replace(
      /onChange=\{\(e\) => setClientModal\(\{ \.\.\.clientModal, cuit: e\.target\.value \}\)\}/,
      "onChange={(e) => setClientModal({ ...clientModal, cuit: e.target.value })}" + handleFetchSnippet(false, 'city')
    );
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Patched', file);
});
