import prisma from '../utils/prisma';
import { normalizePadronText, parseFiscalIdentifier } from '../engines/arca-cuit.engine';
import { extractRepresentedCuitFromCert, getArcaWsaaTicket, resolveArcaCertAndKey } from '../utils/arca-wsaa-cms.util';

export type PadronLookupSource =
  | 'ARCA_PADRON_A13'
  | 'BCRA_PUBLIC_REGISTRY'
  | 'LOCAL_DATABASE'
  | 'NOT_FOUND';

export interface ExistingPersonaMatch {
  id: number;
  name: string;
  cuit: string | null;
  address: string | null;
  city: string | null;
  isActive: boolean;
}

export interface PadronLookupResult {
  found: boolean;
  source: PadronLookupSource;
  cuit: string;
  name: string;
  address: string;
  location: string;
  taxStatus?: string;
  alreadyRegistered: boolean;
  existingPersona: ExistingPersonaMatch | null;
  message?: string;
}

export class ArcaValidationError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

type CachedPadronPayload = Omit<PadronLookupResult, 'alreadyRegistered' | 'existingPersona'>;

const PADRON_CACHE_TTL_MS = 24 * 3600_000;
const padronCache = new Map<string, { data: CachedPadronPayload; expiresAtMs: number }>();

function extractXmlValue(xml: string, tag: string): string {
  const re = new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, 'i');
  const m = re.exec(xml);
  return m ? normalizePadronText(m[1]) : '';
}

function extractFiscalDomicilioBlock(xml: string): string {
  const fiscalMatch = /<(?:\w+:)?domicilioFiscal[^>]*>([\s\S]*?)<\/(?:\w+:)?domicilioFiscal>/i.exec(xml);
  if (fiscalMatch) return fiscalMatch[1];

  const blocks = Array.from(
    xml.matchAll(/<(?:\w+:)?domicilio[^>]*>([\s\S]*?)<\/(?:\w+:)?domicilio>/gi),
    (m) => m[1],
  );
  if (blocks.length === 0) return '';
  return blocks.find((b) => extractXmlValue(b, 'tipoDomicilio').includes('FISCAL')) || blocks[0];
}

async function findLocalExistingPersona(
  cleanDigits: string,
  candidateCuits: string[],
): Promise<ExistingPersonaMatch | null> {
  const searchValues = Array.from(new Set([cleanDigits, ...candidateCuits]));
  const matches = await prisma.persona.findMany({
    where: { OR: searchValues.map((val) => ({ cuit: { contains: val } })) },
    select: { id: true, name: true, cuit: true, address: true, city: true, isActive: true },
    take: 5,
  });

  return (
    matches.find((m) => searchValues.includes((m.cuit || '').replace(/\D/g, ''))) || null
  );
}

async function queryOfficialArcaPadronA13(
  kind: 'CUIT' | 'DNI',
  cleanDigits: string,
  candidateCuits: string[],
): Promise<CachedPadronPayload | null> {
  const credsInfo = resolveArcaCertAndKey();
  if (!credsInfo) return null;
  const envCuit = (process.env.ARCA_PADRON_CUIT || process.env.AFIP_CUIT || '').replace(/\D/g, '');
  const representedCuit =
    (envCuit && envCuit !== '20123456789' ? envCuit : '') ||
    extractRepresentedCuitFromCert(credsInfo.certPem);
  if (!representedCuit) return null;

  let ticket = await getArcaWsaaTicket('ws_sr_padron_a13').catch(() => null);
  let useA5 = false;
  if (!ticket) {
    ticket = await getArcaWsaaTicket('ws_sr_constancia_inscripcion').catch(() => null);
    useA5 = true;
  }
  if (!ticket) return null;

  const baseHost = credsInfo.isProduction ? 'https://aws.afip.gov.ar' : 'https://awshomo.afip.gov.ar';
  const endpoint = useA5
    ? `${baseHost}/sr-padron/webservices/personaServiceA5`
    : `${baseHost}/sr-padron/webservices/personaServiceA13`;
  const ns = useA5 ? 'http://a5.soap.ws.server.puc.sr/' : 'http://a13.soap.ws.server.puc.sr/';
  const methodName = useA5 ? 'getPersona_v2' : 'getPersona';
  const authXml = `<token>${ticket.token}</token><sign>${ticket.sign}</sign><cuitRepresentada>${representedCuit}</cuitRepresentada>`;

  let targetCuit = candidateCuits[0];
  if (kind === 'DNI' && !useA5) {
    const dniEnvelope = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a13="${ns}"><soapenv:Header/><soapenv:Body><a13:getIdPersonaListByDocumento>${authXml}<documento>${cleanDigits}</documento></a13:getIdPersonaListByDocumento></soapenv:Body></soapenv:Envelope>`;
    const dniRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' },
      body: dniEnvelope,
      signal: AbortSignal.timeout(5000),
    });
    if (dniRes.ok) {
      const resolvedId = extractXmlValue(await dniRes.text(), 'idPersona');
      if (/^\d{11}$/.test(resolvedId)) targetCuit = resolvedId;
    }
  }

  const candidatesToTry = kind === 'DNI' && useA5 ? candidateCuits : [targetCuit];
  for (const cuitCandidate of candidatesToTry) {
    const personaEnvelope = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:pad="${ns}"><soapenv:Header/><soapenv:Body><pad:${methodName}>${authXml}<idPersona>${cuitCandidate}</idPersona></pad:${methodName}></soapenv:Body></soapenv:Envelope>`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' },
      body: personaEnvelope,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) continue;

    const xml = await res.text();
    const razonSocial = extractXmlValue(xml, 'razonSocial');
    const fullName =
      razonSocial || normalizePadronText(`${extractXmlValue(xml, 'apellido')} ${extractXmlValue(xml, 'nombre')}`);
    if (!fullName) continue;

    const domXml = extractFiscalDomicilioBlock(xml);
    const cp = extractXmlValue(domXml, 'codigoPostal') || extractXmlValue(domXml, 'codPostal');
    const localidadRaw =
      extractXmlValue(domXml, 'localidad') || extractXmlValue(domXml, 'descripcionProvincia');
    const locationFormatted = cp && localidadRaw && !localidadRaw.includes(cp)
      ? `${localidadRaw} (CP ${cp})`
      : localidadRaw;
    const streetFallback = normalizePadronText(
      `${extractXmlValue(domXml, 'calle')} ${extractXmlValue(domXml, 'numero')}`,
    );

    return {
      found: true,
      source: 'ARCA_PADRON_A13',
      cuit: cuitCandidate,
      name: fullName,
      address: extractXmlValue(domXml, 'direccion') || streetFallback,
      location: locationFormatted,
      taxStatus: extractXmlValue(xml, 'estadoClave') || undefined,
    };
  }
  return null;
}

