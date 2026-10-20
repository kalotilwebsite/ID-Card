import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { parseCSVText } from './googleSheetsService';
import { EmployeeCardData } from '../types';

export interface ParsedExcelResult {
  sheetNames: string[];
  currentSheet: string;
  headers: string[];
  rows: Record<string, any>[];
  embeddedImagesCount: number;
  warnings?: string[];
}

// Convert 1-based column index to Excel column letter (e.g. 1 -> 'A', 11 -> 'K', 12 -> 'L', 27 -> 'AA')
export const colIndexToLetter = (colIndex: number): string => {
  let temp = colIndex;
  let letter = '';
  while (temp > 0) {
    const rem = (temp - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter || 'A';
};

// Convert Excel column letter to 1-based column index (e.g. 'A' -> 1, 'K' -> 11, 'L' -> 12, 'AA' -> 27)
export const letterToColIndex = (letter: string): number => {
  const clean = letter.toUpperCase().trim();
  let col = 0;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      col = col * 26 + (code - 64);
    }
  }
  return col || 1;
};

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
  const mime =
    ext === 'jpg' || ext === 'jpeg'
      ? 'image/jpeg'
      : ext === 'png'
      ? 'image/png'
      : ext === 'gif'
      ? 'image/gif'
      : ext === 'webp'
      ? 'image/webp'
      : ext === 'bmp'
      ? 'image/bmp'
      : ext === 'svg'
      ? 'image/svg+xml'
      : 'image/jpeg';
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

