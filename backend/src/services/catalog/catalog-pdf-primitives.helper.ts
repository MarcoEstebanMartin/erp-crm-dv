import fs from 'fs';
import path from 'path';
import type PDFKit from 'pdfkit';
import type { MinQtyBadgeData } from '../../engines/catalog-studio.engine';
import { resolveLogoAssetPath } from './catalog-image-crop.helper';

export interface PdfFontSet {
  regular: string;
  bold: string;
  price: string;
}

function resolveBundledFontDir(): string | null {
  const candidates = [
    path.resolve(__dirname, '../../../assets/fonts'),
    path.resolve(process.cwd(), 'assets/fonts'),
    path.resolve(process.cwd(), 'backend/assets/fonts'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'Montserrat-Bold.ttf'))) {
      return dir;
    }
  }
  return null;
}

export function registerCatalogFonts(doc: PDFKit.PDFDocument): PdfFontSet {
  const bundledDir = resolveBundledFontDir();
  const candidates = [
    ...(bundledDir
      ? [
          {
            reg: path.join(bundledDir, 'Montserrat-Regular.ttf'),
            bold: path.join(bundledDir, 'Montserrat-Bold.ttf'),
            price: path.join(bundledDir, 'Montserrat-ExtraBold.ttf'),
          },
        ]
      : []),
    {
      reg: 'C:/Windows/Fonts/GOTHIC.TTF',
      bold: 'C:/Windows/Fonts/GOTHICB.TTF',
      price: 'C:/Windows/Fonts/ariblk.ttf',
    },
    {
      reg: 'C:/Windows/Fonts/segoeui.ttf',
      bold: 'C:/Windows/Fonts/segoeuib.ttf',
      price: 'C:/Windows/Fonts/seguibl.ttf',
    },
    {
      reg: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      bold: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
      price: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    },
    {
      reg: '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
      bold: '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
      price: '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    },
  ];

  const fonts: PdfFontSet = {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    price: 'Helvetica-Bold',
  };

  for (const c of candidates) {
    try {
      if (fs.existsSync(c.reg)) {
        doc.registerFont('CatalogReg', c.reg);
        fonts.regular = 'CatalogReg';
        if (fs.existsSync(c.bold)) {
          doc.registerFont('CatalogBold', c.bold);
          fonts.bold = 'CatalogBold';
          fonts.price = 'CatalogBold';
        }
        if (fs.existsSync(c.price)) {
          doc.registerFont('CatalogPrice', c.price);
          fonts.price = 'CatalogPrice';
        }
        break;
      }
    } catch {
      // Fallback safely to Helvetica
    }
  }
  return fonts;
}

export function drawEditionHeader(
  doc: PDFKit.PDFDocument,
  fonts: PdfFontSet,
  pageW: number,
  marginX: number,
  headerH: number,
  title: string,
  subtitle: string,
): number {
  const usableW = pageW - 2 * marginX;
  const topBarH = 3;

  // 1. Clean white editorial background + thin crimson top signature bar
  doc.save();
  doc.rect(0, 0, pageW, headerH).fill('#FFFFFF');
  doc.rect(0, 0, pageW, topBarH).fill('#E30613');
  doc.restore();

  // 2. Refined smaller Logo Don Venancio (left, vertically centered)
  const logoPath = resolveLogoAssetPath();
  if (logoPath) {
    try {
      const logoH = 44;
      doc.save();
      doc.image(logoPath, marginX + 2, topBarH + (headerH - topBarH - logoH) / 2, {
        fit: [74, logoH],
        align: 'center',
        valign: 'center',
      });
      doc.restore();
    } catch {
      // ignore missing/corrupt logo
    }
  }

  // 3. Minimalist bold centered title
  const cleanTitle = String(title || 'OFERTAS SEMANALES').toUpperCase();
  const titleSize = cleanTitle.length <= 22 ? 18.5 : 16;
  doc
    .font(fonts.price)
    .fontSize(titleSize)
    .fillColor('#18181B')
    .text(cleanTitle, 0, 19, {
      width: pageW,
      align: 'center',
      characterSpacing: 1.4,
      lineBreak: false,
    });

  // 4. Editorial gray subtitle flanked by fine rules & crimson micro-dots
  const cleanSub = String(subtitle || '').toUpperCase();
  if (cleanSub) {
    const subY = 45;
    const subFontSize = 8.2;
    const subTracking = 2.2;
    doc.font(fonts.regular).fontSize(subFontSize);
    const subW = doc.widthOfString(cleanSub, { characterSpacing: subTracking });
    const cx = pageW / 2;
    const lineY = subY + 4.5;
    const dotOffset = subW / 2 + 8;
    const lineStart = dotOffset + 5;
    const lineLen = 22;

    doc.save();
    doc
      .font(fonts.regular)
      .fontSize(subFontSize)
      .fillColor('#71717A')
      .text(cleanSub, 0, subY, {
        width: pageW,
        align: 'center',
        characterSpacing: subTracking,
        lineBreak: false,
      });

    doc.fillColor('#E30613');
    doc.circle(cx - dotOffset, lineY, 1.3).fill();
    doc.circle(cx + dotOffset, lineY, 1.3).fill();

    doc.strokeColor('#D4D4D8').lineWidth(0.7);
    doc.moveTo(cx - lineStart - lineLen, lineY).lineTo(cx - lineStart, lineY).stroke();
    doc.moveTo(cx + lineStart, lineY).lineTo(cx + lineStart + lineLen, lineY).stroke();
    doc.restore();
  }

  // 5. Crisp bottom hairline divider
  doc.save();
  doc
    .strokeColor('#E4E4E7')
    .lineWidth(0.75)
    .moveTo(marginX, headerH - 1)
    .lineTo(marginX + usableW, headerH - 1)
    .stroke();
  doc.restore();

  return headerH + 12;
}

export function drawCategoryBanner(
  doc: PDFKit.PDFDocument,
  fonts: PdfFontSet,
  catName: string,
  marginX: number,
  y: number,
  usableW: number,
  bannerH: number,
): void {
  const label = String(catName || 'GENERAL')
    .replace(/💣/g, '')
    .trim()
    .toUpperCase();

  doc.save();
  doc.roundedRect(marginX, y, usableW, bannerH, 5).fill('#1E293B');
  doc
    .font(fonts.bold)
    .fontSize(10.2)
    .fillColor('#FFFFFF')
    .text(label, marginX, y + 3.8, {
      width: usableW,
      align: 'center',
      characterSpacing: 1.8,
    });
  doc.restore();
}

export function drawTinyStar(
  doc: PDFKit.PDFDocument,
  cx: number,
  cy: number,
  r: number,
  color: string,
): void {
  doc.save();
  doc.fillColor(color);
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const currR = i % 2 === 0 ? r : r * 0.45;
    const px = cx + currR * Math.cos(angle);
    const py = cy + currR * Math.sin(angle);
    if (i === 0) doc.moveTo(px, py);
    else doc.lineTo(px, py);
  }
  doc.closePath().fill();
  doc.restore();
}

