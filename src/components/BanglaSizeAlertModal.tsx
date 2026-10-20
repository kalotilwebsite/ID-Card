import React from 'react';
import { AlertCircle, X, ShieldAlert } from 'lucide-react';
import { BANGLA_SIZE_ALERT_MESSAGE } from '../utils/imageCompression';

interface BanglaSizeAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

export function BanglaSizeAlertModal({
  isOpen,
  onClose,
  title = 'ফাইলের সাইজ সতর্কতা',
  message = BANGLA_SIZE_ALERT_MESSAGE,
}: BanglaSizeAlertModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white border border-rose-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 text-center space-y-4 animate-in zoom-in-95 duration-150">
        {/* Warning Icon Badge */}
        <div className="relative mx-auto">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-sm ring-8 ring-rose-50 animate-pulse">
            <AlertCircle className="w-9 h-9 stroke-[2.2]" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-1 shadow">
            <ShieldAlert className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Title */}
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            {title}
          </h3>
          <span className="inline-block mt-1 px-2.5 py-0.5 bg-rose-50 text-rose-700 text-[11px] font-bold rounded-full border border-rose-200">
            সর্বোচ্চ সাইজ সীমা: ১ MB
          </span>
        </div>

        {/* Required Bangla Message */}
        <div className="p-4 bg-rose-50/70 border border-rose-100 rounded-xl text-rose-950 text-xs sm:text-sm font-medium leading-relaxed">
          {message}
        </div>

        {/* Action Button: 'ঠিক আছে' */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="w-full py-3 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>ঠিক আছে</span>
          </button>
        </div>
      </div>
    </div>
  );
}
