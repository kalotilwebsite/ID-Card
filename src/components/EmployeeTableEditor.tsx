import React, { useState } from 'react';
import { EmployeeCardData } from '../types';
import {
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
  Edit2,
  Image as ImageIcon,
  Check,
  X,
} from 'lucide-react';

interface EmployeeTableEditorProps {
  employees: EmployeeCardData[];
  onUpdateEmployees: (employees: EmployeeCardData[]) => void;
  onSelectEmployeeForPreview: (employeeId: string) => void;
  selectedEmployeeId?: string;
}

export const EmployeeTableEditor: React.FC<EmployeeTableEditorProps> = ({
  employees,
  onUpdateEmployees,
  onSelectEmployeeForPreview,
  selectedEmployeeId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'valid' | 'invalid'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<EmployeeCardData>>({});

  const validateEmployee = (emp: EmployeeCardData): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    if (!emp.name || emp.name.trim() === '') errors.push('Name is required');
    if (!emp.designation || emp.designation.trim() === '') errors.push('Designation is required');
    if (!emp.department || emp.department.trim() === '') errors.push('Department is required');
    if (!emp.enrollId || emp.enrollId.trim() === '') errors.push('Enroll ID is required');

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.enrollId.toLowerCase().includes(searchTerm.toLowerCase());

    const { isValid } = validateEmployee(emp);

    if (filterStatus === 'valid') return matchesSearch && isValid;
    if (filterStatus === 'invalid') return matchesSearch && !isValid;
    return matchesSearch;
  });

  const validCount = employees.filter((e) => validateEmployee(e).isValid).length;
  const invalidCount = employees.length - validCount;

  const handleStartEdit = (emp: EmployeeCardData) => {
    setEditingId(emp.id);
    setEditFormData({ ...emp });
  };

  const handleSaveEdit = (id: string) => {
    const updated = employees.map((emp) => {
      if (emp.id === id) {
        const merged = { ...emp, ...editFormData } as EmployeeCardData;
        const validation = validateEmployee(merged);
        return {
          ...merged,
          isValid: validation.isValid,
          validationErrors: validation.errors,
        };
      }
      return emp;
    });
    onUpdateEmployees(updated);
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const handleDeleteEmployee = (id: string) => {
    if (window.confirm('Delete this employee card?')) {
      onUpdateEmployees(employees.filter((e) => e.id !== id));
    }
  };

  const handleAddNewEmployee = () => {
    const newEmp: EmployeeCardData = {
      id: `emp-${Date.now()}`,
      name: 'NEW EMPLOYEE',
      designation: 'Staff',
      department: 'General',
      jobType: 'Permanent',
      joiningDate: new Date().toLocaleDateString('en-GB'),
      enrollId: String(Math.floor(100000 + Math.random() * 900000)),
      cardIssue: new Date().toLocaleDateString('en-GB'),
      permanentAddress: 'Mukkhopur, Trishal, Mymensingh',
      emergencyContact: '01920-694100',
      nationalId: '',
      bloodGroup: 'O+',
      isValid: true,
    };
    onUpdateEmployees([newEmp, ...employees]);
    onSelectEmployeeForPreview(newEmp.id);
    handleStartEdit(newEmp);
  };

  const handlePhotoUpload = (empId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const updated = employees.map((emp) =>
        emp.id === empId ? { ...emp, photoUrl: dataUrl } : emp
      );
      onUpdateEmployees(updated);
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureUpload = (empId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const updated = employees.map((emp) =>
        emp.id === empId ? { ...emp, signatureUrl: dataUrl } : emp
      );
      onUpdateEmployees(updated);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
      {/* Top Toolbar */}
      <div className="p-4 border-b border-gray-200 bg-gray-50/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search name, ID, department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        {/* Filter Pills and Add Button */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-gray-200/70 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                filterStatus === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All ({employees.length})
            </button>
            <button
              onClick={() => setFilterStatus('valid')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors flex items-center gap-1 ${
                filterStatus === 'valid'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <CheckCircle className="w-3 h-3 text-emerald-600" />
              Valid ({validCount})
            </button>
            {invalidCount > 0 && (
              <button
                onClick={() => setFilterStatus('invalid')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors flex items-center gap-1 ${
                  filterStatus === 'invalid'
                    ? 'bg-white text-rose-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <AlertTriangle className="w-3 h-3 text-rose-600" />
                Issues ({invalidCount})
              </button>
            )}
          </div>

          <button
            onClick={handleAddNewEmployee}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Row
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto flex-1 min-h-[300px]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100/70 text-gray-600 uppercase text-[10px] font-bold tracking-wider border-b border-gray-200 sticky top-0 z-10 backdrop-blur-sm">
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Photo</th>
              <th className="py-2.5 px-3">Sign</th>
              <th className="py-2.5 px-3">Name</th>
              <th className="py-2.5 px-3">Designation</th>
              <th className="py-2.5 px-3">Department</th>
              <th className="py-2.5 px-3">Enroll ID</th>
              <th className="py-2.5 px-3">Job Type</th>
              <th className="py-2.5 px-3">Blood</th>
              <th className="py-2.5 px-3">NID</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredEmployees.map((emp) => {
              const validation = validateEmployee(emp);
              const isSelected = emp.id === selectedEmployeeId;
              const isEditing = emp.id === editingId;

              return (
                <tr
                  key={emp.id}
                  onClick={() => onSelectEmployeeForPreview(emp.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-rose-50/70 font-medium'
                      : !validation.isValid
                      ? 'bg-red-50/30 hover:bg-red-50/50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Status Indicator */}
                  <td className="py-2 px-3">
                    {validation.isValid ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        Ready
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] text-rose-600 font-semibold"
                        title={validation.errors.join(', ')}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        Missing info
                      </span>
                    )}
                  </td>

                  {/* Photo thumbnail / upload */}
                  <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                    <div className="relative group w-8 h-10 rounded border border-gray-300 bg-gray-100 overflow-hidden flex items-center justify-center">
                      {emp.photoUrl ? (
                        <img
                          src={emp.photoUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-gray-400" />
                      )}
                      <label
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white text-[8px] font-bold"
                        title="Upload/Change Photo"
                      >
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handlePhotoUpload(emp.id, e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </td>

                  {/* Signature thumbnail / upload */}
                  <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                    <div className="relative group w-12 h-8 rounded border border-gray-300 bg-gray-50 overflow-hidden flex items-center justify-center">
                      {emp.signatureUrl ? (
                        <img
                          src={emp.signatureUrl}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-[8px] text-gray-400 font-medium">None</span>
                      )}
                      <label
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white text-[8px] font-bold"
                        title="Upload/Change Signature"
                      >
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleSignatureUpload(emp.id, e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </td>

                  {/* Name */}
                  <td className="py-2 px-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editFormData.name || ''}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, name: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                      />
                    ) : (
                      <span className="font-bold text-gray-900">{emp.name}</span>
                    )}
                  </td>

                  {/* Designation */}
                  <td className="py-2 px-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editFormData.designation || ''}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, designation: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                      />
                    ) : (
                      <span className="text-gray-700">{emp.designation}</span>
                    )}
                  </td>

                  {/* Department */}
                  <td className="py-2 px-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editFormData.department || ''}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, department: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                      />
                    ) : (
                      <span className="text-gray-700">{emp.department}</span>
                    )}
                  </td>

                  {/* Enroll ID */}
                  <td className="py-2 px-3 font-mono">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editFormData.enrollId || ''}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, enrollId: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                      />
                    ) : (
                      <span className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-bold">
                        {emp.enrollId}
                      </span>
                    )}
                  </td>

                  {/* Job Type */}
                  <td className="py-2 px-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editFormData.jobType || ''}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, jobType: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                      />
                    ) : (
                      <span className="text-gray-600">{emp.jobType}</span>
                    )}
                  </td>

                  {/* Blood Group */}
                  <td className="py-2 px-3 font-semibold text-rose-700">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editFormData.bloodGroup || ''}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, bloodGroup: e.target.value })
                        }
                        className="w-16 border border-gray-300 rounded px-2 py-1 text-xs"
                      />
                    ) : (
                      emp.bloodGroup || '-'
                    )}
                  </td>

                  {/* National ID */}
                  <td className="py-2 px-3 font-mono text-[11px] text-gray-600">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editFormData.nationalId || ''}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, nationalId: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                      />
                    ) : (
                      emp.nationalId || '-'
                    )}
                  </td>

                  {/* Row Actions */}
                  <td className="py-2 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleSaveEdit(emp.id)}
                          className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white"
                          title="Save"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleStartEdit(emp)}
                          className="p-1.5 rounded hover:bg-gray-200 text-gray-600 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp.id)}
                          className="p-1.5 rounded hover:bg-red-100 text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="p-3 bg-gray-50 border-t border-gray-200 text-[11px] text-gray-500 flex items-center justify-between">
        <span>
          Showing {filteredEmployees.length} of {employees.length} employee records
        </span>
        <span>Click any row to view instant card preview on the right</span>
      </div>
    </div>
  );
};
