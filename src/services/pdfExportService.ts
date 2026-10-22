import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { EmployeeCardData, PrintSettings, CompanyTemplateConfig, CARD_WIDTH, CARD_HEIGHT } from '../types';

export interface ExportProgressCallback {
  (current: number, total: number, message: string): void;
}

export const PAPER_DIMENSIONS_MM: Record<string, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
};

export const exportCardsToPdf = async (
  employees: EmployeeCardData[],
  settings: PrintSettings,
  companyConfig: CompanyTemplateConfig,
  renderElementGetter: (empId: string, side: 'front' | 'back') => HTMLElement | null,
  onProgress?: ExportProgressCallback
): Promise<Blob> => {
  const isLandscape = settings.orientation === 'landscape';
  const paper =
    settings.paperSize === 'custom'
      ? {
          width: Math.max(20, Number(settings.customWidthMm) || 210),
          height: Math.max(20, Number(settings.customHeightMm) || 297),
        }
      : PAPER_DIMENSIONS_MM[settings.paperSize] || { width: 210, height: 297 };

  const pageWidthMm = isLandscape ? paper.height : paper.width;
  const pageHeightMm = isLandscape ? paper.width : paper.height;

  const pdf = new jsPDF({
    orientation: settings.orientation,
    unit: 'mm',
    format: [pageWidthMm, pageHeightMm],
  });

  const cardW = settings.cardWidthMm; // e.g. 54mm
  const cardH = settings.cardHeightMm; // e.g. 85.6mm
  const cols = settings.columnsPerPage;
  const rows = settings.rowsPerPage;
  const cardsPerPage = cols * rows;

  const marginLeft = settings.marginsMm.left;
  const marginTop = settings.marginsMm.top;
  const gapX = settings.spacingMm.horizontal;
  const gapY = settings.spacingMm.vertical;

  // Pre-render card images using html2canvas
  const totalCards = employees.length;
  const renderedImages: Record<string, { front?: string; back?: string }> = {};

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    if (onProgress) {
      onProgress(i + 1, totalCards, `Rendering card images (${i + 1}/${totalCards})...`);
    }

    renderedImages[emp.id] = {};

    const frontEl = renderElementGetter(emp.id, 'front');
    if (frontEl) {
      const canvas = await html2canvas(frontEl, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
      });
      renderedImages[emp.id].front = canvas.toDataURL('image/jpeg', 0.95);
    }

    const backEl = renderElementGetter(emp.id, 'back');
    if (backEl) {
      const canvas = await html2canvas(backEl, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
      });
      renderedImages[emp.id].back = canvas.toDataURL('image/jpeg', 0.95);
    }
  }

  // Draw crop marks function
  const drawCropMarks = (x: number, y: number, w: number, h: number) => {
    if (!settings.showCutMarks) return;
    const len = 3; // mm
    const offset = 1.5; // mm
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.15);

    // Top-left
    pdf.line(x - offset - len, y, x - offset, y);
    pdf.line(x, y - offset - len, x, y - offset);

    // Top-right
    pdf.line(x + w + offset, y, x + w + offset + len, y);
    pdf.line(x + w, y - offset - len, x + w, y - offset);

    // Bottom-left
    pdf.line(x - offset - len, y + h, x - offset, y + h);
    pdf.line(x, y + h + offset, x, y + h + offset + len);

    // Bottom-right
    pdf.line(x + w + offset, y + h, x + w + offset + len, y + h);
    pdf.line(x + w, y + h + offset, x + w, y + h + offset + len);
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
        const x = marginLeft + col * (cardW + gapX);
        const y = marginTop + row * (cardH + gapY);

        const imgData = renderedImages[emp.id]?.front;
        if (imgData) {
          pdf.addImage(imgData, 'JPEG', x, y, cardW, cardH);
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
        const x = marginLeft + mirroredCol * (cardW + gapX);
        const y = marginTop + row * (cardH + gapY);

        const imgData = renderedImages[emp.id]?.back;
        if (imgData) {
          pdf.addImage(imgData, 'JPEG', x, y, cardW, cardH);
          drawCropMarks(x, y, cardW, cardH);
        }
      });
    }
  } else if (settings.layoutMode === 'side-by-side') {
    // Side by side: Front and Back adjacent on the same page
    // Each pair takes 2 slots
    const pairsPerPage = Math.floor(cardsPerPage / 2) || 1;
    const totalBatches = Math.ceil(employees.length / pairsPerPage);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      if (batchIdx > 0) pdf.addPage([pageWidthMm, pageHeightMm], settings.orientation);

      const batch = employees.slice(batchIdx * pairsPerPage, (batchIdx + 1) * pairsPerPage);

      batch.forEach((emp, pairIdx) => {
        const slotFront = pairIdx * 2;
        const slotBack = pairIdx * 2 + 1;

        // Front
        const colF = slotFront % cols;
        const rowF = Math.floor(slotFront / cols);
        const xF = marginLeft + colF * (cardW + gapX);
        const yF = marginTop + rowF * (cardH + gapY);

        // Back
        const colB = slotBack % cols;
        const rowB = Math.floor(slotBack / cols);
        const xB = marginLeft + colB * (cardW + gapX);
        const yB = marginTop + rowB * (cardH + gapY);

        const imgFront = renderedImages[emp.id]?.front;
        if (imgFront) {
          pdf.addImage(imgFront, 'JPEG', xF, yF, cardW, cardH);
          drawCropMarks(xF, yF, cardW, cardH);
        }

        const imgBack = renderedImages[emp.id]?.back;
        if (imgBack) {
          pdf.addImage(imgBack, 'JPEG', xB, yB, cardW, cardH);
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
        const x = marginLeft + col * (cardW + gapX);
        const y = marginTop + row * (cardH + gapY);

        const imgData = renderedImages[emp.id]?.[side];
        if (imgData) {
          pdf.addImage(imgData, 'JPEG', x, y, cardW, cardH);
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
