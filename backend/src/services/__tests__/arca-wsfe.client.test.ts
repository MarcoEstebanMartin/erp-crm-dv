import { describe, expect, it } from 'vitest';
import {
  buildWsfeCreateVoucherSoapEnvelope,
  parseWsfeCaeResponseXml,
} from '../billing/arca-wsfe.client';
import { buildAfipCreditNotePayload, buildAfipInvoicePayload } from '../afip.service';

describe('ARCA WSFEv1 Direct SOAP Client', () => {
  it('construye sobre SOAP válido para Factura A con IVA y Percepción IIBB', () => {
    const payload = buildAfipInvoicePayload({
      puntoDeVenta: 1,
      nextVoucherNumber: 15,
      now: new Date('2026-11-27T15:00:00.000Z'),
      request: {
        clientCuit: '30-71234567-8',
        clientDocType: 80,
        invoiceType: 'A',
        total: 12400,
        neto: 10000,
        iva: 2100,
        percepcionAmount: 300,
      },
    });

    const xml = buildWsfeCreateVoucherSoapEnvelope({
      token: 'tok-123',
      sign: 'sgn-456',
      cuit: '20163165059',
      payload,
    });

    expect(xml).toContain('<ar:FECAESolicitar>');
    expect(xml).toContain('<ar:Cuit>20163165059</ar:Cuit>');
    expect(xml).toContain('<ar:CbteTipo>1</ar:CbteTipo>');
    expect(xml).toContain('<ar:ImpTotal>12400</ar:ImpTotal>');
    expect(xml).toContain('<ar:AlicIva><ar:Id>5</ar:Id><ar:BaseImp>10000</ar:BaseImp><ar:Importe>2100</ar:Importe></ar:AlicIva>');
    expect(xml).toContain('<ar:Tributo><ar:Id>9</ar:Id><ar:Desc>Percepcion de IIBB</ar:Desc>');
  });

  it('construye sobre SOAP válido para Nota de Crédito A con CbtesAsoc (RG 4540)', () => {
    const payload = buildAfipCreditNotePayload({
      puntoDeVenta: 1,
      nextVoucherNumber: 4,
      emitterCuit: '20-16316505-9',
      now: new Date('2026-11-27T15:00:00.000Z'),
      request: {
        clientCuit: '30-71234567-8',
        clientDocType: 80,
        invoiceType: 'A',
        total: 1210,
        neto: 1000,
        iva: 210,
        associatedVoucher: {
          invoiceNumber: '00001-00000015',
          invoiceType: 'FACTURA_A',
          invoiceDate: '2026-11-27T12:00:00.000Z',
        },
      },
    });

    const xml = buildWsfeCreateVoucherSoapEnvelope({
      token: 'tok-123',
      sign: 'sgn-456',
      cuit: '20163165059',
      payload,
    });

    expect(xml).toContain('<ar:CbteTipo>3</ar:CbteTipo>');
    expect(xml).toContain(
      '<ar:CbtesAsoc><ar:CbteAsoc><ar:Tipo>1</ar:Tipo><ar:PtoVta>1</ar:PtoVta><ar:Nro>15</ar:Nro><ar:Cuit>20163165059</ar:Cuit><ar:CbteFch>20261127</ar:CbteFch></ar:CbteAsoc></ar:CbtesAsoc>',
    );
  });

  it('parsea respuesta aprobada de ARCA extrayendo CAE y vencimiento', () => {
    const okXml = `
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/">
            <FECAESolicitarResult>
              <FeDetResp>
                <FECAEDetResponse>
                  <CbteDesde>15</CbteDesde>
                  <Resultado>A</Resultado>
                  <CAE>76481234567890</CAE>
                  <CAEFchVto>20261207</CAEFchVto>
                </FECAEDetResponse>
              </FeDetResp>
            </FECAESolicitarResult>
          </FECAESolicitarResponse>
        </soap:Body>
      </soap:Envelope>`;

    expect(parseWsfeCaeResponseXml(okXml)).toEqual({
      CAE: '76481234567890',
      CAEFchVto: '20261207',
      CbteDesde: 15,
    });
  });

  it('lanza error detallado con Observaciones y Errors cuando ARCA rechaza un comprobante', () => {
    const rejectedXml = `
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/">
            <FECAESolicitarResult>
              <FeDetResp>
                <FECAEDetResponse>
                  <Resultado>R</Resultado>
                  <Observaciones>
                    <Obs><Code>10016</Code><Msg>El numero o fecha del comprobante no se corresponde con el proximo a autorizar.</Msg></Obs>
                  </Observaciones>
                </FECAEDetResponse>
              </FeDetResp>
            </FECAESolicitarResult>
          </FECAESolicitarResponse>
        </soap:Body>
      </soap:Envelope>`;

    expect(() => parseWsfeCaeResponseXml(rejectedXml)).toThrow(/10016/);
  });
});
