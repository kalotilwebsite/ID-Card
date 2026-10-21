import React from 'react';
import { PrintSettings, PaperSizeConfig } from '../types';
import { Printer, Settings2, Sliders, Check, HelpCircle } from 'lucide-react';

interface PrintSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PrintSettings;
  onChangeSettings: (settings: PrintSettings) => void;
  totalCardsCount: number;
  onConfirmPrintOk?: () => void;
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paperSize: 'a4',
  customWidthMm: 210,
  customHeightMm: 297,
  orientation: 'portrait',
  cardWidthMm: 54, // Standard CR80 badge width
  cardHeightMm: 85.6, // Standard CR80 badge height
  marginsMm: {
    top: 10,
    bottom: 10,
    left: 10,
    right: 10,
  },
  spacingMm: {
    horizontal: 5,
    vertical: 5,
  },
  columnsPerPage: 3,
  rowsPerPage: 3, // 3x3 = 9 cards per page on A4/Letter
  layoutMode: 'duplex',
  showCutMarks: true,
  cardBorderRadiusMm: 3,
};

export const PrintSettingsModal: React.FC<PrintSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onChangeSettings,
  totalCardsCount,
  onConfirmPrintOk,
}) => {
  const [showPostPrintConfirm, setShowPostPrintConfirm] = useState(false);
  const [printConfirmed, setPrintConfirmed] = useState(false);

  if (!isOpen) return null;

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

  const cardsPerPage = settings.columnsPerPage * settings.rowsPerPage;
  const estimatedPages =
    settings.layoutMode === 'duplex'
      ? Math.ceil(totalCardsCount / cardsPerPage) * 2
      : settings.layoutMode === 'side-by-side'
      ? Math.ceil(totalCardsCount / Math.max(1, Math.floor(cardsPerPage / 2)))
      : Math.ceil(totalCardsCount / cardsPerPage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-black p-5 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Print & Page Layout Setup</h2>
              <p className="text-xs text-gray-300">
                Configure physical card dimensions, paper sizes, and print duplexing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Section 1: Paper & Orientation */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-rose-600" />
              1. Paper Size & Orientation
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  Paper Format:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => update({ paperSize: 'a4' })}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border text-center transition-all ${
                      settings.paperSize === 'a4'
                        ? 'border-rose-600 bg-rose-50 text-rose-700 ring-1 ring-rose-500 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                    }`}
                  >
                    A4 (210 × 297 mm)
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ paperSize: 'letter' })}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border text-center transition-all ${
                      settings.paperSize === 'letter'
                        ? 'border-rose-600 bg-rose-50 text-rose-700 ring-1 ring-rose-500 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                    }`}
                  >
                    US Letter (8.5 × 11 in)
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ paperSize: 'custom' })}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border text-center transition-all ${
                      settings.paperSize === 'custom'
                        ? 'border-rose-600 bg-rose-50 text-rose-700 ring-1 ring-rose-500 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                    }`}
                  >
                    Custom Size
                  </button>
                </div>
              </div>

              {/* Custom Paper Size Inputs */}
              {settings.paperSize === 'custom' && (
                <div className="p-3.5 bg-rose-50/50 rounded-xl border border-rose-200 space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-950">
                      User-Defined Sheet Dimensions (mm)
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500 font-semibold">Presets:</span>
                      <button
                        type="button"
                        onClick={() => update({ customWidthMm: 297, customHeightMm: 420 })}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-700 font-bold hover:bg-rose-100 transition-colors"
                      >
                        A3
                      </button>
                      <button
                        type="button"
                        onClick={() => update({ customWidthMm: 215.9, customHeightMm: 355.6 })}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-700 font-bold hover:bg-rose-100 transition-colors"
                      >
                        Legal
                      </button>
                      <button
                        type="button"
                        onClick={() => update({ customWidthMm: 148, customHeightMm: 210 })}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-700 font-bold hover:bg-rose-100 transition-colors"
                      >
                        A5
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">
                        Sheet Width (mm):
                      </label>
                      <input
                        type="number"
                        min="20"
                        max="2000"
                        step="1"
                        value={settings.customWidthMm || 210}
                        onChange={(e) =>
                          update({
                            customWidthMm: Math.max(20, Number(e.target.value) || 210),
                          })
                        }
                        style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">
                        Sheet Height (mm):
                      </label>
                      <input
                        type="number"
                        min="20"
                        max="2000"
                        step="1"
                        value={settings.customHeightMm || 297}
                        onChange={(e) =>
                          update({
                            customHeightMm: Math.max(20, Number(e.target.value) || 297),
                          })
                        }
                        style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  Sheet Orientation:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => update({ orientation: 'portrait' })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition-all ${
                      settings.orientation === 'portrait'
                        ? 'border-rose-600 bg-rose-50 text-rose-700 ring-1 ring-rose-500 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                    }`}
                  >
                    Portrait (Vertical)
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ orientation: 'landscape' })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition-all ${
                      settings.orientation === 'landscape'
                        ? 'border-rose-600 bg-rose-50 text-rose-700 ring-1 ring-rose-500 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                    }`}
                  >
                    Landscape (Horizontal)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Layout Mode & Print Alignments */}
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5 text-rose-600" />
              2. Front / Back Layout Mode
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => update({ layoutMode: 'duplex' })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  settings.layoutMode === 'duplex'
                    ? 'border-rose-600 bg-rose-50/60 text-rose-950 ring-1 ring-rose-500'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Duplex (Double-Sided)</span>
                  {settings.layoutMode === 'duplex' && (
                    <Check className="w-4 h-4 text-rose-600" />
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Page 1: Fronts, Page 2: Backs (mirrored horizontally so fronts and backs align
                  when flipped).
                </p>
              </button>

              <button
                type="button"
                onClick={() => update({ layoutMode: 'side-by-side' })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  settings.layoutMode === 'side-by-side'
                    ? 'border-rose-600 bg-rose-50/60 text-rose-950 ring-1 ring-rose-500'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Side-by-Side</span>
                  {settings.layoutMode === 'side-by-side' && (
                    <Check className="w-4 h-4 text-rose-600" />
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Front and Back of each card printed side-by-side on the same sheet for folding
                  or single-side prints.
                </p>
              </button>

              <button
                type="button"
                onClick={() => update({ layoutMode: 'front-only' })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  settings.layoutMode === 'front-only'
                    ? 'border-rose-600 bg-rose-50/60 text-rose-950 ring-1 ring-rose-500'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Fronts Only</span>
                  {settings.layoutMode === 'front-only' && (
                    <Check className="w-4 h-4 text-rose-600" />
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Export only the front face of each employee card.
                </p>
              </button>

              <button
                type="button"
                onClick={() => update({ layoutMode: 'back-only' })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  settings.layoutMode === 'back-only'
                    ? 'border-rose-600 bg-rose-50/60 text-rose-950 ring-1 ring-rose-500'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Backs Only</span>
                  {settings.layoutMode === 'back-only' && (
                    <Check className="w-4 h-4 text-rose-600" />
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Export only the back face of each employee card.
                </p>
              </button>
            </div>
          </div>

          {/* Section 3: Dimensions & Grid */}
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center justify-between">
              <span>3. Physical Card Dimensions & Grid (mm)</span>
              <span className="text-[10px] text-gray-400 font-normal">Standard CR80: 54 × 85.6 mm</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] text-gray-700 font-bold mb-1">
                  Card Width (mm):
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.cardWidthMm}
                  onChange={(e) => update({ cardWidthMm: Number(e.target.value) || 54 })}
                  style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-700 font-bold mb-1">
                  Card Height (mm):
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.cardHeightMm}
                  onChange={(e) => update({ cardHeightMm: Number(e.target.value) || 85.6 })}
                  style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-700 font-bold mb-1">
                  Cols Per Page:
                </label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  value={settings.columnsPerPage}
                  onChange={(e) =>
                    update({ columnsPerPage: Math.max(1, Number(e.target.value) || 1) })
                  }
                  style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-700 font-bold mb-1">
                  Rows Per Page:
                </label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  value={settings.rowsPerPage}
                  onChange={(e) =>
                    update({ rowsPerPage: Math.max(1, Number(e.target.value) || 1) })
                  }
                  style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            {/* Margins and Spacing */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div>
                <label className="block text-[11px] text-gray-700 font-bold mb-1">
                  Page Margin X (mm):
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.marginsMm.left}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    updateMargin('left', val);
                    updateMargin('right', val);
                  }}
                  style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-700 font-bold mb-1">
                  Page Margin Y (mm):
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.marginsMm.top}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    updateMargin('top', val);
                    updateMargin('bottom', val);
                  }}
                  style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-700 font-bold mb-1">
                  Card Spacing X (mm):
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.spacingMm.horizontal}
                  onChange={(e) => updateSpacing('horizontal', Number(e.target.value) || 0)}
                  style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-700 font-bold mb-1">
                  Card Spacing Y (mm):
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.spacingMm.vertical}
                  onChange={(e) => updateSpacing('vertical', Number(e.target.value) || 0)}
                  style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            {/* Cut marks checkbox */}
            <div className="pt-2 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-800">
                <input
                  type="checkbox"
                  checked={settings.showCutMarks}
                  onChange={(e) => update({ showCutMarks: e.target.checked })}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-gray-300"
                />
                Print subtle cutting guides / crop marks around each card
              </label>

              <button
                type="button"
                onClick={() => onChangeSettings(DEFAULT_PRINT_SETTINGS)}
                className="text-[11px] text-rose-600 hover:underline font-bold"
              >
                Reset to Standard Defaults
              </button>
            </div>
          </div>

          {/* Section 4: Live Sheet Layout Visualizer */}
          {(() => {
            const paperDimensions =
              settings.paperSize === 'custom'
                ? {
                    width: Math.max(20, Number(settings.customWidthMm) || 210),
                    height: Math.max(20, Number(settings.customHeightMm) || 297),
                  }
                : settings.paperSize === 'letter'
                ? { width: 215.9, height: 279.4 }
                : { width: 210, height: 297 };

            const isLandscape = settings.orientation === 'landscape';
            const sheetW = isLandscape
              ? Math.max(paperDimensions.width, paperDimensions.height)
              : Math.min(paperDimensions.width, paperDimensions.height);
            const sheetH = isLandscape
              ? Math.min(paperDimensions.width, paperDimensions.height)
              : Math.max(paperDimensions.width, paperDimensions.height);

            const gridW =
              settings.columnsPerPage * settings.cardWidthMm +
              (settings.columnsPerPage - 1) * settings.spacingMm.horizontal;
            const gridH =
              settings.rowsPerPage * settings.cardHeightMm +
              (settings.rowsPerPage - 1) * settings.spacingMm.vertical;

            const printableW = sheetW - settings.marginsMm.left - settings.marginsMm.right;
            const printableH = sheetH - settings.marginsMm.top - settings.marginsMm.bottom;

            const fits = gridW <= printableW + 0.5 && gridH <= printableH + 0.5;

            return (
              <div className="space-y-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    4. Sheet Layout Arrangement Preview
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      fits
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {fits ? '✓ Fits Sheet Perfectly' : '⚠ Caution: Adjust Spacing/Margins'}
                  </span>
                </div>

                <div className="bg-slate-100 rounded-xl p-4 flex flex-col items-center justify-center border border-slate-200">
                  {/* Miniature Sheet Representation */}
                  <div
                    style={{
                      width: isLandscape ? 260 : 180,
                      height: isLandscape ? 180 : 250,
                      backgroundColor: '#FFFFFF',
                    }}
                    className="relative rounded-lg shadow-md border-2 border-slate-300 flex flex-col justify-center items-center overflow-hidden p-2"
                  >
                    {/* Inner Margin Guide Box */}
                    <div className="w-full h-full border border-dashed border-rose-300 rounded p-1 flex flex-col justify-center items-center">
                      {/* Grid of Cards */}
                      <div
                        className="grid gap-1 w-full h-full"
                        style={{
                          gridTemplateColumns: `repeat(${settings.columnsPerPage}, minmax(0, 1fr))`,
                          gridTemplateRows: `repeat(${settings.rowsPerPage}, minmax(0, 1fr))`,
                        }}
                      >
                        {Array.from({ length: cardsPerPage }).map((_, idx) => (
                          <div
                            key={idx}
                            className="bg-rose-50 border border-rose-400 rounded-sm flex flex-col items-center justify-center text-[8px] font-bold text-rose-800 shadow-xs"
                          >
                            <span className="leading-none">#{idx + 1}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-[11px] text-gray-600 text-center space-y-0.5">
                    <div>
                      <span className="font-bold text-gray-900">Sheet:</span> {sheetW.toFixed(1)} ×{' '}
                      {sheetH.toFixed(1)} mm ({settings.paperSize.toUpperCase()},{' '}
                      {settings.orientation})
                    </div>
                    <div>
                      <span className="font-bold text-gray-900">Card Grid:</span>{' '}
                      {settings.columnsPerPage} cols × {settings.rowsPerPage} rows ={' '}
                      <span className="font-bold text-rose-700">{cardsPerPage} cards per sheet</span>{' '}
                      ({gridW.toFixed(1)} × {gridH.toFixed(1)} mm)
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Summary Banner */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 flex items-center justify-between">
            <div>
              <span className="font-bold text-gray-900">Estimated Output:</span> {totalCardsCount} cards on{' '}
              <span className="font-bold text-rose-600">{estimatedPages} pages</span> (
              {cardsPerPage} cards per page)
            </div>
            <span className="text-[11px] font-bold text-gray-600 uppercase bg-gray-200/80 px-2 py-0.5 rounded">
              {settings.paperSize} · {settings.orientation}
            </span>
          </div>
        </div>

        {/* Post-Print Explicit Confirmation Banner */}
        {showPostPrintConfirm && (
          <div className="p-3.5 bg-emerald-50 border-t border-emerald-200 flex flex-wrap items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs font-semibold text-emerald-950">
                Did physical printing finish on your printer?
              </span>
            </div>

            {!printConfirmed ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onConfirmPrintOk) onConfirmPrintOk();
                    setPrintConfirmed(true);
                  }}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                >
                  Confirm Print OK
                </button>
                <button
                  type="button"
                  onClick={() => setShowPostPrintConfirm(false)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium"
                >
                  Keep Print Pending
                </button>
              </div>
            ) : (
              <span className="text-xs font-bold text-emerald-700">
                ✓ Updated to Print OK!
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              window.print();
              setShowPostPrintConfirm(true);
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold shadow transition-colors flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Current View</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow transition-colors"
          >
            Apply Print Settings
          </button>
        </div>
      </div>
    </div>
  );
};
