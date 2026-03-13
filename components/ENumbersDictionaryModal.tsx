import React, { useState, useMemo } from 'react';
import { HalalStatus } from '../types';
import { OFFLINE_DB } from '../services/haramKeywords';
import { useLanguage } from '../contexts/LanguageContext';

interface ENumbersDictionaryModalProps {
  onClose: () => void;
}

export const ENumbersDictionaryModal: React.FC<ENumbersDictionaryModalProps> = ({ onClose }) => {
  const { t, language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = useMemo(() => {
    if (!searchTerm) return OFFLINE_DB;
    const lowerSearch = searchTerm.toLowerCase();
    return OFFLINE_DB.filter(item => 
      item.id.toLowerCase().includes(lowerSearch) || 
      item.names.some(name => name.toLowerCase().includes(lowerSearch))
    );
  }, [searchTerm]);

  const getStatusColor = (status: HalalStatus) => {
    switch (status) {
      case HalalStatus.HALAL: return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case HalalStatus.HARAM: return 'text-red-400 bg-red-500/10 border-red-500/20';
      case HalalStatus.DOUBTFUL: return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getStatusText = (status: HalalStatus) => {
    switch (status) {
      case HalalStatus.HALAL: return t.statusHalal;
      case HalalStatus.HARAM: return t.statusHaram;
      case HalalStatus.DOUBTFUL: return t.statusDoubtful;
      default: return t.statusUnknown;
    }
  };

  const isRTL = ['ar', 'fa', 'ur', 'ps', 'ku'].includes(language);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-[#1e1e1e] w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-slide-up">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-white/10 bg-black/20">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-emerald-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            {t.eNumbersDictionary || 'E-Numbers Dictionary'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-white/5">
          <div className="relative">
            <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.searchENumbers || 'Search E-Numbers or ingredients...'}
              className="w-full bg-black/30 border border-white/10 rounded-xl py-3 ps-10 pe-4 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition"
              dir="auto"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredData.length > 0 ? (
            filteredData.map((item) => (
              <div key={item.id} className="bg-black/20 border border-white/5 rounded-xl p-4 hover:bg-black/40 transition">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-white">{item.id}</h3>
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${getStatusColor(item.status)}`}>
                    {getStatusText(item.status)}
                  </span>
                </div>
                
                <div className="mb-2 flex flex-wrap gap-1">
                  {(item.i18nNames?.[language] || item.i18nNames?.['en'] || item.names)
                    .filter(n => n.toLowerCase() !== item.id.toLowerCase())
                    .map((name, idx) => (
                    <span key={idx} className="bg-white/5 text-gray-300 text-[10px] px-2 py-0.5 rounded-full">
                      {name}
                    </span>
                  ))}
                </div>

                <p className="text-sm text-gray-400 leading-relaxed" dir="auto">
                  {item.reason[language] || item.reason['en'] || item.reason['ar']}
                </p>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500 py-10">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto mb-3 opacity-50">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p>{t.noResultsFound || 'No results found'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
