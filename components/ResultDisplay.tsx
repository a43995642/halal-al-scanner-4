import React, { useRef, useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { toPng } from 'html-to-image';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

const StatusIcon = ({ status, className = "w-5 h-5" }: { status: string, className?: string }) => {
  switch (status) {
    case 'HALAL':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`text-emerald-500 ${className}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      );
    case 'HARAM':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`text-red-500 ${className}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case 'DOUBTFUL':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`text-amber-500 ${className}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    default: // Non-Food
      return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`text-gray-400 ${className}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
        </svg>
      );
  }
};

const ResultSkeleton = () => (
  <div className="w-full max-w-sm bg-black/40 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl animate-pulse">
    <div className="flex flex-col items-center mb-8">
      <div className="w-24 h-24 rounded-full bg-white/10 mb-4"></div>
      <div className="h-8 w-32 bg-white/10 rounded-lg mb-2"></div>
      <div className="h-4 w-20 bg-white/10 rounded-lg"></div>
    </div>
    <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-3">
      <div className="h-4 w-3/4 bg-white/10 rounded"></div>
      <div className="h-4 w-1/2 bg-white/10 rounded"></div>
    </div>
    <div className="mt-4 flex flex-wrap gap-2 justify-center">
      <div className="h-6 w-16 bg-white/10 rounded-full"></div>
      <div className="h-6 w-20 bg-white/10 rounded-full"></div>
      <div className="h-6 w-14 bg-white/10 rounded-full"></div>
    </div>
  </div>
);

interface ResultDisplayProps {
  isLoading: boolean;
  progress: number;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  setIsLoading: (val: boolean) => void;
  setImages: (val: string[]) => void;
  result: any;
  handleShareResult: () => void;
  handleCopyResult: () => void;
  setShowCorrectionModal: (val: boolean) => void;
  error: string | null;
  resetApp: () => void;
  t: any;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({
  isLoading,
  progress,
  abortControllerRef,
  setIsLoading,
  setImages,
  result,
  handleShareResult,
  handleCopyResult,
  setShowCorrectionModal,
  error,
  resetApp,
  t
}) => {
  const resultRef = useRef<HTMLDivElement>(null);
  const [isSharingImage, setIsSharingImage] = useState(false);

  const handleShareAsImage = async () => {
    if (!resultRef.current || isSharingImage) return;
    setIsSharingImage(true);
    try {
      // Temporarily hide buttons for the screenshot
      const buttons = resultRef.current.querySelectorAll('button');
      buttons.forEach(btn => btn.style.display = 'none');
      
      const dataUrl = await toPng(resultRef.current, { 
        quality: 0.95, 
        backgroundColor: '#000000',
        style: { padding: '20px', borderRadius: '24px' }
      });
      
      buttons.forEach(btn => btn.style.display = '');

      if (Capacitor.isNativePlatform()) {
        // Save to file and share natively
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const fileName = `halal_result_${Date.now()}.png`;
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: dataUrl.split(',')[1],
          directory: Directory.Cache
        });
        
        await Share.share({
          title: 'Halal Scanner Result',
          url: savedFile.uri,
          dialogTitle: t.share,
        });
      } else {
        // Web fallback: Download image
        const link = document.createElement('a');
        link.download = 'halal_result.png';
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error('Failed to share image', err);
      // Fallback to text share
      handleShareResult();
    } finally {
      setIsSharingImage(false);
    }
  };

