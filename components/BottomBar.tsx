import React from 'react';

interface BottomBarProps {
  isFocusMode: boolean;
  result: any;
  isLoading: boolean;
  images: string[];
  setShowPreviewModal: (val: boolean) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isPremium: boolean;
  hasCustomKey: boolean;
  scanCount: number;
  LIFETIME_SCANS_LIMIT: number;
  resetApp: () => void;
  handleCaptureClick: () => void;
  subscriptionPlan: string;
  handleAnalyze: () => void;
  setShowTextModal: (val: boolean) => void;
  triggerSubscription: () => void;
  t: any;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  isFocusMode,
  result,
  isLoading,
  images,
  setShowPreviewModal,
  handleFileSelect,
  isPremium,
  hasCustomKey,
  scanCount,
  LIFETIME_SCANS_LIMIT,
  resetApp,
  handleCaptureClick,
  subscriptionPlan,
  handleAnalyze,
  setShowTextModal,
  triggerSubscription,
  t
}) => {
  const handleTextClick = () => {
    if (!hasCustomKey && !isPremium && scanCount >= LIFETIME_SCANS_LIMIT) {
      triggerSubscription();
      return;
    }
    setShowTextModal(true);
  };

  const handleGalleryClick = (e: React.MouseEvent<HTMLLabelElement>) => {
    if (!hasCustomKey && !isPremium && scanCount >= LIFETIME_SCANS_LIMIT) {
      e.preventDefault();
      triggerSubscription();
      return;
    }
  };

  return (
    <div className={`absolute bottom-0 left-0 right-0 z-30 pb-[calc(env(safe-area-inset-bottom)+2rem)] transform-gpu transition-all duration-500 ease-in-out ${(isFocusMode && !result) || isLoading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <div className="flex flex-col gap-6 px-6 max-w-md mx-auto">
        <div className="flex justify-between items-center relative pointer-events-auto">
           
           {/* Gallery Button */}
           <div className="flex flex-col items-center gap-1 w-20">
              {!isLoading && !result && (
                <>
                  {images.length > 0 ? (
                     <button onClick={() => setShowPreviewModal(true)} className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 border-white/50 transition shadow-lg active:scale-95`}>
                        <img src={images[images.length - 1]} alt="Last Captured" className="w-full h-full object-cover" />
                        <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-1 rounded-bl-md">{images.length}</div>
                     </button>
                  ) : (
                     <label onClick={handleGalleryClick} className={`w-12 h-12 rounded-full flex items-center justify-center transition border border-white/10 cursor-pointer active:scale-90 ${isFocusMode ? 'bg-black/40 backdrop-blur-md hover:bg-black/60' : 'bg-[#2c2c2c] hover:bg-[#3d3d3d]'}`}>
                        <input type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" disabled={!isPremium && !hasCustomKey && scanCount >= LIFETIME_SCANS_LIMIT} />
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                     </label>
                  )}
                  <span className={`text-[10px] font-medium transition-opacity duration-300 whitespace-nowrap ${isFocusMode ? 'opacity-0' : 'text-gray-400'}`}>{images.length > 0 ? t.selectedImages : t.btnGallery}</span>
                </>
              )}
           </div>

           {/* CAPTURE BUTTON (MAIN) */}
           <div className="relative -top-3">
              {isLoading ? (
                  <div className="w-20 h-20 rounded-full border-[5px] border-white/10 bg-black/40 flex items-center justify-center backdrop-blur-md shadow-lg animate-pulse">
                       <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
              ) : result ? (
                 <button onClick={resetApp} className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-95 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-black"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                 </button>
              ) : (
                 <button 
                   onClick={handleCaptureClick} 
                   className={`w-20 h-20 rounded-full border-[5px] border-transparent flex items-center justify-center backdrop-blur-sm active:scale-95 transition 
                   ${subscriptionPlan === 'annual' 
                      ? 'bg-amber-500/10 hover:bg-amber-500/20' 
                      : subscriptionPlan === 'monthly'
                         ? 'bg-emerald-500/10 hover:bg-emerald-500/20' 
                         : 'bg-white/10 hover:bg-white/20' 
                   }`}
                 >
                    <div className="w-16 h-16 rounded-full bg-white transition-all duration-300"></div>
                 </button>
              )}
           </div>

           {/* Actions (Scan/Barcode) */}
           <div className="flex flex-col items-center gap-1 w-20">
              {!isLoading && !result && (
                <>
                  {images.length > 0 ? (
                     <>
                        <button onClick={handleAnalyze} className={`w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center active:scale-90 transition shadow-lg shadow-emerald-500/30 animate-fade-in`}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        </button>
                        <span className={`text-[10px] font-bold transition-opacity duration-300 whitespace-nowrap ${isFocusMode ? 'opacity-0' : 'text-emerald-400'}`}>{t.scanImagesBtn}</span>
                     </>
                  ) : (
                     <>
                        <button onClick={handleTextClick} className={`w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition border border-white/10 ${isFocusMode ? 'bg-black/40 backdrop-blur-md hover:bg-black/60' : 'bg-[#2c2c2c] hover:bg-[#3d3d3d]'}`}>
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                        </button>
                        <span className={`text-[10px] font-medium transition-opacity duration-300 ${isFocusMode ? 'opacity-0' : 'text-gray-400'}`}>{t.btnManual}</span>
                     </>
                  )}
                </>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};
