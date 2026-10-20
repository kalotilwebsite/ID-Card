import React, { useState } from 'react';
import { Lock, User, Key, AlertCircle, ShieldCheck, UserCheck, X, Briefcase, IdCard } from 'lucide-react';
import { apiService } from '../services/apiService';
import { AuthUser } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: (user: AuthUser) => void;
  forced?: boolean; // if user is not authenticated and access is blocked
  initialMode?: 'system' | 'supervisor';
}

export function LoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
  forced = false,
  initialMode = 'system',
}: LoginModalProps) {
  const [loginMode, setLoginMode] = useState<'system' | 'supervisor'>(initialMode);
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
      setError('Please enter both username/email and password.');
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
      setError('Please enter both Supervisor Employee ID/Enrollment Number and password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await apiService.supervisorLogin(supervisorId.trim(), supervisorPassword);
      onLoginSuccess(res.user);
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || 'Supervisor authentication failed. Please check your Employee ID and password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (role: 'admin' | 'operator' | 'supervisor') => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                loginMode === 'supervisor'
                  ? 'bg-purple-600/20 text-purple-400 border-purple-500/30'
                  : 'bg-rose-600/20 text-rose-400 border-rose-500/30'
              }`}
            >
              {loginMode === 'supervisor' ? <Briefcase className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {loginMode === 'supervisor' ? 'Supervisor Access Portal' : 'Authorized System Sign In'}
              </h3>
              <p className="text-xs text-slate-400">
                {loginMode === 'supervisor'
                  ? 'Employee ID / Enrollment Number Verification'
                  : 'ID Card System &amp; Administrative Console'}
              </p>
            </div>
          </div>
          {!forced && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Login Type Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/70 p-1 gap-1">
          <button
            type="button"
            onClick={() => {
              setLoginMode('system');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              loginMode === 'system'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-rose-400" />
            <span>System Login</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLoginMode('supervisor');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              loginMode === 'supervisor'
                ? 'bg-purple-950/80 text-purple-200 border border-purple-800/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5 text-purple-400" />
            <span>Supervisor Login</span>
            <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 rounded text-[9px] font-semibold">
              New
            </span>
          </button>
        </div>

        {/* Content */}
        {loginMode === 'system' ? (
          <form onSubmit={handleSubmitSystem} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin or operator1"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-950/50 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Sign In to System</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmitSupervisor} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-[11px] text-purple-300 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Authorized supervisors log in using their Employee ID / Enrollment Number and password.</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Supervisor Employee ID / Enrollment Number *
              </label>
              <div className="relative">
                <IdCard className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={supervisorId}
                  onChange={(e) => setSupervisorId(e.target.value)}
                  placeholder="e.g. SUP-2026-01 or 586665"
                  className="w-full bg-slate-950 border border-purple-800/60 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors font-mono"
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Enter your authorized supervisor Employee ID or Enrollment Number assigned by Admin.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Supervisor Password *
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={supervisorPassword}
                  onChange={(e) => setSupervisorPassword(e.target.value)}
                  placeholder="Enter supervisor password"
                  className="w-full bg-slate-950 border border-purple-800/60 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-950/50 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Verifying Supervisor Access...</span>
              ) : (
                <>
                  <Briefcase className="w-4 h-4" />
                  <span>Sign In as Supervisor</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Quick Fill Test Accounts */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Quick Test Credentials
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('admin')}
              className={`p-2 rounded-xl text-left transition-colors border ${
                loginMode === 'system' && username === 'admin'
                  ? 'bg-rose-950/40 border-rose-500/50'
                  : 'bg-slate-900 border-slate-800 hover:bg-slate-850'
              }`}
            >
              <div className="flex items-center gap-1 text-rose-400 text-[11px] font-bold mb-0.5">
                <ShieldCheck className="w-3 h-3" />
                <span>Admin</span>
              </div>
              <div className="text-[9px] text-slate-400 font-mono truncate">admin / admin123</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('supervisor')}
              className={`p-2 rounded-xl text-left transition-colors border ${
                loginMode === 'supervisor'
                  ? 'bg-purple-950/40 border-purple-500/50'
                  : 'bg-slate-900 border-slate-800 hover:bg-slate-850'
              }`}
            >
              <div className="flex items-center gap-1 text-purple-400 text-[11px] font-bold mb-0.5">
                <Briefcase className="w-3 h-3" />
                <span>Supervisor</span>
              </div>
              <div className="text-[9px] text-purple-300/80 font-mono truncate">SUP-2026-01 / sup...</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('operator')}
              className={`p-2 rounded-xl text-left transition-colors border ${
                loginMode === 'system' && username === 'operator1'
                  ? 'bg-sky-950/40 border-sky-500/50'
                  : 'bg-slate-900 border-slate-800 hover:bg-slate-850'
              }`}
            >
              <div className="flex items-center gap-1 text-sky-400 text-[11px] font-bold mb-0.5">
                <UserCheck className="w-3 h-3" />
                <span>Data Entry</span>
              </div>
              <div className="text-[9px] text-slate-400 font-mono truncate">operator1 / op123</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
