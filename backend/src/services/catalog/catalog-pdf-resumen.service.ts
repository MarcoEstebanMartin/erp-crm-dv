import PDFDocument from 'pdfkit';
import {
  buildResumenSections,
  formatCatalogPrice,
  formatCurrentEditionSubtitle,
  formatResumenMinQty,
  type CatalogProductInput,
  type CatalogRenderConfig,
  type CatalogResumenMode,
  type ResumenSection,
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

const COLOR_INK = '#18181B';
const COLOR_SECONDARY_HEADER = '#52525B';
const COLOR_MUTED = '#71717A';
const COLOR_SECTION_BG = '#F4F4F5';
const COLOR_SECTION_BORDER = '#D4D4D8';
const COLOR_ROW_BORDER = '#E4E4E7';
const COLOR_ROW_ZEBRA = '#FAFAFA';
const COLOR_WHITE = '#FFFFFF';

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

function flattenSections(sections: ResumenSection[]): FlatRow[] {
  const flatRows: FlatRow[] = [];
  for (const sec of sections) {
    flatRows.push({ kind: 'section', label: sec.name });
    sec.items.forEach((item, idx) => {
      flatRows.push({ kind: 'item', item, zebra: idx % 2 === 1 });
    });
  }
  return flatRows;
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
    .fillColor(COLOR_INK)
    .text(getHeaderTitle(mode), textStartX, topY + 6, { lineBreak: false });

  const rightLabel = pageNum === 1 ? subtitle : `${subtitle}  •  PÁG. ${pageNum}`;
  doc
    .font(fonts.regular)
    .fontSize(8)
    .fillColor(COLOR_MUTED)
    .text(rightLabel, MARGIN_X, topY + 9, { width: USABLE_W, align: 'right', lineBreak: false });

  const dividerY = topY + 28;
  doc.save();
  doc.strokeColor(COLOR_ROW_BORDER).lineWidth(0.6).moveTo(MARGIN_X, dividerY).lineTo(MARGIN_X + USABLE_W, dividerY).stroke();
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
  title = 'PRODUCTO',
  bgColor = COLOR_INK,
): number {
  doc.save();
  doc.rect(colX, y, colW, TABLE_HEADER_H).fill(bgColor);
  doc
    .font(fonts.bold)
    .fontSize(7.6)
    .fillColor(COLOR_WHITE)
    .text(title, colX + 7, y + 5, { characterSpacing: 0.6, lineBreak: false })
    .text('PRECIO', colX + colW - priceW - 6, y + 5, {
      width: priceW,
      align: 'right',
      characterSpacing: 0.4,
      lineBreak: false,
    });
  doc.restore();
  return y + TABLE_HEADER_H;
}

function drawEmptyColumnNote(
  doc: PDFKit.PDFDocument,
  fonts: PdfFontSet,
  colX: number,
  colW: number,
  y: number,
  rowH: number,
  message: string,
): void {
  doc.save();
  doc.rect(colX, y, colW, rowH).fill(COLOR_WHITE);
  doc.lineWidth(0.3).strokeColor(COLOR_ROW_BORDER).rect(colX, y, colW, rowH).stroke();
  doc
    .font(fonts.regular)
    .fontSize(7.2)
    .fillColor(COLOR_MUTED)
    .text(message, colX + 7, y + (rowH - 7.2) / 2 - 0.5, { width: colW - 14, lineBreak: false });
  doc.restore();
}

function drawRow(
  doc: PDFKit.PDFDocument,
  fonts: PdfFontSet,
  row: FlatRow,
  colX: number,
  colW: number,
  y: number,
  rowH: number,
  compact: boolean,
  sectionAccentColor = COLOR_INK,
): void {
  const priceW = compact ? 48 : 66;

  if (row.kind === 'section') {
    doc.save();
    doc.rect(colX, y, colW, rowH).fill(COLOR_SECTION_BG);
    doc.lineWidth(0.35).strokeColor(COLOR_SECTION_BORDER).rect(colX, y, colW, rowH).stroke();
    doc.rect(colX, y, 2, rowH).fill(sectionAccentColor);
    doc
      .font(fonts.bold)
      .fontSize(compact ? 7.4 : 8.4)
      .fillColor(COLOR_INK)
      .text(row.label, colX + 8, y + (rowH - (compact ? 7.4 : 8.4)) / 2 - 0.5, {
        characterSpacing: 0.5,
        lineBreak: false,
      });
    doc.restore();
    return;
  }

  const item = row.item;
  const rowBg = row.zebra ? COLOR_ROW_ZEBRA : COLOR_WHITE;
  const nameSize = compact ? 6.9 : 8.4;
  const priceSize = compact ? 7.5 : 9.1;
  const minLabel = formatResumenMinQty(item.minQty, item.minOrderQuantity);
  const minW = minLabel ? (compact ? 40 : 54) : 0;

  doc.save();
  doc.rect(colX, y, colW, rowH).fill(rowBg);
  doc.lineWidth(0.3).strokeColor(COLOR_ROW_BORDER).rect(colX, y, colW, rowH).stroke();

  const textOffsetY = (rowH - nameSize) / 2 - 0.8;
  const nameMaxW = colW - priceW - minW - 16;

  doc
    .font(fonts.regular)
    .fontSize(nameSize)
    .fillColor(COLOR_INK)
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
      .fillColor(COLOR_MUTED)
      .text(minLabel, colX + colW - priceW - minW - 8, y + textOffsetY + 0.4, {
        width: minW,
        align: 'right',
        lineBreak: false,
      });
  }

  doc
    .font(fonts.bold)
    .fontSize(priceSize)
    .fillColor(COLOR_INK)
    .text(formatCatalogPrice(item.price), colX + colW - priceW - 6, y + (rowH - priceSize) / 2 - 0.8, {
      width: priceW,
      align: 'right',
      lineBreak: false,
    });

  doc.restore();
}

