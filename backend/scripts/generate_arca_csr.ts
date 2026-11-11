import fs from 'fs';
import path from 'path';
import { parseFiscalIdentifier } from '../src/engines/arca-cuit.engine';
import { generateArcaKeyAndCsr } from '../src/utils/arca-csr.util';

const rawCuit = process.argv[2] || process.env.ARCA_PADRON_CUIT || process.env.AFIP_CUIT || '';
const parsed = parseFiscalIdentifier(rawCuit);
if (!parsed.isValid || parsed.kind !== 'CUIT' || !parsed.normalizedCuit) {
  console.error('❌ Uso: npm run arca:generar-csr -- <TU_CUIT_11_DIGITOS>');
  process.exit(1);
}

const certsDir = path.resolve(__dirname, '../certs');
fs.mkdirSync(certsDir, { recursive: true });
const keyPath = path.join(certsDir, 'arca.key');
const csrPath = path.join(certsDir, 'pedido_arca.csr');

if (fs.existsSync(keyPath)) {
  console.error(`⚠️ Ya existe ${keyPath}. No se sobreescribió para proteger tu clave privada.`);
  process.exit(1);
}

const { keyPem, csrPem } = generateArcaKeyAndCsr(parsed.normalizedCuit);
fs.writeFileSync(keyPath, keyPem, { mode: 0o600 });
fs.writeFileSync(csrPath, csrPem, 'utf8');

console.log(`✅ Generados con éxito para CUIT ${parsed.normalizedCuit}:`);
console.log(`   🔑 Clave privada: ${keyPath}`);
console.log(`   📄 Pedido CSR:    ${csrPath}`);
