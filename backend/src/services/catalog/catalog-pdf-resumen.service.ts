import PDFDocument from 'pdfkit';
import {
  formatCatalogPrice,
  formatCurrentEditionSubtitle,
  isRefrigeratedCategory,
  normalizeCatalogBadge,
  parseMinQtyBadge,
  type CatalogProductInput,
  type CatalogRenderConfig,
} from '../../engines/catalog-studio.engine';
import { resolveLogoAssetPath } from './catalog-image-crop.helper';
import { registerCatalogFonts, type PdfFontSet } from './catalog-pdf-primitives.helper';

const PAGE_W = 445; // Mobile-first compact proportion (matching OFERTAS APP)
const PAGE_H = 740;
const MARGIN_X = 16;
const MARGIN_TOP = 18;
const MARGIN_BOTTOM = 22;
const USABLE_W = PAGE_W - 2 * MARGIN_X;

const COL1_W = 265;
const COL2_W = 60;
const COL3_W = USABLE_W - COL1_W - COL2_W;
const X0 = MARGIN_X;
const X1 = X0 + COL1_W;
const X2 = X1 + COL2_W;
const X3 = X0 + USABLE_W;

const TABLE_HEADER_H = 21;
const CAT_ROW_H = 20;
const ROW_H = 21;

function collectPdfBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function formatMinQtyShort(item: CatalogProductInput): string {
  const parsed = parseMinQtyBadge(item.minQty, item.minOrderQuantity);
  if (!parsed) return '';
  if (parsed.top === 'VENTA') return `x ${parsed.bottom}`;
  return `Mín. ${parsed.center} ${parsed.bottom.toLowerCase()}`;
}

function drawPageHeader(
  doc: PDFKit.PDFDocument,
  fonts: PdfFontSet,
  subtitle: string,
  pageNum: number,
): number {
  const topY = MARGIN_TOP;
  const headerH = 30;
  let textStartX = X0;

  const logoPath = resolveLogoAssetPath();
  if (logoPath) {
    try {
      doc.image(logoPath, X0, topY + 2, { fit: [42, 25], valign: 'center' });
      textStartX = X0 + 50;
    } catch {
      // ignore missing logo
    }
  }

  doc
    .font(fonts.bold)
    .fontSize(11.5)
    .fillColor('#18181B')
    .text('Ofertas Semanales', textStartX, topY + 9, { lineBreak: false });

  const rightLabel = pageNum === 1 ? subtitle : `${subtitle}  •  PÁG. ${pageNum}`;
  doc
    .font(fonts.regular)
    .fontSize(8)
    .fillColor('#71717A')
    .text(rightLabel, X0, topY + 11, { width: USABLE_W, align: 'right', lineBreak: false });

  const dividerY = topY + headerH;
  doc.save();
  doc.strokeColor('#E4E4E7').lineWidth(0.6).moveTo(X0, dividerY).lineTo(X3, dividerY).stroke();
  doc.strokeColor('#D74B4B').lineWidth(1.3).moveTo(X0, dividerY).lineTo(X0 + 44, dividerY).stroke();
  doc.restore();

  // Table columns header
  const thY = dividerY + 8;
  doc.save();
  doc.rect(X0, thY, USABLE_W, TABLE_HEADER_H).fill('#18181B');
  doc.strokeColor('#3F3F46').lineWidth(0.4);
  doc.moveTo(X1, thY).lineTo(X1, thY + TABLE_HEADER_H).stroke();
  doc.moveTo(X2, thY).lineTo(X2, thY + TABLE_HEADER_H).stroke();

  doc
    .font(fonts.bold)
    .fontSize(8.2)
    .fillColor('#FFFFFF')
    .text('PRODUCTO', X0 + 8, thY + 6, { characterSpacing: 0.6, lineBreak: false })
    .text('PRECIO', X2, thY + 6, {
      width: COL3_W,
      align: 'center',
      characterSpacing: 0.5,
      lineBreak: false,
    });
  doc.restore();

  return thY + TABLE_HEADER_H;
}

function drawFooter(doc: PDFKit.PDFDocument, fonts: PdfFontSet, pageNum: number): void {
  doc
    .font(fonts.regular)
    .fontSize(7.2)
    .fillColor('#71717A')
    .text(`Pág. ${pageNum}`, X0, PAGE_H - MARGIN_BOTTOM + 4, {
      width: USABLE_W,
      align: 'right',
      lineBreak: false,
    });
}

