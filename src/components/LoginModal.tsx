import React, { useState } from 'react';
import { Lock, User, Key, AlertCircle, ShieldCheck, UserCheck, X, Briefcase, IdCard } from 'lucide-react';
import { apiService } from '../services/apiService';
import { AuthUser } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: (user: AuthUser) => void;
  forced?: boolean;
  initialMode?: 'supervisor' | 'system';
}

export function LoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
  forced = false,
  initialMode = 'supervisor',
}: LoginModalProps) {
  const [loginMode, setLoginMode] = useState<'supervisor' | 'system'>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmitSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await apiService.login(username, password);
      onLoginSuccess(res.user);
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisorId.trim() || !supervisorPassword) {
      setError('Please enter both Supervisor Enrollment ID and password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await apiService.supervisorLogin(supervisorId.trim(), supervisorPassword);
      onLoginSuccess(res.user);
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || 'Supervisor authentication failed. Please check your Enrollment ID and password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (role: 'supervisor' | 'admin' | 'operator') => {
    setError(null);
    if (role === 'supervisor') {
      setLoginMode('supervisor');
      setSupervisorId('SUP-2026-01');
      setSupervisorPassword('supervisor123');
    } else if (role === 'admin') {
      setLoginMode('system');
      setUsername('admin');
      setPassword('admin123');
    } else {
      setLoginMode('system');
      setUsername('operator1');
      setPassword('operator123');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                loginMode === 'supervisor'
                  ? 'bg-purple-50 text-purple-600 border-purple-200'
                  : 'bg-rose-50 text-rose-600 border-rose-200'
              }`}
            >
              {loginMode === 'supervisor' ? <Briefcase className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {loginMode === 'supervisor' ? 'Supervisor Portal Login' : 'Admin & Staff Sign In'}
              </h3>
              <p className="text-xs text-slate-500">
                {loginMode === 'supervisor'
                  ? 'Sign in using your Enrollment ID & password'
                  : 'ID Card System & Administrative Management'}
              </p>
            </div>
          </div>
          {!forced && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Login Type Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100/60 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => {
              setLoginMode('supervisor');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              loginMode === 'supervisor'
                ? 'bg-white text-purple-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5 text-purple-600" />
            <span>Supervisor Login</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLoginMode('system');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              loginMode === 'system'
                ? 'bg-white text-rose-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-rose-600" />
            <span>Admin / System</span>
          </button>
        </div>

        {/* Content */}
        {loginMode === 'supervisor' ? (
          <form onSubmit={handleSubmitSupervisor} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-[11px] text-purple-900 flex items-start gap-2">
              <Briefcase className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                Supervisors log in using only their pre-assigned <strong>Enrollment ID</strong> and password. No email address or verification is required.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Supervisor Enrollment ID / Employee ID *
              </label>
              <div className="relative">
                <IdCard className="w-4 h-4 text-purple-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={supervisorId}
                  onChange={(e) => setSupervisorId(e.target.value)}
                  placeholder="e.g. SUP-2026-01 or 586665"
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-purple-600 focus:ring-1 focus:ring-purple-600 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 transition-colors font-mono"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Supervisor Password *
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-purple-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={supervisorPassword}
                  onChange={(e) => setSupervisorPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-purple-600 focus:ring-1 focus:ring-purple-600 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Verifying Supervisor...</span>
              ) : (
                <>
                  <Briefcase className="w-4 h-4" />
                  <span>Log In as Supervisor</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmitSystem} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Username or Email *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin or operator1"
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 transition-colors"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Password *
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-rose-600 focus:ring-1 focus:ring-rose-600 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Sign In as Admin</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Quick Fill Test Accounts */}
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Quick Test Accounts
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('supervisor')}
              className={`p-2 rounded-xl text-left transition-colors border ${
                loginMode === 'supervisor'
                  ? 'bg-purple-50 border-purple-300'
                  : 'bg-white border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-1 text-purple-700 text-[11px] font-bold mb-0.5">
                <Briefcase className="w-3 h-3 text-purple-600" />
                <span>Supervisor</span>
              </div>
              <div className="text-[9px] text-slate-500 font-mono truncate">SUP-2026-01</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('admin')}
              className={`p-2 rounded-xl text-left transition-colors border ${
                loginMode === 'system' && username === 'admin'
                  ? 'bg-rose-50 border-rose-300'
                  : 'bg-white border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-1 text-rose-700 text-[11px] font-bold mb-0.5">
                <ShieldCheck className="w-3 h-3 text-rose-600" />
                <span>Admin</span>
              </div>
              <div className="text-[9px] text-slate-500 font-mono truncate">admin / admin123</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('operator')}
              className={`p-2 rounded-xl text-left transition-colors border ${
                loginMode === 'system' && username === 'operator1'
                  ? 'bg-sky-50 border-sky-300'
                  : 'bg-white border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-1 text-sky-700 text-[11px] font-bold mb-0.5">
                <UserCheck className="w-3 h-3 text-sky-600" />
                <span>Operator</span>
              </div>
              <div className="text-[9px] text-slate-500 font-mono truncate">operator1</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
