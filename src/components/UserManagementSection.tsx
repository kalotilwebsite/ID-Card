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
      console.error('Failed to load users:', err);
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
      setStatusMessage({ type: 'error', text: 'Name, Username, and Password are required.' });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const created = await apiService.createUser({
        username: newUsername.trim(),
        password: newPassword,
        name: newName.trim(),
        email: newEmail.trim() || undefined,
        employeeId: newEmployeeId.trim() || newUsername.trim(),
        role: newRole,
      });

      setUsers((prev) => [...prev, created]);
      setIsCreateModalOpen(false);
      setNewUsername('');
      setNewPassword('');
      setNewName('');
      setNewEmail('');
      setNewEmployeeId('');
      setStatusMessage({
        type: 'success',
        text: `Authorized account created for ${created.name} (${created.role === 'supervisor' ? `Supervisor ID: ${created.employeeId || created.username}` : `@${created.username}`}).`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to create user account.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEdit = (user: AuthUser) => {
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

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const updated = await apiService.updateUser(editingUser.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        employeeId: editEmployeeId.trim(),
        role: editRole,
        status: editStatus,
        password: editPassword ? editPassword.trim() : undefined,
      });

      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditingUser(null);
      setStatusMessage({
        type: 'success',
        text: `Account for ${updated.name} updated successfully.`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update account.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (user: AuthUser) => {
    if (!window.confirm(`Are you sure you want to delete account "${user.username}" (${user.name})?`)) {
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      await apiService.deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setStatusMessage({ type: 'success', text: `Account "${user.username}" was deleted.` });
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
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
              Admin Only
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-rose-600" />
              <span>Authorized User &amp; Supervisor Management</span>
            </h2>
          </div>
          <p className="text-xs text-slate-600 max-w-2xl">
            Predefine and manage authorized credentials for <strong className="text-purple-700">Supervisors</strong>,{' '}
            <strong className="text-sky-700">Data Entry Operators</strong>, and{' '}
            <strong className="text-rose-700">Administrators</strong>. Supervisors authenticate strictly using their pre-assigned Enrollment ID and password.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setNewRole('supervisor');
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Add Supervisor</span>
          </button>

          <button
            onClick={() => {
              setNewRole('data_entry');
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add User</span>
          </button>

          <button
            onClick={loadUsers}
            className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl transition-colors"
            title="Refresh user list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Role Access Matrix Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Administrator */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-start gap-3 shadow-2xs">
          <div className="p-2 rounded-lg bg-rose-50 text-rose-600 shrink-0 border border-rose-200">
            <Shield className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <h4 className="font-bold text-slate-900 mb-0.5">Administrator</h4>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Full control: Master database management, supervisor access management, print queue approval, card printing, and reprint history.
            </p>
          </div>
        </div>

        {/* Supervisor */}
        <div className="bg-purple-50/50 border border-purple-200 p-4 rounded-xl flex items-start gap-3 shadow-2xs">
          <div className="p-2 rounded-lg bg-purple-100 text-purple-700 shrink-0 border border-purple-200">
            <Briefcase className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <h4 className="font-bold text-purple-900 mb-0.5">Authorized Supervisor</h4>
            <p className="text-purple-800 leading-relaxed text-[11px]">
              Dedicated Supervisor Portal: Authenticates using pre-assigned Enrollment ID &amp; password. Submits employee photo, signature, and NID. Strictly blocked from card preview and printing.
            </p>
          </div>
        </div>

        {/* Data Entry Operator */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-start gap-3 shadow-2xs">
          <div className="p-2 rounded-lg bg-sky-50 text-sky-600 shrink-0 border border-sky-200">
            <Lock className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <h4 className="font-bold text-slate-900 mb-0.5">Data Entry Operator</h4>
            <p className="text-slate-600 leading-relaxed text-[11px]">
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
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-700 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Authorized Accounts ({filteredUsers.length} of {users.length})
          </div>

          {/* Role Filter Tabs */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-2xs">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                roleFilter === 'all'
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({users.length})
            </button>
            <button
              onClick={() => setRoleFilter('supervisor')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                roleFilter === 'supervisor'
                  ? 'bg-purple-100 text-purple-800 font-bold'
                  : 'text-slate-600 hover:text-purple-700'
              }`}
            >
              <Briefcase className="w-3 h-3 text-purple-600" />
              <span>Supervisors ({users.filter((u) => u.role === 'supervisor').length})</span>
            </button>
            <button
              onClick={() => setRoleFilter('data_entry')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                roleFilter === 'data_entry'
                  ? 'bg-sky-100 text-sky-800 font-bold'
                  : 'text-slate-600 hover:text-sky-700'
              }`}
            >
              Data Entry ({users.filter((u) => u.role === 'data_entry').length})
            </button>
            <button
              onClick={() => setRoleFilter('admin')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                roleFilter === 'admin'
                  ? 'bg-rose-100 text-rose-800 font-bold'
                  : 'text-slate-600 hover:text-rose-700'
              }`}
            >
              Admins ({users.filter((u) => u.role === 'admin').length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Login Identifier / Enrollment ID</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{u.name}</div>
                    {u.email && <div className="text-[11px] text-slate-500">{u.email}</div>}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-mono text-slate-800 font-semibold">{u.username}</div>
                    {u.employeeId && u.employeeId !== u.username && (
                      <div className="text-[10px] text-purple-700 font-mono flex items-center gap-1 mt-0.5">
                        <IdCard className="w-3 h-3 text-purple-600" />
                        <span>Enroll ID: {u.employeeId}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {u.role === 'supervisor' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1 w-fit">
                        <Briefcase className="w-3 h-3 text-purple-600" /> Supervisor
                      </span>
                    ) : u.role === 'admin' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 w-fit">
                        <Shield className="w-3 h-3 text-rose-600" /> Admin
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1 w-fit">
                        <Lock className="w-3 h-3 text-sky-600" /> Data Entry
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.status === 'inactive'
                          ? 'bg-slate-100 text-slate-500 border border-slate-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {u.status === 'inactive' ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Initial'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleStartEdit(u)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit account"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete account"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                {newRole === 'supervisor' ? (
                  <Briefcase className="w-4 h-4 text-purple-600" />
                ) : (
                  <UserPlus className="w-4 h-4 text-rose-600" />
                )}
                <span>
                  {newRole === 'supervisor'
                    ? 'Predefine Authorized Supervisor'
                    : 'Create Authorized User Account'}
                </span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-3.5">
              {/* Role Assignment Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
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
                        ? 'bg-purple-50 border-purple-400 text-purple-800 font-bold'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="text-xs font-bold mb-0.5 flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-purple-600" /> Supervisor
                    </div>
                    <div className="text-[9px] leading-tight text-slate-500">Submission portal</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewRole('data_entry')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      newRole === 'data_entry'
                        ? 'bg-sky-50 border-sky-400 text-sky-800 font-bold'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="text-xs font-bold mb-0.5 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-sky-600" /> Data Entry
                    </div>
                    <div className="text-[9px] leading-tight text-slate-500">Standard entry form</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewRole('admin')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      newRole === 'admin'
                        ? 'bg-rose-50 border-rose-400 text-rose-800 font-bold'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="text-xs font-bold mb-0.5 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-rose-600" /> Admin
                    </div>
                    <div className="text-[9px] leading-tight text-slate-500">Full system access</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Faruk Hossain"
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-rose-600 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
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
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-rose-600 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono"
                />
              </div>

              {newRole === 'supervisor' && (
                <div>
                  <label className="block text-xs font-semibold text-purple-900 mb-1 flex items-center gap-1.5">
                    <IdCard className="w-3.5 h-3.5 text-purple-600" />
                    <span>Supervisor Enrollment ID / Employee ID *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newEmployeeId}
                    onChange={(e) => setNewEmployeeId(e.target.value)}
                    placeholder="e.g. SUP-2026-02 or 586668"
                    className="w-full bg-slate-50 border border-purple-300 focus:bg-white focus:border-purple-600 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono"
                  />
                  <p className="text-[10px] text-purple-700 mt-1">
                    Supervisors log into their portal using this Enrollment ID / Employee ID.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Set initial password"
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-rose-600 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="supervisor@company.com"
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-rose-600 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`px-5 py-2 text-white rounded-xl text-xs font-bold shadow-xs ${
                    newRole === 'supervisor'
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-rose-600 hover:bg-rose-700'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-sky-600" /> Edit Authorized Account ({editingUser.username})
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-rose-600 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Supervisor Enrollment ID / Employee ID
                </label>
                <input
                  type="text"
                  value={editEmployeeId}
                  onChange={(e) => setEditEmployeeId(e.target.value)}
                  placeholder="e.g. SUP-2026-01"
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-rose-600 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-rose-600 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Reset Password (leave empty to keep current)
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="New password"
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-rose-600 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Role
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                  >
                    <option value="supervisor">Supervisor</option>
                    <option value="data_entry">Data Entry Operator</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as 'active' | 'inactive')}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs"
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
