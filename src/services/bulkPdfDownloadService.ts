import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { EmployeeCardData, CARD_WIDTH, CARD_HEIGHT } from '../types';

export interface BulkPdfProgressCallback {
  (current: number, total: number, message: string): void;
}

export interface BulkPdfResult {
  blob: Blob;
  cardCount: number;
  pageCount: number;
  filename: string;
}

/**
 * Downloads up to 18 selected employee cards as a print-ready landscape PDF.
 * - Maximum 18 cards per PDF (rejects if > 18).
 * - Exactly 6 complete cards per landscape page (Front & Back paired side-by-side).
 * - Maximum 3 landscape pages (for 18 cards, exactly 3 pages).
 * - Fully client-side to protect server resources.
 * - High-resolution captures preserving exact typography, photos, signatures, and logos.
 */
export async function generateBulkCardsPdf(
  selectedEmployees: EmployeeCardData[],
  getCardElement: (empId: string, side: 'front' | 'back') => HTMLElement | null,
  onProgress?: BulkPdfProgressCallback
): Promise<BulkPdfResult> {
  const count = selectedEmployees.length;

  if (count === 0) {
    throw new Error('Please select at least 1 card from the table to download.');
  }

  if (count > 18) {
    throw new Error(
      `Maximum 18 cards per PDF download. Please select no more than 18 cards (currently selected: ${count}).`
    );
  }

  // Ensure all fonts are completely rendered before starting capture
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Continue if font ready promise rejects
    }
  }

  // 1. Capture front and back images for each selected employee directly from DOM
  const capturedCards: {
    emp: EmployeeCardData;
    frontImg: string;
    backImg: string;
  }[] = [];

  for (let i = 0; i < count; i++) {
    const emp = selectedEmployees[i];
    if (onProgress) {
      onProgress(i + 1, count, `Capturing card ${i + 1} of ${count} (${emp.name || emp.enrollId})...`);
    }

    let frontEl = getCardElement(emp.id, 'front');
    let backEl = getCardElement(emp.id, 'back');

    // Robust fallbacks to inspect preview elements if offscreen element isn't found
    if (!frontEl) {
      frontEl = (document.getElementById(`inspect-front-${emp.id}`) ||
        document.querySelector(`[data-card-type="front"][data-employee-id="${emp.id}"]`)) as HTMLElement | null;
    }
    if (!backEl) {
      backEl = (document.getElementById(`inspect-back-${emp.id}`) ||
        document.querySelector(`[data-card-type="back"][data-employee-id="${emp.id}"]`)) as HTMLElement | null;
    }

    if (!frontEl || !backEl) {
      throw new Error(`Could not find preview elements for card: ${emp.name || emp.enrollId || emp.id}`);
    }

    // Capture front side at 3x scale for crisp print quality (>450 DPI) with strict boundary isolation
    const frontCanvas = await html2canvas(frontEl, {
      scale: 3,
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
    const frontImg = frontCanvas.toDataURL('image/jpeg', 0.96);

    // Capture back side at 3x scale with strict boundary isolation
    const backCanvas = await html2canvas(backEl, {
      scale: 3,
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
    const backImg = backCanvas.toDataURL('image/jpeg', 0.96);

    capturedCards.push({ emp, frontImg, backImg });
  }

  if (onProgress) {
    onProgress(count, count, 'Arranging landscape print pages...');
  }

  // 2. Generate PDF with jsPDF in landscape orientation
  // A4 Landscape: 297mm width x 210mm height
  const pageWidthMm = 297;
  const pageHeightMm = 210;

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  // Layout calculations:
  // 6 complete cards per landscape page (arranged in 2 rows of 3 card pairs)
  // Each card pair contains Front on left, Back on right
  const cardWidthMm = 44;
  // Aspect ratio preserved exactly: 284 / 500 = 0.568 -> 44 / (284/500) = 77.4648mm
  const cardHeightMm = Number(((cardWidthMm * 500) / 284).toFixed(3));
  const pairGapMm = 2; // Gap between Front and Back of the same card
  const cardGapXMm = 4; // Horizontal gap between different cards
  const rowGapYMm = 12; // Vertical gap between row 1 and row 2

  // Total width of 3 card pairs: 3 * (44 + 2 + 44) + 2 * 4 = 3 * 90 + 8 = 278mm
  const totalRowWidthMm = 3 * (cardWidthMm * 2 + pairGapMm) + 2 * cardGapXMm;
  const marginLeft = Math.max(5, (pageWidthMm - totalRowWidthMm) / 2); // ~9.5mm centered

  // Total height of 2 rows: 2 * 77.465 + 12 = 166.93mm
  const totalGridHeightMm = 2 * cardHeightMm + rowGapYMm;
  const marginTop = Math.max(5, (pageHeightMm - totalGridHeightMm) / 2); // ~21.5mm centered

  const totalPages = Math.ceil(capturedCards.length / 6);

  // Helper for drawing clean print crop marks at the 4 corners of each card side
  const drawCardCropMarks = (x: number, y: number, w: number, h: number) => {
    const len = 2.5; // mm
    const offset = 1.0; // mm
    pdf.setDrawColor(180, 185, 195);
    pdf.setLineWidth(0.12);

    // Top-left corner
    pdf.line(x - offset - len, y, x - offset, y);
    pdf.line(x, y - offset - len, x, y - offset);

    // Top-right corner
    pdf.line(x + w + offset, y, x + w + offset + len, y);
    pdf.line(x + w, y - offset - len, x + w, y - offset);

    // Bottom-left corner
    pdf.line(x - offset - len, y + h, x - offset, y + h);
    pdf.line(x, y + h + offset, x, y + h + offset + len);

    // Bottom-right corner
    pdf.line(x + w + offset, y + h, x + w + offset + len, y + h);
    pdf.line(x + w, y + h + offset, x + w, y + h + offset + len);
  };

  // 3. Render pages (max 3 landscape pages for up to 18 cards)
  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (pageIdx > 0) {
      pdf.addPage('a4', 'landscape');
    }

    const pageCards = capturedCards.slice(pageIdx * 6, (pageIdx + 1) * 6);

    pageCards.forEach((card, slotIdx) => {
      const col = slotIdx % 3; // 0, 1, or 2 (3 card pairs per row)
      const row = Math.floor(slotIdx / 3); // 0 or 1 (2 rows)

      const cardStartX = marginLeft + col * (cardWidthMm * 2 + pairGapMm + cardGapXMm);
      const cardStartY = marginTop + row * (cardHeightMm + rowGapYMm);

      // FRONT SIDE (Left)
      const xFront = cardStartX;
      const yFront = cardStartY;
      pdf.addImage(card.frontImg, 'JPEG', xFront, yFront, cardWidthMm, cardHeightMm, undefined, 'FAST');
      drawCardCropMarks(xFront, yFront, cardWidthMm, cardHeightMm);

      // BACK SIDE (Right)
      const xBack = cardStartX + cardWidthMm + pairGapMm;
      const yBack = cardStartY;
      pdf.addImage(card.backImg, 'JPEG', xBack, yBack, cardWidthMm, cardHeightMm, undefined, 'FAST');
      drawCardCropMarks(xBack, yBack, cardWidthMm, cardHeightMm);
    });
  }

  // Free memory of base64 images
  capturedCards.forEach((c) => {
    c.frontImg = '';
    c.backImg = '';
  });

  const filename = `Bulk_Employee_ID_Cards_${count}_Cards_${new Date().toISOString().slice(0, 10)}.pdf`;
  const blob = pdf.output('blob');

  return {
    blob,
    cardCount: count,
    pageCount: totalPages,
    filename,
  };
}

/**
 * Triggers a direct browser file download for a generated Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
