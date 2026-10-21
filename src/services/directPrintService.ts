import { EmployeeCardData, PrintSettings } from '../types';
import { calculatePrintGeometry } from './pdfExportService';

/**
 * Triggers direct browser printing for all selected employee cards using
 * an isolated invisible iframe with exact physical millimeter page dimensions and layout.
 * Requires NO prior PDF download.
 */
export function directPrintCards(
  employees: EmployeeCardData[],
  settings: PrintSettings,
  renderedCardHtmlGetter: (empId: string, side: 'front' | 'back') => string
): void {
  const geom = calculatePrintGeometry(settings);
  const {
    pageWidthMm,
    pageHeightMm,
    cardWidthMm: cardW,
    cardHeightMm: cardH,
    gapX,
    gapY,
    startX,
    startY,
    cols,
    cardsPerPage,
    pairsPerPage,
    colsOfPairs,
  } = geom;

  // Prepare iframe
  let iframe = document.getElementById('direct-print-iframe') as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'direct-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);
  }

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    window.print();
    return;
  }

  // Generate pages HTML
  let pagesHtml = '';

  const renderCardItem = (emp: EmployeeCardData, side: 'front' | 'back', x: number, y: number) => {
    const innerHtml = renderedCardHtmlGetter(emp.id, side);
    const scale = cardW / 54; // Standard CR80 badge width is 54mm (284px nominal)
    return `
      <div class="print-card-wrapper" style="
        position: absolute;
        left: ${x}mm;
        top: ${y}mm;
        width: ${cardW}mm;
        height: ${cardH}mm;
        overflow: hidden;
        box-sizing: border-box;
      ">
        <div style="
          width: 284px;
          height: 500px;
          transform: scale(${scale / (284 / (54 * (96 / 25.4)))});
          transform-origin: top left;
        ">
          ${innerHtml}
        </div>
      </div>
    `;
  };

  const drawCropMarksHtml = (x: number, y: number, w: number, h: number) => {
    if (!settings.showCutMarks) return '';
    const len = 3;
    const offset = 1.2;
    return `
      <div style="position: absolute; left: ${x - offset - len}mm; top: ${y}mm; width: ${len}mm; height: 0.15mm; background: #b0b0b0;"></div>
      <div style="position: absolute; left: ${x}mm; top: ${y - offset - len}mm; width: 0.15mm; height: ${len}mm; background: #b0b0b0;"></div>
      <div style="position: absolute; left: ${x + w + offset}mm; top: ${y}mm; width: ${len}mm; height: 0.15mm; background: #b0b0b0;"></div>
      <div style="position: absolute; left: ${x + w}mm; top: ${y - offset - len}mm; width: 0.15mm; height: ${len}mm; background: #b0b0b0;"></div>
      <div style="position: absolute; left: ${x - offset - len}mm; top: ${y + h}mm; width: ${len}mm; height: 0.15mm; background: #b0b0b0;"></div>
      <div style="position: absolute; left: ${x}mm; top: ${y + h + offset}mm; width: 0.15mm; height: ${len}mm; background: #b0b0b0;"></div>
      <div style="position: absolute; left: ${x + w + offset}mm; top: ${y + h}mm; width: ${len}mm; height: 0.15mm; background: #b0b0b0;"></div>
      <div style="position: absolute; left: ${x + w}mm; top: ${y + h + offset}mm; width: 0.15mm; height: ${len}mm; background: #b0b0b0;"></div>
    `;
  };

  if (settings.layoutMode === 'duplex') {
    const totalBatches = Math.ceil(employees.length / cardsPerPage);
    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const batch = employees.slice(batchIdx * cardsPerPage, (batchIdx + 1) * cardsPerPage);

      // FRONT SHEET
      let frontCardsHtml = '';
      batch.forEach((emp, slotIdx) => {
        const col = slotIdx % cols;
        const row = Math.floor(slotIdx / cols);
        const x = startX + col * (cardW + gapX);
        const y = startY + row * (cardH + gapY);
        frontCardsHtml += renderCardItem(emp, 'front', x, y);
        frontCardsHtml += drawCropMarksHtml(x, y, cardW, cardH);
      });

      pagesHtml += `
        <div class="print-page" style="width: ${pageWidthMm}mm; height: ${pageHeightMm}mm;">
          ${frontCardsHtml}
        </div>
      `;

      // BACK SHEET (Mirrored columns for perfect double-sided alignment)
      let backCardsHtml = '';
      batch.forEach((emp, slotIdx) => {
        const originalCol = slotIdx % cols;
        const row = Math.floor(slotIdx / cols);
        const mirroredCol = cols - 1 - originalCol;
        const x = startX + mirroredCol * (cardW + gapX);
        const y = startY + row * (cardH + gapY);
        backCardsHtml += renderCardItem(emp, 'back', x, y);
        backCardsHtml += drawCropMarksHtml(x, y, cardW, cardH);
      });

      pagesHtml += `
        <div class="print-page" style="width: ${pageWidthMm}mm; height: ${pageHeightMm}mm;">
          ${backCardsHtml}
        </div>
      `;
    }
  } else if (settings.layoutMode === 'side-by-side') {
    const totalBatches = Math.ceil(employees.length / pairsPerPage);
    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const batch = employees.slice(batchIdx * pairsPerPage, (batchIdx + 1) * pairsPerPage);
      let pageCardsHtml = '';

      batch.forEach((emp, pairIdx) => {
        const colPair = pairIdx % colsOfPairs;
        const row = Math.floor(pairIdx / colsOfPairs);

        const xF = startX + colPair * (cardW * 2 + gapX * 2);
        const yF = startY + row * (cardH + gapY);
        const xB = xF + cardW + gapX;
        const yB = yF;

        pageCardsHtml += renderCardItem(emp, 'front', xF, yF);
        pageCardsHtml += drawCropMarksHtml(xF, yF, cardW, cardH);

        pageCardsHtml += renderCardItem(emp, 'back', xB, yB);
        pageCardsHtml += drawCropMarksHtml(xB, yB, cardW, cardH);
      });

      pagesHtml += `
        <div class="print-page" style="width: ${pageWidthMm}mm; height: ${pageHeightMm}mm;">
          ${pageCardsHtml}
        </div>
      `;
    }
  } else if (settings.layoutMode === 'top-and-bottom') {
    const totalBatches = Math.ceil(employees.length / pairsPerPage);
    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const batch = employees.slice(batchIdx * pairsPerPage, (batchIdx + 1) * pairsPerPage);
      let pageCardsHtml = '';

      batch.forEach((emp, pairIdx) => {
        const col = pairIdx % cols;
        const rowPair = Math.floor(pairIdx / cols);

        const xF = startX + col * (cardW + gapX);
        const yF = startY + rowPair * (cardH * 2 + gapY * 2);
        const xB = xF;
        const yB = yF + cardH + gapY;

        pageCardsHtml += renderCardItem(emp, 'front', xF, yF);
        pageCardsHtml += drawCropMarksHtml(xF, yF, cardW, cardH);

        pageCardsHtml += renderCardItem(emp, 'back', xB, yB);
        pageCardsHtml += drawCropMarksHtml(xB, yB, cardW, cardH);
      });

      pagesHtml += `
        <div class="print-page" style="width: ${pageWidthMm}mm; height: ${pageHeightMm}mm;">
          ${pageCardsHtml}
        </div>
      `;
    }
  } else {
    // Front only or Back only
    const side = settings.layoutMode === 'front-only' ? 'front' : 'back';
    const totalBatches = Math.ceil(employees.length / cardsPerPage);
    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const batch = employees.slice(batchIdx * cardsPerPage, (batchIdx + 1) * cardsPerPage);
      let pageCardsHtml = '';

      batch.forEach((emp, slotIdx) => {
        const col = slotIdx % cols;
        const row = Math.floor(slotIdx / cols);
        const x = startX + col * (cardW + gapX);
        const y = startY + row * (cardH + gapY);

        pageCardsHtml += renderCardItem(emp, side, x, y);
        pageCardsHtml += drawCropMarksHtml(x, y, cardW, cardH);
      });

      pagesHtml += `
        <div class="print-page" style="width: ${pageWidthMm}mm; height: ${pageHeightMm}mm;">
          ${pageCardsHtml}
        </div>
      `;
    }
  }

  // Stylesheet and document structure
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print Employee ID Cards</title>
        <style>
          @page {
            size: ${pageWidthMm}mm ${pageHeightMm}mm;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
          }
          .print-page {
            position: relative;
            background: #ffffff;
            overflow: hidden;
            page-break-after: always;
            break-after: page;
          }
          .print-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
    </html>
  `;

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Wait for rendering then trigger print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.warn('Iframe print error, falling back to window.print():', e);
      window.print();
    }
  }, 400);
}
