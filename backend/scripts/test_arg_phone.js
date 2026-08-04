const { whatsAppService } = require('../dist/services/whatsapp.service');
require('dotenv').config();

async function main() {
  console.log('--- Test 1: With 9 (5493388501086) ---');
  try {
    const res1 = await whatsAppService.sendMessage({
      to: '5493388501086',
      text: 'Prueba 1: Con el 9 (5493388501086)'
    });
    console.log('Result 1 status:', res1.message.status, 'wamid:', res1.message.wamid);
  } catch (err) {
    console.error('Error 1:', err);
  }

  console.log('\n--- Test 2: Without 9 (543388501086) ---');
  try {
    const res2 = await whatsAppService.sendMessage({
      to: '543388501086',
      text: 'Prueba 2: Sin el 9 (543388501086)'
    });
    console.log('Result 2 status:', res2.message.status, 'wamid:', res2.message.wamid);
  } catch (err) {
    console.error('Error 2:', err);
  }
}

main();
