import {
  extractRepresentedCuitFromCert,
  getArcaWsaaTicket,
  resolveArcaCertAndKey,
} from '../../utils/arca-wsaa-cms.util';

const WSFE_NAMESPACE = 'http://ar.gov.afip.dif.FEV1/';
const WSFE_PROD_URL = 'https://servicios1.afip.gov.ar/wsfev1/service.asmx';
const WSFE_HOMO_URL = 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx';
const WSFE_TIMEOUT_MS = 20_000;

export interface WsfeVoucherPayload {
  CantReg: number;
  PtoVta: number;
  CbteTipo: number;
  Concepto: number;
  DocTipo: number;
  DocNro: number;
  CbteDesde: number;
  CbteHasta: number;
  CbteFch: number;
  ImpTotal: number;
  ImpTotConc: number;
  ImpNeto: number;
  ImpOpEx: number;
  ImpIVA: number;
  ImpTrib: number;
  MonId: string;
  MonCotiz: number;
  Iva?: Array<{ Id: number; BaseImp: number; Importe: number }>;
  Tributos?: Array<{ Id: number; Desc: string; BaseImp: number; Alic: number; Importe: number }>;
  CbtesAsoc?: Array<{ Tipo: number; PtoVta: number; Nro: number; Cuit?: string; CbteFch?: string }>;
  PeriodoAsoc?: { FchDesde: string; FchHasta: string };
}

export interface WsfeCaeResponse {
  CAE: string;
  CAEFchVto: string;
  CbteDesde: number;
}

function escapeXml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function extractXmlTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, 'i');
  const match = re.exec(xml);
  return match ? match[1].trim() : null;
}

function extractArcaMessages(xml: string, containerTag: 'Err' | 'Obs'): string[] {
  const re = new RegExp(`<(?:\\w+:)?${containerTag}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${containerTag}>`, 'gi');
  const messages: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    const block = match[1];
    const code = extractXmlTag(block, 'Code') || '';
    const msg = extractXmlTag(block, 'Msg') || '';
    if (code || msg) {
      messages.push(code ? `[${code}] ${msg}`.trim() : msg);
    }
  }
  return messages;
}

export function resolveWsfeEmitterCuit(configuredCuit?: string): string {
  const cleanConfigured = (configuredCuit || '').replace(/\D/g, '');
  if (cleanConfigured.length === 11 && cleanConfigured !== '20123456789' && cleanConfigured !== '20409378472') {
    return cleanConfigured;
  }
  const envCuit = (process.env.AFIP_CUIT || process.env.ARCA_PADRON_CUIT || '').replace(/\D/g, '');
  if (envCuit.length === 11 && envCuit !== '20123456789' && envCuit !== '20409378472') {
    return envCuit;
  }
  const creds = resolveArcaCertAndKey();
  const certCuit = creds ? extractRepresentedCuitFromCert(creds.certPem) : '';
  return certCuit || cleanConfigured || envCuit;
}

