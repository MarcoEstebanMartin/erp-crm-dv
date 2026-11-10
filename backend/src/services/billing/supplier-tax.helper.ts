export async function recordSupplierInvoicePerceptions(
  tx: any,
  params: {
    personaId: number;
    invoiceNumber: string;
    invoiceDate: Date;
    pampa: number;
    bsas: number;
    finalIIBB: number;
    iva3337: number;
    iva5329: number;
    fallbackJurisdiction?: string | null;
  },
): Promise<void> {
  if (params.pampa > 0) {
    await tx.taxWithholding.create({
      data: {
        type: 'PERCEPCION_SUFRIDA',
        taxType: 'IIBB',
        personaId: params.personaId,
        number: params.invoiceNumber,
        date: params.invoiceDate,
        amount: params.pampa,
        jurisdiction: 'AR-L',
      },
    });
  }
  if (params.bsas > 0) {
    await tx.taxWithholding.create({
      data: {
        type: 'PERCEPCION_SUFRIDA',
        taxType: 'IIBB',
        personaId: params.personaId,
        number: params.invoiceNumber,
        date: params.invoiceDate,
        amount: params.bsas,
        jurisdiction: 'AR-B',
      },
    });
  }
  if (params.pampa === 0 && params.bsas === 0 && params.finalIIBB > 0) {
    await tx.taxWithholding.create({
      data: {
        type: 'PERCEPCION_SUFRIDA',
        taxType: 'IIBB',
        personaId: params.personaId,
        number: params.invoiceNumber,
        date: params.invoiceDate,
        amount: params.finalIIBB,
        jurisdiction: params.fallbackJurisdiction ?? null,
      },
    });
  }
  if (params.iva3337 > 0) {
    await tx.taxWithholding.create({
      data: {
        type: 'PERCEPCION_SUFRIDA',
        taxType: 'IVA',
        personaId: params.personaId,
        number: params.invoiceNumber,
        date: params.invoiceDate,
        amount: params.iva3337,
        jurisdiction: 'RG3337',
      },
    });
  }
  if (params.iva5329 > 0) {
    await tx.taxWithholding.create({
      data: {
        type: 'PERCEPCION_SUFRIDA',
        taxType: 'IVA',
        personaId: params.personaId,
        number: params.invoiceNumber,
        date: params.invoiceDate,
        amount: params.iva5329,
        jurisdiction: 'RG5329',
      },
    });
  }
}
