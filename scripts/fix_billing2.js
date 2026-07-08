const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'frontend/src/components/BillingDashboard.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/toLocaleString\('es-AR'\)/g, "toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })");

fs.writeFileSync(file, content);
console.log("Done");
