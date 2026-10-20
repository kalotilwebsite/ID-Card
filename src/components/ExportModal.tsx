import React, { useState } from 'react';
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
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { EmployeeCardData, PrintSettings, CompanyTemplateConfig } from '../types';
import { exportCardsToPdf } from '../services/pdfExportService';
import { exportCardsToDocx } from '../services/docxExportService';
import { exportCardsToExcel } from '../services/excelService';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: EmployeeCardData[];
  settings: PrintSettings;
  companyConfig: CompanyTemplateConfig;
  getCardElement: (empId: string, side: 'front' | 'back') => HTMLElement | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  employees,
  settings,
  companyConfig,
  getCardElement,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'docx' | 'excel' | null>(null);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

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
      const blob = await exportCardsToPdf(
        employees,
        settings,
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
      triggerConfetti();
    } catch (err: any) {
      console.error('Docx export error:', err);
      setErrorMessage(err.message || 'Failed to create Word document.');
    } finally {
      setIsExporting(false);
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
              <span>Download started! Check your browser downloads folder.</span>
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
