const Afip = require('@afipsdk/afip.js');

async function testAfip() {
  try {
    const afip = new Afip({ CUIT: 20409378472 });
    const cuitToSearch = 20409378472;
    console.log('Fetching details for CUIT:', cuitToSearch);
    
    // RegisterScopeThirteen or RegisterScopeFive
    if (afip.RegisterScopeThirteen) {
        const details = await afip.RegisterScopeThirteen.getTaxpayerDetails(cuitToSearch);
        console.log('RegisterScopeThirteen Details:', details);
    } else if (afip.RegisterScopeFive) {
        const details = await afip.RegisterScopeFive.getTaxpayerDetails(cuitToSearch);
        console.log('RegisterScopeFive Details:', details);
    } else {
        console.log('No RegisterScopeThirteen or Five on afip instance:', Object.keys(afip));
    }
  } catch (error) {
    console.error('Error fetching AFIP data:', error);
  }
}

testAfip();
