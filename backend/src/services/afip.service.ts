import fs from 'fs';
import path from 'path';
// @ts-ignore
import Afip from '@afipsdk/afip.js';
import { roundToTwoDecimals, toDecimal } from '../core/money';
import { getSystemConfigSnapshot } from './admin/system-config.service';

const isTestEnv = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
const isProduction = process.env.AFIP_PRODUCTION === 'true' && !isTestEnv;
const cuit = process.env.AFIP_CUIT || '20409378472';
const certPath = path.resolve(process.env.AFIP_CERT_PATH || './certs/homo.crt');
const keyPath = path.resolve(process.env.AFIP_KEY_PATH || './certs/homo.key');

const certsExist = fs.existsSync(certPath) && fs.existsSync(keyPath);
const useMock = isTestEnv || (!certsExist && !isProduction);

let afipClient: any = null;
let afipLock = Promise.resolve();

function withAfipLock<T>(task: () => Promise<T>): Promise<T> {
  const res = afipLock.then(task, task);
  afipLock = res.then(() => {}, () => {});
  return res;
}

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
} else if (!isTestEnv) {
  console.log('⚠️ Certificados no encontrados en ./certs/. Corriendo AFIP en MODO MOCK para desarrollo.');
}

export interface InvoiceRequest {
  clientCuit: string;
  clientDocType: number; // 80: CUIT, 96: DNI, 99: Consumidor Final
  invoiceType: 'A' | 'B';
  total: number;
  neto?: number;
  iva?: number;
  percepcionAmount?: number;
  percepcionIvaAmount?: number;
}

export interface CreditNoteAfipRequest extends InvoiceRequest {
  associatedVoucher?: {
    invoiceNumber?: string | null;
    invoiceType?: string | null;
    invoiceDate?: Date | string | null;
  } | null;
}

export interface InvoiceResult {
  invoiceNumber: string;
  cae: string;
  caeDueDate: Date;
  puntoVenta: number;
}

/**
 * Formatea fecha fiscal AFIP (AAAAMMDD) en huso horario Argentina (UTC-3),
 * evitando desfase de fecha a partir de las 21:00 hs locales por rollover UTC.
 */
export function formatAfipDateAR(date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return Number(`${get('year')}${get('month')}${get('day')}`);
}

function buildVoucherTaxPayload(req: InvoiceRequest) {
  const totalDec = roundToTwoDecimals(req.total);
  const netoDec =
    req.neto !== undefined ? roundToTwoDecimals(req.neto) : roundToTwoDecimals(totalDec.dividedBy('1.21'));
  const ivaDec =
    req.iva !== undefined ? roundToTwoDecimals(req.iva) : roundToTwoDecimals(totalDec.minus(netoDec));
  const pIIBBDec = roundToTwoDecimals(req.percepcionAmount || 0);
  const pIVADec = roundToTwoDecimals(req.percepcionIvaAmount || 0);
  const impTribDec = roundToTwoDecimals(pIIBBDec.plus(pIVADec));
  const calculatedTotalDec = roundToTwoDecimals(netoDec.plus(ivaDec).plus(impTribDec));

  const neto = netoDec.toNumber();
  const iva = ivaDec.toNumber();
  const pIIBB = pIIBBDec.toNumber();
  const pIVA = pIVADec.toNumber();
  const tributosList: any[] = [];

  if (pIIBB > 0 && neto > 0) {
    tributosList.push({
      Id: 9,
      Desc: 'Percepcion de IIBB',
      BaseImp: neto,
      Alic: roundToTwoDecimals(toDecimal(pIIBB).dividedBy(neto).times(100)).toNumber(),
      Importe: pIIBB,
    });
  }
  if (pIVA > 0 && neto > 0) {
    tributosList.push({
      Id: 7,
      Desc: 'Percepcion de IVA RG 5329',
      BaseImp: neto,
      Alic: roundToTwoDecimals(toDecimal(pIVA).dividedBy(neto).times(100)).toNumber(),
      Importe: pIVA,
    });
  }

  return {
    neto,
    iva,
    impTrib: impTribDec.toNumber(),
    calculatedTotal: calculatedTotalDec.toNumber(),
    tributosList,
  };
}

function resolveAfipDocNumber(clientDocType: number, clientCuit: string): number {
  if (clientDocType === 99) return 0;
  const cleanDigits = (clientCuit || '').replace(/\D/g, '');
  return cleanDigits ? Number(cleanDigits) : 0;
}

