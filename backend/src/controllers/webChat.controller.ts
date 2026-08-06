import { Request, Response } from 'express';
import { aiChatbotService } from '../services/aiChatbot.service';

/**
 * Controller para la atención al cliente en tiempo real desde la Tienda Web
 */
export async function handleWebChatMessage(req: Request, res: Response): Promise<void> {
  try {
    const { messageText, history, mediaBase64, mediaMimeType, customerName, priceListType } = req.body;

    if (!messageText && !mediaBase64) {
      res.status(400).json({ status: 'error', message: 'Debe proporcionar un mensaje o una imagen adjunta.' });
      return;
    }

    const aiResponse = await aiChatbotService.processUserMessage({
      messageText: messageText || '',
      history: Array.isArray(history) ? history : [],
      mediaBase64,
      mediaMimeType,
      channel: 'WEB',
      customerName: customerName || 'Visitante Web',
      priceListType: priceListType || 'LISTA_A'
    });

    res.status(200).json({
      status: 'success',
      data: aiResponse
    });
  } catch (error: any) {
    console.error('[WebChatController] Error al procesar mensaje web:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ocurrió un error al procesar el mensaje con el asistente virtual.'
    });
  }
}
