const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('minimumFractionDigits: 2')) {
        content = content.replace(/minimumFractionDigits:\s*2/g, 'minimumFractionDigits: 0');
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated:', fullPath);
      }
    }
  }
}

processDir(path.join(__dirname, '..', 'frontend', 'src'));
console.log('Done.');
