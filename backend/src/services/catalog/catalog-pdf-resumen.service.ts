import PDFDocument from 'pdfkit';
import {
  buildResumenSections,
  formatCatalogPrice,
  formatCurrentEditionSubtitle,
  formatResumenMinQty,
  normalizeCatalogBadge,
  type CatalogProductInput,
  type CatalogRenderConfig,
  type CatalogResumenMode,
} from '../../engines/catalog-studio.engine';
import { resolveLogoAssetPath } from './catalog-image-crop.helper';
import { registerCatalogFonts, type PdfFontSet } from './catalog-pdf-primitives.helper';

const PAGE_W = 595; // A4 vertical
const PAGE_H = 842;
const MARGIN_X = 20;
const MARGIN_TOP = 16;
const MARGIN_BOTTOM = 16;
const USABLE_W = PAGE_W - 2 * MARGIN_X;
const COL_GAP = 12;
const TABLE_HEADER_H = 18;

type FlatRow =
  | { kind: 'section'; label: string }
  | { kind: 'item'; item: CatalogProductInput; zebra: boolean };

function collectPdfBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function resolveResumenMode(config: CatalogRenderConfig): CatalogResumenMode {
  if (config.resumenMode) return config.resumenMode;
  return config.onlyOfertonInResumen ? 'ofertones' : 'all';
}

function getHeaderTitle(mode: CatalogResumenMode): string {
  if (mode === 'ofertones') return 'Ofertones';
  if (mode === 'destacados') return 'Destacados';
  return 'Ofertones y Destacados';
}

function drawPageHeader(
  doc: PDFKit.PDFDocument,
  fonts: PdfFontSet,
  mode: CatalogResumenMode,
  subtitle: string,
  pageNum: number,
): number {
  const topY = MARGIN_TOP;
  let textStartX = MARGIN_X;

  const logoPath = resolveLogoAssetPath();
  if (logoPath) {
    try {
      doc.image(logoPath, MARGIN_X, topY + 1, { fit: [42, 24], valign: 'center' });
      textStartX = MARGIN_X + 50;
    } catch {
      // ignore missing logo
    }
  }

  doc
    .font(fonts.bold)
    .fontSize(12.5)
    .fillColor(mode === 'ofertones' ? '#C80510' : '#18181B')
    .text(getHeaderTitle(mode), textStartX, topY + 6, { lineBreak: false });

  if (mode === 'all') {
    const legendX = textStartX + 158;
    doc.save();
    doc.rect(legendX, topY + 10, 7, 7).fill('#E30613');
    doc
      .font(fonts.regular)
      .fontSize(7.2)
      .fillColor('#52525B')
      .text('Ofertón', legendX + 10, topY + 9.5, { lineBreak: false });
    doc.rect(legendX + 48, topY + 10, 7, 7).fill('#18181B');
    doc
      .font(fonts.regular)
      .fontSize(7.2)
      .fillColor('#52525B')
      .text('Destacado', legendX + 58, topY + 9.5, { lineBreak: false });
    doc.restore();
  }

  const rightLabel = pageNum === 1 ? subtitle : `${subtitle}  •  PÁG. ${pageNum}`;
  doc
    .font(fonts.regular)
    .fontSize(8)
    .fillColor('#71717A')
    .text(rightLabel, MARGIN_X, topY + 9, { width: USABLE_W, align: 'right', lineBreak: false });

  const dividerY = topY + 28;
  doc.save();
  doc.strokeColor('#E4E4E7').lineWidth(0.6).moveTo(MARGIN_X, dividerY).lineTo(MARGIN_X + USABLE_W, dividerY).stroke();
  doc.restore();

  return dividerY + 6;
}

