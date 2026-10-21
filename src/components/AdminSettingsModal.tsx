import React, { useState, useEffect, useRef } from 'react';
import { X, Check, AlertCircle, Upload, RotateCcw, Image as ImageIcon } from 'lucide-react';
import { apiService } from '../services/apiService';
import { AppSettings, PdfPrintLayout, SupportedPaperSize } from '../types';
import { compressImageFile } from '../utils/imageCompression';

interface AdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: (newSettings: AppSettings) => void;
}

const DEFAULT_SUPERVISOR_MESSAGE =
  'Employee ID Card data has been submitted successfully and queued for administrative review and printing. Thank you!';
const DEFAULT_DISABLED_MESSAGE =
  'সাময়িক রক্ষণাবেক্ষণের জন্য আইডি কার্ড আবেদন কার্যক্রম বন্ধ রয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।';
const DEFAULT_LOGIN_BG = '/assets/default_login_bg.jpg';

export function AdminSettingsModal({
  isOpen,
  onClose,
  onSettingsSaved,
}: AdminSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'supervisor_form' | 'login_background' | 'print_layout' | 'confirmation_message'>('supervisor_form');
  const [pdfPrintLayout, setPdfPrintLayout] = useState<PdfPrintLayout>('side_by_side');
  const [paperSize, setPaperSize] = useState<SupportedPaperSize>('a4');
  const [cardsPerPage, setCardsPerPage] = useState<number>(9);
  const [supervisorFormEnabled, setSupervisorFormEnabled] = useState(true);
  const [supervisorFormDisabledMessage, setSupervisorFormDisabledMessage] = useState(DEFAULT_DISABLED_MESSAGE);
  const [supervisorSuccessMessage, setSupervisorSuccessMessage] = useState(DEFAULT_SUPERVISOR_MESSAGE);
  const [loginBackgroundImage, setLoginBackgroundImage] = useState<string>(DEFAULT_LOGIN_BG);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const bgFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setStatusMessage(null);
      return;
    }

    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const res = await apiService.getAdminSettings();
        setSupervisorSuccessMessage(res.supervisorSuccessMessage || DEFAULT_SUPERVISOR_MESSAGE);
        setSupervisorFormEnabled(res.supervisorFormEnabled !== false);
        setSupervisorFormDisabledMessage(res.supervisorFormDisabledMessage || DEFAULT_DISABLED_MESSAGE);
        setPdfPrintLayout(res.pdfPrintLayout || 'side_by_side');
        setLoginBackgroundImage(res.loginBackgroundImage || DEFAULT_LOGIN_BG);
        if (res.paperSize) setPaperSize(res.paperSize as SupportedPaperSize);
        if (res.cardsPerPage) setCardsPerPage(Number(res.cardsPerPage) || 9);
      } catch (err: any) {
        setStatusMessage({ type: 'error', text: err.message || 'Failed to load settings.' });
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUploadBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Compress to high quality web background (max 1600x1000, 0.85 quality)
      const result = await compressImageFile(file, {
        maxWidth: 1600,
        maxHeight: 1000,
        quality: 0.85,
      });
      setLoginBackgroundImage(result.dataUrl);
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to process background image.' });
    } finally {
      e.target.value = '';
    }
  };

  const handleResetBg = () => {
    setLoginBackgroundImage(DEFAULT_LOGIN_BG);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const updated = await apiService.updateAdminSettings({
        supervisorSuccessMessage: supervisorSuccessMessage.trim() || DEFAULT_SUPERVISOR_MESSAGE,
        supervisorFormEnabled,
        supervisorFormDisabledMessage: supervisorFormDisabledMessage.trim() || DEFAULT_DISABLED_MESSAGE,
        pdfPrintLayout,
        loginBackgroundImage,
        paperSize,
        cardsPerPage,
      });

      setStatusMessage({ type: 'success', text: 'Settings saved successfully.' });
      if (onSettingsSaved) onSettingsSaved(updated);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <h3 className="text-sm font-bold text-slate-900">Admin Settings</h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 transition-colors rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Clean Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 shrink-0 text-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('supervisor_form')}
            className={`py-2.5 px-3 font-semibold text-center border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'supervisor_form'
                ? 'border-slate-900 text-slate-900 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Supervisor Form
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('login_background')}
            className={`py-2.5 px-3 font-semibold text-center border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'login_background'
                ? 'border-slate-900 text-slate-900 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Login Background
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('print_layout')}
            className={`py-2.5 px-3 font-semibold text-center border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'print_layout'
                ? 'border-slate-900 text-slate-900 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            PDF & Print Layout
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('confirmation_message')}
            className={`py-2.5 px-3 font-semibold text-center border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'confirmation_message'
                ? 'border-slate-900 text-slate-900 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Success Message
          </button>
        </div>

        {/* Status notification */}
        {statusMessage && (
          <div
            className={`px-4 py-2 text-xs flex items-center gap-2 border-b shrink-0 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Tab Content */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* TAB 1: Supervisor Form Maintenance Mode */}
          {activeTab === 'supervisor_form' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Supervisor Form Availability</span>
                  <span className="text-[11px] text-slate-500">
                    {supervisorFormEnabled
                      ? 'Form is active and accepting submissions'
                      : 'Form is closed for maintenance (inputs disabled)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSupervisorFormEnabled(!supervisorFormEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-hidden ${
                    supervisorFormEnabled ? 'bg-slate-900' : 'bg-slate-300'
                  }`}
                  aria-label="Toggle Supervisor Form Availability"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-xs ${
                      supervisorFormEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Maintenance Mode Popup Message
                </label>
                <textarea
                  rows={3}
                  value={supervisorFormDisabledMessage}
                  onChange={(e) => setSupervisorFormDisabledMessage(e.target.value)}
                  placeholder="সাময়িক রক্ষণাবেক্ষণের জন্য আইডি কার্ড আবেদন কার্যক্রম বন্ধ রয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।"
                  className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg p-2.5 text-xs text-slate-900 outline-hidden leading-relaxed"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  This exact message is displayed in a popup when maintenance mode is active.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: Login Background Image Customization */}
          {activeTab === 'login_background' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Login Screen Background Image
                </label>
                <p className="text-[11px] text-slate-500 mb-3">
                  Upload a subtle corporate visual or background image for the login screen.
                </p>

                {/* Preview Thumbnail */}
                <div className="relative w-full h-44 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center shadow-inner group">
                  {loginBackgroundImage ? (
                    <img
                      src={loginBackgroundImage}
                      alt="Login Background Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-slate-400 flex flex-col items-center gap-1">
                      <ImageIcon className="w-8 h-8 opacity-40" />
                      <span className="text-xs">No background image</span>
                    </div>
                  )}

                  {/* Mock Login Card Preview Overlay */}
                  <div className="absolute inset-0 bg-black/25 flex items-center justify-center p-4 pointer-events-none">
                    <div className="bg-white/90 backdrop-blur-xs rounded-lg px-4 py-2 border border-white/60 shadow-md text-center max-w-xs">
                      <div className="text-[10px] font-bold text-slate-800">Login Preview</div>
                      <div className="w-24 h-1.5 bg-slate-200 rounded-full mx-auto my-1" />
                      <div className="w-20 h-1.5 bg-slate-200 rounded-full mx-auto" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => bgFileInputRef.current?.click()}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Background</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetBg}
                  className="px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reset to Default</span>
                </button>

                <input
                  ref={bgFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadBg}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* TAB 3: PDF Print Layout & Paper Size */}
          {activeTab === 'print_layout' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1.5">
                  Paper Size Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['a4', 'a5', 'letter'] as SupportedPaperSize[]).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPaperSize(size)}
                      className={`py-2 px-2.5 rounded-lg border text-center transition-all ${
                        paperSize === size
                          ? 'border-slate-900 bg-slate-50 text-slate-900 ring-1 ring-slate-900 font-bold'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                      }`}
                    >
                      <span className="text-xs uppercase">{size}</span>
                      <span className="block text-[10px] text-slate-500">
                        {size === 'a4' ? '210×297 mm' : size === 'a5' ? '148×210 mm' : '8.5×11 in'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1.5">
                  Card Arrangement Layout
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPdfPrintLayout('side_by_side')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      pdfPrintLayout === 'side_by_side'
                        ? 'border-slate-900 bg-slate-50 text-slate-900 ring-1 ring-slate-900 font-bold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <div className="text-xs font-semibold">Side by Side</div>
                    <div className="mt-1.5 flex items-center gap-1.5 justify-center py-1.5 bg-white rounded border border-slate-200">
                      <span className="w-5 h-7 border border-slate-400 bg-slate-100 flex items-center justify-center text-[7px] font-mono">F</span>
                      <span className="w-5 h-7 border border-slate-400 bg-slate-100 flex items-center justify-center text-[7px] font-mono">B</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPdfPrintLayout('top_bottom')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      pdfPrintLayout === 'top_bottom'
                        ? 'border-slate-900 bg-slate-50 text-slate-900 ring-1 ring-slate-900 font-bold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <div className="text-xs font-semibold">Top and Bottom</div>
                    <div className="mt-1.5 flex flex-col items-center gap-1 justify-center py-1 bg-white rounded border border-slate-200">
                      <span className="w-7 h-3.5 border border-slate-400 bg-slate-100 flex items-center justify-center text-[7px] font-mono">F</span>
                      <span className="w-7 h-3.5 border border-slate-400 bg-slate-100 flex items-center justify-center text-[7px] font-mono">B</span>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Default Cards Per Page
                </label>
                <select
                  value={cardsPerPage}
                  onChange={(e) => setCardsPerPage(Number(e.target.value) || 9)}
                  className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg px-3 py-2 text-xs text-slate-900 outline-hidden"
                >
                  <option value={4}>4 Cards per Page (2×2)</option>
                  <option value={6}>6 Cards per Page (3×2 or 2×3)</option>
                  <option value={8}>8 Cards per Page (4×2 or 2×4)</option>
                  <option value={9}>9 Cards per Page (3×3 Standard)</option>
                  <option value={10}>10 Cards per Page (5×2)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  The PDF generator automatically scales card dimensions to keep all cards within the page boundaries.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: Confirmation Message */}
          {activeTab === 'confirmation_message' && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-900">
                Supervisor Submission Success Message
              </label>
              <textarea
                rows={4}
                value={supervisorSuccessMessage}
                onChange={(e) => setSupervisorSuccessMessage(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg p-2.5 text-xs text-slate-900 outline-hidden leading-relaxed"
              />
              <p className="text-[10px] text-slate-400">
                This confirmation message is displayed to the supervisor after successfully submitting an employee ID card record.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isLoading}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
