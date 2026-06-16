import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = true,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]" onClick={onCancel} />
      <div className="fixed inset-0 flex items-center justify-center p-4 z-[101] pointer-events-none">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
          <div className="p-5">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${isDestructive ? 'bg-red-100' : 'bg-blue-100'}`}>
              <AlertCircle className={`w-5 h-5 ${isDestructive ? 'text-red-600' : 'text-blue-600'}`} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed">{message}</p>
          </div>
          <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 rounded-xl transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                isDestructive 
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-200' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
