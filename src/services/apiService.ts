import { AuthUser, UserRole, MasterEmployee, SubmissionRecord } from '../types';

const TOKEN_KEY = 'idcard_auth_token';
const USER_KEY = 'idcard_auth_user';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (e) {
    console.error('Storage error:', e);
  }
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser | null) {
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch (e) {
    console.error('Storage error:', e);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}, retryOn401 = true): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      setStoredToken(null);
      setStoredUser(null);
    }

    const errorMsg = data?.error || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg) as any;
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data as T;
}

export const apiService = {
  // Auth
  async login(username: string, password: string): Promise<{ user: AuthUser; token: string }> {
    const res = await request<{ user: AuthUser; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }, false);
    setStoredToken(res.token);
    setStoredUser(res.user);
    return res;
  },

  async supervisorLogin(employeeId: string, password: string): Promise<{ user: AuthUser; token: string }> {
    const res = await request<{ user: AuthUser; token: string }>('/api/auth/supervisor-login', {
      method: 'POST',
      body: JSON.stringify({ employeeId, password }),
    }, false);
    setStoredToken(res.token);
    setStoredUser(res.user);
    return res;
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const res = await request<{ user: AuthUser }>('/api/auth/me', {}, false);
      setStoredUser(res.user);
      return res.user;
    } catch {
      setStoredToken(null);
      setStoredUser(null);
      return null;
    }
  },

  logout() {
    try {
      const token = getStoredToken();
      if (token) {
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    } catch {}
    setStoredToken(null);
    setStoredUser(null);
  },

  // Users Management (Admin)
  async getUsers(): Promise<AuthUser[]> {
    return request<AuthUser[]>('/api/users');
  },

  async createUser(userData: {
    username: string;
    password: string;
    name: string;
    email?: string;
    employeeId?: string;
    role: UserRole;
  }): Promise<AuthUser> {
    return request<AuthUser>('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  async updateUser(
    id: string,
    userData: {
      name?: string;
      email?: string;
      employeeId?: string;
      role?: UserRole;
      status?: 'active' | 'inactive';
      password?: string;
    }
  ): Promise<AuthUser> {
    return request<AuthUser>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  async deleteUser(id: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/api/users/${id}`, {
      method: 'DELETE',
    });
  },

  // Master Employees (Admin)
  async getMasterEmployees(): Promise<MasterEmployee[]> {
    return request<MasterEmployee[]>('/api/master-employees');
  },

  async importMasterEmployees(
    employees: Partial<MasterEmployee>[]
  ): Promise<{
    success: boolean;
    message: string;
    totalRecords: number;
    summary?: {
      total: number;
      successful: number;
      duplicates: number;
      failed: number;
    };
    sampleDuplicates?: string[];
    sampleFailed?: string[];
  }> {
    return request<{
      success: boolean;
      message: string;
      totalRecords: number;
      summary?: {
        total: number;
        successful: number;
        duplicates: number;
        failed: number;
      };
      sampleDuplicates?: string[];
      sampleFailed?: string[];
    }>(
      '/api/master-employees/import',
      {
        method: 'POST',
        body: JSON.stringify({ employees }),
      }
    );
  },

  async updateMasterEmployee(
    enrollId: string,
    data: Partial<MasterEmployee>
  ): Promise<{ success: boolean; message: string; employee: MasterEmployee }> {
    return request<{ success: boolean; message: string; employee: MasterEmployee }>(
      `/api/master-employees/${encodeURIComponent(enrollId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  },

  async deleteMasterEmployee(enrollId: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/api/master-employees/${encodeURIComponent(enrollId)}`, {
      method: 'DELETE',
    });
  },

  async clearMasterEmployees(): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>('/api/master-employees', {
      method: 'DELETE',
    });
  },

  // Employee Lookup (Data Entry & Admin)
  async lookupEmployee(enrollId: string): Promise<{
    found: boolean;
    employee: MasterEmployee;
    alreadySubmitted: boolean;
    submissionInfo?: {
      submittedAt: string;
      submittedBy: string;
      nationalId?: string;
      hasPhoto?: boolean;
      hasSignature?: boolean;
    } | null;
  }> {
    return request(`/api/lookup-employee/${encodeURIComponent(enrollId.trim())}`);
  },

  // Submissions
  async submitDataEntry(data: {
    enrollId: string;
    nationalId: string;
    photoUrl: string;
    signatureUrl: string;
  }): Promise<{ success: boolean; message: string; submission: any }> {
    return request('/api/submissions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getSubmissions(): Promise<SubmissionRecord[]> {
    return request<SubmissionRecord[]>('/api/submissions');
  },

  async deleteSubmission(enrollId: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/api/submissions/${encodeURIComponent(enrollId)}`, {
      method: 'DELETE',
    });
  },

  async markSubmissionPrinted(enrollId: string, note?: string): Promise<{ success: boolean; message: string; record: SubmissionRecord }> {
    return request<{ success: boolean; message: string; record: SubmissionRecord }>(
      `/api/submissions/${encodeURIComponent(enrollId)}/mark-printed`,
      {
        method: 'POST',
        body: JSON.stringify({ note }),
      }
    );
  },

  async reprintSubmission(enrollId: string, note?: string): Promise<{ success: boolean; message: string; record: SubmissionRecord }> {
    return request<{ success: boolean; message: string; record: SubmissionRecord }>(
      `/api/submissions/${encodeURIComponent(enrollId)}/reprint`,
      {
        method: 'POST',
        body: JSON.stringify({ note }),
      }
    );
  },

  async bulkMarkPrinted(enrollIds: string[], note?: string): Promise<{ success: boolean; message: string; updatedCount: number }> {
    return request<{ success: boolean; message: string; updatedCount: number }>('/api/submissions/bulk-mark-printed', {
      method: 'POST',
      body: JSON.stringify({ enrollIds, note }),
    });
  },

  // Settings
  async getPublicSettings(): Promise<{
    supervisorSuccessMessage: string;
    supervisorFormEnabled: boolean;
    supervisorFormDisabledMessage: string;
    pdfPrintLayout: 'side_by_side' | 'top_bottom';
  }> {
    return request<{
      supervisorSuccessMessage: string;
      supervisorFormEnabled: boolean;
      supervisorFormDisabledMessage: string;
      pdfPrintLayout: 'side_by_side' | 'top_bottom';
    }>('/api/settings/public');
  },

  async getAdminSettings(): Promise<{
    supervisorSuccessMessage: string;
    supervisorFormEnabled: boolean;
    supervisorFormDisabledMessage: string;
    pdfPrintLayout: 'side_by_side' | 'top_bottom';
  }> {
    return request<{
      supervisorSuccessMessage: string;
      supervisorFormEnabled: boolean;
      supervisorFormDisabledMessage: string;
      pdfPrintLayout: 'side_by_side' | 'top_bottom';
    }>('/api/settings');
  },

  async updateAdminSettings(settings: {
    supervisorSuccessMessage?: string;
    supervisorFormEnabled?: boolean;
    supervisorFormDisabledMessage?: string;
    pdfPrintLayout?: 'side_by_side' | 'top_bottom';
  }): Promise<{
    supervisorSuccessMessage: string;
    supervisorFormEnabled: boolean;
    supervisorFormDisabledMessage: string;
    pdfPrintLayout: 'side_by_side' | 'top_bottom';
  }> {
    return request<{
      supervisorSuccessMessage: string;
      supervisorFormEnabled: boolean;
      supervisorFormDisabledMessage: string;
      pdfPrintLayout: 'side_by_side' | 'top_bottom';
    }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },
};
