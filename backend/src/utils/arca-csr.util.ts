import crypto from 'crypto';

function encodeLen(len: number): Buffer {
  if (len < 128) return Buffer.from([len]);
  const bytes: number[] = [];
  let rem = len;
  while (rem > 0) {
    bytes.unshift(rem & 0xff);
    rem >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function wrap(tag: number, body: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), encodeLen(body.length), body]);
}

function rdnAttr(oidBytes: number[], valueTag: number, text: string): Buffer {
  const oid = wrap(0x06, Buffer.from(oidBytes));
  const val = wrap(valueTag, Buffer.from(text, 'utf8'));
  return wrap(0x31, wrap(0x30, Buffer.concat([oid, val])));
}

/**
 * Genera clave privada RSA 2048 (`arca.key`) y solicitud PKCS#10 (`pedido_arca.csr`)
 * lista para subir a ARCA ("Administración de Certificados Digitales") sin depender de OpenSSL externo.
 */
export function generateArcaKeyAndCsr(cuit11: string, companyName = 'DON VENANCIO'): {
  keyPem: string;
  csrPem: string;
} {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  const keyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const spkiDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;

  const subject = wrap(
    0x30,
    Buffer.concat([
      rdnAttr([0x55, 0x04, 0x06], 0x13, 'AR'),
      rdnAttr([0x55, 0x04, 0x0a], 0x0c, companyName),
      rdnAttr([0x55, 0x04, 0x03], 0x0c, 'ERP-DV'),
      rdnAttr([0x55, 0x04, 0x05], 0x13, `CUIT ${cuit11}`),
    ]),
  );

  const version0 = Buffer.from([0x02, 0x01, 0x00]);
  const emptyAttrs = Buffer.from([0xa0, 0x00]);
  const certReqInfo = wrap(0x30, Buffer.concat([version0, subject, spkiDer, emptyAttrs]));

  const signature = crypto.sign('RSA-SHA256', certReqInfo, privateKey);
  const rsaSha256Alg = wrap(
    0x30,
    Buffer.concat([
      Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b]),
      Buffer.from([0x05, 0x00]),
    ]),
  );
  const bitStringSig = wrap(0x03, Buffer.concat([Buffer.from([0x00]), signature]));
  const csrDer = wrap(0x30, Buffer.concat([certReqInfo, rsaSha256Alg, bitStringSig]));

  const b64Lines = csrDer.toString('base64').match(/.{1,64}/g)?.join('\n') || '';
  const csrPem = `-----BEGIN CERTIFICATE REQUEST-----\n${b64Lines}\n-----END CERTIFICATE REQUEST-----\n`;

  return { keyPem, csrPem };
}
