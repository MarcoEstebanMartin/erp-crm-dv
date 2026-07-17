const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'frontend/src/components/ComprasDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');
const replacements = {
  'Ã¡': 'á', 'Ã©': 'é', 'Ã­': 'í', 'Ã³': 'ó', 'Ãº': 'ú', 'Ã±': 'ñ', 'Ã“': 'Ó', 'ðŸ§¾': '??', 'âœ¨': '?', 'âš ï¸ ': '??', 'Ã‘': 'Ñ', 'depÃ³sito': 'depósito', 'recepciÃ³n': 'recepción'
};
for (const [bad, good] of Object.entries(replacements)) {
  content = content.split(bad).join(good);
}
fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed encoding in ComprasDashboard.tsx');
