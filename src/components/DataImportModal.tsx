import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Cloud,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  LogOut,
  FolderOpen,
  Download,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logout, getAccessToken } from '../services/firebaseAuth';
import {
  listUserSpreadsheets,
  getSpreadsheetTabs,
  fetchSheetValues,
  fetchPublicSheetCsv,
} from '../services/googleSheetsService';
import { parseExcelFile, ParsedExcelResult } from '../services/excelService';
import { GoogleDriveFile } from '../types';
import ExcelJS from 'exceljs';

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataLoaded: (data: {
    headers: string[];
    rows: Record<string, any>[];
    sourceName: string;
    embeddedImagesCount?: number;
  }) => void;
  onLoadSample: () => void;
}

export const DataImportModal: React.FC<DataImportModalProps> = ({
  isOpen,
  onClose,
  onDataLoaded,
  onLoadSample,
}) => {
  const [activeTab, setActiveTab] = useState<'excel' | 'google-sheets' | 'sample'>('excel');

  // Excel state
  const [isDragging, setIsDragging] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelResult, setExcelResult] = useState<ParsedExcelResult | null>(null);
  const [selectedSheetIdx, setSelectedSheetIdx] = useState(0);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);

  // Google Sheets state
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [spreadsheets, setSpreadsheets] = useState<GoogleDriveFile[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState('');
  const [sheetTabs, setSheetTabs] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState('');
  const [isLoadingTabs, setIsLoadingTabs] = useState(false);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [manualSheetUrl, setManualSheetUrl] = useState('');
  const [googleError, setGoogleError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setAuthUser(user);
        setAccessToken(token);
        loadUserSpreadsheets(token);
      },
      () => {
        setAuthUser(null);
        setAccessToken(null);
        setSpreadsheets([]);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const loadUserSpreadsheets = async (token: string) => {
    setIsLoadingSheets(true);
    setGoogleError(null);
    try {
      const files = await listUserSpreadsheets(token);
      setSpreadsheets(files);
      if (files.length > 0) {
        setSelectedSpreadsheetId(files[0].id);
        handleSelectSpreadsheet(files[0].id, token);
      }
    } catch (err: any) {
      console.warn('Could not auto-list sheets:', err);
      setGoogleError(err.message || 'Could not list Drive spreadsheets.');
    } finally {
      setIsLoadingSheets(false);
    }
  };

  const handleSelectSpreadsheet = async (sheetId: string, token?: string) => {
    setSelectedSpreadsheetId(sheetId);
    const tok = token || accessToken;
    if (!tok || !sheetId) return;

    setIsLoadingTabs(true);
    setGoogleError(null);
    try {
      const tabs = await getSpreadsheetTabs(sheetId, tok);
      setSheetTabs(tabs);
      if (tabs.length > 0) {
        setSelectedTab(tabs[0]);
      }
    } catch (err: any) {
      setGoogleError(err.message || 'Failed to read sheet tabs');
    } finally {
      setIsLoadingTabs(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setGoogleError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setAuthUser(result.user);
        setAccessToken(result.accessToken);
        loadUserSpreadsheets(result.accessToken);
      }
    } catch (err: any) {
      setGoogleError(err.message || 'Google sign in failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logout();
    setAuthUser(null);
    setAccessToken(null);
    setSpreadsheets([]);
  };

  const handleImportGoogleSheet = async () => {
    if (!selectedSpreadsheetId) {
      setGoogleError('Please choose or paste a spreadsheet ID / URL.');
      return;
    }

    setIsLoadingRows(true);
    setGoogleError(null);
    try {
      if (accessToken) {
        const data = await fetchSheetValues(
          selectedSpreadsheetId,
          selectedTab || 'Sheet1',
          accessToken
        );
        if (data.rows.length === 0) {
          throw new Error('Selected sheet has no employee data rows.');
        }
        onDataLoaded({
          headers: data.headers,
          rows: data.rows,
          sourceName: `Google Sheets: ${data.sheetTitle}`,
        });
        onClose();
      } else {
        // Fallback to public CSV
        const data = await fetchPublicSheetCsv(selectedSpreadsheetId);
        onDataLoaded({
          headers: data.headers,
          rows: data.rows,
          sourceName: 'Google Sheets (Public Link)',
        });
        onClose();
      }
    } catch (err: any) {
      setGoogleError(err.message || 'Failed to import sheet values');
    } finally {
      setIsLoadingRows(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = async (file: File) => {
    setExcelFile(file);
    setIsParsingExcel(true);
    setExcelError(null);
    try {
      const result = await parseExcelFile(file, selectedSheetIdx);
      setExcelResult(result);
    } catch (err: any) {
      setExcelError(err.message || 'Error reading spreadsheet file.');
    } finally {
      setIsParsingExcel(false);
    }
  };

  const handleSheetSwitch = async (idx: number) => {
    if (!excelFile) return;
    setSelectedSheetIdx(idx);
    setIsParsingExcel(true);
    try {
      const result = await parseExcelFile(excelFile, idx);
      setExcelResult(result);
    } catch (err: any) {
      setExcelError(err.message);
    } finally {
      setIsParsingExcel(false);
    }
  };

  const handleConfirmExcelData = () => {
    if (!excelResult || excelResult.rows.length === 0) {
      setExcelError('No data rows found in this sheet.');
      return;
    }
    onDataLoaded({
      headers: excelResult.headers,
      rows: excelResult.rows,
      sourceName: excelFile?.name || 'Excel Spreadsheet',
      embeddedImagesCount: excelResult.embeddedImagesCount,
    });
    onClose();
  };

  const downloadSampleExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Employees');

    ws.columns = [
      { header: 'Employee Name', key: 'name', width: 25 },
      { header: 'Designation', key: 'designation', width: 20 },
      { header: 'Department', key: 'department', width: 18 },
      { header: 'Job Type', key: 'jobType', width: 15 },
      { header: 'Joining Date', key: 'joiningDate', width: 15 },
      { header: 'Enroll ID', key: 'enrollId', width: 15 },
      { header: 'Card Issue Date', key: 'cardIssue', width: 16 },
      { header: 'Permanent Address', key: 'address', width: 32 },
      { header: 'Emergency Contact', key: 'emergency', width: 18 },
      { header: 'National ID', key: 'nid', width: 20 },
      { header: 'Blood Group', key: 'blood', width: 12 },
    ];

    ws.addRow({
      name: 'JONAID AL AKANDH AKANDH',
      designation: 'Asst.Caster',
      department: 'Casting',
      jobType: 'Permanent',
      joiningDate: '01/03/2026',
      enrollId: '586665',
      cardIssue: '19/10/2026',
      address: 'Mukkhopur, Trishal, Mymensingh',
      emergency: '01712-345678',
      nid: '01643970731',
      blood: 'O+',
    });

    ws.addRow({
      name: 'FATIMA ZAHRA RAHMAN',
      designation: 'Sr. Quality Officer',
      department: 'Quality Control',
      jobType: 'Permanent',
      joiningDate: '15/01/2025',
      enrollId: '582104',
      cardIssue: '19/10/2026',
      address: 'Bhaluka, Mymensingh',
      emergency: '01833-636610',
      nid: '1994269123456',
      blood: 'A+',
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Akij_Rosa_Employee_Template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-black p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Import Employee Data</h2>
              <p className="text-xs text-gray-300">
                Connect Excel spreadsheet or authorized Google Sheet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50/70 px-4 pt-2">
          <button
            onClick={() => setActiveTab('excel')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
              activeTab === 'excel'
                ? 'bg-white text-rose-600 border-rose-600 shadow-sm'
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Excel & CSV Upload
          </button>

          <button
            onClick={() => setActiveTab('google-sheets')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
              activeTab === 'google-sheets'
                ? 'bg-white text-emerald-600 border-emerald-600 shadow-sm'
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            Google Sheets
          </button>

          <button
            onClick={() => setActiveTab('sample')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
              activeTab === 'sample'
                ? 'bg-white text-indigo-600 border-indigo-600 shadow-sm'
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Demo Preview & Template
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* TAB 1: EXCEL & CSV */}
          {activeTab === 'excel' && (
            <div className="space-y-4">
              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  isDragging
                    ? 'border-rose-500 bg-rose-50/50 scale-[0.99]'
                    : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'
                }`}
              >
                <input
                  type="file"
                  id="excel-file-input"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <label
                  htmlFor="excel-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-semibold text-sm text-gray-800">
                      Click to upload
                    </span>{' '}
                    <span className="text-sm text-gray-500">or drag and drop</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Supports Microsoft Excel (.xlsx, .xls) and CSV files
                  </p>
                </label>
              </div>

              {/* Embedded Photos Feature Callout */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
                <span className="p-1 rounded bg-amber-200/60 text-amber-800 font-bold">
                  ★ Photo Extraction
                </span>
                <p>
                  Photos embedded directly inside Excel rows are automatically detected and
                  mapped to their respective employees without needing separate folders.
                </p>
              </div>

              {isParsingExcel && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-600">
                  <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                  Parsing spreadsheet cells and embedded pictures...
                </div>
              )}

              {excelError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{excelError}</span>
                </div>
              )}

              {/* Parsed Result Preview */}
              {excelResult && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-600" />
                      <span className="text-xs font-bold text-gray-800">
                        {excelFile?.name}
                      </span>
                      <span className="text-[11px] bg-emerald-100 text-emerald-800 font-medium px-2 py-0.5 rounded-full">
                        {excelResult.rows.length} rows found
                      </span>
                      {excelResult.embeddedImagesCount > 0 && (
                        <span className="text-[11px] bg-purple-100 text-purple-800 font-medium px-2 py-0.5 rounded-full">
                          {excelResult.embeddedImagesCount} embedded photos
                        </span>
                      )}
                    </div>

                    {/* Worksheet Selector if multi-sheet */}
                    {excelResult.sheetNames.length > 1 && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-gray-500 font-medium">Sheet:</span>
                        <select
                          value={selectedSheetIdx}
                          onChange={(e) => handleSheetSwitch(Number(e.target.value))}
                          className="bg-white border border-gray-300 rounded px-2 py-1 text-xs"
                        >
                          {excelResult.sheetNames.map((name, i) => (
                            <option key={i} value={i}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={handleConfirmExcelData}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Proceed to Column Mapping ({excelResult.rows.length} Employees)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GOOGLE SHEETS */}
          {activeTab === 'google-sheets' && (
            <div className="space-y-4">
              {!authUser ? (
                <div className="text-center py-6 border border-gray-200 rounded-xl bg-gray-50/50 p-6 space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">
                      Sign in with Google Workspace
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                      Access your Google Sheets spreadsheets directly to import employee lists
                      with user permission.
                    </p>
                  </div>

                  {/* Standard Sign in with Google Button */}
                  <div className="pt-2 flex justify-center">
                    <button
                      onClick={handleGoogleLogin}
                      disabled={isLoggingIn}
                      className="inline-flex items-center justify-center gap-3 px-5 py-2.5 bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow hover:bg-gray-50 text-gray-700 font-medium text-xs transition-all disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 48 48">
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        />
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                        />
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        />
                      </svg>
                      {isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
                    </button>
                  </div>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase tracking-wider text-gray-400 bg-transparent">
                      <span className="bg-gray-50 px-2">or paste public sheet link</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={manualSheetUrl}
                      onChange={(e) => setManualSheetUrl(e.target.value)}
                      className="flex-1 bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        setSelectedSpreadsheetId(manualSheetUrl);
                        handleImportGoogleSheet();
                      }}
                      disabled={!manualSheetUrl || isLoadingRows}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {isLoadingRows ? 'Loading...' : 'Import'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Account Header */}
                  <div className="flex items-center justify-between p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      {authUser.photoURL ? (
                        <img
                          src={authUser.photoURL}
                          alt="User"
                          className="w-7 h-7 rounded-full"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                          {authUser.email?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-gray-900">
                          {authUser.displayName || authUser.email}
                        </p>
                        <p className="text-[10px] text-gray-500">Google Workspace Connected</p>
                      </div>
                    </div>
                    <button
                      onClick={handleGoogleLogout}
                      className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-red-600 font-semibold"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>

                  {/* Spreadsheet Picker */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700">
                      Select Spreadsheet from your Google Drive:
                    </label>
                    {isLoadingSheets ? (
                      <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        Fetching spreadsheets...
                      </div>
                    ) : spreadsheets.length > 0 ? (
                      <select
                        value={selectedSpreadsheetId}
                        onChange={(e) => handleSelectSpreadsheet(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      >
                        {spreadsheets.map((sheet) => (
                          <option key={sheet.id} value={sheet.id}>
                            {sheet.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-gray-500 italic">
                        No Google Sheets found in your drive, or use the direct link below.
                      </p>
                    )}
                  </div>

                  {/* Direct URL Input */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-gray-600">
                      Or paste Google Sheet URL / ID:
                    </label>
                    <input
                      type="text"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={selectedSpreadsheetId}
                      onChange={(e) => handleSelectSpreadsheet(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Sheet Tab Picker */}
                  {sheetTabs.length > 0 && (
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-700">
                        Worksheet Tab:
                      </label>
                      <select
                        value={selectedTab}
                        onChange={(e) => setSelectedTab(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs"
                      >
                        {sheetTabs.map((tab) => (
                          <option key={tab} value={tab}>
                            {tab}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleImportGoogleSheet}
                      disabled={!selectedSpreadsheetId || isLoadingRows || isLoadingTabs}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isLoadingRows ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Importing Rows...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          Import & Proceed to Mapping
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {googleError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{googleError}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DEMO PREVIEW & TEMPLATE */}
          {activeTab === 'sample' && (
            <div className="space-y-4">
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 text-xs text-indigo-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-indigo-900">
                  <FolderOpen className="w-4 h-4 text-indigo-600" />
                  Akij Ceramics & Rosa Certified Template
                </div>
                <p>
                  Quickly test the full pipeline with authentic pre-configured employee records,
                  including the reference image employee: <strong>JONAID AL AKANDH AKANDH</strong>,
                  Asst.Caster (Casting).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => {
                    onLoadSample();
                    onClose();
                  }}
                  className="p-4 border-2 border-indigo-500 bg-indigo-50/40 hover:bg-indigo-100/50 rounded-xl text-left transition-all group flex flex-col justify-between"
                >
                  <div>
                    <span className="font-bold text-xs text-indigo-900 block group-hover:text-indigo-700">
                      ⚡ Load 5 Sample Employees
                    </span>
                    <span className="text-[11px] text-gray-500 block mt-1">
                      Instantly preview front/back cards with sample photos and signatures.
                    </span>
                  </div>
                  <span className="mt-3 inline-flex items-center text-xs font-bold text-indigo-600 group-hover:underline">
                    Load Demo Data →
                  </span>
                </button>

                <button
                  onClick={downloadSampleExcel}
                  className="p-4 border border-gray-200 hover:border-gray-300 bg-white rounded-xl text-left transition-all group flex flex-col justify-between"
                >
                  <div>
                    <span className="font-bold text-xs text-gray-800 block">
                      📥 Download Excel Template (.xlsx)
                    </span>
                    <span className="text-[11px] text-gray-500 block mt-1">
                      Ready-to-fill spreadsheet with proper column headers for Akij/Rosa badges.
                    </span>
                  </div>
                  <span className="mt-3 inline-flex items-center text-xs font-bold text-gray-700 group-hover:text-gray-900">
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Download .xlsx
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
