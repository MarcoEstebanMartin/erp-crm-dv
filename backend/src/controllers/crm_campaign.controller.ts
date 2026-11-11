import { Response } from 'express';
import prisma from '../utils/prisma';
import { whatsAppService } from '../services/whatsapp.service';
import { AuthenticatedRequest } from '../types';

/**
 * Disparar Difusión Masiva de Campaña de Ofertas por WhatsApp
 */
export async function broadcastCampaign(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { campaignId, targetSegment, routeName } = req.body;

    if (!campaignId) {
      res.status(400).json({ status: 'error', message: 'Se requiere el ID de la campaña.' });
      return;
    }

    // 1. Obtener la campaña con sus productos en oferta
    const campaign = await prisma.offerCampaign.findUnique({
      where: { id: parseInt(campaignId, 10) },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!campaign || !campaign.isActive) {
      res.status(404).json({ status: 'error', message: 'Campaña no encontrada o inactiva.' });
      return;
    }

    // 2. Obtener clientes según el segmento seleccionado
    let clientFilter: any = { isClient: true, isActive: true };

    if (targetSegment === 'ROUTE' && routeName) {
      clientFilter.route = { contains: routeName, mode: 'insensitive' };
    } else if (targetSegment === 'INACTIVE') {
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      clientFilter.orders = {
        none: {
          createdAt: { gte: fifteenDaysAgo }
        }
      };
    }

    const clients = await prisma.persona.findMany({
      where: clientFilter,
      select: {
        id: true,
        name: true,
        phone: true,
        route: true
      },
      take: 100
    });

    const validClients = clients.filter(c => c.phone && c.phone.trim().length > 6);

    if (validClients.length === 0) {
      res.status(400).json({ status: 'error', message: 'No se encontraron clientes con teléfono válido en el segmento seleccionado.' });
      return;
    }

    // 3. Formatear el texto promocional
    let offerText = `🔥 *OFERTAS IMPERDIBLES - DV DISTRIBUIDORA* 🔥\n`;
    offerText += `📌 *${campaign.title}*\n\n`;
    offerText += `Aprovechá las mejores ofertas disponibles esta semana:\n`;

    campaign.items.forEach(item => {
      const prodName = item.product.name;
      const offerPrice = Number(item.offerPrice).toLocaleString('es-AR');
      offerText += `• *${prodName}*: *$${offerPrice}*\n`;
    });

    offerText += `\n💬 *Respondé a este mensaje para tomar tu pedido directo con nuestro Asistente.*`;

    // 4. Enviar los mensajes a través del servicio de WhatsApp (Mock o Cloud API)
    let sentCount = 0;
    const sentResults: any[] = [];

    for (const client of validClients) {
      try {
        const cleanPhone = client.phone!.replace(/\D/g, '');
        const personalizedMsg = `Hola *${client.name}*!\n\n${offerText}`;

        const result = await whatsAppService.sendMessage({
          to: cleanPhone,
          text: personalizedMsg
        });

        sentCount++;
        sentResults.push({
          clientId: client.id,
          clientName: client.name,
          phone: cleanPhone,
          status: 'SUCCESS'
        });
      } catch (err: any) {
        sentResults.push({
          clientId: client.id,
          clientName: client.name,
          status: 'FAILED',
          error: err.message
        });
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        campaignTitle: campaign.title,
        totalTargeted: validClients.length,
        sentCount,
        results: sentResults
      }
    });
  } catch (error: any) {
    console.error('Error al difundir campaña de WhatsApp:', error);
    res.status(500).json({ status: 'error', message: 'Error interno al procesar difusión masiva.' });
  }
}
