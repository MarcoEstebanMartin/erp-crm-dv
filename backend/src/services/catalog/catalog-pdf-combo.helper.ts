import type PDFKit from 'pdfkit';
import {
  formatCatalogPrice,
  splitBrandAndDescription,
  type CatalogComboInput,
  type CatalogComboProductSide,
} from '../../engines/catalog-studio.engine';
import { getAutocroppedProductImage } from './catalog-image-crop.helper';
import type { PdfFontSet } from './catalog-pdf-primitives.helper';

const NAVY = '#0B2545';
const RED = '#D2001A';
const SLATE_TEXT = '#334155';

export interface ComboProductDisplayParts {
  brand: string;
  varietal: string;
  volume: string;
}

export function parseComboProductDisplay(rawName: string): ComboProductDisplayParts {
  const clean = String(rawName || '').trim().replace(/\s+/g, ' ').toUpperCase();
  if (!clean) return { brand: '', varietal: '', volume: '' };

  const volRegex = /\s*(?:X\s*)?(\d+(?:[.,]\d+)?\s*(?:ML|CC|LTS?|GR|KG|G|UN)\.?)$/i;
  const volMatch = clean.match(volRegex);
  const volume = volMatch ? `x ${volMatch[1].toLowerCase().replace(/\s+/g, ' ')}` : '';
  const withoutVol = volMatch ? clean.slice(0, volMatch.index).trim() : clean;

  const { brand, description } = splitBrandAndDescription(withoutVol);
  if (brand && description) {
    return { brand, varietal: description, volume };
  }
  return { brand: withoutVol || clean, varietal: '', volume };
}

export function formatComboUxb(raw?: string | null): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) return `${s} u.`;
  return s;
}

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

function drawTitleRays(
  doc: PDFKit.PDFDocument,
  anchorX: number,
  midY: number,
  direction: -1 | 1,
): void {
  const rays = [
    { angleDeg: -22, len: 15.5, color: NAVY, dy: -4.2 },
    { angleDeg: 0, len: 18, color: RED, dy: 0 },
    { angleDeg: 22, len: 15.5, color: NAVY, dy: 4.2 },
  ];
  doc.save();
  doc.lineCap('round').lineWidth(2.1);
  for (const r of rays) {
    const rad = (r.angleDeg * Math.PI) / 180;
    const x1 = anchorX;
    const y1 = midY + r.dy;
    const x2 = x1 + direction * Math.cos(rad) * r.len;
    const y2 = y1 + Math.sin(rad) * r.len;
    doc.strokeColor(r.color).moveTo(x1, y1).lineTo(x2, y2).stroke();
  }
  doc.restore();
}

function drawComboPlusSign(doc: PDFKit.PDFDocument, cx: number, cy: number): void {
  const arm = 27;
  const thick = 8.4;
  const radius = 1.4;

  // Soft 3D offset shadow
  doc.save();
  doc.fillColor('#0F172A').fillOpacity(0.14);
  doc.roundedRect(cx - arm / 2 + 2.2, cy - thick / 2 + 2.4, arm, thick, radius).fill();
  doc.roundedRect(cx - thick / 2 + 2.2, cy - arm / 2 + 2.4, thick, arm, radius).fill();
  doc.restore();

  // Solid deep navy plus block
  doc.save();
  doc.fillColor(NAVY);
  doc.roundedRect(cx - arm / 2, cy - thick / 2, arm, thick, radius).fill();
  doc.roundedRect(cx - thick / 2, cy - arm / 2, thick, arm, radius).fill();
  doc.restore();
}

function drawBottleFloorShadow(doc: PDFKit.PDFDocument, cx: number, y: number): void {
  doc.save();
  doc.fillColor('#0F172A').fillOpacity(0.07);
  doc.ellipse(cx, y, 24, 3.6).fill();
  doc.fillOpacity(0.11);
  doc.ellipse(cx, y, 14, 2.0).fill();
  doc.restore();
}