function drawPageFooter(doc: PDFKit.PDFDocument, fonts: PdfFontSet, pageNum: number): void {
  doc
    .font(fonts.regular)
    .fontSize(7.2)
    .fillColor(COLOR_MUTED)
    .text(`Pág. ${pageNum}`, MARGIN_X, PAGE_H - MARGIN_BOTTOM - 2, {
      width: USABLE_W,
      align: 'right',
      lineBreak: false,
    });
}

function renderSplitOfertonesDestacados(
  doc: PDFKit.PDFDocument,
  fonts: PdfFontSet,
  products: CatalogProductInput[],
  categoryOrder: string[] | undefined,
  subtitle: string,
): void {
  const ofertonesRows = flattenSections(buildResumenSections(products, categoryOrder, 'ofertones'));
  const destacadosRows = flattenSections(buildResumenSections(products, categoryOrder, 'destacados'));

  if (ofertonesRows.length === 0 && destacadosRows.length === 0) {
    doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
    const startY = drawPageHeader(doc, fonts, 'all', subtitle, 1);
    doc
      .font(fonts.regular)
      .fontSize(10)
      .fillColor(COLOR_MUTED)
      .text('No hay productos marcados como Ofertón o Destacado.', MARGIN_X, startY + 28, {
        width: USABLE_W,
        align: 'center',
      });
    return;
  }

  const colW = (USABLE_W - COL_GAP) / 2;
  const rightX = MARGIN_X + colW + COL_GAP;
  const priceW = 48;
  const availH = PAGE_H - MARGIN_TOP - 34 - TABLE_HEADER_H - MARGIN_BOTTOM - 8;

  const maxColRows = Math.max(ofertonesRows.length, destacadosRows.length, 1);
  const rowH = Math.min(20, Math.max(15.2, Math.floor((availH / Math.min(maxColRows, 48)) * 10) / 10));
  const maxRowsPerCol = Math.max(1, Math.floor(availH / rowH));
  const totalPages = Math.ceil(maxColRows / maxRowsPerCol);

  for (let p = 0; p < totalPages; p++) {
    const pageNum = p + 1;
    const offset = p * maxRowsPerCol;
    const leftSlice = ofertonesRows.slice(offset, offset + maxRowsPerCol);
    const rightSlice = destacadosRows.slice(offset, offset + maxRowsPerCol);

    doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
    const tableY = drawPageHeader(doc, fonts, 'all', subtitle, pageNum);

    if (leftSlice.length > 0 || p === 0) {
      let leftY = drawColumnHeader(doc, fonts, MARGIN_X, colW, tableY, priceW, 'OFERTONES', COLOR_INK);
      if (leftSlice.length === 0) {
        drawEmptyColumnNote(doc, fonts, MARGIN_X, colW, leftY, rowH, 'Sin productos en Ofertones');
      } else {
        for (const row of leftSlice) {
          drawRow(doc, fonts, row, MARGIN_X, colW, leftY, rowH, true, COLOR_INK);
          leftY += rowH;
        }
      }
    }

    if (rightSlice.length > 0 || p === 0) {
      let rightY = drawColumnHeader(doc, fonts, rightX, colW, tableY, priceW, 'DESTACADOS', COLOR_SECONDARY_HEADER);
      if (rightSlice.length === 0) {
        drawEmptyColumnNote(doc, fonts, rightX, colW, rightY, rowH, 'Sin productos en Destacados');
      } else {
        for (const row of rightSlice) {
          drawRow(doc, fonts, row, rightX, colW, rightY, rowH, true, COLOR_MUTED);
          rightY += rowH;
        }
      }
    }

    if (totalPages > 1) {
      drawPageFooter(doc, fonts, pageNum);
    }
  }
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

  if (mode === 'all') {
    renderSplitOfertonesDestacados(doc, fonts, products, config.categoryOrder, subtitle);
    doc.end();
    return bufferPromise;
  }

  const sections = buildResumenSections(products, config.categoryOrder, mode);
  const flatRows = flattenSections(sections);

  if (flatRows.length === 0) {
    doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
    const startY = drawPageHeader(doc, fonts, mode, subtitle, 1);
    const emptyMsg =
      mode === 'ofertones'
        ? 'No hay productos marcados como Ofertón.'
        : 'No hay productos marcados como Destacado.';
    doc
      .font(fonts.regular)
      .fontSize(10)
      .fillColor(COLOR_MUTED)
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
  const colHeaderTitle = mode === 'ofertones' ? 'OFERTONES' : 'DESTACADOS';

  let pageNum = 1;
  for (let offset = 0; offset < flatRows.length; offset += rowsPerPage) {
    const pageRows = flatRows.slice(offset, offset + rowsPerPage);
    doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
    const tableY = drawPageHeader(doc, fonts, mode, subtitle, pageNum);

    if (colCount === 1) {
      let y = drawColumnHeader(doc, fonts, MARGIN_X, colW, tableY, priceW, colHeaderTitle, COLOR_INK);
      for (const row of pageRows) {
        drawRow(doc, fonts, row, MARGIN_X, colW, y, rowH, false, COLOR_INK);
        y += rowH;
      }
    } else {
      const splitIdx = Math.min(maxRowsPerCol, Math.ceil(pageRows.length / 2));
      const leftRows = pageRows.slice(0, splitIdx);
      const rightRows = pageRows.slice(splitIdx);

      let leftY = drawColumnHeader(doc, fonts, MARGIN_X, colW, tableY, priceW, colHeaderTitle, COLOR_INK);
      for (const row of leftRows) {
        drawRow(doc, fonts, row, MARGIN_X, colW, leftY, rowH, true, COLOR_INK);
        leftY += rowH;
      }

      if (rightRows.length > 0) {
        const rightX = MARGIN_X + colW + COL_GAP;
        let rightY = drawColumnHeader(doc, fonts, rightX, colW, tableY, priceW, colHeaderTitle, COLOR_INK);
        for (const row of rightRows) {
          drawRow(doc, fonts, row, rightX, colW, rightY, rowH, true, COLOR_INK);
          rightY += rowH;
        }
      }
    }

    if (flatRows.length > rowsPerPage) {
      drawPageFooter(doc, fonts, pageNum);
    }
    pageNum++;
  }

  doc.end();
  return bufferPromise;
}
