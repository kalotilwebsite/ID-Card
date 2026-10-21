import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { EmployeeCardData, PrintSettings, CompanyTemplateConfig } from '../types';

export interface ExportProgressCallback {
  (current: number, total: number, message: string): void;
}

export const PAPER_DIMENSIONS_MM: Record<string, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
  a3: { width: 297, height: 420 },
  letter: { width: 215.9, height: 279.4 },
  legal: { width: 215.9, height: 355.6 },
};

export interface CalculatedPrintGeometry {
  pageWidthMm: number;
  pageHeightMm: number;
  cardWidthMm: number;
  cardHeightMm: number;
  gapX: number;
  gapY: number;
  startX: number;
  startY: number;
  scaleFactor: number;
  cols: number;
  rows: number;
  cardsPerPage: number;
  pairsPerPage: number;
  colsOfPairs: number;
  rowsOfPairs: number;
}

/**
 * Calculates print geometry strictly preserving the mandatory 47 × 78 mm card dimensions
 * and positioning cards centered with precise print margins.
 */
export function calculatePrintGeometry(settings: PrintSettings): CalculatedPrintGeometry {
  const isLandscape = settings.orientation === 'landscape';
  const paper =
    settings.paperSize === 'custom'
      ? {
          width: Math.max(20, Number(settings.customWidthMm) || 297),
          height: Math.max(20, Number(settings.customHeightMm) || 210),
        }
      : PAPER_DIMENSIONS_MM[settings.paperSize] || { width: 297, height: 210 };

  // Page dimensions in mm
  const pageWidthMm = isLandscape ? Math.max(paper.width, paper.height) : Math.min(paper.width, paper.height);
  const pageHeightMm = isLandscape ? Math.min(paper.width, paper.height) : Math.max(paper.width, paper.height);

  // Mandatory exact card dimensions: strictly 47 x 78 mm (never distorted or overridden)
  const cardWidthMm = Number(settings.cardWidthMm) || 47;
  const cardHeightMm = Number(settings.cardHeightMm) || 78;
  const scaleFactor = 1.0;

  const cols = Math.max(1, Number(settings.columnsPerPage) || 4);
  const rows = Math.max(1, Number(settings.rowsPerPage) || 2);

  // Margin safety minimum to avoid cutting off edge or crop marks
  const minSafeMargin = settings.showCutMarks ? 4.0 : 2.5;

  const baseGapX = Math.max(0.5, Number(settings.spacingMm?.horizontal) ?? 4);
  const baseGapY = Math.max(0.5, Number(settings.spacingMm?.vertical) ?? 4);

  let colsOfPairs = 1;
  let rowsOfPairs = 1;
  let unitsAcross = cols;
  let unitsDown = rows;
  let cardsPerPage = cols * rows;
  let pairsPerPage = cardsPerPage;

  if (settings.layoutMode === 'side-by-side') {
    // 4 columns per row default: 2 pairs of (Front + Back)
    colsOfPairs = Math.max(1, Math.floor(cols / 2));
    unitsAcross = colsOfPairs * 2;
    unitsDown = rows;
    pairsPerPage = colsOfPairs * rows;
    cardsPerPage = pairsPerPage;
  } else if (settings.layoutMode === 'top-and-bottom') {
    rowsOfPairs = Math.max(1, Math.floor(rows / 2));
    unitsAcross = cols;
    unitsDown = rowsOfPairs * 2;
    pairsPerPage = cols * rowsOfPairs;
    cardsPerPage = pairsPerPage;
  }

  const gapX = baseGapX;
  const gapY = baseGapY;

  // Calculate total grid extent
  const gridW = unitsAcross * cardWidthMm + (unitsAcross - 1) * gapX;
  const gridH = unitsDown * cardHeightMm + (unitsDown - 1) * gapY;

  // Center grid on page within safe bounds
  const startX = Math.max(minSafeMargin, (pageWidthMm - gridW) / 2);
  const startY = Math.max(minSafeMargin, (pageHeightMm - gridH) / 2);

  return {
    pageWidthMm,
    pageHeightMm,
    cardWidthMm,
    cardHeightMm,
    gapX,
    gapY,
    startX,
    startY,
    scaleFactor,
    cols,
    rows,
    cardsPerPage,
    pairsPerPage,
    colsOfPairs,
    rowsOfPairs,
  };
}

/**
 * Ensures all images (both HTML <img> and SVG <image>) inside an element
 * are fully loaded and raster-decoded before canvas snapshot.
 */
export async function ensureElementImagesLoaded(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll('img, image'));
  await Promise.all(
    images.map((node) => {
      const img = node as HTMLImageElement;
      if (img.complete && img.naturalWidth !== 0) {
        if (img.decode) {
          return img.decode().catch(() => {});
        }
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const timer = setTimeout(() => resolve(), 3000);
        img.onload = async () => {
          clearTimeout(timer);
          if (img.decode) {
            await img.decode().catch(() => {});
          }
          resolve();
        };
        img.onerror = () => {
          clearTimeout(timer);
          resolve();
        };
      });
    })
  );
}

