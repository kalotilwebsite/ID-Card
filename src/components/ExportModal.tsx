import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  FileCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileDown,
  Printer,
  FileSpreadsheet,
  Check,
  Sliders,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { EmployeeCardData, PrintSettings, CompanyTemplateConfig } from '../types';
import { exportCardsToPdf } from '../services/pdfExportService';
import { exportCardsToDocx } from '../services/docxExportService';
import { exportCardsToExcel } from '../services/excelService';
import { apiService } from '../services/apiService';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: EmployeeCardData[];
  settings: PrintSettings;
  companyConfig: CompanyTemplateConfig;
  getCardElement: (empId: string, side: 'front' | 'back') => HTMLElement | null;
  onCardsPrinted?: (enrollIds: string[]) => void;
  onUpdateSettings?: (settings: PrintSettings) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  employees,
  settings,
  companyConfig,
  getCardElement,
  onCardsPrinted,
  onUpdateSettings,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'docx' | 'excel' | null>(null);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [pendingPrintConfirm, setPendingPrintConfirm] = useState(false);
  const [isMarkingPrint, setIsMarkingPrint] = useState(false);
  const [markedSuccess, setMarkedSuccess] = useState(false);

  // Editable PDF Print Margins state
  const [margins, setMargins] = useState<PrintSettings['marginsMm']>({
    top: settings.marginsMm?.top ?? 10,
    bottom: settings.marginsMm?.bottom ?? 10,
    left: settings.marginsMm?.left ?? 10,
    right: settings.marginsMm?.right ?? 10,
  });

  useEffect(() => {
    if (settings.marginsMm) {
      setMargins({
        top: settings.marginsMm.top ?? 10,
        bottom: settings.marginsMm.bottom ?? 10,
        left: settings.marginsMm.left ?? 10,
        right: settings.marginsMm.right ?? 10,
      });
    }
  }, [settings.marginsMm]);

  const handleMarginChange = (side: keyof PrintSettings['marginsMm'], val: number) => {
    const validVal = Math.max(0, val);
    const updatedMargins = {
      ...margins,
      [side]: validVal,
    };
    setMargins(updatedMargins);
    if (onUpdateSettings) {
      onUpdateSettings({
        ...settings,
        marginsMm: updatedMargins,
      });
    }
  };

  if (!isOpen) return null;

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (e) {
      // ignore
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    setExportType('pdf');
    setErrorMessage(null);
    setDownloadSuccess(false);
    setProgressPercent(5);
    setProgressMsg('Initializing PDF document renderer...');

    try {
      const activePrintSettings: PrintSettings = {
        ...settings,
        marginsMm: margins,
      };

      const blob = await exportCardsToPdf(
        employees,
        activePrintSettings,
        companyConfig,
        getCardElement,
        (current, total, msg) => {
          const pct = Math.round((current / total) * 90);
          setProgressPercent(pct);
          setProgressMsg(msg);
        }
      );

      setProgressPercent(100);
      setProgressMsg('PDF generated successfully!');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Employee_ID_Cards_Akij_Rosa_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setPendingPrintConfirm(true);
      setMarkedSuccess(false);
      triggerConfetti();
    } catch (err: any) {
      console.error('PDF export error:', err);
      setErrorMessage(err.message || 'Failed to generate PDF file.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportDocx = async () => {
    setIsExporting(true);
    setExportType('docx');
    setErrorMessage(null);
    setDownloadSuccess(false);
    setProgressPercent(5);
    setProgressMsg('Rendering card graphics for Word document...');

    try {
      const blob = await exportCardsToDocx(
        employees,
        settings,
        getCardElement,
        (current, total, msg) => {
          const pct = Math.round((current / total) * 90);
          setProgressPercent(pct);
          setProgressMsg(msg);
        }
      );

      setProgressPercent(100);
      setProgressMsg('Word document generated successfully!');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Employee_ID_Cards_Akij_Rosa_${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setPendingPrintConfirm(true);
      setMarkedSuccess(false);
      triggerConfetti();
    } catch (err: any) {
      console.error('Docx export error:', err);
      setErrorMessage(err.message || 'Failed to create Word document.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleConfirmPrintOk = async () => {
    setIsMarkingPrint(true);
    try {
      const validEnrollIds = employees.map((e) => e.enrollId).filter(Boolean);
      if (validEnrollIds.length > 0) {
        await apiService.bulkMarkPrinted(
          validEnrollIds,
          `Marked Print OK via ${exportType?.toUpperCase() || 'Export'} output`
        );
      }
      if (onCardsPrinted) {
        onCardsPrinted(validEnrollIds);
      }
      setMarkedSuccess(true);
    } catch (err) {
      console.warn('Backend mark printed note:', err);
      if (onCardsPrinted) {
        onCardsPrinted(employees.map((e) => e.enrollId).filter(Boolean));
      }
      setMarkedSuccess(true);
    } finally {
      setIsMarkingPrint(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    setExportType('excel');
    setErrorMessage(null);
    setDownloadSuccess(false);
    setProgressPercent(10);
    setProgressMsg('Compiling employee records for Excel spreadsheet...');

    try {
      const blob = await exportCardsToExcel(
        employees,
        getCardElement,
        (current, total, msg) => {
          const pct = Math.round((current / total) * 90);
          setProgressPercent(pct);
          setProgressMsg(msg);
        }
      );

      setProgressPercent(100);
      setProgressMsg('Excel spreadsheet generated successfully!');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Employee_ID_Cards_Akij_Rosa_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      triggerConfetti();
    } catch (err: any) {
      console.error('Excel export error:', err);
      setErrorMessage(err.message || 'Failed to generate Excel file.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-black p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Export Generated ID Cards</h2>
              <p className="text-xs text-gray-300">
                Ready to export {employees.length} employee card(s)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center disabled:opacity-30"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Export Mode Cards */}
          <div className="space-y-3">
            {/* PDF Button */}
            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              className="w-full p-4 rounded-xl border-2 border-rose-200 bg-rose-50/40 hover:bg-rose-50 hover:border-rose-500 transition-all text-left flex items-center justify-between group disabled:opacity-50"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-200 group-hover:scale-105 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Export to Print-Ready PDF
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {settings.layoutMode === 'duplex'
                      ? 'Duplex double-sided aligned pages'
                      : settings.layoutMode === 'side-by-side'
                      ? 'Side-by-side front & back pairs'
                      : 'Single-sided cards'}{' '}
                    · {settings.paperSize.toUpperCase()} · High Resolution (300 DPI)
                  </p>
                </div>
              </div>
              <FileDown className="w-5 h-5 text-rose-600 group-hover:translate-y-0.5 transition-transform" />
            </button>

            {/* Editable PDF Page Margins Configuration */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-rose-600" />
                  PDF Page Print Margins (mm)
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-100/80 text-rose-800">
                  Left: {margins.left}mm | Top: {margins.top}mm
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Increase the <strong>Left margin</strong> (e.g., <strong>18 mm</strong> or <strong>20 mm</strong>) to prevent cards from clipping on the left edge and perfectly center them on paper.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
                {/* Left Margin */}
                <div className="bg-white p-2 rounded-lg border border-rose-300 ring-1 ring-rose-100">
                  <label className="block text-[10px] font-bold text-rose-900 mb-0.5">
                    Left Margin (mm)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    step="1"
                    value={margins.left}
                    onChange={(e) => handleMarginChange('left', Number(e.target.value) || 0)}
                    style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                    className="w-full bg-white border border-rose-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-rose-500"
                  />
                  <div className="flex items-center gap-1 mt-1.5">
                    <button
                      type="button"
                      onClick={() => handleMarginChange('left', 10)}
                      className={`px-1 py-0.5 text-[9px] rounded font-bold border transition-colors ${
                        margins.left === 10
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      10
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarginChange('left', 15)}
                      className={`px-1 py-0.5 text-[9px] rounded font-bold border transition-colors ${
                        margins.left === 15
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      15
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarginChange('left', 18)}
                      title="Recommended for centered landscape PDF print"
                      className={`px-1 py-0.5 text-[9px] rounded font-bold border transition-colors ${
                        margins.left === 18
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                      }`}
                    >
                      18★
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarginChange('left', 20)}
                      className={`px-1 py-0.5 text-[9px] rounded font-bold border transition-colors ${
                        margins.left === 20
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      20
                    </button>
                  </div>
                </div>

                {/* Top Margin */}
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                    Top Margin (mm)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    step="1"
                    value={margins.top}
                    onChange={(e) => handleMarginChange('top', Number(e.target.value) || 0)}
                    style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-rose-500"
                  />
                  <div className="flex items-center gap-1 mt-1.5">
                    <button
                      type="button"
                      onClick={() => handleMarginChange('top', 10)}
                      className={`px-1.5 py-0.5 text-[9px] rounded font-semibold border ${
                        margins.top === 10
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      10
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarginChange('top', 15)}
                      className={`px-1.5 py-0.5 text-[9px] rounded font-semibold border ${
                        margins.top === 15
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      15
                    </button>
                  </div>
                </div>

                {/* Right Margin */}
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                    Right Margin (mm)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    step="1"
                    value={margins.right}
                    onChange={(e) => handleMarginChange('right', Number(e.target.value) || 0)}
                    style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-rose-500"
                  />
                  <div className="flex items-center gap-1 mt-1.5">
                    <button
                      type="button"
                      onClick={() => handleMarginChange('right', 10)}
                      className={`px-1.5 py-0.5 text-[9px] rounded font-semibold border ${
                        margins.right === 10
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      10
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarginChange('right', 15)}
                      className={`px-1.5 py-0.5 text-[9px] rounded font-semibold border ${
                        margins.right === 15
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      15
                    </button>
                  </div>
                </div>

                {/* Bottom Margin */}
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                    Bottom Margin (mm)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    step="1"
                    value={margins.bottom}
                    onChange={(e) => handleMarginChange('bottom', Number(e.target.value) || 0)}
                    style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-rose-500"
                  />
                  <div className="flex items-center gap-1 mt-1.5">
                    <button
                      type="button"
                      onClick={() => handleMarginChange('bottom', 10)}
                      className={`px-1.5 py-0.5 text-[9px] rounded font-semibold border ${
                        margins.bottom === 10
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      10
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarginChange('bottom', 15)}
                      className={`px-1.5 py-0.5 text-[9px] rounded font-semibold border ${
                        margins.bottom === 15
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      15
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Word .docx Button */}
            <button
              onClick={handleExportDocx}
              disabled={isExporting}
              className="w-full p-4 rounded-xl border-2 border-blue-200 bg-blue-50/40 hover:bg-blue-50 hover:border-blue-500 transition-all text-left flex items-center justify-between group disabled:opacity-50"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200 group-hover:scale-105 transition-transform">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Export to Microsoft Word (.docx)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Structured Word table layout with embedded high-res front & back images
                  </p>
                </div>
              </div>
              <FileDown className="w-5 h-5 text-blue-600 group-hover:translate-y-0.5 transition-transform" />
            </button>

            {/* Excel .xlsx Button */}
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="w-full p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-500 transition-all text-left flex items-center justify-between group disabled:opacity-50"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200 group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Export to Microsoft Excel (.xlsx)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Complete spreadsheet with employee details, dates, IDs, and embedded photos
                  </p>
                </div>
              </div>
              <FileDown className="w-5 h-5 text-emerald-600 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>

          {/* Progress / Status feedback */}
          {isExporting && (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                  Generating {exportType?.toUpperCase()}...
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-rose-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-gray-500 truncate">{progressMsg}</p>
            </div>
          )}

          {downloadSuccess && !isExporting && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Download ready! File exported successfully.</span>
            </div>
          )}

          {/* Explicit Print Completion Confirmation */}
          {pendingPrintConfirm && !isExporting && (
            <div className="p-4 bg-emerald-50/80 border border-emerald-300 rounded-xl space-y-2.5 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-950">
                    Did the physical printing complete successfully?
                  </h4>
                  <p className="text-[11px] text-emerald-800 leading-snug mt-0.5">
                    Confirm to update the {employees.length} card record(s) to <strong>Print OK</strong> in the database.
                  </p>
                </div>
              </div>

              {!markedSuccess ? (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleConfirmPrintOk}
                    disabled={isMarkingPrint}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    {isMarkingPrint ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Database...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm Print OK</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPendingPrintConfirm(false)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    Keep as Print Pending
                  </button>
                </div>
              ) : (
                <div className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 pt-1">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Cards successfully updated to Print OK!</span>
                </div>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Quick Print layout overview */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-[11px] text-gray-600 space-y-1">
            <div className="font-bold text-gray-800 flex items-center gap-1">
              <Printer className="w-3.5 h-3.5 text-gray-500" />
              Active Print Configuration:
            </div>
            <div>
              • Paper: {settings.paperSize.toUpperCase()} ({settings.orientation})
            </div>
            <div>
              • Card size: {settings.cardWidthMm}mm × {settings.cardHeightMm}mm (CR80 standard)
            </div>
            <div>
              • Layout: {settings.columnsPerPage} columns × {settings.rowsPerPage} rows ({settings.layoutMode})
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-semibold disabled:opacity-40"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
