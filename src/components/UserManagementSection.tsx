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
  CheckSquare,
  Square,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { AuthUser, UserRole, ALL_APP_TABS, AppTabId } from '../types';

export function UserManagementSection() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'supervisor' | 'data_entry'>('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<AuthUser | null>(null);

  // Form State for Create
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('supervisor');
  const [newAllowedTabs, setNewAllowedTabs] = useState<string[]>(['data_entry_form']);

  // Form State for Edit
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editEmployeeId, setEditEmployeeId] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('supervisor');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [editPassword, setEditPassword] = useState('');
  const [editAllowedTabs, setEditAllowedTabs] = useState<string[]>(['data_entry_form']);

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

    if (newRole === 'data_entry' && newAllowedTabs.length === 0) {
      setStatusMessage({ type: 'error', text: 'Please select at least one accessible tab for this Data Entry user.' });
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
        allowedTabs: newRole === 'data_entry' ? newAllowedTabs : undefined,
      });

      setUsers((prev) => [...prev, created]);
      setIsCreateModalOpen(false);
      setNewUsername('');
      setNewPassword('');
      setNewName('');
      setNewEmail('');
      setNewEmployeeId('');
      setNewAllowedTabs(['data_entry_form']);
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
    setEditAllowedTabs(
      Array.isArray(user.allowedTabs) && user.allowedTabs.length > 0
        ? [...user.allowedTabs]
        : ['data_entry_form']
    );
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (editRole === 'data_entry' && editAllowedTabs.length === 0) {
      setStatusMessage({ type: 'error', text: 'Please select at least one accessible tab for this Data Entry user.' });
      return;
    }

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
        allowedTabs: editRole === 'data_entry' ? editAllowedTabs : undefined,
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

  const handleConfirmDelete = async () => {
    if (!deleteConfirmUser) return;
    const target = deleteConfirmUser;

    setIsLoading(true);
    setStatusMessage(null);

    try {
      await apiService.deleteUser(target.id);
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
      setStatusMessage({ type: 'success', text: `Account "${target.username}" was deleted successfully.` });
      setDeleteConfirmUser(null);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to delete user.' });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTabPermission = (tabId: string, isCreate: boolean) => {
    if (isCreate) {
      setNewAllowedTabs((prev) =>
        prev.includes(tabId) ? prev.filter((t) => t !== tabId) : [...prev, tabId]
      );
    } else {
      setEditAllowedTabs((prev) =>
        prev.includes(tabId) ? prev.filter((t) => t !== tabId) : [...prev, tabId]
      );
    }
  };

  const selectAllTabs = (isCreate: boolean) => {
    const all = ALL_APP_TABS.map((t) => t.id);
    if (isCreate) setNewAllowedTabs(all);
    else setEditAllowedTabs(all);
  };

  const clearAllTabs = (isCreate: boolean) => {
    if (isCreate) setNewAllowedTabs([]);
    else setEditAllowedTabs([]);
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter === 'all') return true;
    return u.role === roleFilter;
  });

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
      {/* Compact Top Action Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>User Management</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {users.length} Total
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Manage accounts and tab permissions for Administrators, Supervisors, and Data Entry users.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setNewRole('supervisor');
              setNewAllowedTabs(['supervisor_submission']);
              setIsCreateModalOpen(true);
            }}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Add Supervisor</span>
          </button>

          <button
            onClick={() => {
              setNewRole('data_entry');
              setNewAllowedTabs(['data_entry_form']);
              setIsCreateModalOpen(true);
            }}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add User</span>
          </button>

          <button
            onClick={loadUsers}
            className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl transition-colors"
            title="Refresh user accounts"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
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
        <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
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
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                roleFilter === 'data_entry'
                  ? 'bg-sky-100 text-sky-800 font-bold'
                  : 'text-slate-600 hover:text-sky-700'
              }`}
            >
              <Lock className="w-3 h-3 text-sky-600" />
              <span>Data Entry ({users.filter((u) => u.role === 'data_entry').length})</span>
            </button>
            <button
              onClick={() => setRoleFilter('admin')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                roleFilter === 'admin'
                  ? 'bg-rose-100 text-rose-800 font-bold'
                  : 'text-slate-600 hover:text-rose-700'
              }`}
            >
              <Shield className="w-3 h-3 text-rose-600" />
              <span>Admins ({users.filter((u) => u.role === 'admin').length})</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Identifier / ID</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Tab Permissions</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => {
                const userTabs = u.role === 'admin'
                  ? ALL_APP_TABS.map((t) => t.id)
                  : u.role === 'supervisor'
                  ? ['supervisor_submission']
                  : (u.allowedTabs || ['data_entry_form']);

                return (
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
                          <span>ID: {u.employeeId}</span>
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
                      {u.role === 'admin' ? (
                        <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md inline-block">
                          Full Access (All 6 Tabs)
                        </span>
                      ) : u.role === 'supervisor' ? (
                        <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md inline-block">
                          Supervisor Entry Only
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-sm">
                          {userTabs.length === 6 ? (
                            <span className="text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                              All 6 Tabs Granted
                            </span>
                          ) : userTabs.length === 0 ? (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                              No Tabs Assigned
                            </span>
                          ) : (
                            userTabs.map((tabId) => {
                              const tabDef = ALL_APP_TABS.find((t) => t.id === tabId);
                              const shortName = tabDef?.label.replace(/^\d+\.\s*/, '') || tabId;
                              return (
                                <span
                                  key={tabId}
                                  className="text-[10px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded"
                                  title={tabDef?.label}
                                >
                                  {shortName}
                                </span>
                              );
                            })
                          )}
                        </div>
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
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleStartEdit(u)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit account & permissions"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmUser(u)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* In-App Delete Confirmation Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete User Account</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Are you sure you want to delete user account <strong className="text-slate-900">{deleteConfirmUser.name}</strong> (@{deleteConfirmUser.username})?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isLoading}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                {newRole === 'supervisor' ? (
                  <Briefcase className="w-4 h-4 text-purple-600" />
                ) : newRole === 'admin' ? (
                  <Shield className="w-4 h-4 text-rose-600" />
                ) : (
                  <UserPlus className="w-4 h-4 text-sky-600" />
                )}
                <span>Create User Account</span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-3.5 overflow-y-auto">
              {/* Role Assignment Selector: exactly 3 roles */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  User Role *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewRole('admin');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      newRole === 'admin'
                        ? 'bg-rose-50 border-rose-400 text-rose-800 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold mb-0.5 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-rose-600" /> Admin
                    </div>
                    <div className="text-[10px] text-slate-500">Full system access</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewRole('supervisor');
                      if (!newEmployeeId && newUsername) setNewEmployeeId(newUsername);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      newRole === 'supervisor'
                        ? 'bg-purple-50 border-purple-400 text-purple-800 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold mb-0.5 flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-purple-600" /> Supervisor
                    </div>
                    <div className="text-[10px] text-slate-500">Supervisor portal</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewRole('data_entry')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      newRole === 'data_entry'
                        ? 'bg-sky-50 border-sky-400 text-sky-800 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold mb-0.5 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-sky-600" /> Data Entry
                    </div>
                    <div className="text-[10px] text-slate-500">Tab permissions</div>
                  </button>
                </div>
              </div>

              {/* Data Entry Tab Permission Selector */}
              {newRole === 'data_entry' && (
                <div className="bg-sky-50/60 border border-sky-200 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-sky-600" />
                        <span>Tab Permissions (Select accessible tabs)</span>
                      </h4>
                      <p className="text-[10px] text-sky-800">
                        Unchecked tabs will be hidden and blocked for this user.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => selectAllTabs(true)}
                        className="text-[10px] font-bold text-sky-700 hover:text-sky-900 underline"
                      >
                        Select All
                      </button>
                      <span className="text-sky-300">|</span>
                      <button
                        type="button"
                        onClick={() => clearAllTabs(true)}
                        className="text-[10px] font-bold text-sky-700 hover:text-sky-900 underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {ALL_APP_TABS.map((tab) => {
                      const isChecked = newAllowedTabs.includes(tab.id);
                      return (
                        <label
                          key={tab.id}
                          className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-white border-sky-400 text-slate-900 font-medium shadow-2xs'
                              : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleTabPermission(tab.id, true)}
                            className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                          <div className="leading-tight">
                            <div className="font-semibold text-slate-800 text-[11px]">{tab.label}</div>
                            <div className="text-[9px] text-slate-500">{tab.description}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

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
                  Username *
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
                  placeholder="e.g. operator2 or supervisor2"
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
                  placeholder="Set account password"
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
                  placeholder="user@company.com"
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-rose-600 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
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
                      : newRole === 'admin'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-sky-600" />
                <span>Edit Account ({editingUser.username})</span>
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-5 space-y-3.5 overflow-y-auto">
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
                  Enrollment ID / Employee ID
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Role *
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 font-medium"
                  >
                    <option value="admin">Admin</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="data_entry">Data Entry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as 'active' | 'inactive')}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 font-medium"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Data Entry Tab Permission Selector in Edit Mode */}
              {editRole === 'data_entry' && (
                <div className="bg-sky-50/60 border border-sky-200 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-sky-600" />
                        <span>Tab Permissions (Select accessible tabs)</span>
                      </h4>
                      <p className="text-[10px] text-sky-800">
                        Unchecked tabs remain completely hidden and blocked from this user.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => selectAllTabs(false)}
                        className="text-[10px] font-bold text-sky-700 hover:text-sky-900 underline"
                      >
                        Select All
                      </button>
                      <span className="text-sky-300">|</span>
                      <button
                        type="button"
                        onClick={() => clearAllTabs(false)}
                        className="text-[10px] font-bold text-sky-700 hover:text-sky-900 underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {ALL_APP_TABS.map((tab) => {
                      const isChecked = editAllowedTabs.includes(tab.id);
                      return (
                        <label
                          key={tab.id}
                          className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-white border-sky-400 text-slate-900 font-medium shadow-2xs'
                              : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleTabPermission(tab.id, false)}
                            className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                          <div className="leading-tight">
                            <div className="font-semibold text-slate-800 text-[11px]">{tab.label}</div>
                            <div className="text-[9px] text-slate-500">{tab.description}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Change Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Enter new password to change"
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-rose-600 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
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
