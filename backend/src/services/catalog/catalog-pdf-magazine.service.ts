import PDFDocument from 'pdfkit';
import {
  cleanVarietiesText,
  formatCatalogPrice,
  formatCurrentEditionSubtitle,
  groupCatalogSections,
  normalizeCatalogBadge,
  parseMinQtyBadge,
  splitBrandAndDescription,
  type CatalogComboInput,
  type CatalogProductInput,
  type CatalogRenderConfig,
} from '../../engines/catalog-studio.engine';
import { getAutocroppedProductImage } from './catalog-image-crop.helper';
import {
  drawCategoryBanner,
  drawEditionHeader,
  drawMinQtyMedallion,
  drawStarburstBadge,
  drawTinyStar,
  registerCatalogFonts,
  type PdfFontSet,
} from './catalog-pdf-primitives.helper';
import {
  collectPdfBuffer,
  drawComboCard,
  splitBalancedTwoLines,
} from './catalog-pdf-combo.helper';

const PAGE_W = 595.28; // A4 width in pt
const MARGIN_X = 16;
const COLS = 3;
const COL_GAP = 12;
const USABLE_W = PAGE_W - 2 * MARGIN_X;
const COL_W = (USABLE_W - (COLS - 1) * COL_GAP) / COLS;
const ROW_H = 198;
const ROW_GAP = 12;
const COMBO_H = 214;
const HEADER_H = 92;
const BANNER_H = 18;
const BANNER_MB = 16;
const TOP_MARGIN_SUBSEQUENT = 14;
const BOTTOM_MARGIN = 26;

