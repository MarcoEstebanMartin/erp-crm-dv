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

  // Regex to find the CUIT input onChange
  // It looks like:
  // <input
  //   type="text"
  //   className="input"
  //   placeholder="ej: 20222334449"
  //   value={clientModal.data.cuit}
  //   onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, cuit: e.target.value } })}
  // />
  // Or in VendedorDashboard:
  // value={clientModal.cuit}
  // onChange={(e) => setClientModal({ ...clientModal, cuit: e.target.value })}

  const handleFetchSnippet = (isDataWrapped, isCityOrLocation) => `
                  onBlur={async (e) => {
                    const c = e.target.value;
                    if(c && c.length >= 8) {
                      try {
                        const res = await fetch(\`http://localhost:3000/api/personas/afip/\${c}\`, { headers: { Authorization: \`Bearer \${localStorage.getItem('token')}\` } });
                        const json = await res.json();
                        if(json.status === 'success' && json.data) {
                          setClientModal(prev => (${
                            isDataWrapped
                            ? `{...prev, data: {...prev.data, name: json.data.name || prev.data.name, address: json.data.address || prev.data.address, ${isCityOrLocation}: json.data.location || prev.data.${isCityOrLocation}}}`
                            : `{...prev, name: json.data.name || prev.name, address: json.data.address || prev.address, ${isCityOrLocation}: json.data.location || prev.${isCityOrLocation}}`
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
