
import React from 'react';
import { HalalStatus } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface StatusBadgeProps {
  status: HalalStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const { t } = useLanguage();

  switch (status) {
    case HalalStatus.HALAL:
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl border-4 border-emerald-500 dark:border-emerald-600 text-emerald-800 dark:text-emerald-100 mb-8 animate-fade-in shadow-lg">
          <div className="bg-emerald-100 dark:bg-emerald-800/50 p-4 rounded-full mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-24 h-24 text-emerald-600 dark:text-emerald-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <span className="text-3xl font-extrabold tracking-wide text-center">{t.statusHalal}</span>
          <span className="text-lg opacity-80 mt-2 font-medium text-center">{t.statusHalalSub}</span>
        </div>
      );
    case HalalStatus.HARAM:
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-red-700 dark:bg-red-800 rounded-3xl border-4 border-red-900 dark:border-red-950 text-white mb-8 animate-fade-in shadow-xl">
          <div className="bg-white/10 p-4 rounded-full mb-4 backdrop-blur-md">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-24 h-24 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <span className="text-3xl font-extrabold tracking-wide drop-shadow-md text-center">{t.statusHaram}</span>
          <span className="text-lg opacity-100 mt-2 font-medium text-center">{t.statusHaramSub}</span>
        </div>
      );
    case HalalStatus.DOUBTFUL:
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-yellow-50 dark:bg-yellow-900/20 rounded-3xl border-4 border-yellow-500 dark:border-yellow-600 text-yellow-900 dark:text-yellow-100 mb-8 animate-fade-in shadow-lg">
          <div className="bg-yellow-100 dark:bg-yellow-800/50 p-4 rounded-full mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-24 h-24 text-yellow-600 dark:text-yellow-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <span className="text-3xl font-extrabold tracking-wide text-center">{t.statusDoubtful}</span>
          <span className="text-lg opacity-80 mt-2 font-medium text-center">{t.statusDoubtfulSub}</span>
        </div>
      );
    case HalalStatus.NON_FOOD:
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-slate-100 dark:bg-slate-800 rounded-3xl border-4 border-slate-400 dark:border-slate-600 text-slate-800 dark:text-slate-200 mb-8 animate-fade-in shadow-lg">
          <div className="bg-slate-200 dark:bg-slate-700 p-4 rounded-full mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-24 h-24 text-slate-500 dark:text-slate-400">
               <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <span className="text-3xl font-bold text-center">{t.statusNonFood}</span>
          <span className="text-xl opacity-75 mt-1 font-semibold text-center">{t.statusNonFoodSub}</span>
        </div>
      );
    default:
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-slate-800 rounded-3xl border-4 border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 mb-8 animate-fade-in shadow-lg">
           <div className="bg-gray-200 dark:bg-slate-700 p-4 rounded-full mb-4">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-24 h-24 text-gray-500 dark:text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
          </div>
          <span className="text-3xl font-bold text-center">{t.statusUnknown}</span>
          <span className="text-lg opacity-75 mt-1">{t.statusUnknownSub}</span>
        </div>
      );
  }
};
