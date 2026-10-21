import React, { useState, useEffect } from 'react';
import { AlertCircle, Eye, EyeOff, X } from 'lucide-react';
import { apiService } from '../services/apiService';
import { AuthUser } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: (user: AuthUser) => void;
  forced?: boolean;
}

const DEFAULT_LOGIN_BG = '/assets/default_login_bg.jpg';

export function LoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
  forced = false,
}: LoginModalProps) {
  const [enroll, setEnroll] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string>(DEFAULT_LOGIN_BG);

  // Fetch background image from public settings
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchSettings = async () => {
      try {
        const settings = await apiService.getPublicSettings();
        if (isMounted && settings?.loginBackgroundImage) {
          setBackgroundImage(settings.loginBackgroundImage);
        }
      } catch {
        // Fallback to default
      }
    };

    fetchSettings();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEnroll = enroll.trim();
    if (!cleanEnroll || !password) {
      setError('Please enter Enroll and Password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await apiService.login(cleanEnroll, password);
      onLoginSuccess(res.user);
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid Enroll or Password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
      {/* Background Image with Ambient Contrast Overlay */}
      <div className="absolute inset-0 -z-10 overflow-hidden bg-slate-900">
        <img
          src={backgroundImage}
          alt="Workplace Background"
          className="w-full h-full object-cover transition-opacity duration-500 scale-102"
          onError={() => setBackgroundImage(DEFAULT_LOGIN_BG)}
        />
        <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
      </div>

      {/* Main Unified Login Card - Minimal, Modern, White, Professional */}
      <div className="relative bg-white border border-slate-200/90 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-7 animate-in fade-in zoom-in-95 duration-200">
        {!forced && onClose && (
          <button
            onClick={onClose}
            type="button"
            className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-700 transition-colors rounded-lg"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Concise Error Banner */}
        {error && (
          <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Unified Login Form with ONLY Enroll & Password fields */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={enroll}
              onChange={(e) => setEnroll(e.target.value)}
              placeholder="Enroll"
              autoFocus
              className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 outline-hidden transition-colors shadow-2xs"
            />
          </div>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg px-3.5 py-2.5 pr-10 text-xs text-slate-900 placeholder-slate-400 outline-hidden transition-colors shadow-2xs"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs cursor-pointer mt-1"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