async function fetchSingleBcraDenominacion(cuit11: string): Promise<{ cuit: string; name: string } | null> {
  const endpoints = [
    `https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/${cuit11}`,
    `https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/Historicas/${cuit11}`,
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3500),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as {
        results?: { identificacion?: number | string; denominacion?: string };
      };
      const denom = normalizePadronText(body?.results?.denominacion);
      if (denom) {
        return { cuit: String(body?.results?.identificacion || cuit11), name: denom };
      }
    } catch {
      // Siguiente endpoint
    }
  }
  return null;
}

async function queryBcraPublicRegistry(candidateCuits: string[]): Promise<CachedPadronPayload | null> {
  const results = await Promise.all(candidateCuits.map((c) => fetchSingleBcraDenominacion(c)));
  const hit = results.find((r): r is { cuit: string; name: string } => r !== null);
  if (!hit) return null;
  return { found: true, source: 'BCRA_PUBLIC_REGISTRY', cuit: hit.cuit, name: hit.name, address: '', location: '' };
}

export async function lookupTaxpayerByCuitOrDni(rawInput: string): Promise<PadronLookupResult> {
  const parsed = parseFiscalIdentifier(rawInput);
  if (!parsed.isValid || parsed.kind === 'INVALID') {
    throw new ArcaValidationError(parsed.errorMessage || 'DNI o CUIT inválido.', 400);
  }

  const existingPersona = await findLocalExistingPersona(parsed.cleanDigits, parsed.candidateCuits);
  const cacheKey = `${parsed.kind}:${parsed.cleanDigits}`;
  const now = Date.now();
  const cached = padronCache.get(cacheKey);

  if (cached && cached.expiresAtMs > now) {
    return {
      ...cached.data,
      address: cached.data.address || existingPersona?.address || '',
      location: cached.data.location || existingPersona?.city || '',
      alreadyRegistered: Boolean(existingPersona),
      existingPersona,
    };
  }

  try {
    const arcaHit = await queryOfficialArcaPadronA13(parsed.kind, parsed.cleanDigits, parsed.candidateCuits);
    if (arcaHit) {
      padronCache.set(cacheKey, { data: arcaHit, expiresAtMs: now + PADRON_CACHE_TTL_MS });
      return { ...arcaHit, alreadyRegistered: Boolean(existingPersona), existingPersona };
    }
  } catch (err: any) {
    console.warn(`[ARCA Padrón A13] Aviso al consultar ${parsed.cleanDigits}: ${err?.message || err}`);
  }

  const bcraHit = await queryBcraPublicRegistry(parsed.candidateCuits);
  if (bcraHit) {
    return {
      ...bcraHit,
      address: existingPersona?.address || '',
      location: existingPersona?.city || '',
      alreadyRegistered: Boolean(existingPersona),
      existingPersona,
    };
  }

  if (existingPersona) {
    return {
      found: true,
      source: 'LOCAL_DATABASE',
      cuit: (existingPersona.cuit || parsed.normalizedCuit || parsed.cleanDigits).replace(/\D/g, ''),
      name: existingPersona.name,
      address: existingPersona.address || '',
      location: existingPersona.city || '',
      alreadyRegistered: true,
      existingPersona,
    };
  }

  return {
    found: false,
    source: 'NOT_FOUND',
    cuit: parsed.normalizedCuit || parsed.cleanDigits,
    name: '',
    address: '',
    location: '',
    alreadyRegistered: false,
    existingPersona: null,
    message:
      'No se encontraron datos públicos para este DNI/CUIT. El número es válido; completá Razón Social y Dirección manualmente.',
  };
}

export function clearPadronLookupCacheForTests(): void {
  padronCache.clear();
}