export function drawStarburstBadge(
  doc: PDFKit.PDFDocument,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  points = 22,
  depth = 3.0,
  fillColor = '#D0021B',
): void {
  const step = (2 * Math.PI) / (points * 2);
  const ratio = 1 - depth / Math.max(rx, ry);

  // Drop shadow
  doc.save();
  doc.fillColor('#000000').fillOpacity(0.18);
  for (let i = 0; i < points * 2; i++) {
    const angle = i * step;
    const scale = i % 2 === 0 ? 1 : ratio;
    const px = cx + 1.2 + rx * scale * Math.cos(angle);
    const py = cy + 1.2 + ry * scale * Math.sin(angle);
    if (i === 0) doc.moveTo(px, py);
    else doc.lineTo(px, py);
  }
  doc.closePath().fill();
  doc.restore();

  // Body
  doc.save();
  doc.fillColor(fillColor);
  for (let i = 0; i < points * 2; i++) {
    const angle = i * step;
    const scale = i % 2 === 0 ? 1 : ratio;
    const px = cx + rx * scale * Math.cos(angle);
    const py = cy + ry * scale * Math.sin(angle);
    if (i === 0) doc.moveTo(px, py);
    else doc.lineTo(px, py);
  }
  doc.closePath().fill();
  doc.restore();
}

export function drawMinQtyMedallion(
  doc: PDFKit.PDFDocument,
  fonts: PdfFontSet,
  cx: number,
  cy: number,
  r: number,
  data: MinQtyBadgeData,
): void {
  // Shadow
  doc.save();
  doc.fillColor('#0F172A').fillOpacity(0.22);
  doc.circle(cx + 0.8, cy + 1.1, r).fill();
  doc.restore();

  // Deep Midnight Navy circle + crisp white border
  doc.save();
  doc.circle(cx, cy, r).fillAndStroke('#0F2744', '#FFFFFF');
  doc.lineWidth(1.2).stroke();

  // Fine golden inner ring
  doc.circle(cx, cy, r - 2).lineWidth(0.65).strokeColor('#F59E0B').stroke();

  // Top label (gold)
  doc
    .font(fonts.bold)
    .fontSize(5.8)
    .fillColor('#FDE047')
    .text(data.top, cx - r, cy - r * 0.72, { width: r * 2, align: 'center' });

  // Center number (white bold)
  const centerSize = data.center.length > 2 ? 11.2 : 14;
  doc
    .font(fonts.price)
    .fontSize(centerSize)
    .fillColor('#FFFFFF')
    .text(data.center, cx - r, cy - centerSize * 0.56, { width: r * 2, align: 'center' });

  // Bottom unit (silver)
  doc
    .font(fonts.bold)
    .fontSize(5.4)
    .fillColor('#E2E8F0')
    .text(data.bottom, cx - r, cy + r * 0.36, { width: r * 2, align: 'center' });
  doc.restore();
}