async function drawProductCell(
  doc: PDFKit.PDFDocument,
  fonts: PdfFontSet,
  item: CatalogProductInput,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<void> {
  const badge = normalizeCatalogBadge(item.badge);
  const isHighlighted = badge !== null;
  const isOferton = badge === 'OFERTON';
  let ribH = 0;
  let topPhotoPad = 5;

  if (isHighlighted) {
    const ribbonText = isOferton ? 'OFERTÓN!' : 'DESTACADO';
    const ribBg = isOferton ? '#D0021B' : '#0B1120';
    const ribBorder = isOferton ? '#FEF08A' : '#F59E0B';
    const ribTextColor = isOferton ? '#FFFFFF' : '#FEF08A';
    const cardBorder = isOferton ? '#DC2626' : '#D97706';

    // Shadow
    doc.save();
    doc.fillColor('#0F172A').fillOpacity(0.12);
    doc.roundedRect(x + 1.2, y + 1.5, w, h, 6).fill();
    doc.restore();

    // Champagne card + bold border
    doc.save();
    doc.roundedRect(x, y, w, h, 6).fill('#FFFDF2');
    doc.lineWidth(1.6).strokeColor(cardBorder).roundedRect(x, y, w, h, 6).stroke();

    // Inner fine gold accent hairline
    doc
      .strokeOpacity(0.4)
      .strokeColor('#F59E0B')
      .lineWidth(0.6)
      .roundedRect(x + 2.2, y + 2.2, w - 4.4, h - 4.4, 4.5)
      .stroke();
    doc.restore();

    // Top Ribbon Banner
    ribH = 18.5;
    const ribX = x + 4;
    const ribY = y + 2.2;
    const ribW = w - 8;

    doc.save();
    doc.roundedRect(ribX, ribY, ribW, ribH, 3.5).fill(ribBg);
    doc.lineWidth(0.8).strokeColor(ribBorder).roundedRect(ribX, ribY, ribW, ribH, 3.5).stroke();

    doc.font(fonts.price).fontSize(9.2);
    const txtW = doc.widthOfString(ribbonText);
    const midY = ribY + ribH / 2;
    drawTinyStar(doc, x + w / 2 - txtW / 2 - 7, midY, 2.7, ribTextColor);
    drawTinyStar(doc, x + w / 2 + txtW / 2 + 7, midY, 2.7, ribTextColor);

    doc
      .font(fonts.price)
      .fontSize(9.2)
      .fillColor(ribTextColor)
      .text(ribbonText, ribX, ribY + 4.2, { width: ribW, align: 'center', lineBreak: false });
    doc.restore();

    topPhotoPad = ribH + 5;
  }

  // Typography layout from bottom-up inside [y, y + h]
  const { brand, description } = splitBrandAndDescription(item.name, item.category);
  const displayTitle = description || item.name.toUpperCase();
  const displayBrand = description && brand ? brand : '';
  const cleanSab = cleanVarietiesText(item.varieties);

  let bottomY = y + h - (isHighlighted ? 9 : 7);

  // 1. Optional Varieties Pill
  let pillInfo: {
    x: number;
    y: number;
    w: number;
    h: number;
    text: string;
    fontSize: number;
    bg: string;
    border: string;
    txt: string;
  } | null = null;

  if (cleanSab) {
    const maxPillW = w - 12;
    let fSab = 8.0;
    doc.font(fonts.bold).fontSize(fSab);
    while (doc.widthOfString(cleanSab) > maxPillW - 14 && fSab > 5.4) {
      fSab -= 0.3;
      doc.fontSize(fSab);
    }
    const textW = doc.widthOfString(cleanSab);
    const pillW = Math.min(maxPillW, textW + 14);
    const pillH = 14;
    bottomY -= pillH;

    const isDest = badge === 'DESTACADO';
    pillInfo = {
      x: x + (w - pillW) / 2,
      y: bottomY,
      w: pillW,
      h: pillH,
      text: cleanSab,
      fontSize: fSab,
      bg: isDest ? '#FEF3C7' : '#FEF2F2',
      border: isDest ? '#F59E0B' : '#FECACA',
      txt: isDest ? '#B45309' : '#DC2626',
    };
    bottomY -= 4;
  }

  // 2. Brand line
  let brandY: number | null = null;
  if (displayBrand) {
    bottomY -= 12.5;
    brandY = bottomY;
  }

  // 3. Title lines (up to 2 balanced lines)
  const titleFont = displayBrand ? fonts.regular : fonts.bold;
  const titleSize = displayTitle.length > 28 ? 10.6 : 11.4;
  const titleLines = splitBalancedTwoLines(doc, displayTitle, titleFont, titleSize, w - 10);
  const titleLineH = 12.2;
  bottomY -= titleLines.length * titleLineH;
  const titleTopY = bottomY;

  // 4. Product Photo in remaining vertical space
  const photoTop = y + topPhotoPad;
  const photoBottom = titleTopY - 5;
  const availH = Math.max(28, photoBottom - photoTop);
  const availW = w - 10;

  const img = await getAutocroppedProductImage(item.imageUrl);
  if (img) {
    doc.image(img.buffer, x + 5, photoTop, {
      fit: [availW, availH],
      align: 'center',
      valign: 'center',
    });
  } else {
    const boxSize = Math.min(78, availH - 6);
    const bx = x + (w - boxSize) / 2;
    const by = photoTop + (availH - boxSize) / 2;
    doc.save();
    doc.roundedRect(bx, by, boxSize, boxSize, 4).fill('#F4F4F5');
    doc
      .font(fonts.bold)
      .fontSize(8)
      .fillColor('#71717A')
      .text('[ SIN FOTO ]', bx, by + boxSize / 2 - 4, { width: boxSize, align: 'center', lineBreak: false });
    doc.restore();
  }

  // 5. Starburst Price Badge (Top-Right)
  const priceStr = formatCatalogPrice(item.price);
  const pFontSize = priceStr.length >= 8 ? 18.5 : 20;
  doc.font(fonts.price).fontSize(pFontSize);
  const priceTextW = doc.widthOfString(priceStr);
  const badgeRx = Math.max(35, (priceTextW + 18) / 2);
  const badgeRy = 18.5;
  const badgeCx = x + w - badgeRx - 2;
  const badgeCy = y + ribH + badgeRy + (isHighlighted ? 5 : 3);

  // Optional crossed-out old price pill
  if (item.showOldPrice && item.oldPrice && Number(item.oldPrice) > Number(item.price)) {
    const oldStr = formatCatalogPrice(item.oldPrice);
    doc.font(fonts.price).fontSize(11);
    const oldW = doc.widthOfString(oldStr) + 10;
    const oldH = 15;
    const oldX = Math.max(x + 4, badgeCx - badgeRx - oldW + 3);
    const oldY = badgeCy - oldH / 2 - 4;

    doc.save();
    doc.roundedRect(oldX, oldY, oldW, oldH, 2.5).fill('#FEF08A');
    doc.lineWidth(0.5).strokeColor('#EAB308').roundedRect(oldX, oldY, oldW, oldH, 2.5).stroke();
    doc
      .font(fonts.price)
      .fontSize(11)
      .fillColor('#0F172A')
      .text(oldStr, oldX, oldY + 2, { width: oldW, align: 'center', lineBreak: false });
    doc
      .strokeColor('#D0021B')
      .lineWidth(1.1)
      .moveTo(oldX + 2, oldY + oldH / 2)
      .lineTo(oldX + oldW - 2, oldY + oldH / 2)
      .stroke();
    doc.restore();
  }

  drawStarburstBadge(doc, badgeCx, badgeCy, badgeRx, badgeRy, 18, 4.2, '#D0021B');
  doc
    .font(fonts.price)
    .fontSize(pFontSize)
    .fillColor('#FFFFFF')
    .text(priceStr, badgeCx - badgeRx, badgeCy - pFontSize * 0.56, {
      width: badgeRx * 2,
      align: 'center',
      lineBreak: false,
    });

  // 6. Min Qty Circle Medallion (Top-Left)
  const minQtyData = parseMinQtyBadge(item.minQty, item.minOrderQuantity);
  if (minQtyData) {
    const circleR = 17.5;
    const circleCx = x + circleR + 3;
    const circleCy = y + ribH + circleR + (isHighlighted ? 5 : 3);
    drawMinQtyMedallion(doc, fonts, circleCx, circleCy, circleR, minQtyData);
  }

  // 7. Render Title, Brand & Varieties Pill
  doc.font(titleFont).fontSize(titleSize).fillColor('#1E293B');
  titleLines.forEach((line, idx) => {
    doc.text(line, x + 4, titleTopY + idx * titleLineH, {
      width: w - 8,
      align: 'center',
      lineBreak: false,
    });
  });

  if (displayBrand && brandY !== null) {
    doc
      .font(fonts.bold)
      .fontSize(11.8)
      .fillColor('#0F172A')
      .text(displayBrand, x + 4, brandY, {
        width: w - 8,
        align: 'center',
        lineBreak: false,
      });
  }

  if (pillInfo) {
    doc.save();
    doc.roundedRect(pillInfo.x, pillInfo.y, pillInfo.w, pillInfo.h, pillInfo.h / 2).fill(pillInfo.bg);
    doc
      .lineWidth(0.65)
      .strokeColor(pillInfo.border)
      .roundedRect(pillInfo.x, pillInfo.y, pillInfo.w, pillInfo.h, pillInfo.h / 2)
      .stroke();
    doc
      .font(fonts.bold)
      .fontSize(pillInfo.fontSize)
      .fillColor(pillInfo.txt)
      .text(pillInfo.text, pillInfo.x + 4, pillInfo.y + 3.2, {
        width: pillInfo.w - 8,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    doc.restore();
  }
}

export async function renderCatalogMagazinePdf(
  products: CatalogProductInput[],
  combos: CatalogComboInput[] = [],
  config: CatalogRenderConfig = {},
): Promise<Buffer> {
  const doc = new PDFDocument({ autoFirstPage: false, margin: 0, compress: true });
  const bufferPromise = collectPdfBuffer(doc);
  const fonts = registerCatalogFonts(doc);

  const title = config.title?.trim() || 'OFERTAS SEMANALES';
  const subtitle = config.subtitle?.trim() || formatCurrentEditionSubtitle();
  const sections = groupCatalogSections(products, combos, config.categoryOrder);

  if (sections.length === 0) {
    doc.addPage({ size: [PAGE_W, 420], margin: 0 });
    drawEditionHeader(doc, fonts, PAGE_W, MARGIN_X, HEADER_H, title, subtitle);
    doc
      .font(fonts.regular)
      .fontSize(12)
      .fillColor('#64748B')
      .text('No hay productos activos para mostrar en el catálogo.', 0, 210, {
        width: PAGE_W,
        align: 'center',
      });
    doc.end();
    return bufferPromise;
  }

  let pageNum = 1;

  for (let secIdx = 0; secIdx < sections.length; secIdx++) {
    const sec = sections[secIdx];
    const isFirstPage = secIdx === 0;
    const topSpace = isFirstPage ? HEADER_H + 14 : TOP_MARGIN_SUBSEQUENT;

    // Calculate rows: combos first (full width), then products in 3-col chunks
    const productRows: CatalogProductInput[][] = [];
    for (let i = 0; i < sec.products.length; i += COLS) {
      productRows.push(sec.products.slice(i, i + COLS));
    }

    const totalRowCount = sec.combos.length + productRows.length;
    const rowsHeight =
      sec.combos.length * COMBO_H +
      productRows.length * ROW_H +
      Math.max(0, totalRowCount - 1) * ROW_GAP;

    const dynamicPageH = Math.max(
      340,
      topSpace + BANNER_H + BANNER_MB + rowsHeight + BOTTOM_MARGIN,
    );

    doc.addPage({ size: [PAGE_W, dynamicPageH], margin: 0 });

    let currY = isFirstPage
      ? drawEditionHeader(doc, fonts, PAGE_W, MARGIN_X, HEADER_H, title, subtitle)
      : TOP_MARGIN_SUBSEQUENT;

    drawCategoryBanner(doc, fonts, sec.name, MARGIN_X, currY, USABLE_W, BANNER_H);
    currY += BANNER_H + BANNER_MB;

    for (const combo of sec.combos) {
      await drawComboCard(doc, fonts, combo, MARGIN_X, currY, USABLE_W, COMBO_H);
      currY += COMBO_H + ROW_GAP;
    }

    for (const row of productRows) {
      for (let colIdx = 0; colIdx < row.length; colIdx++) {
        const cellX = MARGIN_X + colIdx * (COL_W + COL_GAP);
        await drawProductCell(doc, fonts, row[colIdx], cellX, currY, COL_W, ROW_H);
      }
      currY += ROW_H + ROW_GAP;
    }

    // Page footer
    doc
      .font(fonts.regular)
      .fontSize(7.5)
      .fillColor('#64748B')
      .text(`PÁG. ${pageNum}`, 0, dynamicPageH - 16, {
        width: PAGE_W - MARGIN_X,
        align: 'right',
        lineBreak: false,
      });

    pageNum++;
  }

  doc.end();
  return bufferPromise;
}
