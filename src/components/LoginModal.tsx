import React, { useState, useEffect } from 'react';
import { Lock, IdCard, Eye, EyeOff, AlertCircle, X, Loader2, Info } from 'lucide-react';
import { apiService } from '../services/apiService';
import { AuthUser } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: (user: AuthUser) => void;
  forced?: boolean;
  backgroundImageUrl?: string;
}

export function LoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
  forced = false,
  backgroundImageUrl,
}: LoginModalProps) {
  const [enrollmentId, setEnrollmentId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Background image & notice state
  const [bgImage, setBgImage] = useState<string>(() => {
    try {
      const local = localStorage.getItem('id_card_login_bg');
      if (local) return local;
    } catch {}
    return backgroundImageUrl || '';
  });
  const [noticeEnabled, setNoticeEnabled] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState('');

  useEffect(() => {
    if (backgroundImageUrl !== undefined) {
      setBgImage(backgroundImageUrl);
    }
    // Fetch public settings for backdrop and optional login notice
    apiService
      .getPublicSettings()
      .then((res) => {
        if (res.loginBackgroundImage && backgroundImageUrl === undefined) {
          setBgImage(res.loginBackgroundImage);
          try {
            localStorage.setItem('id_card_login_bg', res.loginBackgroundImage);
          } catch {}
        }
        setNoticeEnabled(Boolean(res.loginNoticeEnabled));
        if (res.loginNoticeMessage) {
          setNoticeMessage(res.loginNoticeMessage);
        }
      })
      .catch(() => {});
  }, [backgroundImageUrl, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = enrollmentId.trim();
    if (!cleanId || !password) {
      setError('Please enter both your Enrollment ID and password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await apiService.login(cleanId, password);
      onLoginSuccess(res.user);
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your Enrollment ID and password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300"
      style={{
        backgroundImage: bgImage ? `url(${bgImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Background Dimmer/Blur Overlay */}
      <div
        className={`absolute inset-0 transition-opacity ${
          bgImage ? 'bg-slate-950/60 backdrop-blur-xs' : 'bg-slate-900/60 backdrop-blur-xs'
        }`}
      />

      {/* Main Login Card */}
      <div className="relative z-10 bg-white border border-slate-200/90 w-full max-w-sm sm:max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                ID Card Portal Access
              </h3>
              <p className="text-xs text-slate-500">
                Enter your credentials to continue
              </p>
            </div>
          </div>

          {!forced && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Unified Login Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {/* Field 1: Enrollment ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Enrollment ID *
            </label>
            <div className="relative">
              <IdCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={enrollmentId}
                onChange={(e) => setEnrollmentId(e.target.value)}
                placeholder="Enter Enrollment ID"
                autoComplete="username"
                className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 transition-colors font-mono"
                autoFocus
              />
            </div>
          </div>

          {/* Field 2: Password with Show/Hide Eye Icon */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Password *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Clean Single Access Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-3 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Access / Login</span>
              </>
            )}
          </button>

          {/* Optional small announcement / notice below the login form */}
          {noticeEnabled && noticeMessage && (
            <div className="mt-3.5 p-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-[11px] text-slate-600 flex items-start gap-2 shadow-2xs animate-in fade-in">
              <Info className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-snug">{noticeMessage}</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
