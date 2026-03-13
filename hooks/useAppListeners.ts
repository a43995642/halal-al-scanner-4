import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { supabase } from '../lib/supabase';

interface UseAppListenersProps {
  stateRef: React.MutableRefObject<any>;
  setShowSubscriptionModal: (val: boolean) => void;
  setShowSettings: (val: boolean) => void;
  setShowHistory: (val: boolean) => void;
  setShowAuthModal: (val: boolean) => void;
  setShowPrivacy: (val: boolean) => void;
  setShowTerms: (val: boolean) => void;
  setShowCorrectionModal: (val: boolean) => void;
  setShowBarcodeModal: (val: boolean) => void;
  setShowTextModal: (val: boolean) => void;
  setShowPreviewModal: (val: boolean) => void;
  setShowENumbersModal?: (val: boolean) => void;
  setShowQueueModal?: (val: boolean) => void;
  setResult: (val: any) => void;
  setAnalyzedTextContent: (val: any) => void;
  setError: (val: any) => void;
  setIsLoading: (val: boolean) => void;
  setImages: (val: any) => void;
  setShowAuthSuccess: (val: boolean) => void;
}

export const useAppListeners = ({
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
  setShowENumbersModal,
  setShowQueueModal,
  setResult,
  setAnalyzedTextContent,
  setError,
  setIsLoading,
  setImages,
  setShowAuthSuccess
}: UseAppListenersProps) => {
  useEffect(() => {
    let backButtonListener: any;
    let urlListener: any;

    const setupListeners = async () => {
      backButtonListener = await CapacitorApp.addListener('backButton', () => {
        const s = stateRef.current;
        if (s.showOnboarding) { CapacitorApp.exitApp(); return; }
        if (s.showSubscriptionModal) { setShowSubscriptionModal(false); return; }
        if (s.showSettings) { setShowSettings(false); return; }
        if (s.showHistory) { setShowHistory(false); return; }
        if (s.showAuthModal) { setShowAuthModal(false); return; }
        if (s.showPrivacy) { setShowPrivacy(false); return; }
        if (s.showTerms) { setShowTerms(false); return; }
        if (s.showCorrectionModal) { setShowCorrectionModal(false); return; }
        if (s.showBarcodeModal) { setShowBarcodeModal(false); return; }
        if (s.showTextModal) { setShowTextModal(false); return; }
        if (s.showPreviewModal) { setShowPreviewModal(false); return; }
        if (s.showQueueModal && setShowQueueModal) { setShowQueueModal(false); return; }
        if (s.showENumbersModal && setShowENumbersModal) { setShowENumbersModal(false); return; }
        if (s.result && !s.isLoading) {
          setResult(null); setAnalyzedTextContent(null); setError(null); setIsLoading(false); setImages([]); return;
        }
        if (s.images.length > 0 && !s.isLoading) { setImages([]); return; }
        CapacitorApp.exitApp();
      });

      // Handle Deep Link from OAuth (for fallback flow in Chrome Custom Tabs)
      urlListener = await CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
         try {
             // Basic Check if URL is relevant to Auth
             if (url.includes('access_token') || url.includes('refresh_token') || url.includes('code=')) {
                 // Try to exchange code if present (PKCE) or extract tokens
                 const urlObj = new URL(url);
                 const params = new URLSearchParams(urlObj.search || urlObj.hash.substring(1));
                 
                 const code = params.get('code');
                 const accessToken = params.get('access_token');
                 const refreshToken = params.get('refresh_token');

                 if (code) {
                     await supabase.auth.exchangeCodeForSession(code);
                 } else if (accessToken && refreshToken) {
                     await supabase.auth.setSession({
                         access_token: accessToken,
                         refresh_token: refreshToken,
                     });
                 }
                 
                 // Close auth modal if open
                 setShowAuthModal(false);
                 setShowAuthSuccess(true);
                 setTimeout(() => setShowAuthSuccess(false), 4000);
             }
         } catch (e) {
             console.error("Deep Link Auth Error:", e);
         }
      });
    };

    setupListeners();
    return () => { 
        if (backButtonListener) backButtonListener.remove(); 
        if (urlListener) urlListener.remove();
    };
  }, [
    stateRef,
    setShowSettings,
    setShowHistory,
    setShowPreviewModal,
    setShowTextModal,
    setShowBarcodeModal,
    setShowCorrectionModal,
    setShowAuthModal,
    setShowSubscriptionModal,
    setShowPrivacy,
    setShowTerms,
    setResult,
    setError,
    setImages,
    setAnalyzedTextContent,
    setIsLoading,
    setShowAuthSuccess,
    setShowENumbersModal,
    setShowQueueModal
  ]);
};
