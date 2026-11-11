import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface WsaaCredentials {
  token: string;
  sign: string;
  expiresAtMs: number;
}

const ticketCache = new Map<string, WsaaCredentials>();
const inFlightTickets = new Map<string, Promise<WsaaCredentials>>();

function encodeDerLength(len: number): Buffer {
  if (len < 128) return Buffer.from([len]);
  const bytes: number[] = [];
  let rem = len;
  while (rem > 0) {
    bytes.unshift(rem & 0xff);
    rem >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function derWrap(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), encodeDerLength(content.length), content]);
}

function readAsn1Element(buf: Buffer, offset: number): { tlv: Buffer; headerLen: number; bodyLen: number; nextOffset: number } {
  const firstLen = buf[offset + 1];
  let bodyLen = 0;
  let headerLen = 2;
  if ((firstLen & 0x80) === 0) {
    bodyLen = firstLen;
  } else {
    const numBytes = firstLen & 0x7f;
    headerLen = 2 + numBytes;
    for (let i = 0; i < numBytes; i++) {
      bodyLen = (bodyLen << 8) | buf[offset + 2 + i];
    }
  }
  const totalLen = headerLen + bodyLen;
  return {
    tlv: buf.subarray(offset, offset + totalLen),
    headerLen,
    bodyLen,
    nextOffset: offset + totalLen,
  };
}

/**
 * Extrae los TLVs exactos de `serialNumber` e `issuer` desde el certificado DER X.509
 * para construir `SignerIdentifier (IssuerAndSerialNumber)` requerido por CMS / WSAA ARCA.
 */
function extractIssuerAndSerialTlv(certDer: Buffer): Buffer {
  const outer = readAsn1Element(certDer, 0);
  const tbs = readAsn1Element(certDer, outer.headerLen);
  let cursor = outer.headerLen + tbs.headerLen;

  // Si existe version explícita [0] EXPLICIT (tag 0xa0), avanzamos al serialNumber
  if (certDer[cursor] === 0xa0) {
    cursor = readAsn1Element(certDer, cursor).nextOffset;
  }
  const serialEl = readAsn1Element(certDer, cursor);
  const sigAlgEl = readAsn1Element(certDer, serialEl.nextOffset);
  const issuerEl = readAsn1Element(certDer, sigAlgEl.nextOffset);

  // RFC 5652 §10.2.4: IssuerAndSerialNumber ::= SEQUENCE { issuer Name, serialNumber CertificateSerialNumber }
  return derWrap(0x30, Buffer.concat([issuerEl.tlv, serialEl.tlv]));
}

/**
 * Construye un mensaje CMS / PKCS#7 `SignedData` en DER puro con `crypto` nativo de Node.js
 * (sin depender de binarios OpenSSL externos ni SDKs pagos).
 */
export function signWsaaTraCmsBase64(traXml: string, certPem: string, keyPem: string): string {
  const dataBuf = Buffer.from(traXml, 'utf8');
  const x509 = new crypto.X509Certificate(certPem);
  const certDer = x509.raw;

  const signature = crypto.sign('RSA-SHA256', dataBuf, keyPem);

  // OIDs en DER
  const oidData = Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01]); // 1.2.840.113549.1.7.1
  const oidSignedData = Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02]); // 1.2.840.113549.1.7.2
  const oidSha256 = Buffer.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]); // 2.16.840.1.101.3.4.2.1
  const oidRsaSha256 = Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b]); // 1.2.840.113549.1.1.11
  const asn1Null = Buffer.from([0x05, 0x00]);
  const version1 = Buffer.from([0x02, 0x01, 0x01]);

  const sha256AlgId = derWrap(0x30, Buffer.concat([oidSha256, asn1Null]));
  const rsaSha256AlgId = derWrap(0x30, Buffer.concat([oidRsaSha256, asn1Null]));

  const digestAlgorithms = derWrap(0x31, sha256AlgId);
  const encapContentInfo = derWrap(
    0x30,
    Buffer.concat([oidData, derWrap(0xa0, derWrap(0x04, dataBuf))]),
  );
  const certificatesField = derWrap(0xa0, certDer);

  const issuerAndSerial = extractIssuerAndSerialTlv(certDer);
  const signerInfo = derWrap(
    0x30,
    Buffer.concat([
      version1,
      issuerAndSerial,
      sha256AlgId,
      rsaSha256AlgId,
      derWrap(0x04, signature),
    ]),
  );
  const signerInfos = derWrap(0x31, signerInfo);

  const signedData = derWrap(
    0x30,
    Buffer.concat([version1, digestAlgorithms, encapContentInfo, certificatesField, signerInfos]),
  );

  const contentInfo = derWrap(
    0x30,
    Buffer.concat([oidSignedData, derWrap(0xa0, signedData)]),
  );

  return contentInfo.toString('base64');
}

