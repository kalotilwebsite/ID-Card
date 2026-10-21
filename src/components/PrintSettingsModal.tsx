import React, { useState, useRef, useMemo } from 'react';
import {
  PrintSettings,
  EmployeeCardData,
  CompanyTemplateConfig,
  CardCalibrationSettings,
  DEFAULT_CALIBRATION,
} from '../types';
import {
  Printer,
  Sliders,
  Check,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  FileText,
  FileSpreadsheet,
  RotateCw,
  LayoutGrid,
  Layers,
  Sparkles,
  Loader2,
  X,
  AlertCircle,
  Eye,
} from 'lucide-react';
import {
  calculatePrintGeometry,
  exportCardsToPdf,
  PAPER_DIMENSIONS_MM,
} from '../services/pdfExportService';
import { exportCardsToDocx } from '../services/docxExportService';
import { exportCardsToExcel } from '../services/excelService';
import { CardFront } from './CardFront';
import { CardBack } from './CardBack';
import { FRONT_TEMPLATE_SVG, BACK_TEMPLATE_SVG } from '../data/cardTemplates';
import confetti from 'canvas-confetti';

interface PrintSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PrintSettings;
  onChangeSettings: (settings: PrintSettings) => void;
  employees?: EmployeeCardData[];
  totalCardsCount?: number;
  companyConfig?: CompanyTemplateConfig;
  frontTemplateUrl?: string;
  backTemplateUrl?: string;
  calibration?: CardCalibrationSettings;
  getCardElement?: (empId: string, side: 'front' | 'back') => HTMLElement | null;
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paperSize: 'a4',
  customWidthMm: 297,
  customHeightMm: 210,
  orientation: 'landscape',
  cardWidthMm: 47, // Mandatory fixed width
  cardHeightMm: 78, // Mandatory fixed height
  marginsMm: {
    top: 8,
    bottom: 8,
    left: 8,
    right: 8,
  },
  spacingMm: {
    horizontal: 4,
    vertical: 4,
  },
  columnsPerPage: 4, // Exactly 4 columns per row
  rowsPerPage: 2, // 4 cols x 2 rows
  layoutMode: 'side-by-side', // Default Side-by-Side
  showCutMarks: true,
  cardBorderRadiusMm: 3,
};

