import React, { useState, useEffect } from 'react';
import { Settings, X, Check, RotateCcw, MessageSquare, Shield, AlertCircle } from 'lucide-react';
import { apiService } from '../services/apiService';

interface AdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: () => void;
}

const DEFAULT_SUPERVISOR_MESSAGE =
  'Employee ID Card data has been submitted successfully and queued for administrative review and printing. Thank you!';

export function AdminSettingsModal({
  isOpen,
  onClose,
  onSettingsSaved,
}: AdminSettingsModalProps) {
  const [supervisorSuccessMessage, setSupervisorSuccessMessage] = useState('');
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
      } catch (err: any) {
        setSupervisorSuccessMessage(DEFAULT_SUPERVISOR_MESSAGE);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisorSuccessMessage.trim()) {
      setStatusMessage({ type: 'error', text: 'Success message cannot be empty.' });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      await apiService.updateAdminSettings({
        supervisorSuccessMessage: supervisorSuccessMessage.trim(),
      });
      setStatusMessage({ type: 'success', text: 'Supervisor confirmation message updated and saved successfully!' });
      if (onSettingsSaved) onSettingsSaved();
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefault = () => {
    setSupervisorSuccessMessage(DEFAULT_SUPERVISOR_MESSAGE);
    setStatusMessage({ type: 'success', text: 'Reset message to factory default. Click Save Changes to apply.' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Admin System Settings</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Configure supervisor submission messages and workflow behavior
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status notification */}
        {statusMessage && (
          <div
            className={`p-3 text-xs flex items-center justify-between border-b ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              {statusMessage.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600 font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* Security Rule Note */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
            <div className="leading-relaxed">
              <strong className="text-slate-800">Card Preview Restriction Rule:</strong> Supervisors are strictly prevented from viewing, rendering, or printing the ID card design. Only the confirmation message configured below is displayed after submission.
            </div>
          </div>

          {/* Supervisor Confirmation Message Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-rose-600" />
                <span>Supervisor Submission Confirmation Message *</span>
              </label>
              <button
                type="button"
                onClick={handleResetDefault}
                className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Default</span>
              </button>
            </div>

            <textarea
              rows={4}
              value={supervisorSuccessMessage}
              onChange={(e) => setSupervisorSuccessMessage(e.target.value)}
              disabled={isLoading || isSaving}
              placeholder="Enter message to display on the supervisor's confirmation popup..."
              className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 leading-relaxed transition-colors"
            />
            <p className="text-[11px] text-slate-500">
              This message appears in the supervisor's confirmation popup immediately after saving the employee's ID card data.
            </p>
          </div>

          {/* Live Preview Box */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Live Supervisor Modal Preview
            </span>
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-slate-900">Submission Successful!</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {supervisorSuccessMessage || DEFAULT_SUPERVISOR_MESSAGE}
                  </p>
                </div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg text-xs border border-slate-100 flex items-center justify-between text-slate-600">
                <span className="font-medium">Employee: MD. RABIUL AWAL</span>
                <span className="font-mono font-bold text-slate-700">Enroll ID: 586665</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isLoading || !supervisorSuccessMessage.trim()}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
            >
              {isSaving ? (
                <span>Saving Changes...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
