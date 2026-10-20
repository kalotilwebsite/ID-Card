import ExcelJS from 'exceljs';
import { parseCSVText } from './googleSheetsService';

export interface ParsedExcelResult {
  sheetNames: string[];
  currentSheet: string;
  headers: string[];
  rows: Record<string, any>[];
  embeddedImagesCount: number;
}

// Convert image ArrayBuffer to a base64 Data URL safely in browser
export const bufferToDataUrl = (buffer: ArrayBuffer | Uint8Array, extension: string): string => {
  let bytes: Uint8Array;
  if (buffer instanceof Uint8Array) {
    bytes = buffer;
  } else {
    bytes = new Uint8Array(buffer);
  }

  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }

  const base64 = btoa(binary);
  const ext = (extension || 'png').toLowerCase().replace('.', '');
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${base64}`;
};

// Formats phone numbers or NID numbers that Excel might turn into scientific notation (e.g. 5.65646E+13)
export const sanitizeExcelCellValue = (val: any): string => {
  if (val === null || val === undefined) return '';

  if (typeof val === 'number') {
    // If integer, avoid scientific notation
    if (Number.isInteger(val)) {
      return val.toLocaleString('fullwide', { useGrouping: false });
    }
    return String(val);
  }

  if (typeof val === 'object') {
    // ExcelJS sometimes returns rich text or formula objects
    if (val.text) return String(val.text).trim();
    if (val.result !== undefined) return sanitizeExcelCellValue(val.result);
    if (val.richText) {
      return val.richText.map((t: any) => t.text).join('').trim();
    }
    if (val instanceof Date) {
      // Format as DD/MM/YYYY
      const d = String(val.getDate()).padStart(2, '0');
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const y = val.getFullYear();
      return `${d}/${m}/${y}`;
    }
  }

  return String(val).trim();
};

export const parseExcelFile = async (
  file: File,
  targetSheetIndex = 0
): Promise<ParsedExcelResult> => {
  const fileName = file.name.toLowerCase();

  // If CSV file
  if (fileName.endsWith('.csv')) {
    const text = await file.text();
    const parsed = parseCSVText(text);
    if (parsed.length === 0) {
      return { sheetNames: ['Sheet1'], currentSheet: 'Sheet1', headers: [], rows: [], embeddedImagesCount: 0 };
    }
    const headers = parsed[0].map((h, i) => (h ? h.trim() : `Column ${i + 1}`));
    const rows: Record<string, any>[] = [];
    for (let i = 1; i < parsed.length; i++) {
      const line = parsed[i];
      if (line.every((c) => !c || c.trim() === '')) continue;
      const rowObj: Record<string, any> = {};
      headers.forEach((h, idx) => {
        rowObj[h] = line[idx] ? sanitizeExcelCellValue(line[idx]) : '';
      });
      rows.push(rowObj);
    }
    return {
      sheetNames: ['Sheet1'],
      currentSheet: 'Sheet1',
      headers,
      rows,
      embeddedImagesCount: 0,
    };
  }

  // If XLSX or XLS
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const sheetNames = workbook.worksheets.map((ws) => ws.name);
  const worksheet = workbook.worksheets[targetSheetIndex] || workbook.worksheets[0];

  if (!worksheet) {
    throw new Error('Workbook contains no valid worksheets');
  }

  // 1. Extract embedded images and their row positions
  // In ExcelJS, worksheet.getImages() returns [{ type: 'image', imageId: string, range: { tl: { col, row }, br: { col, row } } }]
  const embeddedImageByRow: Record<number, string> = {};
  let imagesCount = 0;

  try {
    const images = worksheet.getImages?.() || [];
    imagesCount = images.length;

    images.forEach((img: any) => {
      try {
        const imageId = typeof img.imageId === 'number' ? img.imageId : parseInt(img.imageId, 10);
        const media = workbook.getImage(imageId);
        if (media && media.buffer) {
          const dataUrl = bufferToDataUrl(media.buffer as any, media.extension);
          // ExcelJS range.tl.row is 0-indexed or 1-indexed. Let's record the row index.
          const topRow = img.range?.tl?.row !== undefined ? Math.floor(img.range.tl.row) : null;
          if (topRow !== null) {
            embeddedImageByRow[topRow] = dataUrl;
          }
        }
      } catch (err) {
        console.warn('Could not extract image from worksheet', err);
      }
    });
  } catch (err) {
    console.warn('Worksheet image extraction not supported or empty', err);
  }

  // 2. Read rows and headers
  const headers: string[] = [];
  const rows: Record<string, any>[] = [];

  let headerRowIndex = 1;
  // Find first row with text
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (headers.length === 0) {
      headerRowIndex = rowNumber;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const val = sanitizeExcelCellValue(cell.value);
        headers[colNumber - 1] = val || `Column ${colNumber}`;
      });
      // Ensure no gaps in headers
      for (let i = 0; i < headers.length; i++) {
        if (!headers[i]) headers[i] = `Column ${i + 1}`;
      }
    } else {
      const rowObj: Record<string, any> = {};
      let hasData = false;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber - 1] || `Column ${colNumber}`;
        const val = sanitizeExcelCellValue(cell.value);
        if (val) hasData = true;
        rowObj[header] = val;
      });

      // Check if this row has an embedded image
      // Note: check rowNumber (1-based), rowNumber - 1 (0-based), and row index offsets
      const zeroBasedRow = rowNumber - 1;
      const associatedImage =
        embeddedImageByRow[zeroBasedRow] ||
        embeddedImageByRow[rowNumber] ||
        embeddedImageByRow[zeroBasedRow - (headerRowIndex - 1)];

      if (associatedImage) {
        rowObj['__embedded_photo__'] = associatedImage;
        hasData = true;
      }

      if (hasData) {
        rows.push(rowObj);
      }
    }
  });

  // If embedded images exists, add an auto header if not present
  if (imagesCount > 0 && !headers.includes('Embedded Photo') && !headers.includes('Photo')) {
    headers.push('Embedded Photo');
    rows.forEach((r) => {
      if (r['__embedded_photo__']) {
        r['Embedded Photo'] = r['__embedded_photo__'];
      }
    });
  }

  return {
    sheetNames,
    currentSheet: worksheet.name,
    headers,
    rows,
    embeddedImagesCount: imagesCount,
  };
};