function parseCaeDueDateAR(rawCaeDue?: string): Date {
  if (rawCaeDue && rawCaeDue.length === 8) {
    const year = rawCaeDue.substring(0, 4);
    const month = rawCaeDue.substring(4, 6);
    const day = rawCaeDue.substring(6, 8);
    return new Date(`${year}-${month}-${day}T23:59:59-03:00`);
  }
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 10);
  return fallback;
}

function buildBaseVoucherPayload(params: {
  puntoDeVenta: number;
  cbteTipo: number;
  nextVoucherNumber: number;
  request: InvoiceRequest;
  fechaActual: number;
}) {
  const { puntoDeVenta, cbteTipo, nextVoucherNumber, request, fechaActual } = params;
  const taxes = buildVoucherTaxPayload(request);

  const payload: any = {
    CantReg: 1,
    PtoVta: puntoDeVenta,
    CbteTipo: cbteTipo,
    Concepto: 1,
    DocTipo: request.clientDocType,
    DocNro: resolveAfipDocNumber(request.clientDocType, request.clientCuit),
    CbteDesde: nextVoucherNumber,
    CbteHasta: nextVoucherNumber,
    CbteFch: fechaActual,
    ImpTotal: taxes.calculatedTotal,
    ImpTotConc: 0,
    ImpNeto: taxes.neto,
    ImpOpEx: 0,
    ImpIVA: taxes.iva,
    ImpTrib: taxes.impTrib,
    MonId: 'PES',
    MonCotiz: 1,
  };

  if (taxes.iva > 0) {
    payload.Iva = [{ Id: 5, BaseImp: taxes.neto, Importe: taxes.iva }];
  }
  if (taxes.tributosList.length > 0) {
    payload.Tributos = taxes.tributosList;
  }

  return payload;
}

export function buildAfipInvoicePayload(params: {
  puntoDeVenta: number;
  nextVoucherNumber: number;
  request: InvoiceRequest;
  now?: Date;
}) {
  const { puntoDeVenta, nextVoucherNumber, request, now = new Date() } = params;
  return buildBaseVoucherPayload({
    puntoDeVenta,
    cbteTipo: request.invoiceType === 'A' ? 1 : 6,
    nextVoucherNumber,
    request,
    fechaActual: formatAfipDateAR(now),
  });
}

export function buildAfipCreditNotePayload(params: {
  puntoDeVenta: number;
  nextVoucherNumber: number;
  emitterCuit?: string;
  request: CreditNoteAfipRequest;
  now?: Date;
}) {
  const { puntoDeVenta, nextVoucherNumber, emitterCuit = cuit, request, now = new Date() } = params;
  const cbteTipo = request.invoiceType === 'A' ? 3 : 8;
  const fechaActual = formatAfipDateAR(now);
  const payload = buildBaseVoucherPayload({
    puntoDeVenta,
    cbteTipo,
    nextVoucherNumber,
    request,
    fechaActual,
  });

  // Requisito ARCA/AFIP RG 4540 para Notas de Crédito (Tipo 3 y 8): CbtesAsoc o PeriodoAsoc obligatorio
  const assoc = request.associatedVoucher;
  const voucherMatch = assoc?.invoiceNumber ? /^(\d{1,5})-(\d{1,8})$/.exec(assoc.invoiceNumber.trim()) : null;
  const ptoVtaAsoc = voucherMatch ? Number(voucherMatch[1]) : 0;
  const nroAsoc = voucherMatch ? Number(voucherMatch[2]) : 0;

  if (ptoVtaAsoc > 0 && nroAsoc > 0) {
    const assocCbteTipo =
      assoc?.invoiceType === 'FACTURA_A'
        ? 1
        : assoc?.invoiceType === 'FACTURA_B'
          ? 6
          : cbteTipo === 3
            ? 1
            : 6;
    const cbteFchAsoc = assoc?.invoiceDate ? formatAfipDateAR(new Date(assoc.invoiceDate)) : fechaActual;
    const emitterClean = emitterCuit.replace(/\D/g, '');
    payload.CbtesAsoc = [
      {
        Tipo: assocCbteTipo,
        PtoVta: ptoVtaAsoc,
        Nro: nroAsoc,
        ...(emitterClean.length === 11 ? { Cuit: emitterClean } : {}),
        CbteFch: String(cbteFchAsoc),
      },
    ];
  } else {
    payload.PeriodoAsoc = {
      FchDesde: String(fechaActual),
      FchHasta: String(fechaActual),
    };
  }

  return payload;
}

