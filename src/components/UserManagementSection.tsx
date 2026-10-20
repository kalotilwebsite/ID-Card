import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Edit2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  X,
  Lock,
  Briefcase,
  IdCard,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { AuthUser, UserRole } from '../types';

export function UserManagementSection() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'supervisor' | 'data_entry'>('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);

  // Form State for Create
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('supervisor');

  // Form State for Edit
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editEmployeeId, setEditEmployeeId] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('supervisor');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [editPassword, setEditPassword] = useState('');

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getUsers();
      setUsers(data);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to load user accounts.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword || !newName.trim()) {
      setStatusMessage({ type: 'error', text: 'Username/ID, password, and name are required.' });
      return;
    }

    try {
      setIsLoading(true);
      await apiService.createUser({
        username: newUsername.trim(),
        password: newPassword,
        name: newName.trim(),
        email: newEmail.trim() || undefined,
        employeeId: newEmployeeId.trim() || newUsername.trim(),
        role: newRole,
      });

      setStatusMessage({ type: 'success', text: `Authorized ${newRole.replace('_', ' ')} "${newUsername}" created successfully.` });
      setIsCreateModalOpen(false);
      setNewUsername('');
      setNewPassword('');
      setNewName('');
      setNewEmail('');
      setNewEmployeeId('');
      setNewRole('supervisor');
      await loadUsers();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to create user.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEdit = (user: AuthUser) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email || '');
    setEditEmployeeId(user.employeeId || user.username);
    setEditRole(user.role);
    setEditStatus(user.status || 'active');
    setEditPassword('');
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setIsLoading(true);
      await apiService.updateUser(editingUser.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        employeeId: editEmployeeId.trim() || undefined,
        role: editRole,
        status: editStatus,
        password: editPassword.trim() ? editPassword.trim() : undefined,
      });

      setStatusMessage({ type: 'success', text: `User "${editingUser.username}" updated successfully.` });
      setEditingUser(null);
      await loadUsers();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update user.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (user: AuthUser) => {
    if (!window.confirm(`Are you sure you want to delete account "${user.username}" (${user.name})?`)) {
      return;
    }

    try {
      setIsLoading(true);
      await apiService.deleteUser(user.id);
      setStatusMessage({ type: 'success', text: `User "${user.username}" deleted.` });
      await loadUsers();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to delete user.' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter === 'all') return true;
    return u.role === roleFilter;
  });

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Admin Only
            </span>
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-rose-500" />
              <span>Authorized User &amp; Supervisor Management</span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Predefine and manage authorized credentials for <strong className="text-purple-300">Supervisors</strong>,{' '}
            <strong className="text-sky-300">Data Entry Operators</strong>, and{' '}
            <strong className="text-rose-300">Administrators</strong>. Enforce strict role-based access so supervisors and operators cannot access administrative settings, master database, or printing features.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setNewRole('supervisor');
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-950/40 flex items-center gap-2"
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Add Supervisor</span>
          </button>

          <button
            onClick={() => {
              setNewRole('data_entry');
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-950/40 flex items-center gap-2"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add User</span>
          </button>

          <button
            onClick={loadUsers}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
            title="Refresh user list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Role Access Matrix Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Administrator */}
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <h4 className="font-bold text-white mb-0.5">Administrator</h4>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Full control: Master Excel database import, supervisor/user management, calibration, and bulk ID card printing.
            </p>
          </div>
        </div>

        {/* Supervisor */}
        <div className="bg-slate-950 border border-purple-900/40 p-4 rounded-xl flex items-start gap-3 bg-gradient-to-br from-purple-950/10 to-transparent">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 shrink-0 border border-purple-500/20">
            <Briefcase className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <h4 className="font-bold text-purple-200 mb-0.5">Authorized Supervisor</h4>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Dedicated Supervisor Portal: Authenticates using Employee ID/Enrollment No. and password to access the ID card submission form. Strictly blocked from admin pages and printing.
            </p>
          </div>
        </div>

        {/* Data Entry Operator */}
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <h4 className="font-bold text-white mb-0.5">Data Entry Operator</h4>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Operator access: Look up Enrollment IDs, view read-only employee information, and submit NID, Photo, and Signature.
            </p>
          </div>
        </div>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2.5 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Authorized Accounts ({filteredUsers.length} of {users.length})
          </div>

          {/* Role Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                roleFilter === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({users.length})
            </button>
            <button
              onClick={() => setRoleFilter('supervisor')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                roleFilter === 'supervisor'
                  ? 'bg-purple-900/60 text-purple-200 border border-purple-700/50 shadow-sm'
                  : 'text-slate-400 hover:text-purple-300'
              }`}
            >
              <Briefcase className="w-3 h-3 text-purple-400" />
              <span>Supervisors ({users.filter((u) => u.role === 'supervisor').length})</span>
            </button>
            <button
              onClick={() => setRoleFilter('data_entry')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                roleFilter === 'data_entry'
                  ? 'bg-sky-900/60 text-sky-200 border border-sky-700/50 shadow-sm'
                  : 'text-slate-400 hover:text-sky-300'
              }`}
            >
              Data Entry ({users.filter((u) => u.role === 'data_entry').length})
            </button>
            <button
              onClick={() => setRoleFilter('admin')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                roleFilter === 'admin'
                  ? 'bg-rose-900/60 text-rose-200 border border-rose-700/50 shadow-sm'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              Admins ({users.filter((u) => u.role === 'admin').length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/90 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Login Identifier / Employee ID</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-white">{u.name}</div>
                    {u.email && <div className="text-[11px] text-slate-500">{u.email}</div>}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-mono text-slate-300 font-semibold">{u.username}</div>
                    {u.employeeId && u.employeeId !== u.username && (
                      <div className="text-[10px] text-purple-400/90 font-mono flex items-center gap-1 mt-0.5">
                        <IdCard className="w-3 h-3 text-purple-400" />
                        <span>Emp ID: {u.employeeId}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {u.role === 'admin' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 w-fit">
                        <Shield className="w-3 h-3" /> Administrator
                      </span>
                    )}
                    {u.role === 'supervisor' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1 w-fit">
                        <Briefcase className="w-3 h-3 text-purple-400" /> Supervisor
                      </span>
                    )}
                    {u.role === 'data_entry' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1 w-fit">
                        <Lock className="w-3 h-3" /> Data Entry
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {u.status === 'active' ? (
                      <span className="text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active
                      </span>
                    ) : (
                      <span className="text-slate-500 font-semibold text-[11px] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-[11px]">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'System'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="Edit user details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Delete user account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                {newRole === 'supervisor' ? (
                  <Briefcase className="w-4 h-4 text-purple-400" />
                ) : (
                  <UserPlus className="w-4 h-4 text-rose-500" />
                )}
                <span>
                  {newRole === 'supervisor'
                    ? 'Predefine Authorized Supervisor'
                    : 'Create Authorized User Account'}
                </span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-3.5">
              {/* Role Assignment Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Account Role *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewRole('supervisor');
                      if (!newEmployeeId && newUsername) setNewEmployeeId(newUsername);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      newRole === 'supervisor'
                        ? 'bg-purple-500/20 border-purple-500 text-purple-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="text-xs font-bold mb-0.5 flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-purple-400" /> Supervisor
                    </div>
                    <div className="text-[9px] leading-tight text-slate-400">Submission portal</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewRole('data_entry')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      newRole === 'data_entry'
                        ? 'bg-sky-500/20 border-sky-500 text-sky-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="text-xs font-bold mb-0.5 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-sky-400" /> Data Entry
                    </div>
                    <div className="text-[9px] leading-tight text-slate-400">Standard entry form</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewRole('admin')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      newRole === 'admin'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="text-xs font-bold mb-0.5 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-rose-400" /> Admin
                    </div>
                    <div className="text-[9px] leading-tight text-slate-400">Full system access</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Faruk Hossain"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {newRole === 'supervisor' ? 'Supervisor Username / Login Handle *' : 'Username *'}
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => {
                    setNewUsername(e.target.value);
                    if (newRole === 'supervisor' && !newEmployeeId) {
                      setNewEmployeeId(e.target.value);
                    }
                  }}
                  placeholder={newRole === 'supervisor' ? 'e.g. supervisor2' : 'e.g. operator2'}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              {newRole === 'supervisor' && (
                <div>
                  <label className="block text-xs font-semibold text-purple-300 mb-1 flex items-center gap-1.5">
                    <IdCard className="w-3.5 h-3.5 text-purple-400" />
                    <span>Supervisor Employee ID / Enrollment Number *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newEmployeeId}
                    onChange={(e) => setNewEmployeeId(e.target.value)}
                    placeholder="e.g. SUP-2026-02 or 586668"
                    className="w-full bg-slate-950 border border-purple-800/80 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-[10px] text-purple-400/80 mt-1">
                    Supervisors log into their portal using this Employee ID / Enrollment Number.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Set initial password"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="supervisor@company.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`px-5 py-2 text-white rounded-xl text-xs font-bold shadow-md ${
                    newRole === 'supervisor'
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-950/40'
                      : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/40'
                  }`}
                >
                  Save &amp; Authorize Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-sky-400" /> Edit Authorized Account ({editingUser.username})
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Supervisor Employee ID / Enrollment Number
                </label>
                <input
                  type="text"
                  value={editEmployeeId}
                  onChange={(e) => setEditEmployeeId(e.target.value)}
                  placeholder="e.g. SUP-2026-01"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reset Password (leave empty to keep current)
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="New password"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Role
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="supervisor">Supervisor</option>
                    <option value="data_entry">Data Entry Operator</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as 'active' | 'inactive')}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-950/40"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