export function buildWsfeCreateVoucherSoapEnvelope(params: {
  token: string;
  sign: string;
  cuit: string;
  payload: WsfeVoucherPayload;
}): string {
  const { token, sign, cuit, payload } = params;

  const ivaXml =
    payload.Iva && payload.Iva.length > 0
      ? `<ar:Iva>${payload.Iva.map(
          (item) =>
            `<ar:AlicIva><ar:Id>${item.Id}</ar:Id><ar:BaseImp>${item.BaseImp}</ar:BaseImp><ar:Importe>${item.Importe}</ar:Importe></ar:AlicIva>`,
        ).join('')}</ar:Iva>`
      : '';

  const tributosXml =
    payload.Tributos && payload.Tributos.length > 0
      ? `<ar:Tributos>${payload.Tributos.map(
          (t) =>
            `<ar:Tributo><ar:Id>${t.Id}</ar:Id><ar:Desc>${escapeXml(t.Desc)}</ar:Desc><ar:BaseImp>${t.BaseImp}</ar:BaseImp><ar:Alic>${t.Alic}</ar:Alic><ar:Importe>${t.Importe}</ar:Importe></ar:Tributo>`,
        ).join('')}</ar:Tributos>`
      : '';

  const cbtesAsocXml =
    payload.CbtesAsoc && payload.CbtesAsoc.length > 0
      ? `<ar:CbtesAsoc>${payload.CbtesAsoc.map(
          (c) =>
            `<ar:CbteAsoc><ar:Tipo>${c.Tipo}</ar:Tipo><ar:PtoVta>${c.PtoVta}</ar:PtoVta><ar:Nro>${c.Nro}</ar:Nro>${
              c.Cuit ? `<ar:Cuit>${escapeXml(c.Cuit)}</ar:Cuit>` : ''
            }${c.CbteFch ? `<ar:CbteFch>${escapeXml(c.CbteFch)}</ar:CbteFch>` : ''}</ar:CbteAsoc>`,
        ).join('')}</ar:CbtesAsoc>`
      : '';

  const periodoAsocXml = payload.PeriodoAsoc
    ? `<ar:PeriodoAsoc><ar:FchDesde>${escapeXml(payload.PeriodoAsoc.FchDesde)}</ar:FchDesde><ar:FchHasta>${escapeXml(payload.PeriodoAsoc.FchHasta)}</ar:FchHasta></ar:PeriodoAsoc>`
    : '';

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="${WSFE_NAMESPACE}">` +
    `<soapenv:Header/>` +
    `<soapenv:Body>` +
    `<ar:FECAESolicitar>` +
    `<ar:Auth><ar:Token>${escapeXml(token)}</ar:Token><ar:Sign>${escapeXml(sign)}</ar:Sign><ar:Cuit>${escapeXml(cuit)}</ar:Cuit></ar:Auth>` +
    `<ar:FeCAEReq>` +
    `<ar:FeCabReq><ar:CantReg>${payload.CantReg}</ar:CantReg><ar:PtoVta>${payload.PtoVta}</ar:PtoVta><ar:CbteTipo>${payload.CbteTipo}</ar:CbteTipo></ar:FeCabReq>` +
    `<ar:FeDetReq><ar:FECAEDetRequest>` +
    `<ar:Concepto>${payload.Concepto}</ar:Concepto>` +
    `<ar:DocTipo>${payload.DocTipo}</ar:DocTipo>` +
    `<ar:DocNro>${payload.DocNro}</ar:DocNro>` +
    `<ar:CbteDesde>${payload.CbteDesde}</ar:CbteDesde>` +
    `<ar:CbteHasta>${payload.CbteHasta}</ar:CbteHasta>` +
    `<ar:CbteFch>${payload.CbteFch}</ar:CbteFch>` +
    `<ar:ImpTotal>${payload.ImpTotal}</ar:ImpTotal>` +
    `<ar:ImpTotConc>${payload.ImpTotConc}</ar:ImpTotConc>` +
    `<ar:ImpNeto>${payload.ImpNeto}</ar:ImpNeto>` +
    `<ar:ImpOpEx>${payload.ImpOpEx}</ar:ImpOpEx>` +
    `<ar:ImpTrib>${payload.ImpTrib}</ar:ImpTrib>` +
    `<ar:ImpIVA>${payload.ImpIVA}</ar:ImpIVA>` +
    `<ar:MonId>${escapeXml(payload.MonId)}</ar:MonId>` +
    `<ar:MonCotiz>${payload.MonCotiz}</ar:MonCotiz>` +
    `${cbtesAsocXml}${periodoAsocXml}${tributosXml}${ivaXml}` +
    `</ar:FECAEDetRequest></ar:FeDetReq>` +
    `</ar:FeCAEReq>` +
    `</ar:FECAESolicitar>` +
    `</soapenv:Body>` +
    `</soapenv:Envelope>`
  );
}

export function parseWsfeCaeResponseXml(xml: string): WsfeCaeResponse {
  const fault = extractXmlTag(xml, 'faultstring');
  if (fault) {
    throw new Error(`ARCA SOAP Fault: ${fault}`);
  }

  const errors = extractArcaMessages(xml, 'Err');
  const observations = extractArcaMessages(xml, 'Obs');
  const detBlock = extractXmlTag(xml, 'FECAEDetResponse') || xml;
  const resultado = extractXmlTag(detBlock, 'Resultado') || extractXmlTag(xml, 'Resultado');
  const cae = extractXmlTag(detBlock, 'CAE') || '';
  const caeFchVto = extractXmlTag(detBlock, 'CAEFchVto') || '';
  const cbteDesde = Number(extractXmlTag(detBlock, 'CbteDesde') || 0);

  if (resultado !== 'A' || !cae) {
    const details = [...errors, ...observations].join(' | ') || 'Comprobante rechazado sin detalle por ARCA';
    throw new Error(`ARCA rechazó el comprobante: ${details}`);
  }

  return { CAE: cae, CAEFchVto: caeFchVto, CbteDesde: cbteDesde };
}

async function callWsfeSoap(soapAction: string, bodyXml: string): Promise<string> {
  const creds = resolveArcaCertAndKey();
  if (!creds) {
    throw new Error('Certificados ARCA/AFIP no configurados.');
  }
  const url = creds.isProduction ? WSFE_PROD_URL : WSFE_HOMO_URL;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `${WSFE_NAMESPACE}${soapAction}`,
    },
    body: bodyXml,
    signal: AbortSignal.timeout(WSFE_TIMEOUT_MS),
  });
  const xml = await response.text();
  if (!response.ok && !extractXmlTag(xml, 'faultstring')) {
    throw new Error(`ARCA WSFE HTTP ${response.status}`);
  }
  return xml;
}

export async function getArcaLastVoucher(
  puntoDeVenta: number,
  cbteTipo: number,
  emitterCuit?: string,
): Promise<number> {
  const ticket = await getArcaWsaaTicket('wsfe');
  if (!ticket) {
    throw new Error('No se pudo obtener ticket WSAA para el servicio wsfe.');
  }
  const cuit = resolveWsfeEmitterCuit(emitterCuit);
  const soap =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="${WSFE_NAMESPACE}">` +
    `<soapenv:Header/><soapenv:Body><ar:FECompUltimoAutorizado>` +
    `<ar:Auth><ar:Token>${escapeXml(ticket.token)}</ar:Token><ar:Sign>${escapeXml(ticket.sign)}</ar:Sign><ar:Cuit>${escapeXml(cuit)}</ar:Cuit></ar:Auth>` +
    `<ar:PtoVta>${puntoDeVenta}</ar:PtoVta><ar:CbteTipo>${cbteTipo}</ar:CbteTipo>` +
    `</ar:FECompUltimoAutorizado></soapenv:Body></soapenv:Envelope>`;

  const xml = await callWsfeSoap('FECompUltimoAutorizado', soap);
  const fault = extractXmlTag(xml, 'faultstring');
  if (fault) throw new Error(`ARCA SOAP Fault: ${fault}`);

  const errors = extractArcaMessages(xml, 'Err');
  if (errors.length > 0) {
    throw new Error(`ARCA FECompUltimoAutorizado error: ${errors.join(' | ')}`);
  }

  const rawNum = extractXmlTag(xml, 'CbteNro');
  const parsed = Number(rawNum);
  if (rawNum === null || !Number.isInteger(parsed) || parsed < 0) {
    throw new Error('ARCA no devolvió un CbteNro válido en FECompUltimoAutorizado.');
  }
  return parsed;
}

export async function createArcaVoucher(
  payload: WsfeVoucherPayload,
  emitterCuit?: string,
): Promise<WsfeCaeResponse> {
  const ticket = await getArcaWsaaTicket('wsfe');
  if (!ticket) {
    throw new Error('No se pudo obtener ticket WSAA para el servicio wsfe.');
  }
  const cuit = resolveWsfeEmitterCuit(emitterCuit);
  const soap = buildWsfeCreateVoucherSoapEnvelope({
    token: ticket.token,
    sign: ticket.sign,
    cuit,
    payload,
  });
  const xml = await callWsfeSoap('FECAESolicitar', soap);
  return parseWsfeCaeResponseXml(xml);
}
