import fs from 'fs';
import path from 'path';
// @ts-ignore
import Afip from '@afipsdk/afip.js';

const isProduction = process.env.AFIP_PRODUCTION === 'true';
const cuit = process.env.AFIP_CUIT || '20409378472';
const certPath = path.resolve(process.env.AFIP_CERT_PATH || './certs/homo.crt');
const keyPath = path.resolve(process.env.AFIP_KEY_PATH || './certs/homo.key');

// Determinar si debemos usar un Mock para no trabar el desarrollo
const certsExist = fs.existsSync(certPath) && fs.existsSync(keyPath);
const useMock = !certsExist && !isProduction;

let afipClient: any = null;

if (!useMock) {
  try {
    afipClient = new Afip({
      CUIT: Number(cuit),
      production: isProduction,
      cert: certPath,
      key: keyPath,
    } as any);
    console.log(`🔒 AFIP SDK Inicializado en modo ${isProduction ? 'PRODUCCIÓN' : 'HOMOLOGACIÓN'}.`);
  } catch (err: any) {
    console.error('❌ Error inicializando el SDK de AFIP:', err.message);
    console.log('⚠️ Se activará el modo MOCK debido a error de inicialización.');
  }
} else {
  console.log('⚠️ Certificados no encontrados en ./certs/. Corriendo AFIP en MODO MOCK para desarrollo.');
}

interface InvoiceRequest {
  clientCuit: string; // CUIT o DNI del cliente
  clientDocType: number; // 80: CUIT, 96: DNI, 99: Consumidor Final
  invoiceType: 'A' | 'B';
  total: number;
  neto?: number;
  iva?: number;
  percepcionAmount?: number;
  percepcionIvaAmount?: number;
}

interface InvoiceResult {
  invoiceNumber: string;
  cae: string;
  caeDueDate: Date;
  puntoVenta: number;
}

/**
 * Solicita el CAE a AFIP para un comprobante.
 */
export async function emitirFacturaAFIP({
  clientCuit,
  clientDocType,
  invoiceType,
  total,
  neto: reqNeto,
  iva: reqIva,
  percepcionAmount,
  percepcionIvaAmount,
}: InvoiceRequest): Promise<InvoiceResult> {
  const puntoDeVenta = 1; // Punto de venta por defecto
  const cbteTipo = invoiceType === 'A' ? 1 : 6; // 1: Factura A, 6: Factura B

  // Si estamos usando Mock
  if (useMock || !afipClient) {
    const mockInvoiceNum = Math.floor(100000 + Math.random() * 900000);
    const mockCae = '9999' + Math.floor(10000000 + Math.random() * 90000000) + '1';
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 10); // Expira en 10 días

    console.log(`[MOCK AFIP] Creando Factura ${invoiceType} #${mockInvoiceNum} por total ARS ${total} (Percep IIBB: ${percepcionAmount || 0}, Percep IVA: ${percepcionIvaAmount || 0})`);

    return {
      invoiceNumber: `00001-${mockInvoiceNum.toString().padStart(8, '0')}`,
      cae: mockCae,
      caeDueDate: dueDate,
      puntoVenta: puntoDeVenta,
    };
  }

  try {
    // 1. Obtener el último número de comprobante registrado en AFIP
    const lastVoucher = await afipClient.ElectronicBilling.getLastVoucher(puntoDeVenta, cbteTipo);
    const nextVoucherNumber = lastVoucher + 1;

    // 2. Cálculos impositivos para Responsable Inscripto (IVA 21% simplificado para la distribuidora)
    const neto = reqNeto !== undefined ? reqNeto : (invoiceType === 'A' ? Number((total / 1.21).toFixed(2)) : Math.round(total / 1.21));
    const iva = reqIva !== undefined ? reqIva : (invoiceType === 'A' ? Number((total - neto).toFixed(2)) : (total - neto));
    const pIIBB = Number(percepcionAmount || 0);
    const pIVA = Number(percepcionIvaAmount || 0);
    const impTrib = Number((pIIBB + pIVA).toFixed(2));

    // Formatear fecha en AAAAMMDD
    const fechaActual = parseInt(new Date().toISOString().replace(/-/g, '').substring(0, 8));

    // 3. Estructurar datos para AFIP
    const data: any = {
      CantReg: 1,
      PtoVta: puntoDeVenta,
      CbteTipo: cbteTipo,
      Concepto: 1, // 1: Productos
      DocTipo: clientDocType,
      DocNro: clientDocType === 99 ? 0 : Number(clientCuit.replace(/-/g, '')),
      CbteDesde: nextVoucherNumber,
      CbteHasta: nextVoucherNumber,
      CbteFch: fechaActual,
      ImpTotal: total,
      ImpTotConc: 0,
      ImpNeto: neto,
      ImpOpEx: 0,
      ImpIVA: iva,
      ImpTrib: impTrib,
      MonId: 'PES',
      MonCotiz: 1,
    };

    // Agregar detalle de IVA si corresponde
    if (iva > 0) {
      data.Iva = [
        {
          Id: 5, // IVA 21%
          BaseImp: neto,
          Importe: iva,
        },
      ];
    }

    // Agregar detalle de tributos/percepciones si existen
    const tributosList = [];
    if (pIIBB > 0) {
      tributosList.push({
        Id: 9, // Otras Percepciones Provinciales (usualmente IIBB)
        Desc: 'Percepcion de IIBB',
        BaseImp: neto,
        Alic: Number(((pIIBB / neto) * 100).toFixed(2)),
        Importe: pIIBB,
      });
    }
    if (pIVA > 0) {
      tributosList.push({
        Id: 7, // Percepción de IVA
        Desc: 'Percepcion de IVA RG 5329',
        BaseImp: neto,
        Alic: Number(((pIVA / neto) * 100).toFixed(2)),
        Importe: pIVA,
      });
    }

    if (tributosList.length > 0) {
      data.Tributos = tributosList;
    }

    // 4. Crear el comprobante ante AFIP
    const res = await afipClient.ElectronicBilling.createVoucher(data);

    const formattedInvoiceNumber = `${puntoDeVenta.toString().padStart(5, '0')}-${nextVoucherNumber
      .toString()
      .padStart(8, '0')}`;

    // Obtener vencimiento del CAE (AFIP devuelve en formato AAAAMMDD)
    let expirationDate = new Date();
    if (res.CAEFchVto) {
      const year = res.CAEFchVto.substring(0, 4);
      const month = res.CAEFchVto.substring(4, 6);
      const day = res.CAEFchVto.substring(6, 8);
      expirationDate = new Date(`${year}-${month}-${day}T23:59:59`);
    } else {
      expirationDate.setDate(expirationDate.getDate() + 10);
    }

    return {
      invoiceNumber: formattedInvoiceNumber,
      cae: res.CAE,
      caeDueDate: expirationDate,
      puntoVenta: puntoDeVenta,
    };
  } catch (error: any) {
    console.error('❌ Error llamando a los Web Services de AFIP:', error);
    throw new Error(`Error AFIP: ${error.message || error}`);
  }
}