export interface PriceTagBadgeOptions {
  priceStr: string;
  oldPriceStr?: string | null;
  isOferton?: boolean;
  rightEdgeX: number;
  topY: number;
}

export function drawPriceTagBadge(
  doc: PDFKit.PDFDocument,
  fonts: PdfFontSet,
  opts: PriceTagBadgeOptions,
): void {
  const { priceStr, oldPriceStr, isOferton = false, rightEdgeX, topY } = opts;
  const hasOld = Boolean(oldPriceStr);

  const pFontSize = priceStr.length >= 8 ? 15.5 : priceStr.length >= 7 ? 17 : 18.5;
  doc.font(fonts.price).fontSize(pFontSize);
  const priceTextW = doc.widthOfString(priceStr);

  const rectW = Math.max(70, priceTextW + 18);
  const rectH = isOferton ? 33 : 28;
  const rectX = rightEdgeX - rectW;
  const rectY = topY + (hasOld ? 17.2 : 0);

  // 1. Subtle drop shadow for main red rectangle
  doc.save();
  doc.fillColor('#0F172A').fillOpacity(0.16);
  doc.roundedRect(rectX + 1, rectY + 1.4, rectW, rectH, 7).fill();
  doc.restore();

  // 2. Main red rounded rectangle + bold white price
  doc.save();
  doc.roundedRect(rectX, rectY, rectW, rectH, 7).fill('#E30613');

  const priceY = isOferton
    ? rectY + (rectH - 5 - pFontSize * 1.15) / 2
    : rectY + (rectH - pFontSize * 1.15) / 2;

  doc
    .font(fonts.price)
    .fontSize(pFontSize)
    .fillColor('#FFFFFF')
    .text(priceStr, rectX, priceY, {
      width: rectW,
      align: 'center',
      lineBreak: false,
    });
  doc.restore();

  // 3. Tilted yellow old-price pill overlapping top-right (+30% scale over previous)
  if (hasOld && oldPriceStr) {
    const oldFontSize = 13.45;
    doc.font(fonts.price).fontSize(oldFontSize);
    const oldTextW = doc.widthOfString(oldPriceStr);
    const oldW = Math.max(66, oldTextW + 17.5);
    const oldH = 22.2;
    const oldX = rectX + rectW - oldW - 1;
    const oldY = rectY - oldH + 5.5;
    const oldCx = oldX + oldW / 2;
    const oldCy = oldY + oldH / 2;

    doc.save();
    doc.rotate(4.2, { origin: [oldCx, oldCy] });
    doc.fillColor('#0F172A').fillOpacity(0.14);
    doc.roundedRect(oldX + 0.9, oldY + 1.4, oldW, oldH, 5.5).fill();
    doc.fillOpacity(1);
    doc.roundedRect(oldX, oldY, oldW, oldH, 5.5).fill('#FBBF24');

    doc
      .font(fonts.price)
      .fontSize(oldFontSize)
      .fillColor('#18181B')
      .text(oldPriceStr, oldX, oldY + (oldH - oldFontSize * 1.18) / 2, {
        width: oldW,
        align: 'center',
        lineBreak: false,
      });

    const strikePad = Math.max(5.7, (oldW - oldTextW) / 2 - 2);
    doc
      .strokeColor('#DC2626')
      .lineWidth(0.9)
      .lineCap('round')
      .moveTo(oldX + strikePad, oldCy + 4.0)
      .lineTo(oldX + oldW - strikePad, oldCy - 3.6)
      .stroke();
    doc.restore();
  }

  // 4. Tilted dark obsidian OFERTÓN! pill overlapping bottom-left (+10% scale)
  if (isOferton) {
    const pillLabel = 'OFERTÓN!';
    const pillFontSize = 8.6;
    doc.font(fonts.price).fontSize(pillFontSize);
    const pillTextW = doc.widthOfString(pillLabel, { characterSpacing: 0.45 });
    const pillW = Math.max(60, Math.min(rectW - 4, pillTextW + 15.5));
    const pillH = 14.85;
    const pillX = rectX + 4;
    const pillY = rectY + rectH - 6;
    const pillCx = pillX + pillW / 2;
    const pillCy = pillY + pillH / 2;

    doc.save();
    doc.rotate(-3.4, { origin: [pillCx, pillCy] });
    doc.fillColor('#0F172A').fillOpacity(0.18);
    doc.roundedRect(pillX + 0.7, pillY + 1.1, pillW, pillH, 3.3).fill();
    doc.fillOpacity(1);
    doc.roundedRect(pillX, pillY, pillW, pillH, 3.3).fill('#0F172A');

    doc
      .font(fonts.price)
      .fontSize(pillFontSize)
      .fillColor('#FFFFFF')
      .text(pillLabel, pillX, pillY + (pillH - pillFontSize * 1.18) / 2, {
        width: pillW,
        align: 'center',
        characterSpacing: 0.45,
        lineBreak: false,
      });
    doc.restore();
  }
}
