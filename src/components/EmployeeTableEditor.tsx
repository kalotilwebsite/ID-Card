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
  Clock,
  Download,
  Loader2,
  AlertCircle,
  FileDown,
} from 'lucide-react';

interface EmployeeTableEditorProps {
  employees: EmployeeCardData[];
  onUpdateEmployees: (employees: EmployeeCardData[]) => void;
  onSelectEmployeeForPreview: (employeeId: string) => void;
  selectedEmployeeId?: string;
  selectedCardIds?: Set<string>;
  onToggleSelectCard?: (employeeId: string) => void;
  onSelectAllCards?: (ids: string[]) => void;
  onClearSelectedCards?: () => void;
  onBulkPdfDownload?: () => void;
  isBulkPdfGenerating?: boolean;
}

export const EmployeeTableEditor: React.FC<EmployeeTableEditorProps> = ({
  employees,
  onUpdateEmployees,
  onSelectEmployeeForPreview,
  selectedEmployeeId,
  selectedCardIds = new Set(),
  onToggleSelectCard,
  onSelectAllCards,
  onClearSelectedCards,
  onBulkPdfDownload,
  isBulkPdfGenerating = false,
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

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmployeeForm, setNewEmployeeForm] = useState({
    name: '',
    designation: '',
    department: '',
    jobType: 'Permanent',
    joiningDate: '01/03/2026',
    enrollId: '',
    cardIssue: '19/10/2026',
    permanentAddress: 'Mukkhopur, Trishal, Mymensingh',
    emergencyContact: '01920-694100',
    nationalId: '',
    bloodGroup: 'O+',
    photoUrl: '',
    signatureUrl: '',
  });
  const [addFormErrors, setAddFormErrors] = useState<string[]>([]);

  const formatToCardDate = (dateVal: string): string => {
    if (!dateVal || !dateVal.trim()) return '';
    const trimmed = dateVal.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-');
      return `${d}/${m}/${y}`;
    }
    return trimmed;
  };

  const formatToInputDate = (dateVal: string): string => {
    if (!dateVal || !dateVal.trim()) return '';
    const match = dateVal.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (match) {
      const d = match[1].padStart(2, '0');
      const m = match[2].padStart(2, '0');
      const y = match[3];
      return `${y}-${m}-${d}`;
    }
    return '';
  };

  const handleOpenAddModal = () => {
    setNewEmployeeForm({
      name: '',
      designation: '',
      department: '',
      jobType: 'Permanent',
      joiningDate: '01/03/2026',
      enrollId: String(Math.floor(100000 + Math.random() * 900000)),
      cardIssue: '19/10/2026',
      permanentAddress: 'Mukkhopur, Trishal, Mymensingh',
      emergencyContact: '01920-694100',
      nationalId: '',
      bloodGroup: 'O+',
      photoUrl: '',
      signatureUrl: '',
    });
    setAddFormErrors([]);
    setIsAddModalOpen(true);
  };

  const handleSaveNewEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];
    if (!newEmployeeForm.name.trim()) errors.push('Employee Name is required');
    if (!newEmployeeForm.designation.trim()) errors.push('Designation is required');
    if (!newEmployeeForm.department.trim()) errors.push('Department is required');
    if (!newEmployeeForm.enrollId.trim()) errors.push('Enroll ID is required');

    if (errors.length > 0) {
      setAddFormErrors(errors);
      return;
    }

    const newEmp: EmployeeCardData = {
      id: `emp-${Date.now()}`,
      name: newEmployeeForm.name.trim(),
      designation: newEmployeeForm.designation.trim(),
      department: newEmployeeForm.department.trim(),
      jobType: newEmployeeForm.jobType.trim() || 'Permanent',
      joiningDate: formatToCardDate(newEmployeeForm.joiningDate) || '01/03/2026',
      enrollId: newEmployeeForm.enrollId.trim(),
      cardIssue: formatToCardDate(newEmployeeForm.cardIssue) || '19/10/2026',
      permanentAddress: newEmployeeForm.permanentAddress.trim() || 'Mukkhopur, Trishal, Mymensingh',
      emergencyContact: newEmployeeForm.emergencyContact.trim() || '01920-694100',
      nationalId: newEmployeeForm.nationalId.trim(),
      bloodGroup: newEmployeeForm.bloodGroup.trim() || 'O+',
      photoUrl: newEmployeeForm.photoUrl || undefined,
      signatureUrl: newEmployeeForm.signatureUrl || undefined,
      isValid: true,
    };

    onUpdateEmployees([newEmp, ...employees]);
    onSelectEmployeeForPreview(newEmp.id);
    setIsAddModalOpen(false);
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
            onClick={handleOpenAddModal}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Employee
          </button>
        </div>
      </div>

      {/* Bulk Selection Bar */}
      <div className="px-4 py-2 bg-slate-50 border-t border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-700">
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold mr-1">
              {selectedCardIds.size}
            </span>
            card{selectedCardIds.size === 1 ? '' : 's'} selected
          </span>

          {selectedCardIds.size > 18 ? (
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-700 border border-rose-300 flex items-center gap-1.5 animate-pulse">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              Maximum 18 cards per PDF download. Please select no more than 18 cards.
            </span>
          ) : selectedCardIds.size > 0 ? (
            <span className="text-[11px] text-gray-500 font-medium">
              (Will generate {Math.ceil(selectedCardIds.size / 6)} landscape page{Math.ceil(selectedCardIds.size / 6) === 1 ? '' : 's'}, 6 cards/page)
            </span>
          ) : (
            <span className="text-[11px] text-gray-500">
              (Select up to 18 cards for bulk landscape PDF download)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {employees.length > 18 && (
            <button
              type="button"
              onClick={() => {
                const first18 = filteredEmployees.slice(0, 18).map((e) => e.id);
                onSelectAllCards?.(first18);
              }}
              className="px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-700 transition-colors"
            >
              Select First 18
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const allFiltered = filteredEmployees.map((e) => e.id);
              onSelectAllCards?.(allFiltered);
            }}
            className="px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-700 transition-colors"
          >
            Select All
          </button>

          {selectedCardIds.size > 0 && (
            <button
              type="button"
              onClick={() => onClearSelectedCards?.()}
              className="px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-500 hover:text-gray-800 transition-colors"
            >
              Clear
            </button>
          )}

          {onBulkPdfDownload && (
            <button
              type="button"
              onClick={onBulkPdfDownload}
              disabled={isBulkPdfGenerating || selectedCardIds.size === 0 || selectedCardIds.size > 18}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
              title={
                selectedCardIds.size > 18
                  ? 'Maximum 18 cards allowed per PDF download'
                  : selectedCardIds.size === 0
                  ? 'Select cards to download'
                  : 'Download selected cards as print-ready landscape PDF'
              }
            >
              {isBulkPdfGenerating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              <span>Bulk PDF Download{selectedCardIds.size > 0 ? ` (${selectedCardIds.size})` : ''}</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto flex-1 min-h-[300px]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100/70 text-gray-600 uppercase text-[10px] font-bold tracking-wider border-b border-gray-200 sticky top-0 z-10 backdrop-blur-sm">
              <th className="py-2.5 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  aria-label="Select all visible cards"
                  title="Select all visible cards"
                  checked={
                    filteredEmployees.length > 0 &&
                    filteredEmployees.every((e) => selectedCardIds.has(e.id))
                  }
                  onChange={() => {
                    const allSelected = filteredEmployees.every((e) => selectedCardIds.has(e.id));
                    if (allSelected) {
                      onClearSelectedCards?.();
                    } else {
                      onSelectAllCards?.(filteredEmployees.map((e) => e.id));
                    }
                  }}
                  className="rounded border-gray-300 text-rose-600 focus:ring-rose-500 cursor-pointer w-4 h-4"
                />
              </th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Photo</th>
              <th className="py-2.5 px-3">Sign</th>
              <th className="py-2.5 px-3">Name</th>
              <th className="py-2.5 px-3">Designation</th>
              <th className="py-2.5 px-3">Department</th>
              <th className="py-2.5 px-3">Enroll ID</th>
              <th className="py-2.5 px-3">Job Type</th>
              <th className="py-2.5 px-3">Join Date</th>
              <th className="py-2.5 px-3">Card Issue</th>
              <th className="py-2.5 px-3">Blood</th>
              <th className="py-2.5 px-3">NID</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredEmployees.map((emp) => {
              const validation = validateEmployee(emp);
              const isSelected = emp.id === selectedEmployeeId;
              const isChecked = selectedCardIds.has(emp.id);
              const isEditing = emp.id === editingId;

              return (
                <tr
                  key={emp.id}
                  onClick={() => onSelectEmployeeForPreview(emp.id)}
                  className={`cursor-pointer transition-colors ${
                    isChecked
                      ? 'bg-rose-50/50 hover:bg-rose-50/80 font-medium'
                      : isSelected
                      ? 'bg-rose-50/30 font-medium'
                      : !validation.isValid
                      ? 'bg-red-50/30 hover:bg-red-50/50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Card Checkbox */}
                  <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select card for ${emp.name}`}
                      checked={isChecked}
                      onChange={() => onToggleSelectCard?.(emp.id)}
                      className="rounded border-gray-300 text-rose-600 focus:ring-rose-500 cursor-pointer w-4 h-4"
                    />
                  </td>

                  {/* Status Indicator */}
                  <td className="py-2 px-3">
                    {emp.printStatus === 'printed' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        Print OK
                      </span>
                    ) : emp.printStatus === 'pending' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3 h-3 text-amber-600" />
                        Print Pending
                      </span>
                    ) : validation.isValid ? (
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
                        style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                        className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs text-slate-900 font-bold focus:border-rose-500 focus:outline-none"
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
                        style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                        className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs text-slate-900 font-semibold focus:border-rose-500 focus:outline-none"
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
                        style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                        className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs text-slate-900 font-semibold focus:border-rose-500 focus:outline-none"
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
                        style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                        className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs font-mono text-slate-900 font-bold focus:border-rose-500 focus:outline-none"
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
                        style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                        className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs text-slate-900 font-medium focus:border-rose-500 focus:outline-none"
                      />
                    ) : (
                      <span className="text-gray-600">{emp.jobType}</span>
                    )}
                  </td>

                  {/* Join Date */}
                  <td className="py-2 px-3 font-mono text-[11px]">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editFormData.joiningDate || ''}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, joiningDate: e.target.value })
                        }
                        placeholder="DD/MM/YYYY"
                        style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                        className="w-24 bg-white border border-gray-300 rounded px-2 py-1 text-xs font-mono text-slate-900 font-bold focus:border-rose-500 focus:outline-none"
                      />
                    ) : (
                      <span className="text-gray-700">{emp.joiningDate || '-'}</span>
                    )}
                  </td>

                  {/* Card Issue Date */}
                  <td className="py-2 px-3 font-mono text-[11px]">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editFormData.cardIssue || ''}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, cardIssue: e.target.value })
                        }
                        placeholder="DD/MM/YYYY"
                        style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                        className="w-24 bg-white border border-gray-300 rounded px-2 py-1 text-xs font-mono text-slate-900 font-bold focus:border-rose-500 focus:outline-none"
                      />
                    ) : (
                      <span className="text-gray-700">{emp.cardIssue || '-'}</span>
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
                        style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                        className="w-16 bg-white border border-gray-300 rounded px-2 py-1 text-xs text-slate-900 font-bold focus:border-rose-500 focus:outline-none"
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

      {/* Add New Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-black p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Add New Employee</h2>
                  <p className="text-xs text-gray-300">
                    Create an ID card with custom details and manual dates
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveNewEmployee} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {addFormErrors.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 space-y-1">
                  {addFormErrors.map((err, i) => (
                    <div key={i} className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Employee Name */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-800">
                    Employee Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. JONAID AL AKANDH AKANDH"
                    value={newEmployeeForm.name}
                    onChange={(e) =>
                      setNewEmployeeForm({ ...newEmployeeForm, name: e.target.value })
                    }
                    style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 placeholder:text-gray-400 placeholder:font-normal focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
                  />
                </div>

                {/* Designation */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-800">
                    Designation / Role <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Asst.Caster"
                    value={newEmployeeForm.designation}
                    onChange={(e) =>
                      setNewEmployeeForm({ ...newEmployeeForm, designation: e.target.value })
                    }
                    style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 placeholder:text-gray-400 placeholder:font-normal focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
                  />
                </div>

                {/* Department */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-800">
                    Department <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Casting"
                    value={newEmployeeForm.department}
                    onChange={(e) =>
                      setNewEmployeeForm({ ...newEmployeeForm, department: e.target.value })
                    }
                    style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 placeholder:text-gray-400 placeholder:font-normal focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
                  />
                </div>

                {/* Enroll ID */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-800">
                    Enroll ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 586665"
                    value={newEmployeeForm.enrollId}
                    onChange={(e) =>
                      setNewEmployeeForm({ ...newEmployeeForm, enrollId: e.target.value })
                    }
                    style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 placeholder:text-gray-400 placeholder:font-normal focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
                  />
                </div>

                {/* Job Type */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-800">Job Type</label>
                  <input
                    type="text"
                    placeholder="Permanent"
                    value={newEmployeeForm.jobType}
                    onChange={(e) =>
                      setNewEmployeeForm({ ...newEmployeeForm, jobType: e.target.value })
                    }
                    style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 placeholder:text-gray-400 placeholder:font-normal focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
                  />
                </div>

                {/* SEPARATE MANUAL DATE FIELD 1: JOIN DATE */}
                <div className="space-y-1 p-3 bg-rose-50/40 rounded-xl border border-rose-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-gray-900">
                      Join Date <span className="text-rose-600">*</span>
                    </label>
                    <span className="text-[10px] text-rose-700 font-bold bg-rose-100 px-1.5 py-0.5 rounded">
                      Manual Selection
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={formatToInputDate(newEmployeeForm.joiningDate)}
                      onChange={(e) => {
                        if (e.target.value) {
                          setNewEmployeeForm({
                            ...newEmployeeForm,
                            joiningDate: formatToCardDate(e.target.value),
                          });
                        }
                      }}
                      style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                      className="bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-rose-500"
                      title="Select date using calendar"
                    />
                    <input
                      type="text"
                      placeholder="DD/MM/YYYY"
                      value={newEmployeeForm.joiningDate}
                      onChange={(e) =>
                        setNewEmployeeForm({ ...newEmployeeForm, joiningDate: e.target.value })
                      }
                      style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                      className="flex-1 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 placeholder:text-gray-400 placeholder:font-normal focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500">
                    Use calendar picker or type date in DD/MM/YYYY format
                  </p>
                </div>

                {/* SEPARATE MANUAL DATE FIELD 2: CARD ISSUE DATE */}
                <div className="space-y-1 p-3 bg-rose-50/40 rounded-xl border border-rose-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-gray-900">
                      Card Issue Date <span className="text-rose-600">*</span>
                    </label>
                    <span className="text-[10px] text-rose-700 font-bold bg-rose-100 px-1.5 py-0.5 rounded">
                      Manual Selection
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={formatToInputDate(newEmployeeForm.cardIssue)}
                      onChange={(e) => {
                        if (e.target.value) {
                          setNewEmployeeForm({
                            ...newEmployeeForm,
                            cardIssue: formatToCardDate(e.target.value),
                          });
                        }
                      }}
                      style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                      className="bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-rose-500"
                      title="Select date using calendar"
                    />
                    <input
                      type="text"
                      placeholder="DD/MM/YYYY"
                      value={newEmployeeForm.cardIssue}
                      onChange={(e) =>
                        setNewEmployeeForm({ ...newEmployeeForm, cardIssue: e.target.value })
                      }
                      style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                      className="flex-1 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 placeholder:text-gray-400 placeholder:font-normal focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500">
                    Use calendar picker or type date in DD/MM/YYYY format
                  </p>
                </div>

                {/* Contact Number */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-800">Contact Number</label>
                  <input
                    type="text"
                    placeholder="01920-694100"
                    value={newEmployeeForm.emergencyContact}
                    onChange={(e) =>
                      setNewEmployeeForm({ ...newEmployeeForm, emergencyContact: e.target.value })
                    }
                    style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 placeholder:text-gray-400 placeholder:font-normal focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
                  />
                </div>

                {/* Permanent Address */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-800">Permanent Address</label>
                  <input
                    type="text"
                    placeholder="Mukkhopur, Trishal, Mymensingh"
                    value={newEmployeeForm.permanentAddress}
                    onChange={(e) =>
                      setNewEmployeeForm({ ...newEmployeeForm, permanentAddress: e.target.value })
                    }
                    style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 placeholder:text-gray-400 placeholder:font-normal focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
                  />
                </div>

                {/* National ID */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-800">National ID / NID</label>
                  <input
                    type="text"
                    placeholder="01643970731"
                    value={newEmployeeForm.nationalId}
                    onChange={(e) =>
                      setNewEmployeeForm({ ...newEmployeeForm, nationalId: e.target.value })
                    }
                    style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 placeholder:text-gray-400 placeholder:font-normal focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
                  />
                </div>

                {/* Blood Group */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-800">Blood Group</label>
                  <select
                    value={newEmployeeForm.bloodGroup}
                    onChange={(e) =>
                      setNewEmployeeForm({ ...newEmployeeForm, bloodGroup: e.target.value })
                    }
                    style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
                  >
                    <option style={{ color: '#0f172a', backgroundColor: '#ffffff' }} value="O+">O+</option>
                    <option style={{ color: '#0f172a', backgroundColor: '#ffffff' }} value="A+">A+</option>
                    <option style={{ color: '#0f172a', backgroundColor: '#ffffff' }} value="B+">B+</option>
                    <option style={{ color: '#0f172a', backgroundColor: '#ffffff' }} value="AB+">AB+</option>
                    <option style={{ color: '#0f172a', backgroundColor: '#ffffff' }} value="O-">O-</option>
                    <option style={{ color: '#0f172a', backgroundColor: '#ffffff' }} value="A-">A-</option>
                    <option style={{ color: '#0f172a', backgroundColor: '#ffffff' }} value="B-">B-</option>
                    <option style={{ color: '#0f172a', backgroundColor: '#ffffff' }} value="AB-">AB-</option>
                  </select>
                </div>

                {/* Photo & Signature Uploads */}
                <div className="space-y-1 sm:col-span-2 pt-2 border-t border-gray-100 flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-12 rounded border border-gray-300 bg-gray-50 overflow-hidden flex items-center justify-center">
                      {newEmployeeForm.photoUrl ? (
                        <img src={newEmployeeForm.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-700 block">Employee Photo</span>
                      <label className="cursor-pointer text-[11px] text-rose-600 hover:text-rose-700 font-bold underline">
                        Upload Image
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                setNewEmployeeForm({
                                  ...newEmployeeForm,
                                  photoUrl: ev.target?.result as string,
                                });
                              };
                              reader.readAsDataURL(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-14 h-10 rounded border border-gray-300 bg-gray-50 overflow-hidden flex items-center justify-center">
                      {newEmployeeForm.signatureUrl ? (
                        <img src={newEmployeeForm.signatureUrl} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-[9px] text-gray-400">None</span>
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-700 block">Signature</span>
                      <label className="cursor-pointer text-[11px] text-rose-600 hover:text-rose-700 font-bold underline">
                        Upload Signature
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                setNewEmployeeForm({
                                  ...newEmployeeForm,
                                  signatureUrl: ev.target?.result as string,
                                });
                              };
                              reader.readAsDataURL(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Save & Create ID Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
