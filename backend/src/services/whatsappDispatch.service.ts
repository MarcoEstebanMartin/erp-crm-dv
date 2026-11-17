import prisma from '../utils/prisma';
import { receiptPdfService } from './receiptPdf.service';

export function normalizeArgentinaWhatsAppPhone(rawPhone?: string | null): string | null {
  if (!rawPhone) return null;
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  if (digits.startsWith('549')) return digits;
  if (digits.startsWith('54')) return `549${digits.slice(2)}`;
  if (digits.startsWith('0')) return `549${digits.slice(1)}`;
  return `549${digits}`;
}

export const whatsappDispatchService = {
  isConfigured(): boolean {
    return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  },

  /**
   * Genera el PDF oficial del recibo y lo envía por Meta WhatsApp Cloud API (Plantilla Utility).
   * Nunca lanza excepción hacia el caller para no abortar la sincronización contable.
   */
  async dispatchReceiptPdf(fieldReceiptId: number) {
    const receipt = await prisma.fieldReceipt.findUnique({
      where: { id: fieldReceiptId },
      include: {
        persona: { select: { name: true, cuit: true, phone: true, outstandingBalance: true } },
        collector: { select: { username: true } },
        payments: true,
      },
    });

    if (!receipt || !receipt.receiptNumber) {
      return { sent: false, reason: 'Recibo no encontrado o sin numeración oficial' };
    }

    const pdf = await receiptPdfService.generateAndSaveReceiptPdf({
      receiptNumber: receipt.receiptNumber,
      provisionalCode: receipt.provisionalCode,
      capturedAt: receipt.capturedAt,
      customerName: receipt.persona.name,
      customerCuit: receipt.persona.cuit,
      collectorName: receipt.collector.username,
      totalAmount: Number(receipt.totalAmount),
      balanceAfter: Number(receipt.persona.outstandingBalance),
      hasPendingTransfer: receipt.payments.some((p) => p.paymentMethod === 'BANK_TRANSFER'),
      payments: receipt.payments.map((p) => ({
        paymentMethod: p.paymentMethod as 'CASH' | 'BANK_TRANSFER' | 'CHECK',
        amount: Number(p.amount),
        transferReference: p.transferReference,
        checkBank: p.checkBank,
        checkNumber: p.checkNumber,
      })),
    });

    await prisma.fieldReceipt.update({
      where: { id: receipt.id },
      data: { pdfUrl: pdf.publicUrl },
    });

    const toPhone = normalizeArgentinaWhatsAppPhone(receipt.persona.phone);
    if (!toPhone) {
      await prisma.fieldReceipt.update({
        where: { id: receipt.id },
        data: { whatsappStatus: 'FAILED', whatsappError: 'Cliente sin número de WhatsApp válido' },
      });
      return { sent: false, pdfUrl: pdf.publicUrl, reason: 'Cliente sin número válido' };
    }

    if (!this.isConfigured()) {
      await prisma.fieldReceipt.update({
        where: { id: receipt.id },
        data: {
          whatsappStatus: 'FAILED',
          whatsappError: 'Meta WhatsApp Cloud API no configurada (faltan credenciales en .env)',
        },
      });
      return { sent: false, pdfUrl: pdf.publicUrl, reason: 'Credenciales Meta no configuradas' };
    }

    try {
      const token = process.env.WHATSAPP_ACCESS_TOKEN!;
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
      const templateName = process.env.WHATSAPP_RECEIPT_TEMPLATE || 'recibo_cobranza_dv';
      const graphBase = `https://graph.facebook.com/v21.0/${phoneNumberId}`;

      const form = new FormData();
      form.append('messaging_product', 'whatsapp');
      form.append('type', 'application/pdf');
      form.append('file', new Blob([new Uint8Array(pdf.buffer)], { type: 'application/pdf' }), `${receipt.receiptNumber}.pdf`);

      const uploadRes = await fetch(`${graphBase}/media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const uploadJson = (await uploadRes.json()) as { id?: string; error?: { message?: string } };
      if (!uploadRes.ok || !uploadJson.id) {
        throw new Error(uploadJson.error?.message || `Error subiendo PDF a Meta (${uploadRes.status})`);
      }

      const formattedTotal = `$${Math.round(Number(receipt.totalAmount)).toLocaleString('es-AR')}`;
      const msgRes = await fetch(`${graphBase}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: toPhone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'es_AR' },
            components: [
              {
                type: 'header',
                parameters: [
                  {
                    type: 'document',
                    document: {
                      id: uploadJson.id,
                      filename: `${receipt.receiptNumber}.pdf`,
                    },
                  },
                ],
              },
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: receipt.persona.name },
                  { type: 'text', text: formattedTotal },
                  { type: 'text', text: receipt.receiptNumber },
                ],
              },
            ],
          },
        }),
      });

      const msgJson = (await msgRes.json()) as {
        messages?: Array<{ id: string }>;
        error?: { message?: string };
      };
      if (!msgRes.ok || !msgJson.messages?.[0]?.id) {
        throw new Error(msgJson.error?.message || `Error enviando plantilla Meta (${msgRes.status})`);
      }

      const whatsappMessageId = msgJson.messages[0].id;
      await prisma.fieldReceipt.update({
        where: { id: receipt.id },
        data: { whatsappStatus: 'SENT', whatsappMessageId, whatsappError: null },
      });

      return { sent: true, pdfUrl: pdf.publicUrl, whatsappMessageId };
    } catch (error: any) {
      await prisma.fieldReceipt.update({
        where: { id: receipt.id },
        data: {
          whatsappStatus: 'FAILED',
          whatsappError: String(error?.message || 'Error enviando por Meta Cloud API').slice(0, 300),
        },
      });
      return { sent: false, pdfUrl: pdf.publicUrl, reason: error?.message };
    }
  },

  /**
   * Procesa webhook de Meta para actualizar estado DELIVERED / FAILED de un recibo enviado.
   */
  async handleStatusWebhook(messageId: string, status: string, errorMessage?: string) {
    if (!messageId) return;
    if (status === 'delivered' || status === 'read') {
      await prisma.fieldReceipt.updateMany({
        where: { whatsappMessageId: messageId },
        data: { whatsappStatus: 'DELIVERED', whatsappError: null },
      });
    } else if (status === 'failed') {
      await prisma.fieldReceipt.updateMany({
        where: { whatsappMessageId: messageId },
        data: { whatsappStatus: 'FAILED', whatsappError: errorMessage ?? 'Entrega fallida en Meta' },
      });
    }
  },
};
