import React from 'react';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'info';
  loading?: boolean;
}

export default function ConfirmModal({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'info',
  loading = false,
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-bg/80 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={onCancel} 
      />
      
      <div className="relative w-full max-w-sm border border-rule bg-bg-2 p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <h2 className="mb-4 font-serif text-3xl tracking-tight">{title}</h2>
        <p className="mb-8 font-mono text-xs leading-relaxed text-text-2 uppercase tracking-wide">
          {message}
        </p>
        
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 font-mono text-[10px] uppercase tracking-widest text-text-3 hover:bg-bg-3 transition-colors border border-transparent hover:border-rule"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-3 font-mono text-[10px] uppercase tracking-widest text-white transition-all hover:brightness-110 disabled:opacity-50 shadow-lg shadow-black/20
              ${variant === 'danger' ? 'bg-red-500/80 hover:bg-red-600' : 'bg-accent'}
            `}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