function drawComboTitle(
  doc: PDFKit.PDFDocument,
  fonts: PdfFontSet,
  titleStr: string,
  cx: number,
  titleY: number,
  maxTitleW: number,
): void {
  const words = titleStr.split(/\s+/).filter(Boolean);
  let fontSize = 15.5;
  doc.font(fonts.price).fontSize(fontSize);
  while (doc.widthOfString(titleStr) > maxTitleW && fontSize > 11.5) {
    fontSize -= 0.5;
    doc.fontSize(fontSize);
  }

  const totalW = doc.widthOfString(titleStr);
  const startX = cx - totalW / 2;

  if (words.length >= 2) {
    const firstWord = words[0];
    const restText = words.slice(1).join(' ');
    const firstWithSpaceW = doc.widthOfString(`${firstWord} `);
    doc
      .font(fonts.price)
      .fontSize(fontSize)
      .fillColor(NAVY)
      .text(firstWord, startX, titleY, { lineBreak: false });
    doc
      .font(fonts.price)
      .fontSize(fontSize)
      .fillColor(RED)
      .text(restText, startX + firstWithSpaceW, titleY, { lineBreak: false });
  } else {
    doc
      .font(fonts.price)
      .fontSize(fontSize)
      .fillColor(NAVY)
      .text(titleStr, startX, titleY, { lineBreak: false });
  }

  const midY = titleY + fontSize * 0.54;
  const rayGap = 13;
  drawTitleRays(doc, startX - rayGap, midY, -1);
  drawTitleRays(doc, startX + totalW + rayGap, midY, 1);
}

