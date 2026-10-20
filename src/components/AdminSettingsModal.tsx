import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { apiService } from '../services/apiService';
import { AppSettings, PdfPrintLayout } from '../types';

interface AdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: (newSettings: AppSettings) => void;
}

const DEFAULT_SUPERVISOR_MESSAGE =
  'Employee ID Card data has been submitted successfully and queued for administrative review and printing. Thank you!';
const DEFAULT_DISABLED_MESSAGE =
  'Employee ID Card submission is temporarily closed by the administrator. Please check back later.';

export function AdminSettingsModal({
  isOpen,
  onClose,
  onSettingsSaved,
}: AdminSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'print_layout' | 'supervisor_form' | 'confirmation_message'>('print_layout');
  const [pdfPrintLayout, setPdfPrintLayout] = useState<PdfPrintLayout>('side_by_side');
  const [supervisorFormEnabled, setSupervisorFormEnabled] = useState(true);
  const [supervisorFormDisabledMessage, setSupervisorFormDisabledMessage] = useState(DEFAULT_DISABLED_MESSAGE);
  const [supervisorSuccessMessage, setSupervisorSuccessMessage] = useState(DEFAULT_SUPERVISOR_MESSAGE);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      } catch (err: any) {
        setStatusMessage({ type: 'error', text: err.message || 'Failed to load settings.' });
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [isOpen]);

  if (!isOpen) return null;

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
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Settings</h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Concise Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={() => setActiveTab('print_layout')}
            className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTab === 'print_layout'
                ? 'border-slate-900 text-slate-900 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Print Layout
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('supervisor_form')}
            className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTab === 'supervisor_form'
                ? 'border-slate-900 text-slate-900 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Supervisor Form
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('confirmation_message')}
            className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTab === 'confirmation_message'
                ? 'border-slate-900 text-slate-900 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Confirmation Message
          </button>
        </div>

        {/* Status notification */}
        {statusMessage && (
          <div
            className={`px-4 py-2 text-xs flex items-center gap-2 border-b ${
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
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {activeTab === 'print_layout' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-800">
                Card Arrangement
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPdfPrintLayout('side_by_side')}
                  className={`p-3.5 rounded-lg border text-left transition-all ${
                    pdfPrintLayout === 'side_by_side'
                      ? 'border-slate-900 bg-slate-50 text-slate-900 ring-1 ring-slate-900 font-bold'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  <div className="text-xs font-semibold">Side by Side</div>
                  <div className="mt-2 flex items-center gap-1.5 justify-center py-2 bg-white rounded border border-slate-200">
                    <span className="w-6 h-9 border border-slate-400 bg-slate-100 flex items-center justify-center text-[8px] font-mono">F</span>
                    <span className="w-6 h-9 border border-slate-400 bg-slate-100 flex items-center justify-center text-[8px] font-mono">B</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPdfPrintLayout('top_bottom')}
                  className={`p-3.5 rounded-lg border text-left transition-all ${
                    pdfPrintLayout === 'top_bottom'
                      ? 'border-slate-900 bg-slate-50 text-slate-900 ring-1 ring-slate-900 font-bold'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  <div className="text-xs font-semibold">Top and Bottom</div>
                  <div className="mt-2 flex flex-col items-center gap-1 justify-center py-1 bg-white rounded border border-slate-200">
                    <span className="w-8 h-4 border border-slate-400 bg-slate-100 flex items-center justify-center text-[8px] font-mono">F</span>
                    <span className="w-8 h-4 border border-slate-400 bg-slate-100 flex items-center justify-center text-[8px] font-mono">B</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'supervisor_form' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-800">Form Status</span>
                <button
                  type="button"
                  onClick={() => setSupervisorFormEnabled(!supervisorFormEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    supervisorFormEnabled ? 'bg-slate-900' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      supervisorFormEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Disabled Message
                </label>
                <textarea
                  rows={3}
                  value={supervisorFormDisabledMessage}
                  onChange={(e) => setSupervisorFormDisabledMessage(e.target.value)}
                  className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg p-2.5 text-xs text-slate-900 outline-hidden"
                />
              </div>
            </div>
          )}

          {activeTab === 'confirmation_message' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-800">
                Message
              </label>
              <textarea
                rows={4}
                value={supervisorSuccessMessage}
                onChange={(e) => setSupervisorSuccessMessage(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg p-2.5 text-xs text-slate-900 outline-hidden"
              />
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
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
