import React from 'react';
import { PrintSettings, PaperSizeConfig } from '../types';
import { Printer, Settings2, Sliders, Check, HelpCircle } from 'lucide-react';

interface PrintSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PrintSettings;
  onChangeSettings: (settings: PrintSettings) => void;
  totalCardsCount: number;
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paperSize: 'a4',
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
}) => {
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Paper Format:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => update({ paperSize: 'a4' })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition-all ${
                      settings.paperSize === 'a4'
                        ? 'border-rose-600 bg-rose-50 text-rose-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    A4 (210 × 297 mm)
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ paperSize: 'letter' })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition-all ${
                      settings.paperSize === 'letter'
                        ? 'border-rose-600 bg-rose-50 text-rose-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    US Letter (8.5 × 11 in)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Sheet Orientation:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => update({ orientation: 'portrait' })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition-all ${
                      settings.orientation === 'portrait'
                        ? 'border-rose-600 bg-rose-50 text-rose-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    Portrait (Vertical)
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ orientation: 'landscape' })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition-all ${
                      settings.orientation === 'landscape'
                        ? 'border-rose-600 bg-rose-50 text-rose-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
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
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              3. Physical Card Dimensions & Grid (mm)
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] text-gray-600 font-medium mb-1">
                  Card Width (mm):
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.cardWidthMm}
                  onChange={(e) => update({ cardWidthMm: Number(e.target.value) || 54 })}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-800"
                />
                <span className="text-[10px] text-gray-400">CR80: 54mm</span>
              </div>

              <div>
                <label className="block text-[11px] text-gray-600 font-medium mb-1">
                  Card Height (mm):
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.cardHeightMm}
                  onChange={(e) => update({ cardHeightMm: Number(e.target.value) || 85.6 })}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-800"
                />
                <span className="text-[10px] text-gray-400">CR80: 85.6mm</span>
              </div>

              <div>
                <label className="block text-[11px] text-gray-600 font-medium mb-1">
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
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-800"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-600 font-medium mb-1">
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
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-800"
                />
              </div>
            </div>

            {/* Margins and Spacing */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div>
                <label className="block text-[11px] text-gray-600 font-medium mb-1">
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
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-600 font-medium mb-1">
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
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-600 font-medium mb-1">
                  Card Spacing X (mm):
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.spacingMm.horizontal}
                  onChange={(e) => updateSpacing('horizontal', Number(e.target.value) || 0)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-600 font-medium mb-1">
                  Card Spacing Y (mm):
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.spacingMm.vertical}
                  onChange={(e) => updateSpacing('vertical', Number(e.target.value) || 0)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>

            {/* Cut marks checkbox */}
            <div className="pt-2 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-800">
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
                className="text-[11px] text-rose-600 hover:underline font-semibold"
              >
                Reset to Standard Defaults
              </button>
            </div>
          </div>

          {/* Summary Banner */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 flex items-center justify-between">
            <div>
              <span className="font-bold">Estimated Output:</span> {totalCardsCount} cards on{' '}
              <span className="font-bold text-rose-600">{estimatedPages} pages</span> (
              {cardsPerPage} cards per page)
            </div>
            <span className="text-[11px] text-gray-500">
              {settings.paperSize.toUpperCase()} · {settings.orientation}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2 flex-shrink-0">
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
