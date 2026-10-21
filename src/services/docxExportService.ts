import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  WidthType,
  AlignmentType,
  PageOrientation,
  BorderStyle,
  HeightRule,
  convertMillimetersToTwip,
  ISectionOptions,
} from 'docx';
import html2canvas from 'html2canvas-pro';
import { EmployeeCardData, PrintSettings } from '../types';
import { calculatePrintGeometry } from './pdfExportService';

export interface DocxProgressCallback {
  (current: number, total: number, message: string): void;
}

/**
 * Exports employee ID cards to a Microsoft Word (.docx) document.
 * - Automatically resizes cards proportionally to fit within printable boundaries of any paper size (A4, A5, Letter, Custom).
 * - Accurately respects layoutMode (duplex, side-by-side, top-and-bottom, front-only, back-only).
 * - Produces completely clean output: no headings, captions, titles, or text outside the cards.
 * - Runs 100% in-memory with direct Blob download, avoiding persistent storage or database writes.
 */
export const exportCardsToDocx = async (
  employees: EmployeeCardData[],
  settings: PrintSettings,
  renderElementGetter: (empId: string, side: 'front' | 'back') => HTMLElement | null,
  onProgress?: DocxProgressCallback
): Promise<Blob> => {
  const totalEmployees = employees.length;
  if (totalEmployees === 0) {
    throw new Error('No employee cards available to export.');
  }

  // Calculate precise print geometry identical to PDF exporter
  const geom = calculatePrintGeometry(settings);
  const {
    pageWidthMm,
    pageHeightMm,
    cardWidthMm,
    cardHeightMm,
    gapX,
    gapY,
    startX,
    startY,
    cols,
    rows,
    cardsPerPage,
    pairsPerPage,
    colsOfPairs,
    rowsOfPairs,
  } = geom;

  const isLandscape = settings.orientation === 'landscape';

  // In Word/docx, 1 inch = 96 CSS pixels = 25.4 mm -> 1 mm = (96 / 25.4) pixels
  const cardPixelW = Math.round(cardWidthMm * (96 / 25.4));
  const cardPixelH = Math.round(cardHeightMm * (96 / 25.4));

  const cellWidthTwips = convertMillimetersToTwip(cardWidthMm);
  const minGap = Math.min(gapX, gapY);
  const extraX = Math.max(0, gapX - minGap);
  const extraY = Math.max(0, gapY - minGap);

  // Cell padding for non-uniform gaps if horizontal and vertical spacing differ
  const cellMargins = {
    top: convertMillimetersToTwip(extraY / 2),
    bottom: convertMillimetersToTwip(extraY / 2),
    left: convertMillimetersToTwip(extraX / 2),
    right: convertMillimetersToTwip(extraX / 2),
  };

  // Card cell border: subtle dashed outline if showCutMarks is enabled, none otherwise
  const cardBorders = settings.showCutMarks
    ? {
        top: { style: BorderStyle.DASHED, size: 1, color: 'CBD5E1' },
        bottom: { style: BorderStyle.DASHED, size: 1, color: 'CBD5E1' },
        left: { style: BorderStyle.DASHED, size: 1, color: 'CBD5E1' },
        right: { style: BorderStyle.DASHED, size: 1, color: 'CBD5E1' },
      }
    : {
        top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      };

  const emptyBorders = {
    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  };

  // Pre-render employee card images in high-fidelity
  const renderedImages: Record<string, { front?: Uint8Array; back?: Uint8Array }> = {};

  const needFront = settings.layoutMode !== 'back-only';
  const needBack = settings.layoutMode !== 'front-only';

  for (let i = 0; i < totalEmployees; i++) {
    const emp = employees[i];
    if (onProgress) {
      onProgress(i + 1, totalEmployees, `Rendering card artwork (${i + 1} of ${totalEmployees})...`);
    }

    renderedImages[emp.id] = {};

    if (needFront) {
      const frontEl = renderElementGetter(emp.id, 'front');
      if (frontEl) {
        const canvas = await html2canvas(frontEl, {
          scale: 2.2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
        });
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.95));
        if (blob) {
          renderedImages[emp.id].front = new Uint8Array(await blob.arrayBuffer());
        }
      }
    }

    if (needBack) {
      const backEl = renderElementGetter(emp.id, 'back');
      if (backEl) {
        const canvas = await html2canvas(backEl, {
          scale: 2.2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
        });
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.95));
        if (blob) {
          renderedImages[emp.id].back = new Uint8Array(await blob.arrayBuffer());
        }
      }
    }
  }

  // Helper to create a single card TableCell
  const createCardCell = (imageBuf?: Uint8Array): TableCell => {
    if (!imageBuf) {
      return new TableCell({
        width: { size: cellWidthTwips, type: WidthType.DXA },
        borders: emptyBorders,
        children: [
          new Paragraph({
            spacing: { before: 0, after: 0, line: 240 },
          }),
        ],
      });
    }

    return new TableCell({
      width: { size: cellWidthTwips, type: WidthType.DXA },
      borders: cardBorders,
      margins: cellMargins,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0, line: 240 },
          children: [
            new ImageRun({
              data: imageBuf,
              transformation: {
                width: cardPixelW,
                height: cardPixelH,
              },
            } as any),
          ],
        }),
      ],
    });
  };

  // Helper to wrap a table in a dedicated page Section
  const createPageSection = (table: Table): ISectionOptions => ({
    properties: {
      page: {
        size: {
          width: convertMillimetersToTwip(pageWidthMm),
          height: convertMillimetersToTwip(pageHeightMm),
          orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
        },
        margin: {
          top: convertMillimetersToTwip(startY),
          bottom: convertMillimetersToTwip(startY),
          left: convertMillimetersToTwip(startX),
          right: convertMillimetersToTwip(startX),
        },
      },
    },
    children: [table],
  });

  const sections: ISectionOptions[] = [];
  const tableBorderConfig = {
    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  };

  if (settings.layoutMode === 'side-by-side') {
    // Front and Back printed side-by-side on each row
    const totalBatches = Math.ceil(employees.length / pairsPerPage);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const batch = employees.slice(batchIdx * pairsPerPage, (batchIdx + 1) * pairsPerPage);
      const tableRows: TableRow[] = [];

      for (let r = 0; r < rows; r++) {
        const rowCells: TableCell[] = [];
        for (let p = 0; p < colsOfPairs; p++) {
          const empIdx = r * colsOfPairs + p;
          const emp = batch[empIdx];
          if (emp) {
            rowCells.push(createCardCell(renderedImages[emp.id]?.front));
            rowCells.push(createCardCell(renderedImages[emp.id]?.back));
          } else {
            rowCells.push(createCardCell());
            rowCells.push(createCardCell());
          }
        }

        tableRows.push(
          new TableRow({
            height: { value: convertMillimetersToTwip(cardHeightMm), rule: HeightRule.ATLEAST },
            children: rowCells,
          })
        );
      }

      const table = new Table({
        alignment: AlignmentType.CENTER,
        columnWidths: Array(colsOfPairs * 2).fill(cellWidthTwips),
        cellSpacing: { value: convertMillimetersToTwip(minGap) },
        borders: tableBorderConfig,
        rows: tableRows,
      });

      sections.push(createPageSection(table));
    }
  } else if (settings.layoutMode === 'top-and-bottom') {
    // Front at top, Back directly underneath for each card
    const totalBatches = Math.ceil(employees.length / pairsPerPage);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const batch = employees.slice(batchIdx * pairsPerPage, (batchIdx + 1) * pairsPerPage);
      const tableRows: TableRow[] = [];

      for (let pr = 0; pr < rowsOfPairs; pr++) {
        const frontCells: TableCell[] = [];
        const backCells: TableCell[] = [];

        for (let c = 0; c < cols; c++) {
          const empIdx = pr * cols + c;
          const emp = batch[empIdx];
          if (emp) {
            frontCells.push(createCardCell(renderedImages[emp.id]?.front));
            backCells.push(createCardCell(renderedImages[emp.id]?.back));
          } else {
            frontCells.push(createCardCell());
            backCells.push(createCardCell());
          }
        }

        // Top Row (Fronts)
        tableRows.push(
          new TableRow({
            height: { value: convertMillimetersToTwip(cardHeightMm), rule: HeightRule.ATLEAST },
            children: frontCells,
          })
        );

        // Bottom Row (Backs)
        tableRows.push(
          new TableRow({
            height: { value: convertMillimetersToTwip(cardHeightMm), rule: HeightRule.ATLEAST },
            children: backCells,
          })
        );
      }

      const table = new Table({
        alignment: AlignmentType.CENTER,
        columnWidths: Array(cols).fill(cellWidthTwips),
        cellSpacing: { value: convertMillimetersToTwip(minGap) },
        borders: tableBorderConfig,
        rows: tableRows,
      });

      sections.push(createPageSection(table));
    }
  } else if (settings.layoutMode === 'duplex') {
    // Duplex: Page of Fronts followed by Page of Backs (mirrored columns for double-sided alignment)
    const totalBatches = Math.ceil(employees.length / cardsPerPage);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const batch = employees.slice(batchIdx * cardsPerPage, (batchIdx + 1) * cardsPerPage);

      // FRONT PAGE
      const frontTableRows: TableRow[] = [];
      for (let r = 0; r < rows; r++) {
        const rowCells: TableCell[] = [];
        for (let c = 0; c < cols; c++) {
          const slot = r * cols + c;
          const emp = batch[slot];
          rowCells.push(createCardCell(emp ? renderedImages[emp.id]?.front : undefined));
        }
        frontTableRows.push(
          new TableRow({
            height: { value: convertMillimetersToTwip(cardHeightMm), rule: HeightRule.ATLEAST },
            children: rowCells,
          })
        );
      }

      const frontTable = new Table({
        alignment: AlignmentType.CENTER,
        columnWidths: Array(cols).fill(cellWidthTwips),
        cellSpacing: { value: convertMillimetersToTwip(minGap) },
        borders: tableBorderConfig,
        rows: frontTableRows,
      });

      sections.push(createPageSection(frontTable));

      // BACK PAGE (Mirrored horizontally so front and back align when sheet is flipped)
      const backTableRows: TableRow[] = [];
      for (let r = 0; r < rows; r++) {
        const rowCells: TableCell[] = [];
        for (let c = 0; c < cols; c++) {
          const mirroredCol = cols - 1 - c;
          const slot = r * cols + mirroredCol;
          const emp = batch[slot];
          rowCells.push(createCardCell(emp ? renderedImages[emp.id]?.back : undefined));
        }
        backTableRows.push(
          new TableRow({
            height: { value: convertMillimetersToTwip(cardHeightMm), rule: HeightRule.ATLEAST },
            children: rowCells,
          })
        );
      }

      const backTable = new Table({
        alignment: AlignmentType.CENTER,
        columnWidths: Array(cols).fill(cellWidthTwips),
        cellSpacing: { value: convertMillimetersToTwip(minGap) },
        borders: tableBorderConfig,
        rows: backTableRows,
      });

      sections.push(createPageSection(backTable));
    }
  } else {
    // 'front-only' or 'back-only'
    const side = settings.layoutMode === 'front-only' ? 'front' : 'back';
    const totalBatches = Math.ceil(employees.length / cardsPerPage);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const batch = employees.slice(batchIdx * cardsPerPage, (batchIdx + 1) * cardsPerPage);
      const tableRows: TableRow[] = [];

      for (let r = 0; r < rows; r++) {
        const rowCells: TableCell[] = [];
        for (let c = 0; c < cols; c++) {
          const slot = r * cols + c;
          const emp = batch[slot];
          rowCells.push(createCardCell(emp ? renderedImages[emp.id]?.[side] : undefined));
        }
        tableRows.push(
          new TableRow({
            height: { value: convertMillimetersToTwip(cardHeightMm), rule: HeightRule.ATLEAST },
            children: rowCells,
          })
        );
      }

      const table = new Table({
        alignment: AlignmentType.CENTER,
        columnWidths: Array(cols).fill(cellWidthTwips),
        cellSpacing: { value: convertMillimetersToTwip(minGap) },
        borders: tableBorderConfig,
        rows: tableRows,
      });

      sections.push(createPageSection(table));
    }
  }

  const doc = new Document({
    sections,
  });

  if (onProgress) {
    onProgress(totalEmployees, totalEmployees, 'Packaging Microsoft Word (.docx) document...');
  }

  return await Packer.toBlob(doc);
};