function drawColumnHeader(
  doc: PDFKit.PDFDocument,
  fonts: PdfFontSet,
  colX: number,
  colW: number,
  y: number,
  priceW: number,
): number {
  doc.save();
  doc.rect(colX, y, colW, TABLE_HEADER_H).fill('#18181B');
  doc
    .font(fonts.bold)
    .fontSize(7.6)
    .fillColor('#FFFFFF')
    .text('PRODUCTO', colX + 7, y + 5, { characterSpacing: 0.5, lineBreak: false })
    .text('PRECIO', colX + colW - priceW - 6, y + 5, {
      width: priceW,
      align: 'right',
      characterSpacing: 0.4,
      lineBreak: false,
    });
  doc.restore();
  return y + TABLE_HEADER_H;
}

function drawRow(
  doc: PDFKit.PDFDocument,
  fonts: PdfFontSet,
  row: FlatRow,
  colX: number,
  colW: number,
  y: number,
  rowH: number,
  mode: CatalogResumenMode,
  compact: boolean,
): void {
  const priceW = compact ? 48 : 66;

  if (row.kind === 'section') {
    doc.save();
    doc.rect(colX, y, colW, rowH).fill('#ECECF0');
    doc.lineWidth(0.35).strokeColor('#D4D4D8').rect(colX, y, colW, rowH).stroke();
    doc.rect(colX, y, 2.5, rowH).fill('#E30613');
    doc
      .font(fonts.bold)
      .fontSize(compact ? 7.4 : 8.4)
      .fillColor('#18181B')
      .text(row.label, colX + 8, y + (rowH - (compact ? 7.4 : 8.4)) / 2 - 0.5, {
        characterSpacing: 0.5,
        lineBreak: false,
      });
    doc.restore();
    return;
  }

  const item = row.item;
  const badge = normalizeCatalogBadge(item.badge);
  const highlightOferton = mode === 'all' && badge === 'OFERTON';
  const rowBg = highlightOferton ? '#FFF5F5' : row.zebra ? '#FAFAFA' : '#FFFFFF';
  const nameSize = compact ? 6.9 : 8.4;
  const priceSize = compact ? 7.5 : 9.1;
  const minLabel = formatResumenMinQty(item.minQty, item.minOrderQuantity);
  const minW = minLabel ? (compact ? 40 : 54) : 0;

  doc.save();
  doc.rect(colX, y, colW, rowH).fill(rowBg);
  doc.lineWidth(0.3).strokeColor('#E4E4E7').rect(colX, y, colW, rowH).stroke();

  if (highlightOferton) {
    doc.rect(colX, y, 2.5, rowH).fill('#E30613');
  }

  const textOffsetY = (rowH - nameSize) / 2 - 0.8;
  const nameMaxW = colW - priceW - minW - 16;

  doc
    .font(highlightOferton ? fonts.bold : fonts.regular)
    .fontSize(nameSize)
    .fillColor('#18181B')
    .text(item.name.toUpperCase(), colX + 7, y + textOffsetY, {
      width: nameMaxW,
      height: nameSize + 3,
      ellipsis: true,
      lineBreak: false,
    });

  if (minLabel) {
    doc
      .font(fonts.regular)
      .fontSize(compact ? 6.2 : 7.3)
      .fillColor('#71717A')
      .text(minLabel, colX + colW - priceW - minW - 8, y + textOffsetY + 0.4, {
        width: minW,
        align: 'right',
        lineBreak: false,
      });
  }

  doc
    .font(fonts.bold)
    .fontSize(priceSize)
    .fillColor(highlightOferton || mode === 'ofertones' ? '#C80510' : '#18181B')
    .text(formatCatalogPrice(item.price), colX + colW - priceW - 6, y + (rowH - priceSize) / 2 - 0.8, {
      width: priceW,
      align: 'right',
      lineBreak: false,
    });

  doc.restore();
}

