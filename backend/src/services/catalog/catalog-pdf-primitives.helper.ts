import fs from 'fs';
import type PDFKit from 'pdfkit';
import type { MinQtyBadgeData } from '../../engines/catalog-studio.engine';
import { resolveLogoAssetPath } from './catalog-image-crop.helper';

export interface PdfFontSet {
  regular: string;
  bold: string;
  price: string;
}

export function registerCatalogFonts(doc: PDFKit.PDFDocument): PdfFontSet {
  const candidates = [
    {
      reg: 'C:/Windows/Fonts/GOTHIC.TTF',
      bold: 'C:/Windows/Fonts/GOTHICB.TTF',
      price: 'C:/Windows/Fonts/seguibli.ttf',
    },
    {
      reg: 'C:/Windows/Fonts/segoeui.ttf',
      bold: 'C:/Windows/Fonts/segoeuib.ttf',
      price: 'C:/Windows/Fonts/ariblk.ttf',
    },
    {
      reg: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      bold: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
      price: '/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf',
    },
    {
      reg: '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
      bold: '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
      price: '/usr/share/fonts/truetype/liberation/LiberationSans-BoldItalic.ttf',
    },
  ];

  const fonts: PdfFontSet = {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    price: 'Helvetica-BoldOblique',
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
  // 1. Crimson Luxury Red background (#B91226)
  doc.save();
  doc.rect(0, 0, pageW, headerH).fill('#B91226');

  // 2. Top gold hairline accent
  doc.strokeOpacity(0.38).strokeColor('#FEF08A').lineWidth(1.2);
  doc.moveTo(0, 0.6).lineTo(pageW, 0.6).stroke();
  doc.restore();

  // 3. Logo Don Venancio (left, vertically centered)
  const logoPath = resolveLogoAssetPath();
  if (logoPath) {
    try {
      doc.image(logoPath, marginX, (headerH - 56) / 2, {
        fit: [92, 56],
        align: 'center',
        valign: 'center',
      });
    } catch {
      // ignore missing/corrupt logo
    }
  }

  // 4. Centered Title
  const cleanTitle = String(title || 'OFERTAS SEMANALES').toUpperCase();
  const titleSize = cleanTitle.length <= 22 ? 22 : 19;
  doc
    .font(fonts.bold)
    .fontSize(titleSize)
    .fillColor('#FFFFFF')
    .text(cleanTitle, 0, 22, { width: pageW, align: 'center', characterSpacing: 0.6 });

  // 5. Edition Obsidian Pill
  const cleanSub = String(subtitle || '').toUpperCase();
  if (cleanSub) {
    doc.font(fonts.bold).fontSize(8.5);
    const subW = doc.widthOfString(cleanSub, { characterSpacing: 0.8 });
    const pillW = Math.max(130, subW + 36);
    const pillH = 20;
    const pillX = (pageW - pillW) / 2;
    const pillY = 54;

    doc.save();
    doc.roundedRect(pillX, pillY, pillW, pillH, pillH / 2).fill('#0B1120');
    doc
      .strokeOpacity(0.35)
      .strokeColor('#FEF08A')
      .lineWidth(0.8)
      .roundedRect(pillX, pillY, pillW, pillH, pillH / 2)
      .stroke();
    doc.restore();

    doc
      .font(fonts.bold)
      .fontSize(8.5)
      .fillColor('#FFFFFF')
      .text(cleanSub, pillX, pillY + 5.5, {
        width: pillW,
        align: 'center',
        characterSpacing: 0.8,
      });
  }

  return headerH + 14;
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
  points = 18,
  depth = 4.2,
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
