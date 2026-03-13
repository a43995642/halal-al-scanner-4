import React, { useState, useEffect } from 'react';

interface VideoBackgroundProps {
  setIsFocusMode: React.Dispatch<React.SetStateAction<boolean>>;
  result: any;
  isLoading: boolean;
  cameraError: string | null;
  openNativeCamera: (callback: (src: string) => void) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  isVideoReady: boolean;
  setIsVideoReady: (val: boolean) => void;
  t: any;
  images: string[];
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({
  setIsFocusMode,
  result,
  isLoading,
  cameraError,
  openNativeCamera,
  videoRef,
  isVideoReady,
  setIsVideoReady,
  t,
  images
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Reset index when images change
  useEffect(() => {
    const timer = setTimeout(() => setCurrentImageIndex(0), 0);
    return () => clearTimeout(timer);
  }, [images]);

  // Cycle images if multiple
  useEffect(() => {
    if (images.length <= 1 || !isLoading) {
      if (!isLoading && images.length > 0) {
        const timer = setTimeout(() => setCurrentImageIndex(0), 0);
        return () => clearTimeout(timer);
      }
      return;
    }

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [images.length, isLoading]);

  return (
    <div 
      className="absolute inset-0 bg-black z-0" 
      onClick={() => !result && !isLoading && setIsFocusMode(prev => !prev)}
    >
       {/* Captured Image Background */}
       {images.length > 0 && (isLoading || result) && (
          <div className="absolute inset-0 z-10">
            {images.map((img, idx) => (
              <img 
                key={idx}
                src={img} 
                alt={`Captured ${idx + 1}`} 
                className={`absolute inset-0 w-full h-full object-cover blur-sm scale-105 transform transition-opacity duration-1000 ${idx === currentImageIndex ? 'opacity-60' : 'opacity-0'}`}
              />
            ))}
            <div className="absolute inset-0 bg-black/40"></div>
          </div>
       )}

       {/* Error State */}
       {cameraError && !result && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-20 p-6 text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4 text-red-500">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" /></svg>
              </div>
              <h3 className="text-white font-bold text-lg mb-2">{t.cameraErrorTitle}</h3>
              <p className="text-gray-400 text-sm mb-6">{cameraError}</p>
              <button onClick={() => openNativeCamera((_src) => { /* handled by parent */ })} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg active:scale-95 transition">{t.useNativeCamera}</button>
          </div>
       )}

       {/* Video Element */}
       <video ref={videoRef} autoPlay playsInline muted disablePictureInPicture onPlaying={() => setIsVideoReady(true)} className={`w-full h-full object-cover transform-gpu transition-opacity duration-500 brightness-110 ${!result && !isLoading && !cameraError && isVideoReady ? 'opacity-100' : 'opacity-0'}`} />
       
       {!result && !isLoading && !cameraError && (
          <div className={`absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-80 overflow-hidden transition-opacity duration-500 ${isVideoReady ? 'opacity-80' : 'opacity-0'}`}>
             <div className="relative w-64 h-64 sm:w-80 sm:h-80 transition-all duration-300">
                 <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-emerald-500 rounded-tl-3xl shadow-sm"></div>
                 <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-emerald-500 rounded-tr-3xl shadow-sm"></div>
                 <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-emerald-500 rounded-bl-3xl shadow-sm"></div>
                 <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-emerald-500 rounded-br-3xl shadow-sm"></div>
             </div>
          </div>
       )}

       <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none z-10"></div>
    </div>
  );
};
