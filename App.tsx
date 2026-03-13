
import React, { useState, useEffect, useRef, Suspense } from 'react';
// Lazy Load Modals
const SubscriptionModal = React.lazy(() => import('./components/SubscriptionModal').then(m => ({ default: m.SubscriptionModal })));
const OnboardingModal = React.lazy(() => import('./components/OnboardingModal').then(m => ({ default: m.OnboardingModal })));
const PrivacyModal = React.lazy(() => import('./components/PrivacyModal').then(m => ({ default: m.PrivacyModal })));
const TermsModal = React.lazy(() => import('./components/TermsModal').then(m => ({ default: m.TermsModal })));
const SettingsModal = React.lazy(() => import('./hooks/SettingsModal')); 
const AuthModal = React.lazy(() => import('./components/AuthModal').then(m => ({ default: m.AuthModal })));
const CorrectionModal = React.lazy(() => import('./components/CorrectionModal').then(m => ({ default: m.CorrectionModal })));
const ImagePreviewModal = React.lazy(() => import('./components/ImagePreviewModal').then(m => ({ default: m.ImagePreviewModal })));
const BarcodeModal = React.lazy(() => import('./components/BarcodeModal').then(m => ({ default: m.BarcodeModal })));
const HistoryModal = React.lazy(() => import('./components/HistoryModal').then(m => ({ default: m.HistoryModal })));
const TextInputModal = React.lazy(() => import('./components/TextInputModal').then(m => ({ default: m.TextInputModal })));
const ENumbersDictionaryModal = React.lazy(() => import('./components/ENumbersDictionaryModal').then(m => ({ default: m.ENumbersDictionaryModal })));

import { analyzeImage, analyzeText, detectProductType } from './services/geminiService';
import { fetchProductByBarcode } from './services/openFoodFacts';
import { ScanResult, ScanHistoryItem, HalalStatus } from './types';
import { secureStorage } from './utils/secureStorage';
import { createAIOptimizedImage, optimizeImageForDisplay } from './utils/imageUtils';
import { vibrate } from './utils/haptics';
import { useLanguage } from './contexts/LanguageContext';
import { useCamera } from './hooks/useCamera'; 
import { Capacitor } from '@capacitor/core';
import { PurchaseService } from './services/purchaseService'; // IMPORTED
import { Clipboard } from '@capacitor/clipboard';
import { Share } from '@capacitor/share';
import { playSuccessSound, playErrorSound, playWarningSound } from './utils/sound'; // Audio Utility

import { FloatingHeader } from './components/FloatingHeader';
import { BottomBar } from './components/BottomBar';
import { ResultDisplay } from './components/ResultDisplay';
import { VideoBackground } from './components/VideoBackground';

import { useAuthAndSubscription } from './hooks/useAuthAndSubscription';
import { useAppListeners } from './hooks/useAppListeners';

import { useOfflineQueue } from './hooks/useOfflineQueue';
import { OfflineQueueModal } from './components/OfflineQueueModal';

// Constants
// LIMIT IS ABSOLUTE (LIFETIME), NOT DAILY
const LIFETIME_SCANS_LIMIT = 3; 
const MAX_IMAGES_PER_SCAN = 4; 

export type ProductType = 'food' | 'cosmetics' | 'clothes';