export async function renderCatalogResumenPdf(
  products: CatalogProductInput[],
  config: CatalogRenderConfig = {},
): Promise<Buffer> {
  const doc = new PDFDocument({ autoFirstPage: false, margin: 0, compress: true });
  const bufferPromise = collectPdfBuffer(doc);
  const fonts = registerCatalogFonts(doc);

  const mode = resolveResumenMode(config);
  const subtitle = (config.subtitle?.trim() || formatCurrentEditionSubtitle()).toUpperCase();
  const sections = buildResumenSections(products, config.categoryOrder, mode);

  const flatRows: FlatRow[] = [];
  for (const sec of sections) {
    flatRows.push({ kind: 'section', label: sec.name });
    sec.items.forEach((item, idx) => {
      flatRows.push({ kind: 'item', item, zebra: idx % 2 === 1 });
    });
  }

  if (flatRows.length === 0) {
    doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
    const startY = drawPageHeader(doc, fonts, mode, subtitle, 1);
    const emptyMsg =
      mode === 'ofertones'
        ? 'No hay productos marcados como Ofertón.'
        : mode === 'destacados'
          ? 'No hay productos marcados como Destacado.'
          : 'No hay productos marcados como Ofertón o Destacado.';
    doc
      .font(fonts.regular)
      .fontSize(10)
      .fillColor('#71717A')
      .text(emptyMsg, MARGIN_X, startY + 28, { width: USABLE_W, align: 'center' });
    doc.end();
    return bufferPromise;
  }

  const useTwoCols = flatRows.length > 35;
  const colCount = useTwoCols ? 2 : 1;
  const colW = useTwoCols ? (USABLE_W - COL_GAP) / 2 : USABLE_W;
  const priceW = useTwoCols ? 48 : 66;
  const availH = PAGE_H - MARGIN_TOP - 34 - TABLE_HEADER_H - MARGIN_BOTTOM - 8;

  const targetRowsPerCol = Math.ceil(flatRows.length / colCount);
  const rowH = useTwoCols
    ? Math.min(20, Math.max(15.2, Math.floor((availH / Math.min(targetRowsPerCol, 48)) * 10) / 10))
    : Math.min(22, Math.max(17, Math.floor((availH / Math.max(targetRowsPerCol, 1)) * 10) / 10));
  const maxRowsPerCol = Math.max(1, Math.floor(availH / rowH));
  const rowsPerPage = maxRowsPerCol * colCount;

  let pageNum = 1;
  for (let offset = 0; offset < flatRows.length; offset += rowsPerPage) {
    const pageRows = flatRows.slice(offset, offset + rowsPerPage);
    doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
    const tableY = drawPageHeader(doc, fonts, mode, subtitle, pageNum);

    if (colCount === 1) {
      let y = drawColumnHeader(doc, fonts, MARGIN_X, colW, tableY, priceW);
      for (const row of pageRows) {
        drawRow(doc, fonts, row, MARGIN_X, colW, y, rowH, mode, false);
        y += rowH;
      }
    } else {
      const splitIdx = Math.min(maxRowsPerCol, Math.ceil(pageRows.length / 2));
      const leftRows = pageRows.slice(0, splitIdx);
      const rightRows = pageRows.slice(splitIdx);

      let leftY = drawColumnHeader(doc, fonts, MARGIN_X, colW, tableY, priceW);
      for (const row of leftRows) {
        drawRow(doc, fonts, row, MARGIN_X, colW, leftY, rowH, mode, true);
        leftY += rowH;
      }

      if (rightRows.length > 0) {
        const rightX = MARGIN_X + colW + COL_GAP;
        let rightY = drawColumnHeader(doc, fonts, rightX, colW, tableY, priceW);
        for (const row of rightRows) {
          drawRow(doc, fonts, row, rightX, colW, rightY, rowH, mode, true);
          rightY += rowH;
        }
      }
    }

    if (flatRows.length > rowsPerPage) {
      doc
        .font(fonts.regular)
        .fontSize(7.2)
        .fillColor('#71717A')
        .text(`Pág. ${pageNum}`, MARGIN_X, PAGE_H - MARGIN_BOTTOM - 2, {
          width: USABLE_W,
          align: 'right',
          lineBreak: false,
        });
    }
    pageNum++;
  }

  doc.end();
  return bufferPromise;
}
