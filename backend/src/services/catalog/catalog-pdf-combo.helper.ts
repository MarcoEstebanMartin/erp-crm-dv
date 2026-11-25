import type PDFKit from 'pdfkit';
import {
  formatCatalogPrice,
  type CatalogComboInput,
} from '../../engines/catalog-studio.engine';
import { getAutocroppedProductImage } from './catalog-image-crop.helper';
import type { PdfFontSet } from './catalog-pdf-primitives.helper';

export function collectPdfBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

export function splitBalancedTwoLines(
  doc: PDFKit.PDFDocument,
  text: string,
  font: string,
  fontSize: number,
  maxWidth: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  doc.font(font).fontSize(fontSize);
  const full = words.join(' ');
  if (doc.widthOfString(full) <= maxWidth) return [full];

  let bestSplit: string[] | null = null;
  let bestScore = Infinity;

  for (let i = 1; i < words.length; i++) {
    const l1Words = words.slice(0, i);
    const l2Words = words.slice(i);
    const l1 = l1Words.join(' ');
    const l2 = l2Words.join(' ');
    const w1 = doc.widthOfString(l1);
    const w2 = doc.widthOfString(l2);
    if (w1 <= maxWidth && w2 <= maxWidth) {
      let score = Math.abs(w1 - w2);
      if (l2Words.length === 1) score += 350;
      if (['ML', 'CC', 'GR', 'KG', 'LT', 'LTS', 'UN', 'G'].includes(l2)) score += 1000;
      if (l1Words[l1Words.length - 1] === 'X') score += 500;
      if (l2Words[0] === 'X') score -= 50;
      if (score < bestScore) {
        bestScore = score;
        bestSplit = [l1, l2];
      }
    }
  }
  if (bestSplit) return bestSplit;

  const lines: string[] = [];
  let curr: string[] = [];
  for (const w of words) {
    const trial = [...curr, w].join(' ');
    if (doc.widthOfString(trial) <= maxWidth) {
      curr.push(w);
    } else {
      if (curr.length > 0) {
        lines.push(curr.join(' '));
        curr = [w];
      } else {
        lines.push(w);
        curr = [];
      }
      if (lines.length === 2) break;
    }
  }
  if (curr.length > 0 && lines.length < 2) lines.push(curr.join(' '));
  return lines.slice(0, 2);
}

export async function drawComboCard(
  doc: PDFKit.PDFDocument,
  fonts: PdfFontSet,
  combo: CatalogComboInput,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<void> {
  const cx = x + w / 2;

  doc.save();
  doc.roundedRect(x, y, w, h, 16).fillAndStroke('#FBFDFE', '#94A3B8');
  doc.lineWidth(1.3);

  doc.save();
  doc.roundedRect(x, y, w, h, 16).clip();
  doc.fillColor('#FFFFFF').fillOpacity(0.65);
  const rayLen = Math.max(w, h) * 1.2;
  const cyMid = y + h / 2;
  for (let i = 0; i < 28; i += 2) {
    const a1 = (i * 2 * Math.PI) / 28;
    const a2 = ((i + 1) * 2 * Math.PI) / 28;
    doc
      .moveTo(cx, cyMid)
      .lineTo(cx + rayLen * Math.cos(a1), cyMid + rayLen * Math.sin(a1))
      .lineTo(cx + rayLen * Math.cos(a2), cyMid + rayLen * Math.sin(a2))
      .closePath()
      .fill();
  }
  doc.restore();

  const comboNum = String(combo.comboNum || 'COMBO 1').toUpperCase();
  const pillW = 104;
  const pillH = 20;
  const pillColor = comboNum.includes('2') ? '#D2001A' : '#0B2545';
  doc.roundedRect(cx - pillW / 2, y + 8, pillW, pillH, pillH / 2).fill(pillColor);
  doc
    .font(fonts.bold)
    .fontSize(10.5)
    .fillColor('#FFFFFF')
    .text(comboNum, cx - pillW / 2, y + 12, { width: pillW, align: 'center', lineBreak: false });

  const titleStr = String(combo.title || 'OFERTA COMBO').toUpperCase();
  doc
    .font(fonts.price)
    .fontSize(15)
    .fillColor('#0B2545')
    .text(titleStr, x + 24, y + 32, { width: w - 48, align: 'center', lineBreak: false });

  const halfW = (w - 52) / 2;
  const sides = [
    { side: combo.product1, sx: x + 12 },
    { side: combo.product2, sx: x + w - 12 - halfW },
  ];

  doc.circle(cx, y + h * 0.58, 15).fill('#D2001A');
  doc
    .font(fonts.bold)
    .fontSize(20)
    .fillColor('#FFFFFF')
    .text('+', cx - 15, y + h * 0.58 - 11.5, { width: 30, align: 'center', lineBreak: false });

  for (const { side, sx } of sides) {
    const img = await getAutocroppedProductImage(side.imageUrl);
    const imgBoxX = sx + 6;
    const imgBoxY = y + 58;
    const imgBoxW = 86;
    const imgBoxH = 112;

    if (img) {
      doc.image(img.buffer, imgBoxX, imgBoxY, {
        fit: [imgBoxW, imgBoxH],
        align: 'center',
        valign: 'center',
      });
    } else {
      doc.roundedRect(imgBoxX, imgBoxY + 12, imgBoxW, 84, 5).fill('#F1F5F9');
      doc
        .font(fonts.bold)
        .fontSize(7.5)
        .fillColor('#64748B')
        .text('[ SIN FOTO ]', imgBoxX, imgBoxY + 50, { width: imgBoxW, align: 'center', lineBreak: false });
    }

    const infoX = sx + 98;
    const infoW = halfW - 104;
    doc
      .font(fonts.bold)
      .fontSize(9.5)
      .fillColor('#0F172A')
      .text(String(side.name || '').toUpperCase(), infoX, y + 60, {
        width: infoW,
        height: 44,
        ellipsis: true,
      });

    if (side.isFree) {
      const freeLabel = String(side.freeLabel || 'SIN CARGO').toUpperCase();
      doc.roundedRect(infoX, y + 110, Math.min(infoW, 112), 24, 6).fill('#059669');
      doc
        .font(fonts.bold)
        .fontSize(11)
        .fillColor('#FFFFFF')
        .text(freeLabel, infoX, y + 116, { width: Math.min(infoW, 112), align: 'center', lineBreak: false });
    } else {
      doc
        .font(fonts.price)
        .fontSize(20)
        .fillColor('#D2001A')
        .text(formatCatalogPrice(side.price), infoX, y + 108, { width: infoW, lineBreak: false });
    }

    const cond = String(side.condition || '1 BULTO').toUpperCase();
    const uxb = side.uxb ? ` · ${String(side.uxb).trim()}` : '';
    doc.roundedRect(infoX, y + 144, infoW, 20, 4).fill('#EBF0F6');
    doc
      .font(fonts.bold)
      .fontSize(8.2)
      .fillColor('#0B2545')
      .text(`${cond}${uxb}`, infoX + 4, y + 149.5, { width: infoW - 8, align: 'center', lineBreak: false });
  }

  doc.restore();
}