  const formatReason = (reason: string) => {
    if (!reason) return '';
    if (reason.startsWith('offlineResult\n')) {
      const parts = reason.split('\n');
      return `${t.offlineResult || 'Offline Result:'}\n${parts.slice(1).join('\n')}`;
    }
    if (reason.startsWith('error_')) {
      const parts = reason.split('|');
      const key = parts[0] as keyof typeof t;
      const extra = parts.length > 1 ? ` (${parts.slice(1).join('|')})` : '';
      return (t[key] || parts[0]) + extra;
    }
    return t[reason as keyof typeof t] || reason;
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none p-6 pb-48">
      {isLoading && (
        <div className="flex flex-col items-center w-full max-w-sm">
          <ResultSkeleton />
          <div className="w-full max-w-[200px] h-1.5 bg-gray-800 rounded-full mt-6 overflow-hidden">
             <div className="h-full bg-emerald-500 transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-6 pointer-events-auto bg-black border border-red-500/50 px-6 py-2 rounded-full text-sm font-medium flex items-center justify-center gap-2">
            <span className="text-gray-300 font-normal select-none">{t.analyzing}</span>
            <span className="w-px h-4 bg-white/20 mx-1"></span>
            <button 
              onClick={() => { if (abortControllerRef.current) abortControllerRef.current.abort(); setIsLoading(false); setImages([]); }} 
              className="text-red-400 hover:text-red-300 transition"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}
      {!isLoading && result && (
        <div className="w-full max-w-sm pointer-events-auto transform-gpu animate-fade-in flex flex-col gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div ref={resultRef} className="flex flex-col gap-3">
              <StatusBadge status={result.status} />
              <div className="bg-black backdrop-blur-md p-5 rounded-2xl border-2 border-white/30 shadow-2xl relative group">
                  <div className="flex justify-between items-start mb-2">
                      <h3 className="text-white font-bold flex items-center gap-2 text-lg">{t.resultTitle} {result.confidence && <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-gray-300">{result.confidence}%</span>}</h3>
                      <div className="flex gap-2">
                          <button onClick={handleShareAsImage} disabled={isSharingImage} className="text-emerald-400 hover:text-emerald-300 transition bg-emerald-500/10 p-2 rounded-lg hover:bg-emerald-500/20" aria-label="Share Image">
                              {isSharingImage ? (
                                <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                              )}
                          </button>
                          <button onClick={handleShareResult} className="text-gray-400 hover:text-white transition bg-white/5 p-2 rounded-lg hover:bg-white/10" aria-label="Share">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" /></svg>
                          </button>
                          <button onClick={handleCopyResult} className="text-gray-400 hover:text-white transition bg-white/5 p-2 rounded-lg hover:bg-white/10" aria-label="Copy">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>
                          </button>
                      </div>
                  </div>
                  <p className="text-white text-base leading-relaxed font-medium whitespace-pre-wrap">{formatReason(result.reason)}</p>
              </div>
              
              {result.warnings && result.warnings.length > 0 && (
                <div className="bg-amber-500/10 backdrop-blur-md p-4 rounded-2xl border border-amber-500/30 shadow-lg mt-2">
                   <div className="flex items-center gap-2 mb-2 text-amber-400 font-bold">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {t.healthWarning || "Health Warning"}
                   </div>
                   <ul className="list-disc list-inside text-amber-200/90 text-sm space-y-1">
                      {result.warnings.map((warning: any, idx: any) => (
                         <li key={idx}>{warning}</li>
                      ))}
                   </ul>
                </div>
              )}

              {result.ingredientsDetected.length > 0 && (
                <div className="bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-lg mt-2">
                  <h4 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-blue-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    {t.detailedAnalysis || "Detailed Analysis"}
                  </h4>
                  <div className="flex flex-col gap-2">
                    {result.ingredientsDetected.map((ing: any, idx: number) => (
                      <div key={idx} className="flex flex-col bg-white/5 p-2.5 rounded-xl border border-white/5">
                        <div className="flex items-start justify-between">
                          <span className="text-sm text-gray-200 font-medium flex-1">{ing.name}</span>
                          <div className="ml-2 flex-shrink-0" title={ing.status === 'HALAL' ? (t.statusHalal || 'Halal') : ing.status === 'HARAM' ? (t.statusHaram || 'Haram') : ing.status === 'DOUBTFUL' ? (t.statusDoubtful || 'Doubtful') : (t.statusNonFood || 'Non-Food')}>
                            <StatusIcon status={ing.status} className="w-5 h-5" />
                          </div>
                        </div>
                        {ing.subIngredients && ing.subIngredients.length > 0 && (
                          <div className="mt-2 pl-3 border-l-2 border-white/10 flex flex-col gap-1.5">
                            <span className="text-xs text-gray-400 mb-1">{t.contains || (document.documentElement.dir === 'rtl' ? 'يحتوي على:' : 'Contains:')}</span>
                            {ing.subIngredients.map((sub: any, sIdx: number) => (
                              <div key={sIdx} className="flex items-start justify-between">
                                <span className="text-xs text-gray-300 flex-1">{sub.name}</span>
                                <div className="ml-2 flex-shrink-0" title={sub.status === 'HALAL' ? (t.statusHalal || 'Halal') : sub.status === 'HARAM' ? (t.statusHaram || 'Haram') : sub.status === 'DOUBTFUL' ? (t.statusDoubtful || 'Doubtful') : (t.statusNonFood || 'Non-Food')}>
                                  <StatusIcon status={sub.status} className="w-4 h-4" />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-center mt-2">
               <button onClick={() => setShowCorrectionModal(true)} className="text-gray-400 text-xs flex items-center gap-1.5 hover:text-white transition bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" /></svg>
                  {t.reportError}
               </button>
            </div>
        </div>
      )}
      {!isLoading && error && (
        <div className="w-full max-w-sm bg-red-900/90 backdrop-blur-md p-4 rounded-xl border border-red-500/50 text-white text-center pointer-events-auto">
           <p className="font-bold mb-1">{t.analysisFailed}</p> <p className="text-sm opacity-80 whitespace-pre-wrap">{formatReason(error)}</p> <button onClick={resetApp} className="mt-3 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm transition">{t.retry}</button>
        </div>
      )}
    </div>
  );
};