function drawComboSideInfo(
  doc: PDFKit.PDFDocument,
  fonts: PdfFontSet,
  side: CatalogComboProductSide,
  infoX: number,
  infoW: number,
  cardY: number,
): void {
  const { brand, varietal, volume } = parseComboProductDisplay(side.name);
  let textY = cardY + 55;

  if (brand) {
    let brandSize = 10.2;
    doc.font(fonts.price).fontSize(brandSize);
    while (doc.widthOfString(brand) > infoW && brandSize > 8.2) {
      brandSize -= 0.4;
      doc.fontSize(brandSize);
    }
    doc
      .font(fonts.price)
      .fontSize(brandSize)
      .fillColor(NAVY)
      .text(brand, infoX, textY, { width: infoW, align: 'center', lineBreak: false });
    textY += brandSize + 2.5;
  }

  if (varietal) {
    const varFontSize = 9.3;
    const varLines = splitBalancedTwoLines(doc, varietal, fonts.bold, varFontSize, infoW);
    doc.font(fonts.bold).fontSize(varFontSize).fillColor(RED);
    for (const line of varLines) {
      doc.text(line, infoX, textY, { width: infoW, align: 'center', lineBreak: false });
      textY += 11;
    }
  }

  if (volume) {
    doc
      .font(fonts.bold)
      .fontSize(8.5)
      .fillColor(SLATE_TEXT)
      .text(volume, infoX, textY + 0.5, { width: infoW, align: 'center', lineBreak: false });
  }

  // Price or Free Badge (straight, clean, centered)
  const priceY = cardY + 109;
  if (side.isFree) {
    const freeLabel = String(side.freeLabel || 'SIN CARGO').toUpperCase();
    const freeW = Math.min(infoW - 12, 118);
    const freeX = infoX + (infoW - freeW) / 2;
    doc.roundedRect(freeX, priceY + 2, freeW, 24, 6).fill('#059669');
    doc
      .font(fonts.bold)
      .fontSize(11)
      .fillColor('#FFFFFF')
      .text(freeLabel, freeX, priceY + 8, { width: freeW, align: 'center', lineBreak: false });
  } else {
    doc
      .font(fonts.price)
      .fontSize(21.5)
      .fillColor(RED)
      .text(formatCatalogPrice(side.price), infoX, priceY, {
        width: infoW,
        align: 'center',
        lineBreak: false,
      });
  }

  // Navy straight condition pill + subtle UxB sub-pill
  const cond = String(side.condition || '1 BULTO').toUpperCase();
  const condW = Math.min(infoW - 10, 128);
  const condH = 19;
  const condX = infoX + (infoW - condW) / 2;
  const condY = cardY + 141;

  doc.roundedRect(condX, condY, condW, condH, 5).fill(NAVY);
  doc
    .font(fonts.bold)
    .fontSize(8.6)
    .fillColor('#FFFFFF')
    .text(cond, condX + 4, condY + 5, { width: condW - 8, align: 'center', lineBreak: false });

  const uxbText = formatComboUxb(side.uxb);
  if (uxbText) {
    const uxbW = Math.min(condW - 18, 76);
    const uxbH = 14.5;
    const uxbX = infoX + (infoW - uxbW) / 2;
    const uxbY = condY + condH + 4;
    doc.save();
    doc.lineWidth(0.75);
    doc.roundedRect(uxbX, uxbY, uxbW, uxbH, uxbH / 2).fillAndStroke('#EDF2F7', '#CBD5E1');
    doc
      .font(fonts.bold)
      .fontSize(7.6)
      .fillColor(NAVY)
      .text(uxbText, uxbX + 4, uxbY + 3.2, { width: uxbW - 8, align: 'center', lineBreak: false });
    doc.restore();
  }
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
  const cardY = y + 6;
  const cardH = h - 6;

  doc.save();
  doc.lineWidth(1.25);
  doc.roundedRect(x, cardY, w, cardH, 16).fillAndStroke('#FBFDFE', '#94A3B8');

  // Subtle radial sunburst rays clipped inside the card
  doc.save();
  doc.roundedRect(x, cardY, w, cardH, 16).clip();
  doc.fillColor('#FFFFFF').fillOpacity(0.65);
  const rayLen = Math.max(w, cardH) * 1.2;
  const cyMid = cardY + cardH / 2;
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

  // Top-border straddling COMBO pill
  const comboNum = String(combo.comboNum || 'COMBO 1').toUpperCase();
  const pillW = 108;
  const pillH = 19;
  const pillY = cardY - pillH / 2;
  doc.save();
  doc.lineWidth(1.4);
  doc.roundedRect(cx - pillW / 2, pillY, pillW, pillH, pillH / 2).fillAndStroke(NAVY, '#FFFFFF');
  doc
    .font(fonts.bold)
    .fontSize(9.8)
    .fillColor('#FFFFFF')
    .text(comboNum, cx - pillW / 2, pillY + 4.3, {
      width: pillW,
      align: 'center',
      characterSpacing: 0.6,
      lineBreak: false,
    });
  doc.restore();

  // Two-tone title flanked by 3 decorative rays on each side
  const titleStr = String(combo.title || 'OFERTA COMBO').toUpperCase();
  drawComboTitle(doc, fonts, titleStr, cx, cardY + 18, w - 120);

  // Mirrored layout: [Info 1] [Bottle 1]  +  [Bottle 2] [Info 2]
  const plusZoneHalf = 23;
  const imgBoxW = 78;
  const imgBoxH = 122;
  const imgBoxY = cardY + 52;
  const outerPad = 14;
  const infoGap = 8;

  const leftImgX = cx - plusZoneHalf - imgBoxW;
  const rightImgX = cx + plusZoneHalf;
  const leftInfoX = x + outerPad;
  const leftInfoW = leftImgX - infoGap - leftInfoX;
  const rightInfoX = rightImgX + imgBoxW + infoGap;
  const rightInfoW = x + w - outerPad - rightInfoX;

  drawComboPlusSign(doc, cx, imgBoxY + imgBoxH * 0.5);

  const sides = [
    { side: combo.product1, imgBoxX: leftImgX, infoX: leftInfoX, infoW: leftInfoW },
    { side: combo.product2, imgBoxX: rightImgX, infoX: rightInfoX, infoW: rightInfoW },
  ];

  for (const { side, imgBoxX, infoX, infoW } of sides) {
    const img = await getAutocroppedProductImage(side.imageUrl);
    drawBottleFloorShadow(doc, imgBoxX + imgBoxW / 2, imgBoxY + imgBoxH + 1.5);

    if (img) {
      doc.image(img.buffer, imgBoxX, imgBoxY, {
        fit: [imgBoxW, imgBoxH],
        align: 'center',
        valign: 'bottom',
      });
    } else {
      doc.roundedRect(imgBoxX + 6, imgBoxY + 16, imgBoxW - 12, 92, 5).fill('#F1F5F9');
      doc
        .font(fonts.bold)
        .fontSize(7.5)
        .fillColor('#64748B')
        .text('[ SIN FOTO ]', imgBoxX + 6, imgBoxY + 58, {
          width: imgBoxW - 12,
          align: 'center',
          lineBreak: false,
        });
    }

    drawComboSideInfo(doc, fonts, side, infoX, infoW, cardY);
  }

  doc.restore();
}
