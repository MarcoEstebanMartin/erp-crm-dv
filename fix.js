const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'frontend/src/components/ClientesDashboard.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\\\$/g, '$');
content = content.replace(/\\\`/g, '`');

fs.writeFileSync(file, content);