/**
 * Capture card element to crisp, high-resolution PNG data URL.
 */
export async function captureCardToPng(element: HTMLElement): Promise<string> {
  // Ensure web fonts are completely loaded and layout metrics stabilized
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (e) {}
  }

  // Ensure all images are decoded into GPU/raster memory
  await ensureElementImagesLoaded(element);

  // Short frame wait for any final DOM paint cycles
  await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 40)));

  const canvas = await html2canvas(element, {
    scale: 3, // 3x scale renders 300 DPI print quality
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    scrollX: 0,
    scrollY: 0,
  });

  return canvas.toDataURL('image/png');
}

export const exportCardsToPdf = async (
  employees: EmployeeCardData[],
  settings: PrintSettings,
  companyConfig: CompanyTemplateConfig,
  renderElementGetter: (empId: string, side: 'front' | 'back') => HTMLElement | null,
  onProgress?: ExportProgressCallback
): Promise<Blob> => {
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
    scaleFactor,
    cols,
    cardsPerPage,
    pairsPerPage,
    colsOfPairs,
  } = geom;

  const pdf = new jsPDF({
    orientation: settings.orientation,
    unit: 'mm',
    format: [pageWidthMm, pageHeightMm],
    compress: true,
  });

  // Pre-render card images using html2canvas with lossless PNG
  const totalCards = employees.length;
  const renderedImages: Record<string, { front?: string; back?: string }> = {};

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    if (onProgress) {
      onProgress(i + 1, totalCards, `Rendering card graphics (${i + 1}/${totalCards})...`);
    }

    renderedImages[emp.id] = {};

    const frontEl = renderElementGetter(emp.id, 'front');
    if (frontEl) {
      try {
        renderedImages[emp.id].front = await captureCardToPng(frontEl);
      } catch (err) {
        console.warn(`Failed to capture front for ${emp.id}:`, err);
      }
    }

    const backEl = renderElementGetter(emp.id, 'back');
    if (backEl) {
      try {
        renderedImages[emp.id].back = await captureCardToPng(backEl);
      } catch (err) {
        console.warn(`Failed to capture back for ${emp.id}:`, err);
      }
    }
  }

  // Draw crop marks function strictly clamped within page boundary
  const drawCropMarks = (x: number, y: number, w: number, h: number) => {
    if (!settings.showCutMarks) return;
    const len = Math.min(3, Math.max(1.2, 3 * scaleFactor));
    const offset = Math.min(1.5, Math.max(0.6, 1.5 * scaleFactor));
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.12);

    // Top-left
    const x1 = Math.max(0.5, x - offset - len);
    const x2 = Math.max(0.5, x - offset);
    if (x2 > x1) pdf.line(x1, y, x2, y);

    const y1 = Math.max(0.5, y - offset - len);
    const y2 = Math.max(0.5, y - offset);
    if (y2 > y1) pdf.line(x, y1, x, y2);

    // Top-right
    const x3 = Math.min(pageWidthMm - 0.5, x + w + offset);
    const x4 = Math.min(pageWidthMm - 0.5, x + w + offset + len);
    if (x4 > x3) pdf.line(x3, y, x4, y);
    if (y2 > y1) pdf.line(x + w, y1, x + w, y2);

    // Bottom-left
    if (x2 > x1) pdf.line(x1, y + h, x2, y + h);
    const y3 = Math.min(pageHeightMm - 0.5, y + h + offset);
    const y4 = Math.min(pageHeightMm - 0.5, y + h + offset + len);
    if (y4 > y3) pdf.line(x, y3, x, y4);

    // Bottom-right
    if (x4 > x3) pdf.line(x3, y + h, x4, y + h);
    if (y4 > y3) pdf.line(x + w, y3, x + w, y4);
  };

  // Generate PDF Pages based on layoutMode
  if (settings.layoutMode === 'duplex') {
    // Duplex: Page of Fronts, followed immediately by Page of Backs (mirrored horizontally)
    const totalBatches = Math.ceil(employees.length / cardsPerPage);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const batchEmployees = employees.slice(batchIdx * cardsPerPage, (batchIdx + 1) * cardsPerPage);

      // FRONT PAGE
      if (batchIdx > 0) pdf.addPage([pageWidthMm, pageHeightMm], settings.orientation);

      batchEmployees.forEach((emp, slotIdx) => {
        const col = slotIdx % cols;
        const row = Math.floor(slotIdx / cols);
        const x = startX + col * (cardW + gapX);
        const y = startY + row * (cardH + gapY);

        const imgData = renderedImages[emp.id]?.front;
        if (imgData) {
          pdf.addImage(imgData, 'PNG', x, y, cardW, cardH, undefined, 'FAST');
          drawCropMarks(x, y, cardW, cardH);
        }
      });

      // BACK PAGE (Mirrored columns for perfect double-sided alignment)
      pdf.addPage([pageWidthMm, pageHeightMm], settings.orientation);

      batchEmployees.forEach((emp, slotIdx) => {
        const originalCol = slotIdx % cols;
        const row = Math.floor(slotIdx / cols);
        // Mirrored column position
        const mirroredCol = cols - 1 - originalCol;
        const x = startX + mirroredCol * (cardW + gapX);
        const y = startY + row * (cardH + gapY);

        const imgData = renderedImages[emp.id]?.back;
        if (imgData) {
          pdf.addImage(imgData, 'PNG', x, y, cardW, cardH, undefined, 'FAST');
          drawCropMarks(x, y, cardW, cardH);
        }
      });
    }
  } else if (settings.layoutMode === 'side-by-side') {
    // Side by side: Front on left, Back on right for each card
    const totalBatches = Math.ceil(employees.length / pairsPerPage);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      if (batchIdx > 0) pdf.addPage([pageWidthMm, pageHeightMm], settings.orientation);

      const batch = employees.slice(batchIdx * pairsPerPage, (batchIdx + 1) * pairsPerPage);

      batch.forEach((emp, pairIdx) => {
        const colPair = pairIdx % colsOfPairs;
        const row = Math.floor(pairIdx / colsOfPairs);

        // Front (Left)
        const xF = startX + colPair * (cardW * 2 + gapX * 2);
        const yF = startY + row * (cardH + gapY);

        // Back (Right)
        const xB = xF + cardW + gapX;
        const yB = yF;

        const imgFront = renderedImages[emp.id]?.front;
        if (imgFront) {
          pdf.addImage(imgFront, 'PNG', xF, yF, cardW, cardH, undefined, 'FAST');
          drawCropMarks(xF, yF, cardW, cardH);
        }

        const imgBack = renderedImages[emp.id]?.back;
        if (imgBack) {
          pdf.addImage(imgBack, 'PNG', xB, yB, cardW, cardH, undefined, 'FAST');
          drawCropMarks(xB, yB, cardW, cardH);
        }
      });
    }
  } else if (settings.layoutMode === 'top-and-bottom') {
    // Top and Bottom: Front at top, Back at bottom for each card
    const totalBatches = Math.ceil(employees.length / pairsPerPage);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      if (batchIdx > 0) pdf.addPage([pageWidthMm, pageHeightMm], settings.orientation);

      const batch = employees.slice(batchIdx * pairsPerPage, (batchIdx + 1) * pairsPerPage);

      batch.forEach((emp, pairIdx) => {
        const col = pairIdx % cols;
        const rowPair = Math.floor(pairIdx / cols);

        // Front (Top)
        const xF = startX + col * (cardW + gapX);
        const yF = startY + rowPair * (cardH * 2 + gapY * 2);

        // Back (Bottom)
        const xB = xF;
        const yB = yF + cardH + gapY;

        const imgFront = renderedImages[emp.id]?.front;
        if (imgFront) {
          pdf.addImage(imgFront, 'PNG', xF, yF, cardW, cardH, undefined, 'FAST');
          drawCropMarks(xF, yF, cardW, cardH);
        }

        const imgBack = renderedImages[emp.id]?.back;
        if (imgBack) {
          pdf.addImage(imgBack, 'PNG', xB, yB, cardW, cardH, undefined, 'FAST');
          drawCropMarks(xB, yB, cardW, cardH);
        }
      });
    }
  } else {
    // Front only or Back only
    const side = settings.layoutMode === 'front-only' ? 'front' : 'back';
    const totalBatches = Math.ceil(employees.length / cardsPerPage);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      if (batchIdx > 0) pdf.addPage([pageWidthMm, pageHeightMm], settings.orientation);

      const batch = employees.slice(batchIdx * cardsPerPage, (batchIdx + 1) * cardsPerPage);

      batch.forEach((emp, slotIdx) => {
        const col = slotIdx % cols;
        const row = Math.floor(slotIdx / cols);
        const x = startX + col * (cardW + gapX);
        const y = startY + row * (cardH + gapY);

        const imgData = renderedImages[emp.id]?.[side];
        if (imgData) {
          pdf.addImage(imgData, 'PNG', x, y, cardW, cardH, undefined, 'FAST');
          drawCropMarks(x, y, cardW, cardH);
        }
      });
    }
  }

  if (onProgress) {
    onProgress(totalCards, totalCards, 'Compiling PDF document...');
  }

  return pdf.output('blob');
};
