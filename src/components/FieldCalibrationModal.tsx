import React, { useState } from 'react';
import {
  Sliders,
  RotateCcw,
  Upload,
  Check,
  Move,
  Type,
  Maximize2,
  Sparkles,
  Info,
} from 'lucide-react';
import { CardCalibrationSettings, FieldPositionConfig } from '../types';
import { DEFAULT_CALIBRATION } from '../types';
import { CardFront } from './CardFront';
import { CardBack } from './CardBack';
import { SAMPLE_EMPLOYEES } from '../data/sampleEmployees';

interface FieldCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  calibration: CardCalibrationSettings;
  onChangeCalibration: (settings: CardCalibrationSettings) => void;
  frontTemplateUrl: string;
  backTemplateUrl: string;
  onUpdateFrontTemplate: (url: string) => void;
  onUpdateBackTemplate: (url: string) => void;
  onResetTemplates: () => void;
}

export const FieldCalibrationModal: React.FC<FieldCalibrationModalProps> = ({
  isOpen,
  onClose,
  calibration,
  onChangeCalibration,
  frontTemplateUrl,
  backTemplateUrl,
  onUpdateFrontTemplate,
  onUpdateBackTemplate,
  onResetTemplates,
}) => {
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [selectedField, setSelectedField] = useState<string>('name');

  if (!isOpen) return null;

  const frontFieldKeys: { key: keyof CardCalibrationSettings['front']; label: string }[] = [
    { key: 'name', label: '1. Employee Name' },
    { key: 'designation', label: '2. Designation' },
    { key: 'department', label: '3. Department' },
    { key: 'jobType', label: '4. Job Type' },
    { key: 'joiningDate', label: '5. Joining Date' },
    { key: 'enrollId', label: '6. Enrollment ID' },
    { key: 'cardIssue', label: '7. Card Issue Date' },
    { key: 'photo', label: '8. Employee Photo Box' },
    { key: 'signature', label: '9. Employee Signature Box' },
  ];

  const backFieldKeys: { key: keyof CardCalibrationSettings['back']; label: string }[] = [
    { key: 'emergencyContact', label: '1. Emergency Contact Number' },
    { key: 'nationalId', label: '2. National ID Number' },
    { key: 'bloodGroup', label: '3. Blood Group' },
  ];

  const currentFieldList = activeSide === 'front' ? frontFieldKeys : backFieldKeys;

  // Ensure selected field belongs to current side
  const activeKey = currentFieldList.some((f) => f.key === selectedField)
    ? selectedField
    : currentFieldList[0].key;

  const currentConfig: FieldPositionConfig =
    activeSide === 'front'
      ? (calibration.front as any)[activeKey]
      : (calibration.back as any)[activeKey];

  const updateFieldConfig = (partial: Partial<FieldPositionConfig>) => {
    const updated = {
      ...calibration,
      [activeSide]: {
        ...calibration[activeSide],
        [activeKey]: {
          ...currentConfig,
          ...partial,
        },
      },
    };
    onChangeCalibration(updated);
    // Save to local storage for persistence across sessions
    try {
      localStorage.setItem('id_card_calibration_settings', JSON.stringify(updated));
    } catch (e) {
      // ignore
    }
  };

  const handleCustomTemplateUpload = (side: 'front' | 'back', file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (side === 'front') {
        onUpdateFrontTemplate(dataUrl);
      } else {
        onUpdateBackTemplate(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetCalibration = () => {
    if (window.confirm('Reset all field positions and formatting to reference defaults?')) {
      onChangeCalibration(DEFAULT_CALIBRATION);
      try {
        localStorage.removeItem('id_card_calibration_settings');
      } catch (e) {
        // ignore
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-black p-5 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Field Calibration & Template Alignment</h2>
              <p className="text-xs text-gray-300">
                Calibrate variable field positions and overlay directly onto the exact reference templates
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Content: Left Controls, Right Live Card */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
          {/* Controls Panel (7 cols) */}
          <div className="lg:col-span-7 p-6 space-y-5">
            {/* Side Switcher (Front vs Back) */}
            <div className="flex items-center justify-between">
              <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold w-fit">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSide('front');
                    setSelectedField('name');
                  }}
                  className={`px-4 py-1.5 rounded-lg transition-all ${
                    activeSide === 'front'
                      ? 'bg-white text-rose-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Front Side (9 Fields)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSide('back');
                    setSelectedField('emergencyContact');
                  }}
                  className={`px-4 py-1.5 rounded-lg transition-all ${
                    activeSide === 'back'
                      ? 'bg-white text-rose-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Back Side (Strictly 3 Fields)
                </button>
              </div>

              {/* Upload image button */}
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload {activeSide === 'front' ? 'Front' : 'Back'} Image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleCustomTemplateUpload(activeSide, e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>

            {/* Field Picker */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700">
                Select Variable Field to Calibrate:
              </label>
              <select
                value={activeKey}
                onChange={(e) => setSelectedField(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
              >
                {currentFieldList.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Position Offsets (X & Y) */}
            <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 space-y-3">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-rose-600" />
                Position Coordinates (px)
              </h4>

              <div className="grid grid-cols-2 gap-4">
                {/* X Position */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    X Position (Left Offset):
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateFieldConfig({ x: Math.max(0, currentConfig.x - 1) })}
                      className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold"
                    >
                      -1
                    </button>
                    <input
                      type="number"
                      value={currentConfig.x}
                      onChange={(e) => updateFieldConfig({ x: Number(e.target.value) || 0 })}
                      className="w-full text-center bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => updateFieldConfig({ x: currentConfig.x + 1 })}
                      className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold"
                    >
                      +1
                    </button>
                  </div>
                </div>

                {/* Y Position */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Y Position (Top Offset):
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateFieldConfig({ y: Math.max(0, currentConfig.y - 1) })}
                      className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold"
                    >
                      -1
                    </button>
                    <input
                      type="number"
                      value={currentConfig.y}
                      onChange={(e) => updateFieldConfig({ y: Number(e.target.value) || 0 })}
                      className="w-full text-center bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => updateFieldConfig({ y: currentConfig.y + 1 })}
                      className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold"
                    >
                      +1
                    </button>
                  </div>
                </div>
              </div>

              {/* Width & Height for box elements (photo, signature, or whiteout) */}
              {(activeKey === 'photo' || activeKey === 'signature') && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Box Width (px):
                    </label>
                    <input
                      type="number"
                      value={currentConfig.width || 80}
                      onChange={(e) =>
                        updateFieldConfig({ width: Number(e.target.value) || 80 })
                      }
                      className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Box Height (px):
                    </label>
                    <input
                      type="number"
                      value={currentConfig.height || 100}
                      onChange={(e) =>
                        updateFieldConfig({ height: Number(e.target.value) || 100 })
                      }
                      className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Typography Formatting Controls (for text fields) */}
            {activeKey !== 'photo' && activeKey !== 'signature' && (
              <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 space-y-3">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-rose-600" />
                  Typography & Text Formatting
                </h4>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Font Size (px):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={currentConfig.fontSize}
                      onChange={(e) =>
                        updateFieldConfig({ fontSize: Number(e.target.value) || 12 })
                      }
                      className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Font Weight:
                    </label>
                    <select
                      value={currentConfig.fontWeight}
                      onChange={(e) =>
                        updateFieldConfig({ fontWeight: e.target.value as any })
                      }
                      className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-semibold"
                    >
                      <option value="normal">Normal</option>
                      <option value="semibold">SemiBold</option>
                      <option value="bold">Bold</option>
                      <option value="800">ExtraBold</option>
                      <option value="900">Black (Heavy)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Text Align:
                    </label>
                    <select
                      value={currentConfig.textAlign}
                      onChange={(e) =>
                        updateFieldConfig({ textAlign: e.target.value as any })
                      }
                      className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-semibold"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center justify-between border-t border-gray-200">
              <button
                type="button"
                onClick={handleResetCalibration}
                className="text-xs text-gray-500 hover:text-rose-600 flex items-center gap-1 font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Field Offsets
              </button>

              <button
                onClick={onClose}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow transition-colors flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Save & Close
              </button>
            </div>
          </div>

          {/* Right Live Interactive Preview (5 cols) */}
          <div className="lg:col-span-5 p-6 bg-slate-900 flex flex-col items-center justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              Live Preview: {activeSide === 'front' ? 'Front Side' : 'Back Side'}
            </span>

            <div
              style={{ width: 284 * 0.8, height: 500 * 0.8 }}
              className="relative shadow-2xl rounded-2xl overflow-hidden border border-slate-700"
            >
              {activeSide === 'front' ? (
                <CardFront
                  employee={SAMPLE_EMPLOYEES[0]}
                  templateUrl={frontTemplateUrl}
                  calibration={calibration.front}
                  scale={0.8}
                />
              ) : (
                <CardBack
                  employee={SAMPLE_EMPLOYEES[0]}
                  templateUrl={backTemplateUrl}
                  calibration={calibration.back}
                  scale={0.8}
                />
              )}
            </div>

            <p className="text-[11px] text-slate-400 text-center mt-3 max-w-xs">
              Changes reflect immediately on all generated cards and persist in storage for bulk
              export.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