export default function App() {
  const [images, setImages] = useState<string[]>([]);
  const [productType, setProductType] = useState<ProductType>('food');
  const [showTextModal, setShowTextModal] = useState(false); 
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [analyzedTextContent, setAnalyzedTextContent] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const useLowQuality = false; 
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false); // Track if camera is actually playing

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [showENumbersModal, setShowENumbersModal] = useState(false);
  
  const [showAuthSuccess, setShowAuthSuccess] = useState(false);

  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  // Use secure storage for initial state, but update via RevenueCat events
  const [isPremium, setIsPremium] = useState(() => secureStorage.getItem('isPremium', false));
  const [subscriptionPlan, setSubscriptionPlan] = useState(() => secureStorage.getItem('subscriptionPlan', 'free'));
  
  const [hasCustomKey, setHasCustomKey] = useState(false);
  
  const { language, t } = useLanguage();
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const { 
    videoRef, 
    isCapturing, 
    captureImage, 
    toggleTorch, 
    isTorchOn, 
    hasTorch, 
    error: cameraError,
    openNativeCamera
  } = useCamera();

  const {
    userId,
    scanCount,
    setScanCount,
    fetchUserStats
  } = useAuthAndSubscription();

  const { queue, isOnline, add: addToQueue, remove: removeFromQueue } = useOfflineQueue();

  const stateRef = useRef({
    showOnboarding, showPrivacy, showTerms, showSettings,
    showHistory, showSubscriptionModal, showAuthModal,
    showCorrectionModal, showTextModal, showBarcodeModal,
    showPreviewModal, showQueueModal, showENumbersModal, result, images, isLoading
  });

  Object.assign(stateRef.current, {
    showOnboarding, showPrivacy, showTerms, showSettings,
    showHistory, showSubscriptionModal, showAuthModal,
    showCorrectionModal, showTextModal, showBarcodeModal,
    showPreviewModal, showQueueModal, showENumbersModal, result, images, isLoading
  });

  useAppListeners({
    stateRef,
    setShowSubscriptionModal,
    setShowSettings,
    setShowHistory,
    setShowAuthModal,
    setShowPrivacy,
    setShowTerms,
    setShowCorrectionModal,
    setShowBarcodeModal,
    setShowTextModal,
    setShowPreviewModal,
    setResult,
    setAnalyzedTextContent,
    setError,
    setIsLoading,
    setImages,
    setShowAuthSuccess
  });

  useEffect(() => {
    document.documentElement.classList.add('dark');
    
    // 1. Initialize RevenueCat
    PurchaseService.initialize();

    // 2. Listen for Subscription Changes (from PurchaseService)
    const handleSubChange = (e: CustomEvent) => {
        setIsPremium(e.detail.isPremium);
        if (e.detail.plan) setSubscriptionPlan(e.detail.plan);
        // Automatically close modal if user becomes premium
        if (e.detail.isPremium) setShowSubscriptionModal(false);
    };
    window.addEventListener('subscription-changed' as any, handleSubChange);

    return () => {
        window.removeEventListener('subscription-changed' as any, handleSubChange);
    };
  }, []);
  
  // Handle visibility change to save battery
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isTorchOn) {
        toggleTorch(); // Turn off torch if app goes background
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isTorchOn, toggleTorch]);
  
  // Check for custom key on load and whenever settings close
  useEffect(() => {
      const checkKey = () => {
          const key = secureStorage.getItem('customApiKey', '');
          setHasCustomKey(!!key);
      };
      checkKey();
      if (!showSettings) {
          checkKey();
      }
  }, [showSettings]);



  useEffect(() => {
    const accepted = localStorage.getItem('halalScannerTermsAccepted');
    if (accepted !== 'true') setShowOnboarding(true);
    const savedHistory = localStorage.getItem('halalScannerHistory');
    if (savedHistory) { try { setHistory(JSON.parse(savedHistory)); } catch (e) { /* ignore */ } }
  }, []);
  
  const showToast = (msg: string) => { setToastMessage(msg); setTimeout(() => setToastMessage(null), 3000); };

  useEffect(() => {
    if (images.length === 1 && !result && !isLoading) {
      const detect = async () => {
        try {
          const detectedType = await detectProductType(images[0]);
          if (detectedType && ['food', 'cosmetics', 'clothes'].includes(detectedType)) {
            setProductType(detectedType as ProductType);
            const typeName = detectedType === 'food' ? (t.food || 'Food') : detectedType === 'cosmetics' ? (t.cosmetics || 'Cosmetics') : (t.clothes || 'Clothes');
            showToast(`${t.productDetectedAs || 'Product detected as'} ${typeName}`);
          }
        } catch (e) {
          console.error("Auto-detect failed:", e);
        }
      };
      detect();
    }
  }, [images, result, isLoading, t]);
  const saveToHistory = (scanResult: ScanResult, thumbnail?: string) => { const newItem: ScanHistoryItem = { id: Date.now().toString(), date: Date.now(), result: scanResult, thumbnail }; const updatedHistory = [newItem, ...history].slice(0, 30); setHistory(updatedHistory); localStorage.setItem('halalScannerHistory', JSON.stringify(updatedHistory)); };
  
  // --- HANDLE SUBSCRIPTION TRIGGER ---
  const triggerSubscription = async () => {
      // 1. Try Native Paywall first (Android/iOS)
      if (Capacitor.isNativePlatform()) {
          const presented = await PurchaseService.presentPaywall();
          // If presentPaywall returns false (not supported or failed to load),
          // fall back to our custom modal
          if (!presented) {
              setShowSubscriptionModal(true);
          }
      } else {
          // 2. Web Mode: Show Custom Modal
          setShowSubscriptionModal(true);
      }
  };

  const incrementScanCount = () => {
      setScanCount(prev => prev + 1);
      // For logged in users, DB increment happens on server side in the API
      // We just optimistically update UI here, and fetchUserStats later ensures sync
  };

  const handleCaptureClick = () => {
    if (result) { resetApp(); return; }
    
    // Check Limits - Bypass if Custom Key or Premium
    // Uses Absolute Lifetime Limit
    if (!hasCustomKey && !isPremium && scanCount >= LIFETIME_SCANS_LIMIT) { 
        triggerSubscription();
        return; 
    }

    if (cameraError) { openNativeCamera((src) => { const newImages = [...images, src]; setImages(newImages); }); return; }
    if (isCapturing) return;
    if (isLoading) return;
    
    if (images.length >= MAX_IMAGES_PER_SCAN) { showToast(t.maxImages); return; }
    captureImage((src) => { const newImages = [...images, src]; setImages(newImages); vibrate(50); showToast(t.imgAdded); }, false);
  };

  const handleAnalyze = async () => {
    if (images.length === 0 || isLoading) return;
    
    // Check Limits - Bypass if Custom Key or Premium
    if (!hasCustomKey && !isPremium && scanCount >= LIFETIME_SCANS_LIMIT) { 
        triggerSubscription();
        return; 
    }

    if (!isOnline) {
        await addToQueue({
            id: Date.now().toString(),
            type: 'image',
            payload: images,
            date: Date.now()
        });
        showToast(language === 'ar' ? "أنت غير متصل. تم الحفظ في قائمة الانتظار." : "Offline. Saved to queue.");
        setImages([]);
        return;
    }

    setIsLoading(true); setError(null); setAnalyzedTextContent(null); setProgress(5);
    const controller = new AbortController(); abortControllerRef.current = controller;
    
    try {
      const width = useLowQuality ? 1024 : 2000;
      const quality = useLowQuality ? 0.7 : 0.85;
      
      const aiReadyImages = await Promise.all(images.map(img => createAIOptimizedImage(img, width, quality)));
      
      setProgress(40); progressInterval.current = setInterval(() => { setProgress(prev => (prev >= 90 ? 90 : prev + 2)); }, 200);
      
      let dietaryPreferences: string[] = [];
      try {
          const storedPrefs = localStorage.getItem('dietaryPreferences');
          if (storedPrefs) dietaryPreferences = JSON.parse(storedPrefs);
      } catch(e) { /* ignore */ }

      const scanResult = await analyzeImage(aiReadyImages, userId || undefined, true, true, language, controller.signal, dietaryPreferences, productType);
      
      clearInterval(progressInterval.current as any); setProgress(100);
      
      // Increment Local Counter for every analysis attempt
      incrementScanCount();
      if (userId && !hasCustomKey) await fetchUserStats(userId); 

      if (scanResult.confidence === 0) { 
          setError(scanResult.reason); 
          playErrorSound();
      } else { 
          vibrate([50, 100]);
          
          // Audio Feedback based on result
          if (scanResult.status === HalalStatus.HALAL) playSuccessSound();
          else if (scanResult.status === HalalStatus.HARAM) playErrorSound();
          else playWarningSound();

          setResult(scanResult); 
          
          optimizeImageForDisplay(images[0]).then(img => {
               const imgObj = new Image();
               imgObj.src = img;
               imgObj.onload = () => {
                   const c = document.createElement('canvas');
                   c.width = 300;
                   c.height = (imgObj.height * 300) / imgObj.width;
                   c.getContext('2d')?.drawImage(imgObj, 0, 0, 300, c.height);
                   saveToHistory(scanResult, c.toDataURL('image/jpeg', 0.6));
               };
          }).catch(() => saveToHistory(scanResult)); 
      }
    } catch (err: any) { 
        if (err.name === 'AbortError') return; 
        if (err.message === "LIMIT_REACHED") {
            triggerSubscription();
            return;
        }
        setError(t.unexpectedError); 
    } finally { 
        setIsLoading(false); 
        abortControllerRef.current = null; 
    }
  };

  const handleCopyResult = async () => {
    if (!result) return;
    const textToCopy = `${t.resultTitle} ${result.status}\n${result.reason}\n${t.ingredientsDetected} ${result.ingredientsDetected.map(i => i.name).join(', ')}`;
    await Clipboard.write({ string: textToCopy });
    showToast(t.shareCopied);
  };

  const handleShareResult = async () => {
    if (!result) return;
    const textToShare = `${t.resultTitle} ${result.status}\n${result.reason}`;
    try {
      await Share.share({
        title: 'Halal Scanner Result',
        text: textToShare,
        dialogTitle: t.share,
      });
    } catch (e) {
      // Fallback to clipboard if share not supported or cancelled
      handleCopyResult();
    }
  };

  const resetApp = () => { setImages([]); setResult(null); setAnalyzedTextContent(null); setError(null); setIsLoading(false); };
  const removeImage = (index: number) => { setImages(prev => prev.filter((_, i) => i !== index)); vibrate(20); if (images.length <= 1) setShowPreviewModal(false); };
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLoading) return;

    // Check Limits - Bypass if Custom Key or Premium
    if (!hasCustomKey && !isPremium && scanCount >= LIFETIME_SCANS_LIMIT) { 
        triggerSubscription();
        e.target.value = '';
        return; 
    }

    if (e.target.files && e.target.files.length > 0) {
      let files = Array.from(e.target.files) as File[];
      
      // Filter for images only
      const validImages = files.filter(file => file.type.startsWith('image/'));
      
      if (validImages.length < files.length) {
          showToast(t.onlyImages);
      }
      
      files = validImages;
      if (files.length === 0) { e.target.value = ''; return; }

      const remainingSlots = MAX_IMAGES_PER_SCAN - images.length;
      if (remainingSlots <= 0) { showToast(t.maxImages); e.target.value = ''; return; }
      if (files.length > remainingSlots) { showToast(t.maxImages); files = files.slice(0, remainingSlots); }
      const newImages: string[] = [];
      for (const file of files) { const reader = new FileReader(); const promise = new Promise<string>((resolve) => { reader.onloadend = () => resolve(reader.result as string); }); reader.readAsDataURL(file); newImages.push(await promise); }
      setImages(prev => [...prev, ...newImages]); vibrate(50); e.target.value = '';
    }
  };

  const handleBarcodeSearch = async (barcode: string) => {
    // Check Limits for Barcode as well (Absolute)
    if (!hasCustomKey && !isPremium && scanCount >= LIFETIME_SCANS_LIMIT) { 
        setShowBarcodeModal(false);
        triggerSubscription();
        return; 
    }

    if (!isOnline) {
        await addToQueue({
            id: Date.now().toString(),
            type: 'text',
            payload: `BARCODE:${barcode}`,
            date: Date.now()
        });
        showToast(language === 'ar' ? "أنت غير متصل. تم الحفظ في قائمة الانتظار." : "Offline. Saved to queue.");
        setShowBarcodeModal(false);
        return;
    }

    setShowBarcodeModal(false); setIsLoading(true); setResult(null); setImages([]); setAnalyzedTextContent(t.searching);
    try {
      const product = await fetchProductByBarcode(barcode);
      if (!product) throw new Error("PRODUCT_NOT_FOUND");
      const ingredients = language === 'ar' ? (product.ingredients_text_ar || product.ingredients_text) : (product.ingredients_text_en || product.ingredients_text);
      if (!ingredients) { setResult({ status: HalalStatus.DOUBTFUL, reason: "Product found but ingredients list is missing.", ingredientsDetected: [], confidence: 100 }); setIsLoading(false); return; }
      const finalText = `${t.barcodeTitle}: ${product.product_name || ''}\n\n${ingredients}`; handleAnalyzeText(finalText);
    } catch (err) { setError(t.barcodeNotFound); setIsLoading(false); }
  };

  const handleAnalyzeText = async (text: string) => {
    // Check Limits (Absolute)
    if (!hasCustomKey && !isPremium && scanCount >= LIFETIME_SCANS_LIMIT) { 
        setShowTextModal(false);
        triggerSubscription();
        return; 
    }

    if (!isOnline) {
        await addToQueue({
            id: Date.now().toString(),
            type: 'text',
            payload: text,
            date: Date.now()
        });
        showToast(language === 'ar' ? "أنت غير متصل. تم الحفظ في قائمة الانتظار." : "Offline. Saved to queue.");
        setShowTextModal(false);
        return;
    }

    setShowTextModal(false); setIsLoading(true); setResult(null); setImages([]); setAnalyzedTextContent(text);
    const controller = new AbortController(); abortControllerRef.current = controller;
    
    let dietaryPreferences: string[] = [];
    try {
        const storedPrefs = localStorage.getItem('dietaryPreferences');
        if (storedPrefs) dietaryPreferences = JSON.parse(storedPrefs);
    } catch(e) { /* ignore */ }

    try { 
        const scanResult = await analyzeText(text, userId || undefined, language, controller.signal, dietaryPreferences, productType); 
        
        // Audio Feedback
        if (scanResult.status === HalalStatus.HALAL) playSuccessSound();
        else if (scanResult.status === HalalStatus.HARAM) playErrorSound();
        else playWarningSound();

        setResult(scanResult); 
        incrementScanCount(); // Increment Local Counter
        saveToHistory(scanResult); 
    } catch (err: any) { 
        if (err.name === 'AbortError') return;
        if (err.message === "LIMIT_REACHED") {
            triggerSubscription();
            return;
        }
        setError(t.unexpectedError); 
    } finally { setIsLoading(false); }
  };

  const handleSubscribe = async () => { 
      const isPro = await PurchaseService.checkSubscriptionStatus(); 
      setIsPremium(isPro); 
  };

  const handleAnalyzeQueueItem = async (item: any) => {
      setShowQueueModal(false);
      removeFromQueue(item.id);
      if (item.type === 'image') {
          setImages(item.payload);
          // We need to wait for state to update before analyzing
          setTimeout(() => {
              // Trigger analyze manually since handleAnalyze depends on images state
              const btn = document.getElementById('hidden-analyze-btn');
              if (btn) btn.click();
          }, 100);
      } else if (item.type === 'text') {
          if (item.payload.startsWith('BARCODE:')) {
              handleBarcodeSearch(item.payload.replace('BARCODE:', ''));
          } else {
              handleAnalyzeText(item.payload);
          }
      }
  };

  return (
    <div className="fixed inset-0 bg-black text-white font-sans flex flex-col overflow-hidden">
      <style>{`
        video::-webkit-media-controls,
        video::-webkit-media-controls-play-button,
        video::-webkit-media-controls-start-playback-button,
        video::-webkit-media-controls-overlay-play-button,
        video::-webkit-media-controls-enclosure {
          display: none !important;
          -webkit-appearance: none;
          opacity: 0;
        }
      `}</style>
      
      {/* Hidden button for queue triggering */}
      <button id="hidden-analyze-btn" className="hidden" onClick={handleAnalyze}></button>

      <Suspense fallback={<div className="fixed inset-0 z-50 bg-black/50" />}>
        {showOnboarding && <OnboardingModal onFinish={() => { localStorage.setItem('halalScannerTermsAccepted', 'true'); setShowOnboarding(false); }} />}
        {showHistory && <HistoryModal history={history} onClose={() => setShowHistory(false)} onLoadItem={(item) => { setResult(item.result); setImages(item.thumbnail ? [item.thumbnail] : []); setShowHistory(false); }} />}
        {showTextModal && <TextInputModal onClose={() => setShowTextModal(false)} onAnalyze={handleAnalyzeText} />}
        {showBarcodeModal && <BarcodeModal onClose={() => setShowBarcodeModal(false)} onSearch={handleBarcodeSearch} />}
        {showPreviewModal && <ImagePreviewModal images={images} onDelete={removeImage} onClose={() => setShowPreviewModal(false)} />}
        {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
        {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={() => { setShowAuthModal(false); setShowAuthSuccess(true); fetchUserStats(userId || ''); setTimeout(() => setShowAuthSuccess(false), 4000); }} />}
        
        {showQueueModal && (
            <OfflineQueueModal 
                queue={queue} 
                isOnline={isOnline} 
                onClose={() => setShowQueueModal(false)} 
                onAnalyze={handleAnalyzeQueueItem} 
                onRemove={removeFromQueue} 
                t={t} 
            />
        )}        
        {showENumbersModal && <ENumbersDictionaryModal onClose={() => setShowENumbersModal(false)} />}
        {showCorrectionModal && result && (
           <CorrectionModal onClose={() => setShowCorrectionModal(false)} result={result} analyzedText={analyzedTextContent} userId={userId} />
        )}
        
        {showSettings && <SettingsModal 
            onClose={() => setShowSettings(false)} 
            onClearHistory={() => setHistory([])} 
            isPremium={!!isPremium} 
            onManageSubscription={() => { setShowSettings(false); triggerSubscription(); }}
            onOpenAuth={() => { setShowAuthModal(true); }}
            onOpenPrivacy={() => { setShowSettings(false); setShowPrivacy(true); }}
            onOpenTerms={() => { setShowSettings(false); setShowTerms(true); }}
        />}
        
        {showSubscriptionModal && (
            <SubscriptionModal 
                onSubscribe={handleSubscribe} 
                onClose={() => setShowSubscriptionModal(false)} 
                isLimitReached={false}
                onOpenPrivacy={() => setShowPrivacy(true)}
                onOpenTerms={() => setShowTerms(true)}
            />
        )}
      </Suspense>

      {/* ... Rest of the component code ... */}
      {/* Keeping Existing Toast, AuthSuccess, Layers 1-3 */}
      {toastMessage && <div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-gray-900/90 text-white px-6 py-3 rounded-full shadow-xl z-[80] animate-fade-in text-sm font-medium backdrop-blur-sm border border-white/10">{toastMessage}</div>}

      {showAuthSuccess && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4">
            <div className="bg-[#1e1e1e] w-full max-w-sm p-8 rounded-3xl border border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.15)] text-center animate-slide-up relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-500"></div>
                <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-12 h-12"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">{t.authSuccessTitle}</h2>
                <p className="text-gray-400 text-sm leading-relaxed mb-8">{t.authSuccessDesc}</p>
                <button onClick={() => setShowAuthSuccess(false)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-emerald-900/20 active:scale-[0.98]">{t.startScanning}</button>
            </div>
        </div>
      )}

      {/* --- LAYER 1: VIDEO BACKGROUND --- */}
      <VideoBackground 
        setIsFocusMode={setIsFocusMode}
        result={result}
        isLoading={isLoading}
        cameraError={cameraError}
        openNativeCamera={openNativeCamera}
        videoRef={videoRef}
        isVideoReady={isVideoReady}
        setIsVideoReady={setIsVideoReady}
        t={t}
        images={images}
      />

      {/* --- LAYER 2: FLOATING HEADER --- */}
      <FloatingHeader 
        isFocusMode={isFocusMode}
        productType={productType}
        setProductType={setProductType}
        result={result}
        isLoading={isLoading}
        setShowSettings={setShowSettings}
        hasTorch={hasTorch}
        toggleTorch={toggleTorch}
        isTorchOn={isTorchOn}
        setShowHistory={setShowHistory}
        queueCount={queue.length}
        setShowQueueModal={setShowQueueModal}
        setShowENumbersModal={setShowENumbersModal}
        productType={productType}
        setProductType={setProductType}
        triggerSubscription={triggerSubscription}
        hasCustomKey={hasCustomKey}
        isPremium={!!isPremium}
        scanCount={scanCount}
        LIFETIME_SCANS_LIMIT={LIFETIME_SCANS_LIMIT}
      />

      {/* --- LAYER 3: MIDDLE CONTENT (Result, Error) --- */}
      <ResultDisplay 
        isLoading={isLoading}
        progress={progress}
        abortControllerRef={abortControllerRef}
        setIsLoading={setIsLoading}
        setImages={setImages}
        result={result}
        handleShareResult={handleShareResult}
        handleCopyResult={handleCopyResult}
        setShowCorrectionModal={setShowCorrectionModal}
        error={error}
        resetApp={resetApp}
        t={t}
      />

      {/* --- LAYER 4: BOTTOM BAR --- */}
      <BottomBar 
        isFocusMode={isFocusMode}
        result={result}
        isLoading={isLoading}
        images={images}
        setShowPreviewModal={setShowPreviewModal}
        handleFileSelect={handleFileSelect}
        isPremium={!!isPremium}
        hasCustomKey={hasCustomKey}
        scanCount={scanCount}
        LIFETIME_SCANS_LIMIT={LIFETIME_SCANS_LIMIT}
        resetApp={resetApp}
        handleCaptureClick={handleCaptureClick}
        subscriptionPlan={subscriptionPlan}
        handleAnalyze={handleAnalyze}
        setShowTextModal={setShowTextModal}
        triggerSubscription={triggerSubscription}
        t={t}
      />
    </div>
  );
}
