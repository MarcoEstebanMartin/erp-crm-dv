const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'frontend/src/index.css');
let content = fs.readFileSync(file, 'utf8');

const newStyles = `
/* Billing Channels (Elegantes y Sobrios) */
.btn-official {
  background-color: #2C5282; /* Azul elegante y sobrio */
  border-color: #2C5282;
  color: white;
}
.btn-official:hover {
  background-color: #2A4365;
  border-color: #2A4365;
}

.btn-internal {
  background-color: #822727; /* Rojo/Bordó elegante y sobrio */
  border-color: #822727;
  color: white;
}
.btn-internal:hover {
  background-color: #63171B;
  border-color: #63171B;
}

.text-official {
  color: #2C5282 !important;
}
.text-internal {
  color: #822727 !important;
}
`;

content += newStyles;
fs.writeFileSync(file, content);
console.log("Appended styles to index.css");