export function extractRepresentedCuitFromCert(certPem: string): string {
  try {
    const subj = new crypto.X509Certificate(certPem).subject;
    const m = /CUIT\s*(\d{11})/i.exec(subj);
    return m ? m[1] : '';
  } catch {
    return '';
  }
}

export function resolveArcaCertAndKey(): { certPem: string; keyPem: string; isProduction: boolean } | null {
  const isPadronProd =
    process.env.ARCA_PADRON_PRODUCTION !== undefined
      ? process.env.ARCA_PADRON_PRODUCTION === 'true'
      : true;
  const envCertPem = (process.env.ARCA_PADRON_CERT_PEM || process.env.AFIP_CERT_PEM || '').trim();
  const envKeyPem = (process.env.ARCA_PADRON_KEY_PEM || process.env.AFIP_KEY_PEM || '').trim();

  if (envCertPem && envKeyPem) {
    return {
      certPem: envCertPem.replace(/\\n/g, '\n'),
      keyPem: envKeyPem.replace(/\\n/g, '\n'),
      isProduction: isPadronProd,
    };
  }

  const dedicatedCert = path.resolve(process.env.ARCA_PADRON_CERT_PATH || './certs/arca.crt');
  const dedicatedKey = path.resolve(process.env.ARCA_PADRON_KEY_PATH || './certs/arca.key');
  if (fs.existsSync(dedicatedCert) && fs.existsSync(dedicatedKey)) {
    return {
      certPem: fs.readFileSync(dedicatedCert, 'utf8'),
      keyPem: fs.readFileSync(dedicatedKey, 'utf8'),
      isProduction: isPadronProd,
    };
  }

  const certPath = path.resolve(process.env.AFIP_CERT_PATH || './certs/homo.crt');
  const keyPath = path.resolve(process.env.AFIP_KEY_PATH || './certs/homo.key');

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    return null;
  }

  return {
    certPem: fs.readFileSync(certPath, 'utf8'),
    keyPem: fs.readFileSync(keyPath, 'utf8'),
    isProduction: process.env.AFIP_PRODUCTION === 'true',
  };
}

function extractXmlTag(xml: string, tag: string): string | null {
  const decoded = xml
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = re.exec(decoded);
  return match ? match[1].trim() : null;
}

export async function getArcaWsaaTicket(serviceName: string): Promise<WsaaCredentials | null> {
  const creds = resolveArcaCertAndKey();
  if (!creds) return null;

  const cacheKey = `${creds.isProduction ? 'prod' : 'homo'}:${serviceName}`;
  const now = Date.now();
  const cached = ticketCache.get(cacheKey);
  if (cached && cached.expiresAtMs - 600_000 > now) {
    return cached;
  }

  const existingFlight = inFlightTickets.get(cacheKey);
  if (existingFlight) return existingFlight;

  const flight = (async () => {
    const genDate = new Date(now - 120_000).toISOString();
    const expDate = new Date(now + 12 * 3600_000).toISOString();
    const uniqueId = Math.floor(now / 1000);
    const traXml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<loginTicketRequest version="1.0">` +
      `<header><uniqueId>${uniqueId}</uniqueId><generationTime>${genDate}</generationTime><expirationTime>${expDate}</expirationTime></header>` +
      `<service>${serviceName}</service>` +
      `</loginTicketRequest>`;

    const cmsB64 = signWsaaTraCmsBase64(traXml, creds.certPem, creds.keyPem);
    const wsaaUrl = creds.isProduction
      ? 'https://wsaa.afip.gov.ar/ws/services/LoginCms'
      : 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms';

    const soapEnvelope =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">` +
      `<soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cmsB64}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`;

    const response = await fetch(wsaaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' },
      body: soapEnvelope,
      signal: AbortSignal.timeout(8000),
    });

    const xml = await response.text();
    const token = extractXmlTag(xml, 'token');
    const sign = extractXmlTag(xml, 'sign');
    const expirationStr = extractXmlTag(xml, 'expirationTime');

    if (!response.ok || !token || !sign) {
      const fault = extractXmlTag(xml, 'faultstring') || `HTTP ${response.status}`;
      throw new Error(`WSAA rechazó autenticación (${serviceName}): ${fault}`);
    }

    const ticket: WsaaCredentials = {
      token,
      sign,
      expiresAtMs: expirationStr ? new Date(expirationStr).getTime() : now + 11 * 3600_000,
    };
    ticketCache.set(cacheKey, ticket);
    return ticket;
  })();

  inFlightTickets.set(cacheKey, flight);
  try {
    return await flight;
  } finally {
    inFlightTickets.delete(cacheKey);
  }
}