/**
 * Solicita el CAE a AFIP para una Nota de Crédito.
 */
export async function emitirNotaCreditoAFIP({
  clientCuit,
  clientDocType,
  invoiceType,
  total,
}: InvoiceRequest): Promise<InvoiceResult> {
  const puntoDeVenta = 1; // Punto de venta por defecto
  const cbteTipo = invoiceType === 'A' ? 3 : 8; // 3: Nota de Crédito A, 8: Nota de Crédito B

  // Si estamos usando Mock
  if (useMock || !afipClient) {
    const mockInvoiceNum = Math.floor(100000 + Math.random() * 900000);
    const mockCae = '9999' + Math.floor(10000000 + Math.random() * 90000000) + '2';
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 10); // Expira en 10 días

    console.log(`[MOCK AFIP] Creando Nota de Crédito ${invoiceType} #${mockInvoiceNum} por total ARS ${total}`);

    return {
      invoiceNumber: `00001-${mockInvoiceNum.toString().padStart(8, '0')}`,
      cae: mockCae,
      caeDueDate: dueDate,
      puntoVenta: puntoDeVenta,
    };
  }

  try {
    // 1. Obtener el último número de comprobante registrado en AFIP
    const lastVoucher = await afipClient.ElectronicBilling.getLastVoucher(puntoDeVenta, cbteTipo);
    const nextVoucherNumber = lastVoucher + 1;

    // 2. Cálculos impositivos
    const neto = invoiceType === 'A' ? Number((total / 1.21).toFixed(2)) : Math.round(total / 1.21);
    const iva = invoiceType === 'A' ? Number((total - neto).toFixed(2)) : (total - neto);

    // Formatear fecha en AAAAMMDD
    const fechaActual = parseInt(new Date().toISOString().replace(/-/g, '').substring(0, 8));

    // 3. Estructurar datos para AFIP
    const data: any = {
      CantReg: 1,
      PtoVta: puntoDeVenta,
      CbteTipo: cbteTipo,
      Concepto: 1, // 1: Productos
      DocTipo: clientDocType,
      DocNro: clientDocType === 99 ? 0 : Number(clientCuit.replace(/-/g, '')),
      CbteDesde: nextVoucherNumber,
      CbteHasta: nextVoucherNumber,
      CbteFch: fechaActual,
      ImpTotal: total,
      ImpTotConc: 0,
      ImpNeto: neto,
      ImpOpEx: 0,
      ImpIVA: iva,
      ImpTrib: 0,
      MonId: 'PES',
      MonCotiz: 1,
    };

    // Agregar detalle de IVA si corresponde
    if (iva > 0) {
      data.Iva = [
        {
          Id: 5, // IVA 21%
          BaseImp: neto,
          Importe: iva,
        },
      ];
    }

    // 4. Crear el comprobante ante AFIP
    const res = await afipClient.ElectronicBilling.createVoucher(data);

    const formattedInvoiceNumber = `${puntoDeVenta.toString().padStart(5, '0')}-${nextVoucherNumber
      .toString()
      .padStart(8, '0')}`;

    // Obtener vencimiento del CAE
    let expirationDate = new Date();
    if (res.CAEFchVto) {
      const year = res.CAEFchVto.substring(0, 4);
      const month = res.CAEFchVto.substring(4, 6);
      const day = res.CAEFchVto.substring(6, 8);
      expirationDate = new Date(`${year}-${month}-${day}T23:59:59`);
    } else {
      expirationDate.setDate(expirationDate.getDate() + 10);
    }

    return {
      invoiceNumber: formattedInvoiceNumber,
      cae: res.CAE,
      caeDueDate: expirationDate,
      puntoVenta: puntoDeVenta,
    };
  } catch (error: any) {
    console.error('❌ Error llamando a los Web Services de AFIP para Nota de Crédito:', error);
    throw new Error(`Error AFIP Nota de Crédito: ${error.message || error}`);
  }
}