export const PrintSettingsModal: React.FC<PrintSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onChangeSettings,
  employees = [],
  totalCardsCount,
  companyConfig = {} as any,
  frontTemplateUrl = FRONT_TEMPLATE_SVG,
  backTemplateUrl = BACK_TEMPLATE_SVG,
  calibration = DEFAULT_CALIBRATION,
  getCardElement,
}) => {
  const [activeTab, setActiveTab] = useState<'layout' | 'preview'>('preview');
  const [previewZoom, setPreviewZoom] = useState(0.65);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgressMsg, setExportProgressMsg] = useState('');
  const [exportError, setExportError] = useState<string | null>(null);

  // Hidden print container ref
  const printSheetRef = useRef<HTMLDivElement>(null);

  const effectiveEmployees = employees;
  const cardsCount = effectiveEmployees.length > 0 ? effectiveEmployees.length : (totalCardsCount || 1);

  const update = (partial: Partial<PrintSettings>) => {
    onChangeSettings({ ...settings, ...partial });
  };

  const updateMargin = (side: keyof PrintSettings['marginsMm'], val: number) => {
    onChangeSettings({
      ...settings,
      marginsMm: {
        ...settings.marginsMm,
        [side]: val,
      },
    });
  };

  const updateSpacing = (axis: keyof PrintSettings['spacingMm'], val: number) => {
    onChangeSettings({
      ...settings,
      spacingMm: {
        ...settings.spacingMm,
        [axis]: val,
      },
    });
  };

  // Re-calculate geometry in real time
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
    cardsPerPage,
    pairsPerPage,
    colsOfPairs,
  } = geom;

  // Build page batches for visual rendering
  interface CardPlacement {
    employee: EmployeeCardData;
    side: 'front' | 'back';
    xMm: number;
    yMm: number;
  }

  interface PageData {
    pageNumber: number;
    title: string;
    cards: CardPlacement[];
  }

  const pages: PageData[] = useMemo(() => {
    if (!isOpen || effectiveEmployees.length === 0) return [];
    const result: PageData[] = [];

    if (settings.layoutMode === 'duplex') {
      const totalBatches = Math.ceil(effectiveEmployees.length / cardsPerPage);
      for (let b = 0; b < totalBatches; b++) {
        const batch = effectiveEmployees.slice(b * cardsPerPage, (b + 1) * cardsPerPage);

        // Front Sheet
        const frontCards: CardPlacement[] = [];
        batch.forEach((emp, slotIdx) => {
          const col = slotIdx % cols;
          const row = Math.floor(slotIdx / cols);
          const x = startX + col * (cardWidthMm + gapX);
          const y = startY + row * (cardHeightMm + gapY);
          frontCards.push({ employee: emp, side: 'front', xMm: x, yMm: y });
        });
        result.push({
          pageNumber: result.length + 1,
          title: `Front Side Sheet (Cards ${b * cardsPerPage + 1} - ${b * cardsPerPage + batch.length})`,
          cards: frontCards,
        });

        // Back Sheet (Mirrored columns for perfect double-sided alignment)
        const backCards: CardPlacement[] = [];
        batch.forEach((emp, slotIdx) => {
          const originalCol = slotIdx % cols;
          const row = Math.floor(slotIdx / cols);
          const mirroredCol = cols - 1 - originalCol;
          const x = startX + mirroredCol * (cardWidthMm + gapX);
          const y = startY + row * (cardHeightMm + gapY);
          backCards.push({ employee: emp, side: 'back', xMm: x, yMm: y });
        });
        result.push({
          pageNumber: result.length + 1,
          title: `Back Side Sheet (Cards ${b * cardsPerPage + 1} - ${b * cardsPerPage + batch.length} • Mirrored)`,
          cards: backCards,
        });
      }
    } else if (settings.layoutMode === 'side-by-side') {
      const totalBatches = Math.ceil(effectiveEmployees.length / pairsPerPage);
      for (let b = 0; b < totalBatches; b++) {
        const batch = effectiveEmployees.slice(b * pairsPerPage, (b + 1) * pairsPerPage);
        const pageCards: CardPlacement[] = [];

        batch.forEach((emp, pairIdx) => {
          const colPair = pairIdx % colsOfPairs;
          const row = Math.floor(pairIdx / colsOfPairs);

          const xF = startX + colPair * (cardWidthMm * 2 + gapX * 2);
          const yF = startY + row * (cardHeightMm + gapY);
          const xB = xF + cardWidthMm + gapX;
          const yB = yF;

          pageCards.push({ employee: emp, side: 'front', xMm: xF, yMm: yF });
          pageCards.push({ employee: emp, side: 'back', xMm: xB, yMm: yB });
        });

        result.push({
          pageNumber: result.length + 1,
          title: `Sheet ${b + 1} • Side-by-Side (Pairs ${b * pairsPerPage + 1} - ${b * pairsPerPage + batch.length})`,
          cards: pageCards,
        });
      }
    } else if (settings.layoutMode === 'top-and-bottom') {
      const totalBatches = Math.ceil(effectiveEmployees.length / pairsPerPage);
      for (let b = 0; b < totalBatches; b++) {
        const batch = effectiveEmployees.slice(b * pairsPerPage, (b + 1) * pairsPerPage);
        const pageCards: CardPlacement[] = [];

        batch.forEach((emp, pairIdx) => {
          const col = pairIdx % cols;
          const rowPair = Math.floor(pairIdx / cols);

          const xF = startX + col * (cardWidthMm + gapX);
          const yF = startY + rowPair * (cardHeightMm * 2 + gapY * 2);
          const xB = xF;
          const yB = yF + cardHeightMm + gapY;

          pageCards.push({ employee: emp, side: 'front', xMm: xF, yMm: yF });
          pageCards.push({ employee: emp, side: 'back', xMm: xB, yMm: yB });
        });

        result.push({
          pageNumber: result.length + 1,
          title: `Sheet ${b + 1} • Top & Bottom (Pairs ${b * pairsPerPage + 1} - ${b * pairsPerPage + batch.length})`,
          cards: pageCards,
        });
      }
    } else {
      // Front only or Back only
      const side = settings.layoutMode === 'front-only' ? 'front' : 'back';
      const totalBatches = Math.ceil(effectiveEmployees.length / cardsPerPage);
      for (let b = 0; b < totalBatches; b++) {
        const batch = effectiveEmployees.slice(b * cardsPerPage, (b + 1) * cardsPerPage);
        const pageCards: CardPlacement[] = [];

        batch.forEach((emp, slotIdx) => {
          const col = slotIdx % cols;
          const row = Math.floor(slotIdx / cols);
          const x = startX + col * (cardWidthMm + gapX);
          const y = startY + row * (cardHeightMm + gapY);
          pageCards.push({ employee: emp, side, xMm: x, yMm: y });
        });

        result.push({
          pageNumber: result.length + 1,
          title: `Sheet ${b + 1} • ${side === 'front' ? 'Front Side Only' : 'Back Side Only'}`,
          cards: pageCards,
        });
      }
    }

    return result;
  }, [isOpen, effectiveEmployees, settings, geom]);

  // Direct Print Action
  const handleDirectPrint = () => {
    // Insert temporary style tag for print @page rules
    const styleId = 'idcard-print-page-style';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.innerHTML = `
      @media print {
        @page {
          size: ${pageWidthMm}mm ${pageHeightMm}mm;
          margin: 0;
        }
        body * {
          visibility: hidden !important;
        }
        #print-preview-sheets-container, #print-preview-sheets-container * {
          visibility: visible !important;
        }
        #print-preview-sheets-container {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
        }
        .print-virtual-sheet {
          box-shadow: none !important;
          border: none !important;
          margin: 0 !important;
          page-break-after: always !important;
          break-after: page !important;
          width: ${pageWidthMm}mm !important;
          height: ${pageHeightMm}mm !important;
          transform: none !important;
        }
        .print-virtual-sheet:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }
        .screen-only-guide {
          display: none !important;
        }
      }
    `;

    setTimeout(() => {
      window.print();
    }, 150);
  };

  // PDF Export Action
  const handleDownloadPdf = async () => {
    if (effectiveEmployees.length === 0) return;
    setIsExporting(true);
    setExportError(null);
    setExportProgressMsg('Preparing PDF document...');

    const defaultGetter = (empId: string, side: 'front' | 'back') => {
      return (
        document.getElementById(`export-${side}-${empId}`) ||
        document.getElementById(`preview-card-${side}-${empId}`)
      );
    };

    try {
      const blob = await exportCardsToPdf(
        effectiveEmployees,
        settings,
        companyConfig,
        getCardElement || defaultGetter,
        (curr, total, msg) => setExportProgressMsg(`${msg} (${Math.round((curr / total) * 100)}%)`)
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Employee_ID_Cards_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      try {
        confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 } });
      } catch (e) {}
    } catch (err: any) {
      console.error('PDF generation error:', err);
      setExportError(err.message || 'Failed to generate PDF document.');
    } finally {
      setIsExporting(false);
    }
  };

  // Word (DOCX) Export Action
  const handleDownloadDocx = async () => {
    if (effectiveEmployees.length === 0) return;
    setIsExporting(true);
    setExportError(null);
    setExportProgressMsg('Compiling Word (.docx) document...');

    const defaultGetter = (empId: string, side: 'front' | 'back') => {
      return (
        document.getElementById(`export-${side}-${empId}`) ||
        document.getElementById(`preview-card-${side}-${empId}`)
      );
    };

    try {
      const blob = await exportCardsToDocx(
        effectiveEmployees,
        settings,
        getCardElement || defaultGetter,
        (curr, total, msg) => setExportProgressMsg(`${msg} (${Math.round((curr / total) * 100)}%)`)
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Employee_ID_Cards_${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('DOCX export error:', err);
      setExportError(err.message || 'Failed to export Word document.');
    } finally {
      setIsExporting(false);
    }
  };

  // Excel Export Action
  const handleDownloadExcel = async () => {
    if (effectiveEmployees.length === 0) return;
    setIsExporting(true);
    setExportError(null);
    setExportProgressMsg('Compiling Excel spreadsheet...');

    const defaultGetter = (empId: string, side: 'front' | 'back') => {
      return (
        document.getElementById(`export-${side}-${empId}`) ||
        document.getElementById(`preview-card-${side}-${empId}`)
      );
    };

    try {
      const blob = await exportCardsToExcel(
        effectiveEmployees,
        getCardElement || defaultGetter,
        (curr, total, msg) => setExportProgressMsg(`${msg} (${Math.round((curr / total) * 100)}%)`)
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Employee_Records_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Excel export error:', err);
      setExportError(err.message || 'Failed to export Excel spreadsheet.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4 overflow-hidden">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header Toolbar */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-3.5 text-white flex items-center justify-between flex-shrink-0 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">Print & Page Layout Preview Studio</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-600/30 text-rose-300 border border-rose-500/40">
                  {cardsCount} {cardsCount === 1 ? 'Card' : 'Cards'} Selected
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {settings.paperSize.toUpperCase()} ({pageWidthMm}×{pageHeightMm}mm) • {settings.orientation} • {pages.length} {pages.length === 1 ? 'Sheet' : 'Sheets'} • All selected cards visible together
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {/* Direct Print Button (Requires NO PDF download) */}
            <button
              onClick={handleDirectPrint}
              disabled={isExporting || effectiveEmployees.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Print directly to connected printer or system print dialog"
            >
              <Printer className="w-4 h-4" />
              <span>Direct Print</span>
            </button>

            {/* Download PDF Button */}
            <button
              onClick={handleDownloadPdf}
              disabled={isExporting || effectiveEmployees.length === 0}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Download high-resolution print-ready PDF"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>

            {/* Word Export Button */}
            <button
              onClick={handleDownloadDocx}
              disabled={isExporting || effectiveEmployees.length === 0}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
              title="Export as Microsoft Word (.docx)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Word</span>
            </button>

            {/* Excel Export Button */}
            <button
              onClick={handleDownloadExcel}
              disabled={isExporting || effectiveEmployees.length === 0}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
              title="Export records to Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </button>

            <div className="h-6 w-px bg-slate-700 mx-1" />

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close Print Preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar / Notification Banner */}
        {isExporting && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-2 flex items-center gap-2 text-xs font-semibold text-amber-800 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
            <span>{exportProgressMsg || 'Generating document...'}</span>
          </div>
        )}

        {exportError && (
          <div className="bg-rose-50 border-b border-rose-200 px-5 py-2 flex items-center justify-between text-xs font-semibold text-rose-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{exportError}</span>
            </div>
            <button onClick={() => setExportError(null)} className="text-rose-500 hover:text-rose-800">✕</button>
          </div>
        )}

        {/* Main Workspace (Left Controls + Right Visual Sheet Preview) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Adjustable Print & Layout Settings */}
          <div className="w-80 sm:w-96 border-r border-slate-200 bg-slate-50/70 overflow-y-auto p-4 flex flex-col gap-5 flex-shrink-0">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-rose-600" />
                Layout &amp; Page Setup
              </span>
              <button
                type="button"
                onClick={() => onChangeSettings(DEFAULT_PRINT_SETTINGS)}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline"
              >
                Reset Defaults
              </button>
            </div>

            {/* 1. Paper Format */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                1. Paper Format:
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['a4', 'letter', 'a3', 'a5', 'legal', 'custom'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => update({ paperSize: fmt })}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer ${
                      settings.paperSize === fmt
                        ? 'border-rose-600 bg-rose-50 text-rose-700 ring-1 ring-rose-500 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>

              {settings.paperSize === 'custom' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600">Width (mm)</label>
                    <input
                      type="number"
                      value={settings.customWidthMm || 210}
                      onChange={(e) => update({ customWidthMm: Math.max(20, Number(e.target.value)) })}
                      className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600">Height (mm)</label>
                    <input
                      type="number"
                      value={settings.customHeightMm || 297}
                      onChange={(e) => update({ customHeightMm: Math.max(20, Number(e.target.value)) })}
                      className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 2. Orientation */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                2. Orientation:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => update({ orientation: 'portrait' })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    settings.orientation === 'portrait'
                      ? 'border-rose-600 bg-rose-50 text-rose-700 ring-1 ring-rose-500'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="w-3 h-4 border border-current rounded-xs" />
                  <span>Portrait</span>
                </button>
                <button
                  type="button"
                  onClick={() => update({ orientation: 'landscape' })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    settings.orientation === 'landscape'
                      ? 'border-rose-600 bg-rose-50 text-rose-700 ring-1 ring-rose-500'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="w-4 h-3 border border-current rounded-xs" />
                  <span>Landscape</span>
                </button>
              </div>
            </div>

            {/* 3. Printing Arrangement / Layout Mode */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                3. Card Layout Arrangement:
              </label>
              <div className="space-y-1.5">
                {[
                  {
                    id: 'side-by-side',
                    title: 'Side-by-Side (Front & Back Together)',
                    desc: 'Each card front and back appear horizontally adjacent on the same sheet',
                  },
                  {
                    id: 'top-and-bottom',
                    title: 'Top-and-Bottom (Front Above Back)',
                    desc: 'Front card at top, Back card directly below on the same sheet',
                  },
                  {
                    id: 'duplex',
                    title: 'Duplex (Double-Sided 2-Page Printing)',
                    desc: 'Page 1 prints Fronts; Page 2 prints Backs with perfectly mirrored alignment',
                  },
                  {
                    id: 'front-only',
                    title: 'Front Side Only',
                    desc: 'Only generate and print the front side of each employee card',
                  },
                  {
                    id: 'back-only',
                    title: 'Back Side Only',
                    desc: 'Only generate and print the back side of each employee card',
                  },
                ].map((mode) => (
                  <label
                    key={mode.id}
                    onClick={() => update({ layoutMode: mode.id as any })}
                    className={`block p-2.5 rounded-xl border cursor-pointer transition-all ${
                      settings.layoutMode === mode.id
                        ? 'border-rose-600 bg-rose-50/60 ring-1 ring-rose-500 shadow-2xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="layoutMode"
                        checked={settings.layoutMode === mode.id}
                        onChange={() => update({ layoutMode: mode.id as any })}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-xs font-bold text-slate-900">{mode.title}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 pl-5">{mode.desc}</p>
                  </label>
                ))}
              </div>
            </div>

            {/* 4. Grid Configuration */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                4. Grid (Columns × Rows):
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Columns:</span>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={settings.columnsPerPage}
                    onChange={(e) => update({ columnsPerPage: Math.max(1, Number(e.target.value)) })}
                    className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Rows:</span>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={settings.rowsPerPage}
                    onChange={(e) => update({ rowsPerPage: Math.max(1, Number(e.target.value)) })}
                    className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-500 font-bold">Presets:</span>
                {[
                  { label: '4 Cards (2×2)', cols: 2, rows: 2 },
                  { label: '6 Cards (3×2)', cols: 3, rows: 2 },
                  { label: '8 Cards (4×2)', cols: 4, rows: 2 },
                  { label: '9 Cards (3×3)', cols: 3, rows: 3 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => update({ columnsPerPage: preset.cols, rowsPerPage: preset.rows })}
                    className="px-2 py-0.5 bg-white border border-slate-200 hover:border-slate-300 rounded text-[10px] font-semibold text-slate-700"
                  >
                    {preset.cols * preset.rows}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Physical Card Dimensions (mm) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  5. Card Dimensions (mm):
                </label>
                <button
                  type="button"
                  onClick={() => update({ cardWidthMm: 47, cardHeightMm: 78 })}
                  className="text-[10px] text-rose-600 hover:underline font-semibold"
                >
                  Standard (47×78 mm)
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Width:</span>
                  <input
                    type="number"
                    step="0.1"
                    min={20}
                    max={120}
                    value={settings.cardWidthMm}
                    onChange={(e) => update({ cardWidthMm: Math.max(10, Number(e.target.value)) })}
                    className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Height:</span>
                  <input
                    type="number"
                    step="0.1"
                    min={20}
                    max={150}
                    value={settings.cardHeightMm}
                    onChange={(e) => update({ cardHeightMm: Math.max(10, Number(e.target.value)) })}
                    className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>
            </div>

            {/* 6. Margins & Spacing (mm) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                6. Page Margins &amp; Card Spacing (mm):
              </label>
              <div className="grid grid-cols-4 gap-1.5 text-center">
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Top</span>
                  <input
                    type="number"
                    min={0}
                    value={settings.marginsMm?.top || 10}
                    onChange={(e) => updateMargin('top', Number(e.target.value))}
                    className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-lg text-center bg-white"
                  />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Bottom</span>
                  <input
                    type="number"
                    min={0}
                    value={settings.marginsMm?.bottom || 10}
                    onChange={(e) => updateMargin('bottom', Number(e.target.value))}
                    className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-lg text-center bg-white"
                  />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Left</span>
                  <input
                    type="number"
                    min={0}
                    value={settings.marginsMm?.left || 10}
                    onChange={(e) => updateMargin('left', Number(e.target.value))}
                    className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-lg text-center bg-white"
                  />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Right</span>
                  <input
                    type="number"
                    min={0}
                    value={settings.marginsMm?.right || 10}
                    onChange={(e) => updateMargin('right', Number(e.target.value))}
                    className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-lg text-center bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Horizontal Gap:</span>
                  <input
                    type="number"
                    min={0}
                    value={settings.spacingMm?.horizontal ?? 5}
                    onChange={(e) => updateSpacing('horizontal', Number(e.target.value))}
                    className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Vertical Gap:</span>
                  <input
                    type="number"
                    min={0}
                    value={settings.spacingMm?.vertical ?? 5}
                    onChange={(e) => updateSpacing('vertical', Number(e.target.value))}
                    className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>
            </div>

            {/* 7. Cut / Crop Marks */}
            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border border-slate-200 bg-white">
                <input
                  type="checkbox"
                  checked={settings.showCutMarks}
                  onChange={(e) => update({ showCutMarks: e.target.checked })}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span className="text-xs font-bold text-slate-800">Print Precision Crop / Cut Marks</span>
              </label>
            </div>
          </div>

          {/* Right Panel: Scrollable Visual Sheet Preview of ALL Selected Cards */}
          <div className="flex-1 bg-slate-200/60 flex flex-col overflow-hidden">
            {/* Zoom & Sheets Status Bar */}
            <div className="px-5 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <span className="font-bold flex items-center gap-1.5 text-slate-900">
                  <Eye className="w-4 h-4 text-rose-600" />
                  Live Print Sheets Preview
                </span>
                <span className="text-slate-400">•</span>
                <span>
                  Showing <strong>{pages.length}</strong> {pages.length === 1 ? 'Sheet' : 'Sheets'} ({effectiveEmployees.length} total selected records)
                </span>
              </div>

              {/* Zoom Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPreviewZoom((z) => Math.max(0.35, z - 0.1))}
                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono font-bold text-slate-700 w-12 text-center">
                  {Math.round(previewZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewZoom((z) => Math.min(1.2, z + 0.1))}
                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewZoom(0.65)}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-600 ml-1"
                >
                  Fit
                </button>
              </div>
            </div>

            {/* Scrollable Container with all Virtual Sheets */}
            <div
              id="print-preview-sheets-container"
              ref={printSheetRef}
              className="flex-1 overflow-y-auto p-6 flex flex-col items-center gap-8"
            >
              {pages.length === 0 ? (
                <div className="py-20 text-center text-slate-400">
                  <Printer className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-semibold">No employee records selected for print preview.</p>
                </div>
              ) : (
                pages.map((page) => {
                  // Pixel conversion for screen representation (1mm = ~3.7795px at 96 DPI)
                  const DPI_FACTOR = 3.779527559;
                  const sheetPixelW = pageWidthMm * DPI_FACTOR;
                  const sheetPixelH = pageHeightMm * DPI_FACTOR;

                  return (
                    <div key={page.pageNumber} className="flex flex-col items-center">
                      {/* Sheet Header / Page Badge */}
                      <div className="screen-only-guide mb-2 text-xs font-bold text-slate-600 flex items-center justify-between w-full max-w-[650px] px-2">
                        <span>{page.title}</span>
                        <span className="text-slate-400 text-[11px]">Page {page.pageNumber} of {pages.length}</span>
                      </div>

                      {/* Virtual Paper Sheet (Scaled according to previewZoom) */}
                      <div
                        style={{
                          width: sheetPixelW * previewZoom,
                          height: sheetPixelH * previewZoom,
                        }}
                        className="relative transition-all"
                      >
                        <div
                          style={{
                            width: sheetPixelW,
                            height: sheetPixelH,
                            transform: `scale(${previewZoom})`,
                            transformOrigin: 'top left',
                          }}
                          className="print-virtual-sheet bg-white rounded-lg shadow-xl border border-slate-300 relative overflow-hidden"
                        >
                          {/* Printable Margins Boundary Guide (Screen only) */}
                          <div
                            style={{
                              position: 'absolute',
                              left: (settings.marginsMm?.left || 10) * DPI_FACTOR,
                              top: (settings.marginsMm?.top || 10) * DPI_FACTOR,
                              right: (settings.marginsMm?.right || 10) * DPI_FACTOR,
                              bottom: (settings.marginsMm?.bottom || 10) * DPI_FACTOR,
                            }}
                            className="screen-only-guide border border-dashed border-slate-200 pointer-events-none"
                          />

                          {/* Render all cards on this sheet */}
                          {page.cards.map((card, idx) => {
                            const leftPx = card.xMm * DPI_FACTOR;
                            const topPx = card.yMm * DPI_FACTOR;
                            const widthPx = cardWidthMm * DPI_FACTOR;
                            const heightPx = cardHeightMm * DPI_FACTOR;

                            // Scale card component from nominal 284x500 to physical printed box widthPx x heightPx
                            const cardScale = widthPx / 284;

                            return (
                              <div
                                key={`${card.employee.id}-${card.side}-${idx}`}
                                style={{
                                  position: 'absolute',
                                  left: leftPx,
                                  top: topPx,
                                  width: widthPx,
                                  height: heightPx,
                                  overflow: 'hidden',
                                }}
                                className="print-card-slot"
                              >
                                <div
                                  style={{
                                    width: 284,
                                    height: 500,
                                    transform: `scale(${cardScale})`,
                                    transformOrigin: 'top left',
                                  }}
                                >
                                  {card.side === 'front' ? (
                                    <CardFront
                                      id={`preview-card-front-${card.employee.id}`}
                                      employee={card.employee}
                                      templateUrl={frontTemplateUrl}
                                      calibration={calibration.front}
                                      scale={1}
                                    />
                                  ) : (
                                    <CardBack
                                      id={`preview-card-back-${card.employee.id}`}
                                      employee={card.employee}
                                      templateUrl={backTemplateUrl}
                                      calibration={calibration.back}
                                      scale={1}
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
