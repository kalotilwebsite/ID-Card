import ExcelJS from 'exceljs';
import { parseCSVText } from './googleSheetsService';
import { EmployeeCardData } from '../types';

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

  // 1. Extract embedded images and their row/column positions
  // In ExcelJS, worksheet.getImages() returns [{ type: 'image', imageId: string, range: { tl: { col, row }, br: { col, row } } }]
  const embeddedImageByRowCol: Record<string, string> = {};
  const imagesByRow: Record<number, string[]> = {};
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
          const topRow = img.range?.tl?.row !== undefined ? Math.floor(img.range.tl.row) : null;
          const topCol = img.range?.tl?.col !== undefined ? Math.floor(img.range.tl.col) : null;
          if (topRow !== null) {
            if (!imagesByRow[topRow]) imagesByRow[topRow] = [];
            imagesByRow[topRow].push(dataUrl);

            if (topCol !== null) {
              embeddedImageByRowCol[`${topRow}_${topCol}`] = dataUrl;
            }
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

      // Check for embedded images in this row:
      const zeroBasedRow = rowNumber - 1;
      
      // Match by exact cell column if available
      headers.forEach((header, colIdx) => {
        const imgAtCell =
          embeddedImageByRowCol[`${zeroBasedRow}_${colIdx}`] ||
          embeddedImageByRowCol[`${rowNumber}_${colIdx}`] ||
          embeddedImageByRowCol[`${zeroBasedRow - (headerRowIndex - 1)}_${colIdx}`];
        if (imgAtCell) {
          rowObj[header] = imgAtCell;
          hasData = true;
          const lowerH = header.toLowerCase();
          if (lowerH.includes('sign')) {
            rowObj['__embedded_signature__'] = imgAtCell;
          } else {
            rowObj['__embedded_photo__'] = imgAtCell;
          }
        }
      });

      // Match sequential images by row if column match was not found
      const rowImages =
        imagesByRow[zeroBasedRow] ||
        imagesByRow[rowNumber] ||
        imagesByRow[zeroBasedRow - (headerRowIndex - 1)];

      if (rowImages && rowImages.length > 0) {
        if (!rowObj['__embedded_photo__'] && rowImages[0]) {
          rowObj['__embedded_photo__'] = rowImages[0];
          hasData = true;
        }
        if (!rowObj['__embedded_signature__'] && rowImages.length > 1 && rowImages[1]) {
          rowObj['__embedded_signature__'] = rowImages[1];
          hasData = true;
        }
      }

      if (hasData) {
        rows.push(rowObj);
      }
    }
  });

  // If embedded images exists, add auto headers for photo and signature if not present
  const hasEmbeddedPhotos = rows.some((r) => Boolean(r['__embedded_photo__']));
  const hasEmbeddedSignatures = rows.some((r) => Boolean(r['__embedded_signature__']));

  if (hasEmbeddedPhotos && !headers.includes('Embedded Photo') && !headers.includes('Photo')) {
    headers.push('Embedded Photo');
    rows.forEach((r) => {
      if (r['__embedded_photo__']) {
        r['Embedded Photo'] = r['__embedded_photo__'];
      }
    });
  }

  if (hasEmbeddedSignatures && !headers.includes('Embedded Signature') && !headers.includes('Signature')) {
    headers.push('Embedded Signature');
    rows.forEach((r) => {
      if (r['__embedded_signature__']) {
        r['Embedded Signature'] = r['__embedded_signature__'];
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

export const exportCardsToExcel = async (
  employees: EmployeeCardData[],
  renderElementGetter?: (empId: string, side: 'front' | 'back') => HTMLElement | null,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<Blob> => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Akij Ceramics / Rosa ID Card System';
  wb.lastModifiedBy = 'Akij Ceramics / Rosa ID Card System';
  wb.created = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet('Employee ID Cards', {
    views: [{ showGridLines: true }],
  });

  ws.columns = [
    { header: 'SL', key: 'sl', width: 6 },
    { header: 'Enroll ID', key: 'enrollId', width: 14 },
    { header: 'Employee Name', key: 'name', width: 28 },
    { header: 'Designation', key: 'designation', width: 22 },
    { header: 'Department', key: 'department', width: 20 },
    { header: 'Job Type', key: 'jobType', width: 16 },
    { header: 'Join Date', key: 'joiningDate', width: 16 },
    { header: 'Card Issue Date', key: 'cardIssue', width: 16 },
    { header: 'Contact Number', key: 'emergencyContact', width: 18 },
    { header: 'Permanent Address', key: 'permanentAddress', width: 34 },
    { header: 'National ID', key: 'nationalId', width: 18 },
    { header: 'Blood Group', key: 'bloodGroup', width: 14 },
    { header: 'Photo Status', key: 'photoStatus', width: 15 },
    { header: 'Signature Status', key: 'signatureStatus', width: 16 },
  ];

  // Header row styling
  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  const total = employees.length;
  for (let i = 0; i < total; i++) {
    const emp = employees[i];
    if (onProgress) {
      onProgress(i + 1, total, `Exporting employee ${i + 1} of ${total} to Excel...`);
    }

    const rowNumber = i + 2;
    const row = ws.addRow({
      sl: i + 1,
      enrollId: emp.enrollId || '',
      name: emp.name || '',
      designation: emp.designation || '',
      department: emp.department || '',
      jobType: emp.jobType || 'Permanent',
      joiningDate: emp.joiningDate || '',
      cardIssue: emp.cardIssue || '',
      emergencyContact: emp.emergencyContact || '',
      permanentAddress: emp.permanentAddress || 'Mukkhopur, Trishal, Mymensingh',
      nationalId: emp.nationalId || '',
      bloodGroup: emp.bloodGroup || '',
      photoStatus: emp.photoUrl ? 'Attached' : 'None',
      signatureStatus: emp.signatureUrl ? 'Attached' : 'None',
    });

    row.height = 24;
    row.eachCell((cell, colNum) => {
      cell.alignment = {
        vertical: 'middle',
        horizontal:
          colNum === 1 || colNum === 2 || colNum === 7 || colNum === 8 || colNum === 12
            ? 'center'
            : 'left',
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (i % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }
    });

    if (emp.photoUrl && emp.photoUrl.startsWith('data:image')) {
      try {
        const matches = emp.photoUrl.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1].toLowerCase() === 'jpg' ? 'jpeg' : matches[1].toLowerCase();
          const base64Data = matches[2];
          const imageId = wb.addImage({
            base64: base64Data,
            extension: (ext === 'png' ? 'png' : 'jpeg') as any,
          });
          ws.addImage(imageId, {
            tl: { col: 12.1, row: rowNumber - 0.9 },
            ext: { width: 30, height: 32 },
          });
          row.height = 36;
        }
      } catch (e) {
        // Continue gracefully
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};