function drawCategoryRow(
  doc: PDFKit.PDFDocument,
  fonts: PdfFontSet,
  label: string,
  y: number,
  isCont = false,
): number {
  doc.save();
  doc.rect(X0, y, USABLE_W, CAT_ROW_H).fill('#ECECF0');
  doc.lineWidth(0.4).strokeColor('#E4E4E7').rect(X0, y, USABLE_W, CAT_ROW_H).stroke();
  doc.rect(X0, y, 2.5, CAT_ROW_H).fill('#D74B4B');
  doc
    .font(fonts.bold)
    .fontSize(8.8)
    .fillColor('#18181B')
    .text(isCont ? `${label} (CONT.)` : label, X0 + 9, y + 5.8, {
      characterSpacing: 0.5,
      lineBreak: false,
    });
  doc.restore();
  return y + CAT_ROW_H;
}

export async function renderCatalogResumenPdf(
  products: CatalogProductInput[],
  config: CatalogRenderConfig = {},
): Promise<Buffer> {
  const doc = new PDFDocument({ autoFirstPage: false, margin: 0, compress: true });
  const bufferPromise = collectPdfBuffer(doc);
  const fonts = registerCatalogFonts(doc);

  const subtitle = (config.subtitle?.trim() || formatCurrentEditionSubtitle()).toUpperCase();

  // Filter highlighted products (OFERTON + DESTACADO, or only OFERTON if requested)
  const highlighted = products.filter((p) => {
    const b = normalizeCatalogBadge(p.badge);
    if (!b) return false;
    return config.onlyOfertonInResumen ? b === 'OFERTON' : true;
  });

  const refrigerados = highlighted.filter((p) => isRefrigeratedCategory(p.category));
  const varios = highlighted.filter((p) => !isRefrigeratedCategory(p.category));
  const sections: Array<{ name: string; items: CatalogProductInput[] }> = [];
  if (refrigerados.length > 0) sections.push({ name: 'REFRIGERADOS', items: refrigerados });
  if (varios.length > 0) sections.push({ name: 'VARIOS', items: varios });

  let pageNum = 1;
  doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
  let currY = drawPageHeader(doc, fonts, subtitle, pageNum);

  if (sections.length === 0) {
    doc
      .font(fonts.regular)
      .fontSize(10)
      .fillColor('#71717A')
      .text('No hay productos marcados como Ofertón o Destacado.', X0, currY + 28, {
        width: USABLE_W,
        align: 'center',
      });
    drawFooter(doc, fonts, pageNum);
    doc.end();
    return bufferPromise;
  }

  const maxY = PAGE_H - MARGIN_BOTTOM - 8;

  for (const sec of sections) {
    if (currY + CAT_ROW_H + ROW_H > maxY) {
      drawFooter(doc, fonts, pageNum);
      pageNum++;
      doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
      currY = drawPageHeader(doc, fonts, subtitle, pageNum);
    }

    currY = drawCategoryRow(doc, fonts, sec.name, currY, false);

    for (let idx = 0; idx < sec.items.length; idx++) {
      if (currY + ROW_H > maxY) {
        drawFooter(doc, fonts, pageNum);
        pageNum++;
        doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
        currY = drawPageHeader(doc, fonts, subtitle, pageNum);
        currY = drawCategoryRow(doc, fonts, sec.name, currY, true);
      }

      const item = sec.items[idx];
      const isOferton = normalizeCatalogBadge(item.badge) === 'OFERTON';
      const rowBg = idx % 2 === 1 ? '#FAFAFA' : '#FFFFFF';

      doc.save();
      doc.rect(X0, currY, USABLE_W, ROW_H).fill(rowBg);
      doc.lineWidth(0.35).strokeColor('#E4E4E7').rect(X0, currY, USABLE_W, ROW_H).stroke();

      // Subtle red dot indicator for OFERTON
      const nameX = isOferton ? X0 + 14 : X0 + 8;
      if (isOferton) {
        doc.circle(X0 + 7.5, currY + ROW_H / 2, 2.2).fill('#D0021B');
      }

      doc
        .font(isOferton ? fonts.bold : fonts.regular)
        .fontSize(8.4)
        .fillColor('#18181B')
        .text(item.name.toUpperCase(), nameX, currY + 6, {
          width: COL1_W - (nameX - X0) - 6,
          height: 12,
          ellipsis: true,
          lineBreak: false,
        });

      const minLabel = formatMinQtyShort(item);
      if (minLabel) {
        doc
          .font(fonts.regular)
          .fontSize(7.4)
          .fillColor('#71717A')
          .text(minLabel, X1 + 2, currY + 6.5, {
            width: COL2_W - 4,
            align: 'center',
            lineBreak: false,
          });
      }

      doc
        .font(fonts.bold)
        .fontSize(9.2)
        .fillColor(isOferton ? '#D0021B' : '#18181B')
        .text(formatCatalogPrice(item.price), X2 + 4, currY + 5.6, {
          width: COL3_W - 8,
          align: 'right',
          lineBreak: false,
        });

      doc.restore();
      currY += ROW_H;
    }
  }

  drawFooter(doc, fonts, pageNum);
  doc.end();
  return bufferPromise;
}
