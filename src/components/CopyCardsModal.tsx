import React, { useState } from 'react';
import {
  Copy,
  Check,
  Download,
  FileArchive,
  Layers,
  Sparkles,
  Loader2,
  X,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  Image as ImageIcon,
  Grid,
  FileText,
} from 'lucide-react';
import { EmployeeCardData, PrintSettings } from '../types';
import {
  captureCardElementToBlob,
  captureCardPairToBlob,
  captureMultipleCardsCombinedToBlob,
  copyBlobToClipboard,
  downloadBlob,
  createCardsZipBlob,
} from '../services/cardImageCopyService';

interface CopyCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEmployees: EmployeeCardData[];
  settings: PrintSettings;
  getCardElement: (empId: string, side: 'front' | 'back') => HTMLElement | null;
  onSuccessNotification: (msg: string) => void;
}

export const CopyCardsModal: React.FC<CopyCardsModalProps> = ({
  isOpen,
  onClose,
  selectedEmployees,
  settings,
  getCardElement,
  onSuccessNotification,
}) => {
  const [activeTab, setActiveTab] = useState<'individual' | 'combined' | 'download'>('individual');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const [copiedCardKey, setCopiedCardKey] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [lastCopiedBlobUrl, setLastCopiedBlobUrl] = useState<string | null>(null);
  const [clipboardError, setClipboardError] = useState<string | null>(null);

  if (!isOpen) return null;

  const count = selectedEmployees.length;

  // --- ACTION 1: Copy Individual Card (Front, Back, or Pair) ---
  const handleCopyIndividualCard = async (
    emp: EmployeeCardData,
    side: 'front' | 'back' | 'pair'
  ) => {
    setIsProcessing(true);
    setProcessingMsg(`Rendering ${side === 'pair' ? 'card pair' : side + ' side'} for ${emp.name}...`);
    setClipboardError(null);

    try {
      const frontEl = getCardElement(emp.id, 'front');
      const backEl = getCardElement(emp.id, 'back');

      let blob: Blob;
      if (side === 'pair') {
        if (!frontEl || !backEl) {
          throw new Error(`Rendered card elements for ${emp.name} not found in preview.`);
        }
        const arrangement =
          settings.layoutMode === 'top-and-bottom' ? 'top-and-bottom' : 'side-by-side';
        blob = await captureCardPairToBlob(frontEl, backEl, arrangement, 3);
      } else {
        const el = side === 'front' ? frontEl : backEl;
        if (!el) {
          throw new Error(`Rendered ${side} card element for ${emp.name} not found in preview.`);
        }
        blob = await captureCardElementToBlob(el, { scale: 3 });
      }

      const res = await copyBlobToClipboard(blob);
      if (res.success) {
        const key = `${emp.id}-${side}`;
        setCopiedCardKey(key);
        setTimeout(() => setCopiedCardKey(null), 3000);
        onSuccessNotification(
          `Copied ${side.toUpperCase()} for ${emp.name} to clipboard! Paste into Microsoft Word with Ctrl+V.`
        );
      } else {
        setClipboardError(
          'Browser clipboard access restricted. You can download the PNG or copy from the preview below.'
        );
        if (res.fallbackUrl) {
          setLastCopiedBlobUrl(res.fallbackUrl);
        }
      }
    } catch (err: any) {
      console.error('Error copying card:', err);
      setClipboardError(err.message || 'Failed to capture card image.');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- ACTION 2: Step-by-Step Sequential Copy for Microsoft Word ---
  const handleStepByStepCopy = async () => {
    const currentEmp = selectedEmployees[stepIndex];
    if (!currentEmp) return;
    await handleCopyIndividualCard(currentEmp, 'pair');
    // Auto advance to next card after copy
    if (stepIndex < selectedEmployees.length - 1) {
      setStepIndex((i) => i + 1);
    }
  };

  // --- ACTION 3: Copy Multiple Cards Together (Combined Grid/Layout) ---
  const handleCopyCombinedLayout = async () => {
    setIsProcessing(true);
    setProcessingMsg(`Rendering all ${count} selected cards in preview arrangement...`);
    setClipboardError(null);

    try {
      const pairs: Array<{ frontEl: HTMLElement; backEl?: HTMLElement }> = [];
      for (const emp of selectedEmployees) {
        const f = getCardElement(emp.id, 'front');
        const b = getCardElement(emp.id, 'back');
        if (f) {
          pairs.push({ frontEl: f, backEl: b || undefined });
        }
      }

      if (pairs.length === 0) {
        throw new Error('No rendered card elements found in the preview sheet.');
      }

      const layoutMode =
        settings.layoutMode === 'front-only' ||
        settings.layoutMode === 'back-only' ||
        settings.layoutMode === 'top-and-bottom'
          ? settings.layoutMode
          : 'side-by-side';

      const blob = await captureMultipleCardsCombinedToBlob(
        pairs,
        layoutMode as any,
        settings.columnsPerPage || 3,
        2.5
      );

      const res = await copyBlobToClipboard(blob);
      if (res.success) {
        setCopiedCardKey('combined-all');
        setTimeout(() => setCopiedCardKey(null), 4000);
        onSuccessNotification(
          `Successfully copied all ${count} selected cards together to clipboard! Press Ctrl+V in Microsoft Word to paste as a single group.`
        );
      } else {
        setClipboardError(
          'Clipboard permission blocked. You can download the full high-resolution layout PNG below.'
        );
        if (res.fallbackUrl) {
          setLastCopiedBlobUrl(res.fallbackUrl);
        }
      }
    } catch (err: any) {
      console.error('Error copying combined cards:', err);
      setClipboardError(err.message || 'Failed to capture combined card images.');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- ACTION 4: Download Combined Layout PNG ---
  const handleDownloadCombinedPng = async () => {
    setIsProcessing(true);
    setProcessingMsg('Generating high-resolution layout PNG...');
    try {
      const pairs: Array<{ frontEl: HTMLElement; backEl?: HTMLElement }> = [];
      for (const emp of selectedEmployees) {
        const f = getCardElement(emp.id, 'front');
        const b = getCardElement(emp.id, 'back');
        if (f) pairs.push({ frontEl: f, backEl: b || undefined });
      }

      const layoutMode =
        settings.layoutMode === 'front-only' ||
        settings.layoutMode === 'back-only' ||
        settings.layoutMode === 'top-and-bottom'
          ? settings.layoutMode
          : 'side-by-side';

      const blob = await captureMultipleCardsCombinedToBlob(
        pairs,
        layoutMode as any,
        settings.columnsPerPage || 3,
        3.0
      );
      downloadBlob(
        blob,
        `ID_Cards_Layout_${count}_Selected_${new Date().toISOString().slice(0, 10)}.png`
      );
      onSuccessNotification(`Downloaded high-resolution PNG with ${count} selected cards.`);
    } catch (err: any) {
      setClipboardError(err.message || 'Failed to download layout PNG.');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- ACTION 5: Download All Selected Cards as ZIP ---
  const handleDownloadZip = async () => {
    setIsProcessing(true);
    setProcessingMsg(`Generating separate PNGs for all ${count} cards and packaging ZIP...`);
    try {
      const files: Array<{ filename: string; blob: Blob }> = [];

      for (let i = 0; i < selectedEmployees.length; i++) {
        const emp = selectedEmployees[i];
        const num = String(i + 1).padStart(2, '0');
        const cleanName = (emp.name || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
        const idStr = emp.enrollId || emp.id;

        const f = getCardElement(emp.id, 'front');
        const b = getCardElement(emp.id, 'back');

        if (f && b) {
          // Generate Pair
          const pairBlob = await captureCardPairToBlob(f, b, 'side-by-side', 3);
          files.push({
            filename: `${num}_${idStr}_${cleanName}_Pair.png`,
            blob: pairBlob,
          });
        }
        if (f) {
          const frontBlob = await captureCardElementToBlob(f, { scale: 3 });
          files.push({
            filename: `${num}_${idStr}_${cleanName}_Front.png`,
            blob: frontBlob,
          });
        }
        if (b) {
          const backBlob = await captureCardElementToBlob(b, { scale: 3 });
          files.push({
            filename: `${num}_${idStr}_${cleanName}_Back.png`,
            blob: backBlob,
          });
        }
      }

      const zipBlob = await createCardsZipBlob(files);
      downloadBlob(
        zipBlob,
        `ID_Cards_PNGs_${count}_Employees_${new Date().toISOString().slice(0, 10)}.zip`
      );
      onSuccessNotification(
        `Downloaded ZIP with ${files.length} high-resolution PNG images. Extract and drag & drop directly into Word!`
      );
    } catch (err: any) {
      setClipboardError(err.message || 'Failed to create ZIP package.');
    } finally {
      setIsProcessing(false);
    }
  };

  const currentStepEmp = selectedEmployees[stepIndex] || selectedEmployees[0];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 overflow-hidden">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight">Copy Selected Cards as Image</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600/30 text-emerald-300 border border-emerald-500/40">
                  {count} {count === 1 ? 'Card' : 'Cards'} Selected
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Pristine 300+ DPI PNG images copied straight to your clipboard for Microsoft Word (Ctrl+V)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('individual')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x cursor-pointer ${
              activeTab === 'individual'
                ? 'bg-white text-emerald-700 border-slate-200 shadow-xs -mb-px'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Separate Cards (Word Objects)</span>
            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded-full">
              {count}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('combined')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x cursor-pointer ${
              activeTab === 'combined'
                ? 'bg-white text-emerald-700 border-slate-200 shadow-xs -mb-px'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Combined Layout Image</span>
            <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[10px] rounded-full">
              Single Object
            </span>
          </button>

          <button
            onClick={() => setActiveTab('download')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x cursor-pointer ${
              activeTab === 'download'
                ? 'bg-white text-emerald-700 border-slate-200 shadow-xs -mb-px'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Batch Download (ZIP / PNG)</span>
          </button>
        </div>

        {/* Loading Banner */}
        {isProcessing && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center gap-2.5 text-xs font-semibold text-emerald-800 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span>{processingMsg || 'Generating crisp card image...'}</span>
          </div>
        )}

        {/* Clipboard Permission Error or Fallback Notice */}
        {clipboardError && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between text-xs font-semibold text-amber-900">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>{clipboardError}</span>
            </div>
            {lastCopiedBlobUrl && (
              <a
                href={lastCopiedBlobUrl}
                download="ID_Card_Copy.png"
                className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[11px] font-bold hover:bg-amber-700 transition-colors"
              >
                Download PNG
              </a>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: INDIVIDUAL CARDS (For Independent Moving & Resizing in Word) */}
          {activeTab === 'individual' && (
            <div className="space-y-6">
              {/* Step-by-Step Banner for Multiple Cards */}
              {count > 1 && (
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200 rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      Step-by-Step Word Paste Mode (Card {stepIndex + 1} of {count})
                    </span>
                    <div className="flex items-center gap-1 text-xs">
                      {selectedEmployees.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setStepIndex(i)}
                          className={`w-6 h-6 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                            stepIndex === i
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300'
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-emerald-100">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {currentStepEmp?.name || 'Selected Employee'}
                      </h4>
                      <p className="text-xs text-slate-600">
                        Enroll ID: <strong>{currentStepEmp?.enrollId}</strong> • Department:{' '}
                        <strong>{currentStepEmp?.department}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleStepByStepCopy}
                        disabled={isProcessing}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {copiedCardKey === `${currentStepEmp?.id}-pair` ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-200" />
                            <span>Copied Card #{stepIndex + 1}!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copy Card #{stepIndex + 1} (Pair) to Word</span>
                          </>
                        )}
                      </button>

                      {stepIndex < count - 1 ? (
                        <button
                          onClick={() => setStepIndex((i) => Math.min(count - 1, i + 1))}
                          className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span>Next</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setStepIndex(0)}
                          className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          Restart from #1
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Cards List with Independent Copy Controls */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Selected Employee Cards ({count})
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Order preserved as in preview • Each card pastes as an independent image object
                  </span>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-xs">
                  {selectedEmployees.map((emp, idx) => {
                    const isFrontCopied = copiedCardKey === `${emp.id}-front`;
                    const isBackCopied = copiedCardKey === `${emp.id}-back`;
                    const isPairCopied = copiedCardKey === `${emp.id}-pair`;

                    return (
                      <div
                        key={emp.id}
                        className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                          stepIndex === idx && count > 1 ? 'bg-emerald-50/40' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {idx + 1}
                          </span>
                          <div className="w-9 h-11 rounded border border-slate-200 bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {emp.photoUrl ? (
                              <img src={emp.photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{emp.name}</span>
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {emp.enrollId}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {emp.designation} • {emp.department} • Blood: {emp.bloodGroup || 'O+'}
                            </p>
                          </div>
                        </div>

                        {/* Copy Buttons for this Card */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Copy Pair Button (Front & Back Together) */}
                          <button
                            onClick={() => handleCopyIndividualCard(emp, 'pair')}
                            disabled={isProcessing}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              isPairCopied
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                            title="Copy Front & Back together as 1 card image"
                          >
                            {isPairCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{isPairCopied ? 'Copied Pair!' : 'Copy Pair'}</span>
                          </button>

                          {/* Copy Front Only */}
                          <button
                            onClick={() => handleCopyIndividualCard(emp, 'front')}
                            disabled={isProcessing}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                              isFrontCopied
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                            }`}
                            title="Copy Front side only"
                          >
                            {isFrontCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3 h-3" />}
                            <span>{isFrontCopied ? 'Copied Front!' : 'Front'}</span>
                          </button>

                          {/* Copy Back Only */}
                          <button
                            onClick={() => handleCopyIndividualCard(emp, 'back')}
                            disabled={isProcessing}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                              isBackCopied
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                            }`}
                            title="Copy Back side only"
                          >
                            {isBackCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3 h-3" />}
                            <span>{isBackCopied ? 'Copied Back!' : 'Back'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COMBINED LAYOUT IMAGE (All selected cards in 1 high-res image for Word) */}
          {activeTab === 'combined' && (
            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-200">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Grid className="w-4 h-4 text-emerald-600" />
                      All {count} Selected Cards as a Single Combined Image
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Arranged in your current layout mode:{' '}
                      <strong className="text-slate-800 uppercase">{settings.layoutMode}</strong> (
                      {settings.columnsPerPage} columns)
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyCombinedLayout}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {copiedCardKey === 'combined-all' ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-200" />
                          <span>Copied All {count} Cards!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy Combined Image (Ctrl+C)</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleDownloadCombinedPng}
                      disabled={isProcessing}
                      className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download PNG</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {selectedEmployees.map((emp, i) => (
                    <div
                      key={emp.id}
                      className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-2.5 shadow-2xs"
                    >
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">
                        {i + 1}
                      </span>
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-900 truncate">{emp.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{emp.enrollId} • {emp.department}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BATCH DOWNLOAD (ZIP / PNG) */}
          {activeTab === 'download' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option A: ZIP Archive */}
                <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
                      <FileArchive className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">Download All as ZIP Archive</h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Includes Front, Back, and Pair PNG files for every selected employee, cleanly named with
                      Enroll ID and Name.
                    </p>
                    <ul className="text-[11px] text-slate-500 mt-3 space-y-1">
                      <li>• Lossless 300+ DPI PNG format</li>
                      <li>• Uncompressed signatures and logos</li>
                      <li>• Easily drag and drop directly into Word</li>
                    </ul>
                  </div>

                  <button
                    onClick={handleDownloadZip}
                    disabled={isProcessing}
                    className="mt-5 w-full py-2.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download ZIP Archive ({count} Cards)</span>
                  </button>
                </div>

                {/* Option B: Combined Layout PNG */}
                <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">Download Combined Layout PNG</h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Downloads a single high-resolution image containing all {count} selected cards in their
                      current grid layout.
                    </p>
                    <ul className="text-[11px] text-slate-500 mt-3 space-y-1">
                      <li>• Ready to insert as a single picture</li>
                      <li>• Perfect side-by-side or top-bottom layout</li>
                      <li>• Matches preview orientation and spacing</li>
                    </ul>
                  </div>

                  <button
                    onClick={handleDownloadCombinedPng}
                    disabled={isProcessing}
                    className="mt-5 w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Combined PNG ({count} Cards)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Microsoft Word Pro Tip Card */}
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
              <FileText className="w-4 h-4" />
            </div>
            <div className="text-xs text-blue-950 space-y-1">
              <h5 className="font-bold">How to move & resize freely in Microsoft Word:</h5>
              <p className="text-blue-900/90 leading-relaxed">
                1. In Microsoft Word, press <strong>Ctrl+V</strong> to paste the copied card image.
                <br />
                2. Click on the pasted card, click the <strong>Layout Options</strong> icon next to it (or right-click → <strong>Wrap Text</strong>), and choose <strong>"In Front of Text"</strong> or <strong>"Tight"</strong>.
                <br />
                3. You can now freely drag the card anywhere on the page, arrange multiple cards without margins breaking, resize, and print perfectly without distortion!
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Copying source: <strong>Direct Live Preview DOM</strong> (zero PDF engine distortion)
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
