import React, { useState, useEffect } from 'react';
import {
  Settings,
  X,
  Check,
  RotateCcw,
  MessageSquare,
  Shield,
  AlertCircle,
  Image as ImageIcon,
  Upload,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Info,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { AppSettings } from '../types';

interface AdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: () => void;
}

const DEFAULT_SUPERVISOR_MESSAGE =
  'Employee ID Card data has been submitted successfully and queued for administrative review and printing. Thank you!';
const DEFAULT_GENERAL_SUCCESS_MESSAGE =
  'Operation completed successfully and database records updated.';
const DEFAULT_LOGIN_NOTICE =
  'Welcome to the ID Card Portal. Please contact Administration if you need credential assistance.';
const DEFAULT_SUPERVISOR_DISABLED_MSG =
  'Supervisor data entry is temporarily closed by Administration. Please check back later or contact the admin office.';

export function AdminSettingsModal({
  isOpen,
  onClose,
  onSettingsSaved,
}: AdminSettingsModalProps) {
  // Settings state
  const [supervisorSuccessMessage, setSupervisorSuccessMessage] = useState(DEFAULT_SUPERVISOR_MESSAGE);
  const [generalSuccessMessage, setGeneralSuccessMessage] = useState(DEFAULT_GENERAL_SUCCESS_MESSAGE);
  const [loginBackgroundImage, setLoginBackgroundImage] = useState('');
  const [loginNoticeEnabled, setLoginNoticeEnabled] = useState(false);
  const [loginNoticeMessage, setLoginNoticeMessage] = useState(DEFAULT_LOGIN_NOTICE);
  const [supervisorEntryEnabled, setSupervisorEntryEnabled] = useState(true);
  const [supervisorEntryDisabledMessage, setSupervisorEntryDisabledMessage] = useState(
    DEFAULT_SUPERVISOR_DISABLED_MSG
  );

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
        setGeneralSuccessMessage(res.generalSuccessMessage || DEFAULT_GENERAL_SUCCESS_MESSAGE);
        setLoginBackgroundImage(res.loginBackgroundImage || '');
        setLoginNoticeEnabled(Boolean(res.loginNoticeEnabled));
        setLoginNoticeMessage(res.loginNoticeMessage || DEFAULT_LOGIN_NOTICE);
        setSupervisorEntryEnabled(res.supervisorEntryEnabled !== false);
        setSupervisorEntryDisabledMessage(
          res.supervisorEntryDisabledMessage || DEFAULT_SUPERVISOR_DISABLED_MSG
        );
      } catch (err: any) {
        console.warn('Failed to load settings, using defaults:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUploadBgImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setStatusMessage({ type: 'error', text: 'Please select a valid image file.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setLoginBackgroundImage(dataUrl);
      setStatusMessage({
        type: 'success',
        text: 'Background image selected. Click Save Settings to persist.',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBgImage = () => {
    setLoginBackgroundImage('');
    setStatusMessage({
      type: 'success',
      text: 'Custom background removed. Click Save Settings to restore the default backdrop.',
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisorSuccessMessage.trim()) {
      setStatusMessage({ type: 'error', text: 'Supervisor success message cannot be empty.' });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      await apiService.updateAdminSettings({
        supervisorSuccessMessage: supervisorSuccessMessage.trim(),
        generalSuccessMessage: generalSuccessMessage.trim(),
        loginBackgroundImage,
        loginNoticeEnabled,
        loginNoticeMessage: loginNoticeMessage.trim(),
        supervisorEntryEnabled,
        supervisorEntryDisabledMessage: supervisorEntryDisabledMessage.trim(),
      });

      // Synchronize with client localStorage for instantaneous boot
      try {
        if (loginBackgroundImage) {
          localStorage.setItem('id_card_login_bg', loginBackgroundImage);
        } else {
          localStorage.removeItem('id_card_login_bg');
        }
      } catch {}

      setStatusMessage({ type: 'success', text: 'System settings updated and saved successfully!' });
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
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
                Configure supervisor availability, success messages, login notice, and theme
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
        <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-6 overflow-y-auto">
          {/* SECTION 1: SUPERVISOR ENTRY ON/OFF TOGGLE (ADMIN CONTROLLED) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    1. Supervisor Entry Data Submission
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      supervisorEntryEnabled
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {supervisorEntryEnabled ? 'ON (Active)' : 'OFF (Disabled)'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Enable or disable employee ID card data submissions from the Supervisor Entry portal.
                </p>
              </div>

              {/* Toggle switch */}
              <button
                type="button"
                onClick={() => setSupervisorEntryEnabled((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  supervisorEntryEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
                title={supervisorEntryEnabled ? 'Click to Disable' : 'Click to Enable'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    supervisorEntryEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Configurable Disabled Notice Message */}
            {!supervisorEntryEnabled && (
              <div className="space-y-1.5 pt-2 border-t border-slate-200 animate-in fade-in">
                <label className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Message Displayed to Supervisors When Disabled</span>
                </label>
                <textarea
                  rows={2}
                  value={supervisorEntryDisabledMessage}
                  onChange={(e) => setSupervisorEntryDisabledMessage(e.target.value)}
                  placeholder="Enter message explaining why supervisor entry is currently closed..."
                  className="w-full bg-white border border-rose-200 focus:border-rose-500 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400"
                />
                <p className="text-[11px] text-slate-500">
                  This message is displayed to supervisors attempting to access or submit cards while entry is toggled OFF.
                </p>
              </div>
            )}
          </div>

          {/* SECTION 2: SUCCESS MESSAGE SETTINGS */}
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-rose-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                2. Operation Success Messages
              </h4>
            </div>

            {/* Field A: Supervisor Submission Success Message */}
            <div className="space-y-1.5 bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  Supervisor Submission Confirmation Message *
                </label>
                <button
                  type="button"
                  onClick={() => setSupervisorSuccessMessage(DEFAULT_SUPERVISOR_MESSAGE)}
                  className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Default</span>
                </button>
              </div>

              <textarea
                rows={3}
                value={supervisorSuccessMessage}
                onChange={(e) => setSupervisorSuccessMessage(e.target.value)}
                placeholder="Enter confirmation popup message..."
                className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 leading-relaxed transition-colors"
              />
              <p className="text-[11px] text-slate-500">
                Displayed in the supervisor confirmation popup immediately after saving employee ID card data.
              </p>
            </div>

            {/* Field B: General Operation Success Message */}
            <div className="space-y-1.5 bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  General Action &amp; Print Completion Message
                </label>
                <button
                  type="button"
                  onClick={() => setGeneralSuccessMessage(DEFAULT_GENERAL_SUCCESS_MESSAGE)}
                  className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Default</span>
                </button>
              </div>

              <input
                type="text"
                value={generalSuccessMessage}
                onChange={(e) => setGeneralSuccessMessage(e.target.value)}
                placeholder="e.g. Operation completed successfully and database records updated."
                className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 transition-colors"
              />
              <p className="text-[11px] text-slate-500">
                Shown when marking ID cards as Printed, updating records, or verifying print completion.
              </p>
            </div>
          </div>

          {/* SECTION 3: LOGIN AREA POPUP / NOTICE MESSAGE */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    3. Login Area Announcement / Message
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      loginNoticeEnabled
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {loginNoticeEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Display an optional small popup/message below the login form for user guidance or announcements.
                </p>
              </div>

              {/* Toggle switch */}
              <button
                type="button"
                onClick={() => setLoginNoticeEnabled((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  loginNoticeEnabled ? 'bg-rose-600' : 'bg-slate-300'
                }`}
                title={loginNoticeEnabled ? 'Click to Disable' : 'Click to Enable'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    loginNoticeEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {loginNoticeEnabled && (
              <div className="space-y-2 pt-2 border-t border-slate-200 animate-in fade-in">
                <label className="text-xs font-bold text-slate-800">
                  Login Message Text
                </label>
                <textarea
                  rows={2}
                  value={loginNoticeMessage}
                  onChange={(e) => setLoginNoticeMessage(e.target.value)}
                  placeholder="Enter message to display below the login form..."
                  className="w-full bg-white border border-slate-300 focus:border-rose-600 focus:ring-1 focus:ring-rose-600 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400"
                />

                {/* Preview */}
                <div className="mt-2 p-3 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Preview (Below Login Form)
                  </span>
                  <div className="p-2.5 bg-slate-50 border border-slate-200/90 rounded-lg text-xs text-slate-700 flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                    <span>{loginNoticeMessage || DEFAULT_LOGIN_NOTICE}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: LOGIN SCREEN BACKGROUND IMAGE */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                <ImageIcon className="w-3.5 h-3.5 text-rose-600" />
                <span>4. Login Screen Background Image</span>
              </label>
              {loginBackgroundImage && (
                <button
                  type="button"
                  onClick={handleRemoveBgImage}
                  className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove (Use Default)</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl p-3">
              {/* Thumbnail Preview */}
              <div
                className="w-24 h-16 rounded-lg border border-slate-300 bg-slate-200 overflow-hidden flex items-center justify-center shrink-0 relative shadow-2xs"
                style={{
                  backgroundImage: loginBackgroundImage ? `url(${loginBackgroundImage})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {!loginBackgroundImage && (
                  <span className="text-[10px] text-slate-500 font-medium text-center px-1">
                    Default Theme
                  </span>
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 shadow-2xs">
                    <Upload className="w-3.5 h-3.5 text-rose-600" />
                    <span>{loginBackgroundImage ? 'Replace Image' : 'Upload Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadBgImage(e.target.files[0]);
                        }
                      }}
                    />
                  </label>

                  {loginBackgroundImage && (
                    <button
                      type="button"
                      onClick={handleRemoveBgImage}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition-colors"
                    >
                      Use Default
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  {loginBackgroundImage
                    ? 'Custom backdrop active. Rendered behind the unified login portal with dark contrast overlay.'
                    : 'No custom image set. Default clean dark backdrop is active.'}
                </p>
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
