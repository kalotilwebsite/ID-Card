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
} from 'docx';
import html2canvas from 'html2canvas-pro';
import { EmployeeCardData, PrintSettings } from '../types';

export interface DocxProgressCallback {
  (current: number, total: number, message: string): void;
}

export const exportCardsToDocx = async (
  employees: EmployeeCardData[],
  settings: PrintSettings,
  renderElementGetter: (empId: string, side: 'front' | 'back') => HTMLElement | null,
  onProgress?: DocxProgressCallback
): Promise<Blob> => {
  const total = employees.length;
  const isLandscape = settings.orientation === 'landscape';

  // Convert card mm to points/pixels for docx ImageRun:
  // 1 mm ~ 3.78 px
  const cardPixelW = Math.round(settings.cardWidthMm * 3.78);
  const cardPixelH = Math.round(settings.cardHeightMm * 3.78);

  const cardTableCells: TableCell[] = [];

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    if (onProgress) {
      onProgress(i + 1, total, `Processing card ${i + 1} of ${total} for Word document...`);
    }

    const frontEl = renderElementGetter(emp.id, 'front');
    const backEl = renderElementGetter(emp.id, 'back');

    let frontBuf: Uint8Array | null = null;
    let backBuf: Uint8Array | null = null;

    if (frontEl) {
      const cF = await html2canvas(frontEl, { scale: 2, backgroundColor: '#ffffff', logging: false });
      const blobF = await new Promise<Blob | null>((res) => cF.toBlob(res, 'image/png'));
      if (blobF) {
        frontBuf = new Uint8Array(await blobF.arrayBuffer());
      }
    }

    if (backEl) {
      const cB = await html2canvas(backEl, { scale: 2, backgroundColor: '#ffffff', logging: false });
      const blobB = await new Promise<Blob | null>((res) => cB.toBlob(res, 'image/png'));
      if (blobB) {
        backBuf = new Uint8Array(await blobB.arrayBuffer());
      }
    }

    // Add Front Cell
    if (frontBuf && (settings.layoutMode !== 'back-only')) {
      cardTableCells.push(
        new TableCell({
          width: { size: settings.cardWidthMm * 56.7, type: WidthType.DXA },
          borders: {
            top: { style: BorderStyle.DASHED, size: 1, color: 'D1D5DB' },
            bottom: { style: BorderStyle.DASHED, size: 1, color: 'D1D5DB' },
            left: { style: BorderStyle.DASHED, size: 1, color: 'D1D5DB' },
            right: { style: BorderStyle.DASHED, size: 1, color: 'D1D5DB' },
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: frontBuf,
                  transformation: {
                    width: cardPixelW,
                    height: cardPixelH,
                  },
                } as any),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              text: `${emp.name} (Front)`,
            }),
          ],
        })
      );
    }

    // Add Back Cell
    if (backBuf && (settings.layoutMode !== 'front-only')) {
      cardTableCells.push(
        new TableCell({
          width: { size: settings.cardWidthMm * 56.7, type: WidthType.DXA },
          borders: {
            top: { style: BorderStyle.DASHED, size: 1, color: 'D1D5DB' },
            bottom: { style: BorderStyle.DASHED, size: 1, color: 'D1D5DB' },
            left: { style: BorderStyle.DASHED, size: 1, color: 'D1D5DB' },
            right: { style: BorderStyle.DASHED, size: 1, color: 'D1D5DB' },
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: backBuf,
                  transformation: {
                    width: cardPixelW,
                    height: cardPixelH,
                  },
                } as any),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              text: `${emp.name} (Back)`,
            }),
          ],
        })
      );
    }
  }

  // Group cells into table rows according to columnsPerPage
  const cols = Math.max(1, settings.columnsPerPage || 2);
  const tableRows: TableRow[] = [];

  for (let i = 0; i < cardTableCells.length; i += cols) {
    const rowCells = cardTableCells.slice(i, i + cols);
    // Pad remaining cells if last row has fewer items
    while (rowCells.length < cols) {
      rowCells.push(
        new TableCell({
          width: { size: settings.cardWidthMm * 56.7, type: WidthType.DXA },
          children: [new Paragraph({})],
        })
      );
    }
    tableRows.push(new TableRow({ children: rowCells }));
  }

  const table = new Table({
    rows: tableRows,
    alignment: AlignmentType.CENTER,
  });

  const paperW =
    settings.paperSize === 'custom'
      ? Math.max(20, Number(settings.customWidthMm) || 210)
      : settings.paperSize === 'letter'
      ? 215.9
      : 210;
  const paperH =
    settings.paperSize === 'custom'
      ? Math.max(20, Number(settings.customHeightMm) || 297)
      : settings.paperSize === 'letter'
      ? 279.4
      : 297;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: (isLandscape ? paperH : paperW) * 56.7,
              height: (isLandscape ? paperW : paperH) * 56.7,
              orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: {
              top: settings.marginsMm.top * 56.7,
              bottom: settings.marginsMm.bottom * 56.7,
              left: settings.marginsMm.left * 56.7,
              right: settings.marginsMm.right * 56.7,
            },
          },
        },
        children: [
          new Paragraph({
            text: 'Employee ID Cards - Akij Ceramics Limited / Rosa',
            heading: 'Heading1',
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: '' }),
          table,
        ],
      },
    ],
  });

  if (onProgress) {
    onProgress(total, total, 'Packaging Word document (.docx)...');
  }

  return await Packer.toBlob(doc);
};
