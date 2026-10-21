import React, { useState, useEffect } from 'react';
import { AlertCircle, X, Shield, Users } from 'lucide-react';
import { apiService } from '../services/apiService';
import { AuthUser } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: (user: AuthUser) => void;
  forced?: boolean;
  initialMode?: 'supervisor' | 'system';
}

const DEFAULT_LOGIN_BG = '/assets/default_login_bg.jpg';

export function LoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
  forced = false,
  initialMode = 'supervisor',
}: LoginModalProps) {
  const [loginMode, setLoginMode] = useState<'admin' | 'supervisor'>(
    initialMode === 'supervisor' ? 'supervisor' : 'admin'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
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

  const handleSubmitAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter email and password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await apiService.login(email.trim(), password);
      onLoginSuccess(res.user);
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisorId.trim() || !supervisorPassword) {
      setError('Please enter Enrollment ID and password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await apiService.supervisorLogin(supervisorId.trim(), supervisorPassword);
      onLoginSuccess(res.user);
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid Enrollment ID or password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
      {/* Background Image with Subtle Workplace Ambience Overlay */}
      <div className="absolute inset-0 -z-10 overflow-hidden bg-slate-900">
        <img
          src={backgroundImage}
          alt="Workplace Background"
          className="w-full h-full object-cover transition-opacity duration-500 scale-102"
          onError={() => setBackgroundImage(DEFAULT_LOGIN_BG)}
        />
        {/* Elegant darkening & contrast overlay to ensure card readability */}
        <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
      </div>

      {/* Main Login Card - Clean, High Contrast, Minimal */}
      <div className="relative bg-white/95 backdrop-blur-md border border-white/60 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Role Selection Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/80">
          <button
            type="button"
            onClick={() => {
              setLoginMode('supervisor');
              setError(null);
            }}
            className={`flex-1 py-3 text-xs font-semibold text-center transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
              loginMode === 'supervisor'
                ? 'border-slate-900 text-slate-900 font-bold bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Supervisor</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode('admin');
              setError(null);
            }}
            className={`flex-1 py-3 text-xs font-semibold text-center transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
              loginMode === 'admin'
                ? 'border-slate-900 text-slate-900 font-bold bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>
          {!forced && onClose && (
            <button
              onClick={onClose}
              className="px-3 text-slate-400 hover:text-slate-700 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Form Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {loginMode === 'admin' ? (
            <form onSubmit={handleSubmitAdmin} className="space-y-3.5">
              <div>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  autoFocus
                  className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg px-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 outline-hidden transition-colors"
                />
              </div>

              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg px-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 outline-hidden transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs mt-1"
              >
                {isLoading ? 'Signing in...' : 'Sign In as Admin'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmitSupervisor} className="space-y-3.5">
              <div>
                <input
                  type="text"
                  value={supervisorId}
                  onChange={(e) => setSupervisorId(e.target.value)}
                  placeholder="Enrollment ID"
                  autoFocus
                  className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg px-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 outline-hidden transition-colors"
                />
              </div>

              <div>
                <input
                  type="password"
                  value={supervisorPassword}
                  onChange={(e) => setSupervisorPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg px-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 outline-hidden transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs mt-1"
              >
                {isLoading ? 'Signing in...' : 'Sign In as Supervisor'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