interface ExtractedCellImage {
  dataUrl: string;
  rowNumber: number; // 1-based Excel row
  colNumber: number; // 1-based Excel column
  colLetter: string; // 'A', 'K', 'L', etc.
  source: 'drawing' | 'cellImage' | 'media';
  fileName?: string;
  format?: string;
}

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
    const headers = parsed[0].map((h, i) => (h ? h.trim() : `Column ${colIndexToLetter(i + 1)}`));
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

  // Prepare JSZip instance for raw archive inspection (modern cellImages and fallback validation)
  let zip: JSZip | null = null;
  try {
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch (err) {
    console.warn('Could not inspect workbook as zip archive:', err);
  }

  const cellImages: ExtractedCellImage[] = [];
  const warnings: string[] = [];

  // 1. Primary Extraction: ExcelJS DrawingML images
  try {
    const images = worksheet.getImages?.() || [];

    images.forEach((img: any) => {
      try {
        const imageId = typeof img.imageId === 'number' ? img.imageId : parseInt(img.imageId, 10);
        const media = workbook.getImage(imageId);
        if (media && media.buffer) {
          const ext = (media.extension || 'png').toLowerCase();
          if (['emf', 'wmf'].includes(ext)) {
            warnings.push(
              `An embedded image is in Windows Metafile (.${ext.toUpperCase()}) format, which web browsers cannot display. Please re-insert as PNG or JPEG in Excel.`
            );
            return;
          }
          if (['tiff', 'tif'].includes(ext)) {
            warnings.push(
              `An embedded image is in .${ext.toUpperCase()} format. Web browsers require standard PNG or JPEG images.`
            );
            return;
          }

          const dataUrl = bufferToDataUrl(media.buffer as any, media.extension);
          const tl = img.range?.tl;
          const br = img.range?.br;

          if (tl) {
            const tlCol = tl.col !== undefined ? tl.col : (tl.nativeCol !== undefined ? tl.nativeCol : 0);
            const tlRow = tl.row !== undefined ? tl.row : (tl.nativeRow !== undefined ? tl.nativeRow : 0);
            const brCol = br && br.col !== undefined ? br.col : (br && br.nativeCol !== undefined ? br.nativeCol : tlCol + 1);
            const brRow = br && br.row !== undefined ? br.row : (br && br.nativeRow !== undefined ? br.nativeRow : tlRow + 1);

            // Calculate anchor center position in 1-based Excel row & column coordinates
            const centerCol = (tlCol + brCol) / 2;
            const centerRow = (tlRow + brRow) / 2;

            const colNumber = Math.floor(centerCol) + 1;
            const rowNumber = Math.floor(centerRow) + 1;
            const colLetter = colIndexToLetter(colNumber);

            cellImages.push({
              dataUrl,
              rowNumber,
              colNumber,
              colLetter,
              source: 'drawing',
              format: media.extension,
            });
          }
        }
      } catch (err) {
        console.warn('Could not extract image from worksheet drawing:', err);
      }
    });
  } catch (err) {
    console.warn('Worksheet image extraction not supported or empty:', err);
  }

  // 2. Secondary Extraction: Modern Excel 365 "Place in Cell" (xl/cellimages.xml)
  if (zip && zip.file('xl/cellimages.xml')) {
    try {
      const cellImagesXml = await zip.file('xl/cellimages.xml')!.async('text');
      let relsXml = '';
      const relsFile = zip.file('xl/_rels/cellimages.xml.rels');
      if (relsFile) {
        relsXml = await relsFile.async('text');
      }

      // Map rId to media file path in zip
      const rIdToTarget: Record<string, string> = {};
      const relMatches = relsXml.matchAll(/<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g);
      for (const m of relMatches) {
        rIdToTarget[m[1]] = m[2].replace(/^(\.\.\/)+/, '').replace(/^xl\//, '');
      }

      // Map image ID/name to media target
      const imageIdToTarget: Record<string, string> = {};
      const imgMatches = cellImagesXml.matchAll(/<etc:cellImage[\s\S]*?name="([^"]+)"[\s\S]*?r:embed="([^"]+)"/g);
      for (const m of imgMatches) {
        const imgId = m[1];
        const rId = m[2];
        if (rIdToTarget[rId]) {
          imageIdToTarget[imgId] = rIdToTarget[rId];
        }
      }

      // Look in worksheet XML to find cell locations
      const sheetIndex1 = targetSheetIndex + 1;
      const sheetFile =
        zip.file(`xl/worksheets/sheet${sheetIndex1}.xml`) ||
        zip.file('xl/worksheets/sheet1.xml');

      if (sheetFile) {
        const sheetXml = await sheetFile.async('text');
        // Match cells with DISPIMG formula: <c r="K2"...><f>_xlfn.DISPIMG("ID_...", ...)</f></c>
        const cellMatches = sheetXml.matchAll(/<c\s+r="([A-Z]+)(\d+)"[^>]*>[\s\S]*?<f[^>]*>[^<]*DISPIMG\("([^"]+)"/g);
        for (const cm of cellMatches) {
          const colLetter = cm[1];
          const rowNumber = parseInt(cm[2], 10);
          const imgName = cm[3];
          const mediaPath = imageIdToTarget[imgName];
          if (mediaPath) {
            const mFile = zip.file('xl/' + mediaPath) || zip.file(mediaPath);
            if (mFile) {
              const buf = await mFile.async('uint8array');
              const ext = mediaPath.split('.').pop() || 'png';
              const dataUrl = bufferToDataUrl(buf, ext);
              const colNumber = letterToColIndex(colLetter);

              // Only add if not already captured at this cell
              const exists = cellImages.some(
                (c) => c.rowNumber === rowNumber && c.colNumber === colNumber
              );
              if (!exists) {
                cellImages.push({
                  dataUrl,
                  rowNumber,
                  colNumber,
                  colLetter,
                  source: 'cellImage',
                  format: ext,
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Error extracting modern cellimages.xml:', err);
    }
  }

  // 3. Check for any unsupported media formats or absolute anchors in zip
  if (zip) {
    try {
      for (const [path, fileEntry] of Object.entries(zip.files)) {
        if (path.startsWith('xl/media/') && !fileEntry.dir) {
          const fName = path.split('/').pop() || '';
          const ext = fName.split('.').pop()?.toLowerCase() || '';
          if (['emf', 'wmf'].includes(ext)) {
            const warningMsg = `Image file "${fName}" is in Windows Metafile (.${ext.toUpperCase()}) format. Browsers cannot render EMF/WMF format directly. Please re-insert as PNG or JPEG in Excel.`;
            if (!warnings.includes(warningMsg)) warnings.push(warningMsg);
          } else if (['tiff', 'tif'].includes(ext)) {
            const warningMsg = `Image file "${fName}" is in .${ext.toUpperCase()} format. Web browsers require PNG or JPEG format.`;
            if (!warnings.includes(warningMsg)) warnings.push(warningMsg);
          }
        } else if (path.startsWith('xl/drawings/') && path.endsWith('.xml') && !path.includes('_rels')) {
          const drawingXml = await fileEntry.async('text');
          if (drawingXml.includes('<xdr:absoluteAnchor')) {
            const warningMsg = `Worksheet contains floating image(s) with absolute canvas placement. Move the images inside employee cells (e.g., Column K for Photo, Column L for Signature) to associate them with specific employees.`;
            if (!warnings.includes(warningMsg)) warnings.push(warningMsg);
          }
        }
      }
    } catch (err) {
      // Ignore zip validation errors
    }
  }

  // 4. Index all extracted cell images by row & column
  const imageByCell: Record<string, string> = {};
  for (const item of cellImages) {
    imageByCell[`${item.rowNumber}_${item.colNumber}`] = item.dataUrl;
    imageByCell[`${item.rowNumber}_${item.colLetter.toUpperCase()}`] = item.dataUrl;
  }

  // 5. Detect header row and maximum column count
  let headerRowIndex = 1;
  const initialRowHeaders: string[] = [];

  // Find first row containing text values
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (initialRowHeaders.length === 0) {
      let hasAnyText = false;
      row.eachCell({ includeEmpty: true }, (cell) => {
        if (sanitizeExcelCellValue(cell.value)) hasAnyText = true;
      });
      if (hasAnyText) {
        headerRowIndex = rowNumber;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const val = sanitizeExcelCellValue(cell.value);
          initialRowHeaders[colNumber - 1] = val || '';
        });
      }
    }
  });

  // Calculate maximum column across worksheet cells and extracted image cell locations
  let maxColumns = Math.max(initialRowHeaders.length, worksheet.columnCount || 0);
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    if (row.cellCount > maxColumns) maxColumns = row.cellCount;
    row.eachCell({ includeEmpty: true }, (_, colNumber) => {
      if (colNumber > maxColumns) maxColumns = colNumber;
    });
  });

  for (const item of cellImages) {
    if (item.colNumber > maxColumns) {
      maxColumns = item.colNumber;
    }
  }
  maxColumns = Math.max(maxColumns, 1);

  // 6. Build final headers list
  const headers: string[] = [];
  const headerRow = worksheet.getRow(headerRowIndex);

  for (let col = 1; col <= maxColumns; col++) {
    const cell = headerRow.getCell(col);
    const val = sanitizeExcelCellValue(cell.value);
    const colLetter = colIndexToLetter(col);

    let headerName = '';
    if (val && !/^Column\s+\d+$/i.test(val)) {
      headerName = val;
    } else {
      headerName = `Column ${colLetter}`;
    }
    headers[col - 1] = headerName;
  }

  // 7. Parse rows and attach cell images to corresponding columns
  const rows: Record<string, any>[] = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    // Skip header row
    if (rowNumber <= headerRowIndex) return;

    const rowObj: Record<string, any> = {
      __cell_images__: {},
    };
    let hasAnyData = false;

    for (let col = 1; col <= maxColumns; col++) {
      const cell = row.getCell(col);
      const textVal = sanitizeExcelCellValue(cell.value);
      const header = headers[col - 1] || `Column ${colIndexToLetter(col)}`;
      const colLetter = colIndexToLetter(col);

      // Check if this exact cell has an embedded image
      const imgAtCell =
        imageByCell[`${rowNumber}_${col}`] ||
        imageByCell[`${rowNumber}_${colLetter}`];

      if (imgAtCell) {
        hasAnyData = true;
        rowObj[header] = imgAtCell;
        rowObj[colLetter] = imgAtCell;
        rowObj[`Column ${colLetter}`] = imgAtCell;
        rowObj[`Col ${colLetter}`] = imgAtCell;
        rowObj[`Column ${col}`] = imgAtCell;

        // Populate dedicated image lookup map on the row
        rowObj.__cell_images__[col] = imgAtCell;
        rowObj.__cell_images__[colLetter] = imgAtCell;
        rowObj.__cell_images__[header] = imgAtCell;
        rowObj.__cell_images__[`Column ${colLetter}`] = imgAtCell;

        // Auto-detect photo or signature field for this specific employee row
        const lowerH = header.toLowerCase();
        if (lowerH.includes('sign')) {
          rowObj['__embedded_signature__'] = imgAtCell;
        } else if (
          lowerH.includes('photo') ||
          lowerH.includes('picture') ||
          lowerH.includes('image') ||
          lowerH.includes('pic')
        ) {
          rowObj['__embedded_photo__'] = imgAtCell;
        }
      } else if (textVal) {
        hasAnyData = true;
        rowObj[header] = textVal;
        rowObj[colLetter] = textVal;
        rowObj[`Column ${colLetter}`] = textVal;

        // Check if text itself is an image URL
        if (/^(https?:\/\/|data:image\/)/i.test(textVal)) {
          const lowerH = header.toLowerCase();
          if (lowerH.includes('sign')) {
            rowObj['__embedded_signature__'] = textVal;
          } else if (
            lowerH.includes('photo') ||
            lowerH.includes('picture') ||
            lowerH.includes('image') ||
            lowerH.includes('pic')
          ) {
            rowObj['__embedded_photo__'] = textVal;
          }
        }
      } else {
        rowObj[header] = '';
        rowObj[colLetter] = '';
        rowObj[`Column ${colLetter}`] = '';
      }
    }

    if (hasAnyData) {
      rows.push(rowObj);
    }
  });

  return {
    sheetNames,
    currentSheet: worksheet.name,
    headers,
    rows,
    embeddedImagesCount: cellImages.length,
    warnings: warnings.length > 0 ? warnings : undefined,
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
