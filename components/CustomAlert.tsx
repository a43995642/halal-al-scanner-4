
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'success-gold';

interface CustomAlertProps {
  isOpen: boolean;
  title: string;
  message: string;
  type: AlertType;
  isConfirm?: boolean;
  onClose: () => void;
  onConfirm?: () => void;
}

export const CustomAlert: React.FC<CustomAlertProps> = ({ 
  isOpen, 
  title, 
  message, 
  type, 
  isConfirm, 
  onClose, 
  onConfirm 
}) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  // Icons based on type
  const renderIcon = () => {
    switch (type) {
      case 'success':
        return (
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 border border-emerald-500/20 text-emerald-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        );
      case 'success-gold':
        return (
          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-4 border border-amber-500/20 text-amber-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        );
      case 'error':
        return (
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20 text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
        );
      case 'warning':
        return (
          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-4 border border-amber-500/20 text-amber-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 border border-blue-500/20 text-blue-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-white/10 animate-slide-up flex flex-col items-center text-center relative">
        
        {renderIcon()}

        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed mb-6 whitespace-pre-wrap">{message}</p>

        <div className={`w-full flex gap-3 ${isConfirm ? 'flex-row' : 'flex-col'}`}>
          {isConfirm && (
            <button 
              onClick={onClose}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3.5 rounded-xl transition"
            >
              {t.cancel}
            </button>
          )}
          
          <button 
            onClick={() => {
                if (isConfirm && onConfirm) onConfirm();
                onClose();
            }}
            className={`flex-1 font-bold py-3.5 rounded-xl transition shadow-lg text-white 
                ${type === 'error' ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20' : 
                  type === 'warning' ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20' : 
                  type === 'success-gold' ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-900/20' :
                  'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'}`}
          >
            {isConfirm ? t.confirm : t.closeBtn}
          </button>
        </div>

      </div>
    </div>
  );
};
