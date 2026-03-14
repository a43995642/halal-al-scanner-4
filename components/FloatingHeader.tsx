import React from 'react';

interface FloatingHeaderProps {
  isFocusMode: boolean;
  result: any;
  isLoading: boolean;
  setShowSettings: (val: boolean) => void;
  hasTorch: boolean;
  toggleTorch: () => void;
  isTorchOn: boolean;
  setShowHistory: (val: boolean) => void;
  queueCount?: number;
  setShowQueueModal?: (val: boolean) => void;
  setShowENumbersModal?: (val: boolean) => void;
  triggerSubscription: () => void;
  hasCustomKey: boolean;
  isPremium: boolean;
  scanCount: number;
  LIFETIME_SCANS_LIMIT: number;
}

export const FloatingHeader: React.FC<FloatingHeaderProps> = ({
  isFocusMode,
  result,
  isLoading,
  setShowSettings,
  hasTorch,
  toggleTorch,
  isTorchOn,
  setShowHistory,
  queueCount = 0,
  setShowQueueModal,
  setShowENumbersModal
}) => {
  return (
    <div className={`absolute top-0 left-0 right-0 z-20 p-4 pt-[calc(env(safe-area-inset-top)+10px)] flex justify-between items-start transform-gpu transition-all duration-500 ease-in-out ${(isFocusMode && !result) || isLoading ? '-translate-y-32 opacity-0' : 'translate-y-0 opacity-100'}`}>
      
      <div className="flex gap-3">
        <button onClick={() => setShowSettings(true)} className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white active:bg-white/20">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </button>

        {setShowENumbersModal && (
          <button onClick={() => setShowENumbersModal(true)} className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white active:bg-white/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
          </button>
        )}

        {queueCount > 0 && setShowQueueModal && (
          <button onClick={() => setShowQueueModal(true)} className="relative w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white active:bg-white/20 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-yellow-400"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" /></svg>
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{queueCount}</span>
          </button>
        )}
      </div>

      <div className="flex gap-3">
        {hasTorch && (
           <button onClick={toggleTorch} className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center transition active:bg-white/20 ${isTorchOn ? 'bg-yellow-400 text-yellow-900' : 'bg-black/30 text-white'}`}>
               {isTorchOn ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>}
           </button>
        )}

        <button onClick={() => setShowHistory(true)} className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white active:bg-white/20">
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </button>
      </div>
    </div>
  );
};
