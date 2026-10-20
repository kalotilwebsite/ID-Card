import { GoogleDriveFile } from '../types';

export interface FetchedSheetData {
  headers: string[];
  rows: Record<string, any>[];
  rawRows: any[][];
  sheetTitle: string;
}

export const extractSpreadsheetId = (urlOrId: string): string => {
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  // If it's already an ID without slashes
  if (/^[a-zA-Z0-9-_]{15,}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
};

export const listUserSpreadsheets = async (accessToken: string): Promise<GoogleDriveFile[]> => {
  const query = "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&pageSize=25&fields=files(id,name,mimeType,modifiedTime)&orderBy=modifiedTime desc`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch Google Drive spreadsheets (${res.status})`);
  }

  const data = await res.json();
  return data.files || [];
};

export const getSpreadsheetTabs = async (
  spreadsheetId: string,
  accessToken: string
): Promise<string[]> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to retrieve sheet tabs (${res.status})`);
  }

  const data = await res.json();
  const sheets = data.sheets || [];
  return sheets.map((s: any) => s.properties?.title || 'Sheet1');
};

export const fetchSheetValues = async (
  spreadsheetId: string,
  tabName: string,
  accessToken: string
): Promise<FetchedSheetData> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    tabName
  )}?valueRenderOption=FORMATTED_VALUE`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to load spreadsheet values (${res.status})`);
  }

  const data = await res.json();
  const values: any[][] = data.values || [];

  if (values.length === 0) {
    return { headers: [], rows: [], rawRows: [], sheetTitle: tabName };
  }

  const headers = values[0].map((h: any, idx: number) => (h ? String(h).trim() : `Column ${idx + 1}`));
  const rows: Record<string, any>[] = [];

  for (let r = 1; r < values.length; r++) {
    const rowValues = values[r];
    if (!rowValues || rowValues.every((c: any) => c === undefined || c === null || String(c).trim() === '')) {
      continue;
    }
    const rowObj: Record<string, any> = {};
    headers.forEach((header, colIdx) => {
      rowObj[header] = rowValues[colIdx] !== undefined ? String(rowValues[colIdx]).trim() : '';
    });
    rows.push(rowObj);
  }

  return {
    headers,
    rows,
    rawRows: values,
    sheetTitle: tabName,
  };
};

export const fetchPublicSheetCsv = async (urlOrId: string): Promise<FetchedSheetData> => {
  const sheetId = extractSpreadsheetId(urlOrId);
  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

  const res = await fetch(exportUrl);
  if (!res.ok) {
    throw new Error(
      `Could not access public spreadsheet (${res.status}). Ensure the Google Sheet is shared with "Anyone with the link can view".`
    );
  }

  const text = await res.text();
  const lines = parseCSVText(text);

  if (lines.length === 0) {
    throw new Error('Spreadsheet appears to be empty.');
  }

  const headers = lines[0].map((h, i) => (h ? h.trim() : `Column ${i + 1}`));
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowValues = lines[i];
    if (rowValues.every((c) => !c || c.trim() === '')) continue;
    const rowObj: Record<string, any> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = rowValues[idx] ? rowValues[idx].trim() : '';
    });
    rows.push(rowObj);
  }

  return {
    headers,
    rows,
    rawRows: lines,
    sheetTitle: 'Public Sheet',
  };
};

// Robust CSV parser supporting quotes, commas, and multiline values
export const parseCSVText = (text: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal);
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal);
      rows.push(currentRow);
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal);
    rows.push(currentRow);
  }

  return rows;
};
