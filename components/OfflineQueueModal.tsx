import React from 'react';
import { QueueItem } from '../utils/offlineQueue';

interface OfflineQueueModalProps {
  queue: QueueItem[];
  isOnline: boolean;
  onClose: () => void;
  onAnalyze: (item: QueueItem) => void;
  onRemove: (id: string) => void;
  t: any;
}

export const OfflineQueueModal: React.FC<OfflineQueueModalProps> = ({
  queue,
  isOnline,
  onClose,
  onAnalyze,
  onRemove,
  t
}) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#1a1a1a] w-full max-w-md rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col max-h-[85vh]">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/20 sticky top-0 z-10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-emerald-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
            {t.offlineQueueTitle || t.offlineQueue || 'Offline Queue'}
          </h2>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {!isOnline && queue.length > 0 && (
             <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400 text-sm flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                {t.offlineWarning || 'You are currently offline. Connect to the internet to analyze these items.'}
             </div>
          )}

          {queue.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mx-auto mb-4 opacity-20"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
              <p>{t.emptyQueue || 'Your queue is empty.'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {queue.map((item) => (
                <div key={item.id} className="bg-black/40 border border-white/5 rounded-2xl p-4 flex gap-4 items-center">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 border border-white/10 flex items-center justify-center relative">
                    {item.type === 'image' && item.payload.length > 0 ? (
                      <>
                        <img src={item.payload[0]} alt="Queue item" className="w-full h-full object-cover" />
                        {item.payload.length > 1 && (
                          <div className="absolute bottom-0 right-0 bg-black/70 text-[10px] px-1.5 py-0.5 rounded-tl-lg text-white font-bold">
                            +{item.payload.length - 1}
                          </div>
                        )}
                      </>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">
                      {item.type === 'image' ? (t.imagesToAnalyze || 'Images to analyze') : (t.textToAnalyze || 'Text to analyze')}
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                      {new Date(item.date).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => onAnalyze(item)}
                      disabled={!isOnline}
                      className={`p-2 rounded-lg transition ${isOnline ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
                      title={isOnline ? (t.analyzeNow || 'Analyze Now') : (t.offlineWarning || 'Offline')}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    </button>
                    <button 
                      onClick={() => onRemove(item.id)}
                      className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.158 3.21c-.342.052-.682.107-1.022.166m-1.022-.165L3.84 5.79m14.158-3.21a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.011v.114c0 .989.91 1.974 2.09 2.011a51.964 51.964 0 003.32 0c1.18-.037 2.09-1.022 2.09-2.011v-.114c0-.989-.91-1.974-2.09-2.011a51.964 51.964 0 00-3.32 0z" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