function generateMockAfipResult(puntoDeVenta: number, caeSuffix: '1' | '2'): InvoiceResult {
  const mockNum = Math.floor(100000 + Math.random() * 900000);
  const mockCae = `9999${Math.floor(10000000 + Math.random() * 90000000)}${caeSuffix}`;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 10);
  return {
    invoiceNumber: `${String(puntoDeVenta).padStart(5, '0')}-${mockNum.toString().padStart(8, '0')}`,
    cae: mockCae,
    caeDueDate: dueDate,
    puntoVenta: puntoDeVenta,
  };
}

/**
 * Solicita el CAE a AFIP para una Factura A o B con candado secuencial anti-colisión.
 */
export async function emitirFacturaAFIP(request: InvoiceRequest): Promise<InvoiceResult> {
  return withAfipLock(async () => {
    const sysCfg = await getSystemConfigSnapshot();
    const puntoDeVenta = sysCfg.company.puntoVenta || 1;
    const cbteTipo = request.invoiceType === 'A' ? 1 : 6;

    if (useMock || !afipClient) {
      return generateMockAfipResult(puntoDeVenta, '1');
    }

    try {
      const lastVoucher = await afipClient.ElectronicBilling.getLastVoucher(puntoDeVenta, cbteTipo);
      const nextVoucherNumber = lastVoucher + 1;
      const data = buildAfipInvoicePayload({ puntoDeVenta, nextVoucherNumber, request });
      const res = await afipClient.ElectronicBilling.createVoucher(data);
      const formattedInvoiceNumber = `${puntoDeVenta.toString().padStart(5, '0')}-${nextVoucherNumber
        .toString()
        .padStart(8, '0')}`;

      return {
        invoiceNumber: formattedInvoiceNumber,
        cae: res.CAE,
        caeDueDate: parseCaeDueDateAR(res.CAEFchVto),
        puntoVenta: puntoDeVenta,
      };
    } catch (error: any) {
      console.error('❌ Error llamando a los Web Services de AFIP:', error);
      if (!isProduction) {
        return generateMockAfipResult(puntoDeVenta, '1');
      }
      throw new Error(`Error AFIP: ${error.message || error}`);
    }
  });
}

export async function emitirFacturaAFIPConReintento(
  requestData: InvoiceRequest,
  retries = 3,
): Promise<InvoiceResult> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await emitirFacturaAFIP(requestData);
    } catch (error: any) {
      console.warn(`⚠️ Intento ${attempt}/${retries} fallido al conectar con AFIP WSFE: ${error.message}`);
      if (attempt === retries) throw error;
      await new Promise((res) => setTimeout(res, 1500 * attempt));
    }
  }
  throw new Error('Servidor de AFIP inalcanzable tras múltiples intentos.');
}

/**
 * Solicita el CAE a AFIP para una Nota de Crédito (Tipo 3 A / Tipo 8 B) con CbtesAsoc/PeriodoAsoc,
 * Punto de Venta dinámico y candado secuencial `withAfipLock`.
 */
export async function emitirNotaCreditoAFIP(
  request: CreditNoteAfipRequest,
): Promise<InvoiceResult> {
  return withAfipLock(async () => {
    const sysCfg = await getSystemConfigSnapshot();
    const puntoDeVenta = sysCfg.company.puntoVenta || 1;
    const emitterCuit = sysCfg.company.cuit || cuit;
    const cbteTipo = request.invoiceType === 'A' ? 3 : 8;

    if (useMock || !afipClient) {
      return generateMockAfipResult(puntoDeVenta, '2');
    }

    try {
      const lastVoucher = await afipClient.ElectronicBilling.getLastVoucher(puntoDeVenta, cbteTipo);
      const nextVoucherNumber = lastVoucher + 1;
      const data = buildAfipCreditNotePayload({
        puntoDeVenta,
        nextVoucherNumber,
        emitterCuit,
        request,
      });
      const res = await afipClient.ElectronicBilling.createVoucher(data);
      const formattedInvoiceNumber = `${puntoDeVenta.toString().padStart(5, '0')}-${nextVoucherNumber
        .toString()
        .padStart(8, '0')}`;

      return {
        invoiceNumber: formattedInvoiceNumber,
        cae: res.CAE,
        caeDueDate: parseCaeDueDateAR(res.CAEFchVto),
        puntoVenta: puntoDeVenta,
      };
    } catch (error: any) {
      console.error('❌ Error llamando a los Web Services de AFIP para Nota de Crédito:', error);
      throw new Error(`Error AFIP Nota de Crédito: ${error.message || error}`);
    }
  });
}

export async function getPersonDetailsAFIP(cuitOrDni: string) {
  const { lookupTaxpayerByCuitOrDni } = await import('./arca-padron.service');
  return lookupTaxpayerByCuitOrDni(cuitOrDni);
}