function calculateCuil(dniStr: string, genderPrefix: '20' | '27' = '20'): string {
  const cleanDni = dniStr.replace(/\D/g, '').padStart(8, '0');
  let prefix: string = genderPrefix;
  const xy = prefix + cleanDni;
  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(xy[i], 10) * multipliers[i];
  }
  
  const mod = sum % 11;
  let z = 0;
  if (mod === 0) {
    z = 0;
  } else if (mod === 1) {
    prefix = '23';
    z = genderPrefix === '20' ? 9 : 4;
  } else {
    z = 11 - mod;
  }
  
  return `${prefix}${cleanDni}${z}`;
}

/**
 * Consulta los datos de un contribuyente en AFIP por su CUIT o DNI.
 */
export async function getPersonDetailsAFIP(cuit: string): Promise<any> {
  let cleanInput = cuit.replace(/\D/g, '');
  if (cleanInput.length >= 7 && cleanInput.length <= 8) {
    cleanInput = calculateCuil(cleanInput, '20');
  }

  const numericCuit = Number(cleanInput);

  if (useMock || !afipClient) {
    console.log(`[MOCK AFIP] Consultando datos para CUIT ${numericCuit}`);
    return {
      cuit: numericCuit,
      name: 'Empresa de Prueba S.A.',
      address: 'Avenida Falsa 123',
      location: 'Ciudad Autónoma de Buenos Aires',
      isClient: true,
      isProvider: false,
    };
  }

  try {
    // Para consultar el padrón de AFIP se suele usar RegisterScopeThirteen o RegisterScopeFive.
    // afip.js implementa RegisterScopeThirteen.
    const details = await afipClient.RegisterScopeThirteen.getTaxpayerDetails(numericCuit);
    
    // Parsear respuesta (ejemplo basado en la estructura típica de AFIP A13)
    const data = details?.datosGenerales || {};
    const addressData = details?.datosGenerales?.domicilioFiscal || {};
    
    let fullName = data.razonSocial || '';
    if (!fullName && data.nombre && data.apellido) {
      fullName = `${data.nombre} ${data.apellido}`;
    }

    return {
      cuit: numericCuit,
      name: fullName,
      address: addressData.direccion || '',
      location: addressData.localidad || addressData.descripcionProvincia || '',
      isClient: true,
      isProvider: false,
      rawData: details
    };
  } catch (error: any) {
    console.error(`❌ Error consultando CUIT ${numericCuit} en AFIP (Probablemente faltan certificados reales):`, error.message || error);
    
    // Fallback a Mock si falla la conexión real a AFIP
    console.log(`[MOCK FALLBACK] Retornando datos simulados para no bloquear el flujo.`);
    return {
      cuit: numericCuit,
      name: 'Empresa Generada (AFIP Inactivo)',
      address: 'Avenida Falsa 123',
      location: 'Buenos Aires',
      isClient: true,
      isProvider: false,
      fallback: true
    };
  }
}
